from __future__ import annotations

import html
import ipaddress
import json
import os
import re
import socket
import tempfile
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlparse

import httpx
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, HttpUrl

from .analyzer import analyze_audio

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
ALLOWED = {".wav", ".mp3", ".m4a", ".flac", ".ogg", ".aac"}
AUDIO_TYPES = {
    "audio/mpeg": ".mp3", "audio/mp3": ".mp3", "audio/wav": ".wav",
    "audio/x-wav": ".wav", "audio/flac": ".flac", "audio/ogg": ".ogg",
    "audio/mp4": ".m4a", "audio/x-m4a": ".m4a", "audio/aac": ".aac",
}
MAX_BYTES = 80 * 1024 * 1024
MAX_PAGE_BYTES = 3 * 1024 * 1024
USER_AGENT = "ChordMap/0.3.1"

app = FastAPI(title="ChordMap", version="0.3.1")
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


class UrlRequest(BaseModel):
    url: HttpUrl


class AudioPageParser(HTMLParser):
    KEYS = {
        "og:audio", "og:audio:url", "og:audio:secure_url",
        "twitter:player:stream", "twitter:audio:src", "contenturl",
        "audiourl", "audio_url", "previewurl", "preview_url",
    }

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.urls: list[str] = []
        self.title_parts: list[str] = []
        self.in_title = False
        self.in_jsonld = False
        self.jsonld: list[str] = []

    def handle_starttag(self, tag, attrs):
        a = {k.lower(): (v or "") for k, v in attrs}
        tag = tag.lower()
        if tag == "title":
            self.in_title = True
        elif tag == "meta":
            key = (a.get("property") or a.get("name") or a.get("itemprop") or "").lower()
            if key in self.KEYS and a.get("content"):
                self.urls.append(a["content"])
        elif tag == "audio" and a.get("src"):
            self.urls.append(a["src"])
        elif tag == "source" and a.get("src") and (not a.get("type") or a["type"].lower().startswith("audio/")):
            self.urls.append(a["src"])
        elif tag == "link" and a.get("href") and a.get("type", "").lower().startswith("audio/"):
            self.urls.append(a["href"])
        elif tag == "script" and "ld+json" in a.get("type", "").lower():
            self.in_jsonld, self.jsonld = True, []

    def handle_endtag(self, tag):
        tag = tag.lower()
        if tag == "title":
            self.in_title = False
        elif tag == "script" and self.in_jsonld:
            self.in_jsonld = False
            try:
                self._json_urls(json.loads("".join(self.jsonld)))
            except Exception:
                pass

    def handle_data(self, data):
        if self.in_title:
            self.title_parts.append(data.strip())
        if self.in_jsonld:
            self.jsonld.append(data)

    def _json_urls(self, value):
        if isinstance(value, dict):
            for key, child in value.items():
                if key.replace("_", "").lower() in {"contenturl", "audiourl", "previewurl", "audiopreviewurl"} and isinstance(child, str):
                    self.urls.append(child)
                else:
                    self._json_urls(child)
        elif isinstance(value, list):
            for child in value:
                self._json_urls(child)

    @property
    def candidates(self):
        return self.urls

    @property
    def title(self):
        return " ".join(x for x in self.title_parts if x).strip()


_AudioCandidateParser = AudioPageParser


@app.get("/", response_class=HTMLResponse)
def index():
    text = (STATIC_DIR / "index.html").read_text(encoding="utf-8")
    text = text.replace("ChordMap V0.3", "ChordMap V0.3.1")
    text = text.replace(
        "貼你有權使用的直接音訊網址，或上傳整首歌曲。系統會估算 Key、BPM、歌曲結構與完整和弦時間軸，並輸出可下載的整首和弦圖。",
        "可貼一般歌曲頁、公開音訊網址，或上傳整首歌曲。系統會先找頁面公開的 audio / preview，再分析 Key、BPM、歌曲結構與和弦時間軸。",
    )
    text = text.replace(
        "支援可直接取得的 MP3 / WAV / M4A / FLAC / OGG / AAC，單檔上限 80 MB。YouTube、Spotify、Apple Music、SoundCloud 一般播放頁不會繞過平台限制抓音訊。",
        "一般歌曲頁也能貼：會解析頁面公開的 audio、OG audio、contentUrl 或 preview。若平台沒有公開音訊會明確提示；preview 不會假裝成整首歌。單檔上限 80 MB。",
    )
    text = text.replace(
        "const data=await res.json(); audio.src=url; audio.load(); render(data, decodeURIComponent(url.split('/').pop() || 'URL audio')); setStatus('完成。可以播放、移調、看同步和弦並輸出 PNG。','ok');",
        "const data=await res.json(); const resolved=data.source?.resolved_audio_url||url; audio.src=resolved; audio.load(); const name=data.source?.page_title||decodeURIComponent(url.split('/').pop()||'URL audio'); render(data,name); if(data.source?.scope==='preview') setStatus('已分析公開 preview；這不是整首歌，結果只代表預覽片段。'); else setStatus('完成。已從網址取得可分析音訊。','ok');",
    )
    return HTMLResponse(text)


