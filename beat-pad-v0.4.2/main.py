from __future__ import annotations

import asyncio
import json
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from urllib.parse import parse_qs, quote, urlparse

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, JSONResponse, Response
from pydantic import BaseModel, Field

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
MAX_DURATION_SECONDS = 10 * 60
DOWNLOAD_TIMEOUT_SECONDS = 180
INFO_TIMEOUT_SECONDS = 60

app = FastAPI(title="Qookey Beat Pad V0.4.3", version="0.4.3")
youtube_lock = asyncio.Semaphore(1)


class YouTubeRequest(BaseModel):
    url: str = Field(min_length=8, max_length=2048)


VIDEO_ID_RE = re.compile(r"^[A-Za-z0-9_-]{11}$")


def canonicalize_youtube_url(value: str) -> tuple[str, str]:
    """Return canonical single-video YouTube URL and video id.

    Mix/playlist/query parameters such as list=, index=, start_radio= and si=
    are deliberately discarded so a watch URL is always treated as one video.
    """
    value = value.strip()
    try:
        parsed = urlparse(value)
    except Exception as exc:
        raise ValueError("YouTube 網址格式錯誤。") from exc

    if parsed.scheme not in {"http", "https"}:
        raise ValueError("只接受 http / https YouTube 網址。")

    host = (parsed.hostname or "").lower().rstrip(".")
    allowed = {
        "youtube.com",
        "www.youtube.com",
        "m.youtube.com",
        "music.youtube.com",
        "youtu.be",
        "www.youtu.be",
    }
    if host not in allowed:
        raise ValueError("目前只接受 youtube.com 或 youtu.be 網址。")

    video_id = ""

    if host in {"youtu.be", "www.youtu.be"}:
        video_id = parsed.path.strip("/").split("/")[0]
    else:
        path = parsed.path.rstrip("/")
        if path == "/watch":
            video_id = parse_qs(parsed.query).get("v", [""])[0]
        elif path.startswith("/shorts/"):
            video_id = path.split("/shorts/", 1)[1].split("/")[0]
        elif path.startswith("/embed/"):
            video_id = path.split("/embed/", 1)[1].split("/")[0]
        elif path.startswith("/live/"):
            video_id = path.split("/live/", 1)[1].split("/")[0]

    if not VIDEO_ID_RE.fullmatch(video_id):
        raise ValueError("找不到有效的 YouTube Video ID。請貼單支影片網址。")

    canonical = f"https://www.youtube.com/watch?v={video_id}"
    return canonical, video_id


def command_error(proc: subprocess.CompletedProcess[str], fallback: str) -> str:
    text = (proc.stderr or proc.stdout or "").strip()
    if not text:
        return fallback
    last = text.splitlines()[-1].strip()
    if len(last) > 280:
        last = last[:280] + "…"
    return last


def run_cmd(args: list[str], timeout: int) -> subprocess.CompletedProcess[str]:
    try:
        return subprocess.run(
            args,
            check=False,
            text=True,
            capture_output=True,
            timeout=timeout,
        )
    except subprocess.TimeoutExpired as exc:
        raise RuntimeError("處理逾時，請稍後再試或換較短的影片。") from exc


def yt_dlp_runtime_args() -> list[str]:
    """Use a supported JS runtime for current YouTube challenge solving."""
    if shutil.which("deno"):
        return ["--js-runtimes", "deno"]
    if shutil.which("node"):
        return ["--js-runtimes", "node"]
    return []


