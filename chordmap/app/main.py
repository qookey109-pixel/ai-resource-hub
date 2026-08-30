from __future__ import annotations

import ipaddress
import os
import socket
import tempfile
from pathlib import Path
from urllib.parse import urlparse

import httpx
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, HttpUrl

from .analyzer import analyze_audio

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
ALLOWED = {".wav", ".mp3", ".m4a", ".flac", ".ogg", ".aac"}
AUDIO_TYPES = {
    "audio/mpeg": ".mp3",
    "audio/mp3": ".mp3",
    "audio/wav": ".wav",
    "audio/x-wav": ".wav",
    "audio/flac": ".flac",
    "audio/ogg": ".ogg",
    "audio/mp4": ".m4a",
    "audio/x-m4a": ".m4a",
    "audio/aac": ".aac",
}
MAX_BYTES = 80 * 1024 * 1024

app = FastAPI(title="ChordMap", version="0.3.0")
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


class UrlRequest(BaseModel):
    url: HttpUrl


@app.get("/")
def index():
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/health")
def health():
    return JSONResponse({"ok": True, "service": "ChordMap", "version": "0.3.0"})


def _safe_public_url(raw_url: str) -> str:
    parsed = urlparse(raw_url)
    if parsed.scheme not in {"http", "https"}:
        raise HTTPException(status_code=400, detail="只支援 http / https 音訊網址。")
    if not parsed.hostname:
        raise HTTPException(status_code=400, detail="網址缺少主機名稱。")

    host = parsed.hostname.lower()
    if host in {"localhost", "localhost.localdomain"} or host.endswith(".local"):
        raise HTTPException(status_code=400, detail="不允許分析本機或內網網址。")

    try:
        infos = socket.getaddrinfo(
            host,
            parsed.port or (443 if parsed.scheme == "https" else 80),
            proto=socket.IPPROTO_TCP,
        )
    except socket.gaierror as exc:
        raise HTTPException(status_code=400, detail="無法解析此網址的主機。") from exc

    for info in infos:
        ip = ipaddress.ip_address(info[4][0])
        if not ip.is_global:
            raise HTTPException(status_code=400, detail="不允許分析本機、私有網路或保留位址。")
    return raw_url


def _suffix_from_response(url: str, content_type: str) -> str:
    suffix = Path(urlparse(url).path).suffix.lower()
    if suffix in ALLOWED:
        return suffix
    mime = content_type.split(";", 1)[0].strip().lower()
    return AUDIO_TYPES.get(mime, "")


def _looks_like_platform_page(url: str) -> bool:
    host = (urlparse(url).hostname or "").lower()
    known = ("youtube.com", "youtu.be", "spotify.com", "music.apple.com", "soundcloud.com")
    return any(host == item or host.endswith("." + item) for item in known)


@app.post("/api/analyze")
async def analyze(file: UploadFile = File(...)):
    suffix = Path(file.filename or "audio").suffix.lower()
    if suffix not in ALLOWED:
        raise HTTPException(status_code=400, detail=f"不支援的檔案格式：{suffix or '未知'}")

    data = await file.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="檔案太大，目前上限 80 MB。")

    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(data)
            tmp_path = tmp.name
        result = analyze_audio(tmp_path)
        result["source"] = {"type": "upload", "name": file.filename or "audio"}
        return result
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"分析失敗：{exc}") from exc
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)


@app.post("/api/analyze-url")
async def analyze_url(request: UrlRequest):
    raw_url = str(request.url)
    if _looks_like_platform_page(raw_url):
        raise HTTPException(
            status_code=400,
            detail="這是串流平台播放頁，不是直接音訊檔。請改貼你有權使用的 MP3/WAV/M4A 直連，或直接上傳音檔。",
        )

    safe_url = _safe_public_url(raw_url)
    tmp_path = None
    try:
        timeout = httpx.Timeout(45.0, connect=10.0)
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=False) as client:
            current = safe_url
            for _ in range(4):
                async with client.stream("GET", current, headers={"User-Agent": "ChordMap/0.3"}) as response:
                    if response.status_code in {301, 302, 303, 307, 308}:
                        location = response.headers.get("location")
                        if not location:
                            raise HTTPException(status_code=400, detail="遠端網址回傳無效重新導向。")
                        current = _safe_public_url(str(httpx.URL(current).join(location)))
                        continue

                    if response.status_code >= 400:
                        raise HTTPException(status_code=400, detail=f"無法取得音訊網址（HTTP {response.status_code}）。")

                    content_type = response.headers.get("content-type", "")
                    suffix = _suffix_from_response(current, content_type)
                    if not suffix:
                        raise HTTPException(
                            status_code=400,
                            detail="這個網址看起來不是可直接取得的音訊檔。請使用 MP3/WAV/M4A/FLAC/OGG/AAC 直連。",
                        )

                    content_length = response.headers.get("content-length")
                    if content_length and content_length.isdigit() and int(content_length) > MAX_BYTES:
                        raise HTTPException(status_code=413, detail="遠端音訊太大，目前上限 80 MB。")

                    size = 0
                    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
                        tmp_path = tmp.name
                        async for chunk in response.aiter_bytes(1024 * 256):
                            size += len(chunk)
                            if size > MAX_BYTES:
                                raise HTTPException(status_code=413, detail="遠端音訊太大，目前上限 80 MB。")
                            tmp.write(chunk)
                    if size == 0:
                        raise HTTPException(status_code=400, detail="遠端音訊內容是空的。")
                    break
            else:
                raise HTTPException(status_code=400, detail="遠端網址重新導向次數過多。")

        if not tmp_path:
            raise HTTPException(status_code=400, detail="無法取得遠端音訊。")

        result = analyze_audio(tmp_path)
        result["source"] = {"type": "url", "url": raw_url}
        return result
    except HTTPException:
        raise
    except httpx.RequestError as exc:
        raise HTTPException(status_code=400, detail=f"取得音訊失敗：{exc}") from exc
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"分析失敗：{exc}") from exc
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)