@app.get("/health")
def health():
    return JSONResponse({"ok": True, "service": "ChordMap", "version": "0.3.1"})


def safe_url(raw: str) -> str:
    p = urlparse(raw)
    if p.scheme not in {"http", "https"} or not p.hostname:
        raise HTTPException(400, "只支援有效的 http / https 網址。")
    host = p.hostname.lower()
    if host in {"localhost", "localhost.localdomain"} or host.endswith(".local"):
        raise HTTPException(400, "不允許分析本機或內網網址。")
    try:
        infos = socket.getaddrinfo(host, p.port or (443 if p.scheme == "https" else 80), proto=socket.IPPROTO_TCP)
    except socket.gaierror as exc:
        raise HTTPException(400, "無法解析此網址的主機。") from exc
    if any(not ipaddress.ip_address(info[4][0]).is_global for info in infos):
        raise HTTPException(400, "不允許分析本機、私有網路或保留位址。")
    return raw


def suffix_for(url: str, content_type: str) -> str:
    suffix = Path(urlparse(url).path).suffix.lower()
    if suffix in ALLOWED:
        return suffix
    return AUDIO_TYPES.get(content_type.split(";", 1)[0].strip().lower(), "")


def platform_page(url: str) -> bool:
    host = (urlparse(url).hostname or "").lower()
    return any(host == x or host.endswith("." + x) for x in ("youtube.com", "youtu.be", "spotify.com", "music.apple.com", "soundcloud.com"))


def page_candidates(page_url: str, body: str) -> tuple[list[str], str]:
    parser = AudioPageParser()
    try:
        parser.feed(body)
    except Exception:
        pass
    raw = list(parser.urls)
    raw += re.findall(r'''["'](?:previewUrl|preview_url|audioPreviewUrl|audio_preview_url|contentUrl|audioUrl|audio_url)["']\s*:\s*["']([^"']+)["']''', body, re.I)
    raw += re.findall(r'''https?:\\?/\\?/[^\s"'<>]+?\.(?:mp3|m4a|aac|ogg|wav|flac)(?:\?[^\s"'<>]*)?''', body, re.I)
    out, seen = [], set()
    for item in raw:
        item = html.unescape(item.strip().strip("'\"")).replace("\\/", "/").replace("\\u0026", "&")
        if not item or item.startswith(("data:", "blob:", "javascript:")):
            continue
        try:
            resolved = safe_url(urljoin(page_url, item))
        except HTTPException:
            continue
        if resolved not in seen:
            seen.add(resolved)
            out.append(resolved)
        if len(out) >= 16:
            break
    return out, parser.title


async def open_public(client: httpx.AsyncClient, raw: str) -> tuple[str, httpx.Response]:
    current = safe_url(raw)
    for _ in range(5):
        response = await client.send(client.build_request("GET", current, headers={"User-Agent": USER_AGENT, "Accept": "*/*"}), stream=True)
        if response.status_code in {301, 302, 303, 307, 308}:
            location = response.headers.get("location")
            await response.aclose()
            if not location:
                raise HTTPException(400, "遠端網址回傳無效重新導向。")
            current = safe_url(str(httpx.URL(current).join(location)))
            continue
        return current, response
    raise HTTPException(400, "遠端網址重新導向次數過多。")