def extract_youtube_audio(url: str) -> tuple[bytes, dict]:
    if shutil.which("ffmpeg") is None:
        raise RuntimeError("伺服器缺少 FFmpeg。")

    with tempfile.TemporaryDirectory(prefix="beatpad-yt-") as tmp:
        tmpdir = Path(tmp)

        info_cmd = [
            sys.executable, "-m", "yt_dlp",
            *yt_dlp_runtime_args(),
            "--no-playlist",
            "--skip-download",
            "--dump-single-json",
            "--no-warnings",
            "--socket-timeout", "20",
            url,
        ]
        info_proc = run_cmd(info_cmd, INFO_TIMEOUT_SECONDS)
        if info_proc.returncode != 0:
            raise RuntimeError(command_error(info_proc, "無法讀取 YouTube 影片資訊。"))

        try:
            info = json.loads(info_proc.stdout)
        except json.JSONDecodeError as exc:
            raise RuntimeError("YouTube 回傳的影片資訊無法解析。") from exc

        duration = info.get("duration")
        if not isinstance(duration, (int, float)) or duration <= 0:
            raise RuntimeError("無法確認影片長度。")
        if duration > MAX_DURATION_SECONDS:
            raise RuntimeError("目前最多分析 10 分鐘的 YouTube 影片。")

        if info.get("is_live"):
            raise RuntimeError("目前不支援 YouTube 直播。")

        template = str(tmpdir / "source.%(ext)s")
        download_cmd = [
            sys.executable, "-m", "yt_dlp",
            *yt_dlp_runtime_args(),
            "--no-playlist",
            "--no-warnings",
            "--socket-timeout", "20",
            "--retries", "2",
            "-f", "bestaudio/best",
            "-o", template,
            url,
        ]
        dl_proc = run_cmd(download_cmd, DOWNLOAD_TIMEOUT_SECONDS)
        if dl_proc.returncode != 0:
            raise RuntimeError(command_error(dl_proc, "YouTube 音訊下載失敗。"))

        candidates = [
            p for p in tmpdir.glob("source.*")
            if p.is_file() and p.suffix.lower() not in {".part", ".ytdl", ".json"}
        ]
        if not candidates:
            raise RuntimeError("沒有取得可分析的 YouTube 音訊。")

        source = max(candidates, key=lambda p: p.stat().st_size)
        wav = tmpdir / "analysis.wav"

        ffmpeg_cmd = [
            "ffmpeg",
            "-hide_banner",
            "-loglevel", "error",
            "-y",
            "-i", str(source),
            "-vn",
            "-ac", "1",
            "-ar", "11025",
            "-c:a", "pcm_s16le",
            str(wav),
        ]
        ff_proc = run_cmd(ffmpeg_cmd, 120)
        if ff_proc.returncode != 0 or not wav.exists():
            raise RuntimeError(command_error(ff_proc, "FFmpeg 音訊轉換失敗。"))

        data = wav.read_bytes()
        if not data:
            raise RuntimeError("分析用 WAV 是空檔案。")

        meta = {
            "title": str(info.get("title") or "YouTube"),
            "duration": float(duration),
            "id": str(info.get("id") or ""),
            "uploader": str(info.get("uploader") or info.get("channel") or ""),
        }
        return data, meta


@app.get("/")
def index() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/api/health")
def health() -> JSONResponse:
    try:
        import yt_dlp  # noqa: F401
        yt_dlp_ok = True
    except Exception:
        yt_dlp_ok = False

    runtime = "deno" if shutil.which("deno") else ("node" if shutil.which("node") else None)
    return JSONResponse({
        "ok": bool(shutil.which("ffmpeg") and yt_dlp_ok and runtime),
        "ffmpeg": bool(shutil.which("ffmpeg")),
        "deno": bool(shutil.which("deno")),
        "node": bool(shutil.which("node")),
        "js_runtime": runtime,
        "yt_dlp": yt_dlp_ok,
        "max_duration_seconds": MAX_DURATION_SECONDS,
    })


@app.post("/api/youtube-audio")
async def youtube_audio(payload: YouTubeRequest) -> Response:
    try:
        url, video_id = canonicalize_youtube_url(payload.url)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    async with youtube_lock:
        try:
            data, meta = await asyncio.to_thread(extract_youtube_audio, url)
        except RuntimeError as exc:
            message = str(exc)
            lower = message.lower()
            if "sign in to confirm" in lower or "not a bot" in lower or "login_required" in lower:
                raise HTTPException(
                    status_code=422,
                    detail={
                        "code": "YOUTUBE_AUTH_REQUIRED",
                        "message": "YouTube 暫時封鎖這個雲端 IP，需要登入驗證。請改用 TurboScribe 轉成 MP3，再把檔案丟回本站分析。",
                    },
                ) from exc
            raise HTTPException(status_code=422, detail={"code": "YOUTUBE_FETCH_FAILED", "message": message}) from exc
        except Exception as exc:
            raise HTTPException(status_code=500, detail="YouTube 音訊處理發生未預期錯誤。") from exc

    headers = {
        "X-Video-Title": quote(meta["title"][:180], safe=""),
        "X-Video-Duration": str(meta["duration"]),
        "X-Video-Id": (meta["id"] or video_id)[:64],
        "X-Canonical-Url": quote(url, safe=""),
        "Cache-Control": "no-store",
    }
    return Response(content=data, media_type="audio/wav", headers=headers)