async def save_audio(response: httpx.Response, url: str) -> str:
    try:
        if response.status_code >= 400:
            raise HTTPException(400, f"無法取得音訊（HTTP {response.status_code}）。")
        suffix = suffix_for(url, response.headers.get("content-type", ""))
        if not suffix:
            raise HTTPException(415, "候選網址不是可直接取得的音訊。")
        length = response.headers.get("content-length", "")
        if length.isdigit() and int(length) > MAX_BYTES:
            raise HTTPException(413, "遠端音訊太大，目前上限 80 MB。")
        size, path = 0, None
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            path = tmp.name
            async for chunk in response.aiter_bytes(256 * 1024):
                size += len(chunk)
                if size > MAX_BYTES:
                    raise HTTPException(413, "遠端音訊太大，目前上限 80 MB。")
                tmp.write(chunk)
        if not size:
            if path and os.path.exists(path):
                os.unlink(path)
            raise HTTPException(400, "遠端音訊內容是空的。")
        return path
    finally:
        await response.aclose()


async def read_page(response: httpx.Response) -> str:
    data = bytearray()
    try:
        if response.status_code >= 400:
            raise HTTPException(400, f"無法取得歌曲頁面（HTTP {response.status_code}）。")
        async for chunk in response.aiter_bytes(128 * 1024):
            data.extend(chunk)
            if len(data) > MAX_PAGE_BYTES:
                raise HTTPException(413, "歌曲頁面太大，無法安全解析。")
    finally:
        await response.aclose()
    return bytes(data).decode("utf-8", errors="replace")


@app.post("/api/analyze")
async def analyze(file: UploadFile = File(...)):
    suffix = Path(file.filename or "audio").suffix.lower()
    if suffix not in ALLOWED:
        raise HTTPException(400, f"不支援的檔案格式：{suffix or '未知'}")
    data = await file.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise HTTPException(413, "檔案太大，目前上限 80 MB。")
    path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(data)
            path = tmp.name
        result = analyze_audio(path)
        result["source"] = {"type": "upload", "name": file.filename or "audio", "scope": "full"}
        return result
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(422, f"分析失敗：{exc}") from exc
    finally:
        if path and os.path.exists(path):
            os.unlink(path)


@app.post("/api/analyze-url")
async def analyze_url(request: UrlRequest):
    raw_url, path, resolved, title, input_kind = str(request.url), None, None, "", "direct_audio"
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(50.0, connect=10.0), follow_redirects=False) as client:
            current, response = await open_public(client, raw_url)
            if suffix_for(current, response.headers.get("content-type", "")):
                path, resolved = await save_audio(response, current), current
            else:
                input_kind = "page"
                body = await read_page(response)
                candidates, title = page_candidates(current, body)
                if not candidates:
                    msg = "歌曲頁網址已接受，但平台沒有公開可供分析的音訊/preview。要抓整首歌仍需要你有權使用的完整音訊檔。" if platform_page(raw_url) else "已讀取網頁，但頁面沒有公開 audio、OG audio、contentUrl 或 preview 可分析。"
                    raise HTTPException(400, msg)
                for candidate in candidates:
                    try:
                        c_url, c_response = await open_public(client, candidate)
                        if not suffix_for(c_url, c_response.headers.get("content-type", "")):
                            await c_response.aclose()
                            continue
                        path, resolved = await save_audio(c_response, c_url), c_url
                        break
                    except (HTTPException, httpx.RequestError):
                        continue
                if not path:
                    raise HTTPException(400, "找到公開音訊候選，但目前都無法直接取得；可能需要登入、授權或是受保護串流。")
        result = analyze_audio(path)
        scope = "preview" if any(x in (resolved or "").lower() for x in ("preview", "sample", "snippet")) else "full_or_public_audio"
        result["source"] = {"type": "url", "input_kind": input_kind, "url": raw_url, "page_title": title or None, "resolved_audio_url": resolved, "scope": scope}
        return result
    except HTTPException:
        raise
    except httpx.RequestError as exc:
        raise HTTPException(400, f"取得歌曲頁/音訊失敗：{exc}") from exc
    except Exception as exc:
        raise HTTPException(422, f"分析失敗：{exc}") from exc
    finally:
        if path and os.path.exists(path):
            os.unlink(path)
