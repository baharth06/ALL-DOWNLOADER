from __future__ import annotations

import asyncio
import contextlib
import mimetypes
import os
import re
import secrets
import shutil
import time
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any
from urllib.parse import urljoin, urlparse

import httpx
from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field

from .models import Job
from .providers.direct import DirectProvider, safe_request
from .providers.factory import get_provider
from .rate_limit import limiter
from .security import assert_safe_url

DATA = Path(os.getenv('WORKER_DATA_DIR', './data')).resolve()
DATA.mkdir(parents=True, exist_ok=True)
MAX_FILE_BYTES = int(os.getenv('MAX_FILE_BYTES', str(1024 * 1024 * 1024)))
RETENTION = int(os.getenv('RETENTION_SECONDS', str(3600)))
TOKEN = os.getenv('MEDIA_WORKER_TOKEN', '')
PUBLIC = os.getenv('PUBLIC_WORKER_URL', 'http://127.0.0.1:8000').rstrip('/')
ALLOWED_ORIGIN = os.getenv('ALLOWED_ORIGIN', 'http://localhost:3000')
MAX_CONCURRENT_JOBS = max(1, int(os.getenv('MAX_CONCURRENT_JOBS', '2')))
ANALYZE_CACHE_SECONDS = int(os.getenv('ANALYZE_CACHE_SECONDS', '300'))
ANALYZE_CACHE_MAX = int(os.getenv('ANALYZE_CACHE_MAX', '32'))
ENVIRONMENT = os.getenv('ENVIRONMENT', 'development').lower()

jobs: dict[str, Job] = {}
tasks: dict[str, asyncio.Task] = {}
job_semaphore = asyncio.Semaphore(MAX_CONCURRENT_JOBS)
analyze_cache: dict[str, tuple[float, dict[str, Any]]] = {}
raw_info_cache: dict[str, tuple[float, dict[str, Any]]] = {}


class AnalyzeRequest(BaseModel):
    url: str = Field(min_length=10, max_length=4096)


class DownloadRequest(BaseModel):
    url: str = Field(min_length=10, max_length=4096)
    formatId: str = Field(min_length=1, max_length=100)
    quality: str = Field(default='best', max_length=30)
    format: str = Field(default='original', max_length=20)


def auth(x_worker_token: str | None):
    if ENVIRONMENT == 'production' and not TOKEN:
        raise HTTPException(503, 'Worker authentication is not configured.')
    if TOKEN and x_worker_token != TOKEN:
        raise HTTPException(401, 'Unauthorized')


def safe_filename(value: str, ext: str):
    base = re.sub(r'[^A-Za-z0-9._-]+', '_', value).strip('._')[:80] or 'download'
    if not base.lower().endswith('.' + ext.lower()):
        base += '.' + ext.lower()
    return base


def public_job(job: Job):
    return job.public()


def check_runtime() -> dict[str, Any]:
    ffmpeg = shutil.which('ffmpeg') is not None
    deno = shutil.which('deno') is not None
    try:
        import yt_dlp
        yt_version = yt_dlp.version.__version__
    except Exception:
        yt_version = None
    return {'ffmpeg': ffmpeg, 'deno': deno, 'yt_dlp': yt_version}


@asynccontextmanager
async def lifespan(app: FastAPI):
    if ENVIRONMENT == 'production':
        if not TOKEN or not PUBLIC.startswith('https://'):
            raise RuntimeError('Production worker requires MEDIA_WORKER_TOKEN and a public HTTPS PUBLIC_WORKER_URL.')
        runtime = check_runtime()
        missing = [name for name, ready in runtime.items() if not ready]
        if missing:
            raise RuntimeError(f'Production worker runtime is incomplete: {", ".join(missing)}')
    cleanup_task = asyncio.create_task(cleanup_loop())
    try:
        yield
    finally:
        cleanup_task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await cleanup_task
        pending = list(tasks.values())
        for task in pending:
            task.cancel()
        if pending:
            await asyncio.gather(*pending, return_exceptions=True)


app = FastAPI(title='All Downloader Media Worker', version='3.0.0', lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[ALLOWED_ORIGIN],
    allow_credentials=False,
    allow_methods=['GET', 'POST', 'DELETE'],
    allow_headers=['content-type', 'x-worker-token'],
)


@app.middleware('http')
async def request_guard(request: Request, call_next):
    if request.url.path in {'/analyze', '/download'} and request.method == 'POST':
        key = (
            request.headers.get('x-forwarded-for', '').split(',')[0].strip()
            or (request.client.host if request.client else 'unknown')
        )
        if not limiter.check(key):
            return JSONResponse(
                {'detail': 'Rate limit exceeded. Try again later.'},
                status_code=429,
                headers={'Retry-After': '60'},
            )

    response = await call_next(request)
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
    response.headers['X-Robots-Tag'] = 'noindex, nofollow'
    response.headers['X-Frame-Options'] = 'DENY'
    return response


@app.get('/health')
async def health():
    runtime = check_runtime()
    return {
        'ok': bool(runtime['ffmpeg'] and runtime['deno'] and runtime['yt_dlp']),
        'worker': 'all-downloader',
        'version': '3.0.0',
        'active_jobs': sum(1 for job in jobs.values() if job.status in {'queued', 'analyzing', 'downloading', 'processing'}),
        'max_concurrent_jobs': MAX_CONCURRENT_JOBS,
        'runtime': runtime,
    }


@app.post('/analyze')
async def analyze(req: AnalyzeRequest, x_worker_token: str | None = Header(default=None)):
    auth(x_worker_token)
    try:
        assert_safe_url(req.url, allow_generic=True)
        now = time.time()
        cached = analyze_cache.get(req.url)
        if cached and now - cached[0] < ANALYZE_CACHE_SECONDS:
            return cached[1]

        provider = get_provider(req.url)
        raw_info = None
        if hasattr(provider, 'get_info_for_download'):
            raw_info = await provider.get_info_for_download(req.url)
            result = provider._normalize(raw_info)  # type: ignore[attr-defined]
            raw_info_cache[req.url] = (now, raw_info)
        else:
            result = await provider.analyze(req.url)
        if not result.get('formats'):
            raise ValueError('No downloadable formats were returned by the source.')
        analyze_cache[req.url] = (now, result)
        if len(analyze_cache) > ANALYZE_CACHE_MAX:
            oldest = min(analyze_cache.items(), key=lambda item: item[1][0])[0]
            analyze_cache.pop(oldest, None)
        if len(raw_info_cache) > ANALYZE_CACHE_MAX:
            oldest = min(raw_info_cache.items(), key=lambda item: item[1][0])[0]
            raw_info_cache.pop(oldest, None)
        return result
    except HTTPException:
        raise
    except Exception as exc:
        print(f'analyze failed: {type(exc).__name__}: {exc}')
        raise HTTPException(400, 'This content cannot be downloaded from this source.') from exc


@app.post('/download')
async def create_download(req: DownloadRequest, x_worker_token: str | None = Header(default=None)):
    auth(x_worker_token)
    if req.format not in {'mp4', 'webm', 'mp3', 'aac', 'original'}:
        raise HTTPException(400, 'Unsupported output format.')
    assert_safe_url(req.url, allow_generic=True)

    active = sum(1 for job in jobs.values() if job.status in {'queued', 'analyzing', 'downloading', 'processing'})
    if active >= MAX_CONCURRENT_JOBS * 4:
        raise HTTPException(429, 'The worker is busy. Please retry shortly.')

    jid = str(uuid.uuid4())
    file_token = secrets.token_urlsafe(32)
    jobs[jid] = Job(id=jid, status='queued', file_token=file_token)
    tasks[jid] = asyncio.create_task(run_job(jid, req.model_dump()))
    return public_job(jobs[jid])


@app.get('/download/{jid}')
async def get_job(jid: str, x_worker_token: str | None = Header(default=None)):
    auth(x_worker_token)
    job = jobs.get(jid)
    if not job:
        raise HTTPException(404, 'Job not found.')
    return public_job(job)


@app.delete('/download/{jid}')
async def cancel_job(jid: str, x_worker_token: str | None = Header(default=None)):
    auth(x_worker_token)
    job = jobs.get(jid)
    if not job:
        raise HTTPException(404, 'Job not found.')
    task = tasks.get(jid)
    if task and not task.done() and job.status not in {'completed', 'failed', 'cancelled'}:
        task.cancel()
        job.status = 'cancelled'
        job.error = None
    return JSONResponse(public_job(job))


@app.get('/files/{filename}')
async def file_download(filename: str, token: str | None = None):
    target = (DATA / filename).resolve()
    if target.parent != DATA or not target.is_file():
        raise HTTPException(404, 'File not found.')

    jid = filename.split('__', 1)[0]
    job = jobs.get(jid)
    if not job or not token or not job.file_token or not secrets.compare_digest(token, job.file_token):
        raise HTTPException(403, 'Invalid download link.')

    return FileResponse(target, filename=filename, headers={
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        'Content-Disposition': f'attachment; filename="{filename}"',
    })


async def run_job(jid: str, req: dict[str, Any]):
    job = jobs[jid]
    async with job_semaphore:
        try:
            job.status = 'analyzing'
            provider = get_provider(req['url'])
            if isinstance(provider, DirectProvider):
                await download_direct(jid, req)
            else:
                cached = raw_info_cache.get(req['url'])
                if cached and time.time() - cached[0] < ANALYZE_CACHE_SECONDS:
                    info = cached[1]
                else:
                    info = await provider.get_info_for_download(req['url'])
                await download_ytdlp(jid, req, info)
        except asyncio.CancelledError:
            job.status = 'cancelled'
            raise
        except Exception as exc:
            job.status = 'failed'
            job.error = 'The download could not be completed for this source.'
            print(f'job {jid} failed: {type(exc).__name__}: {exc}')
        finally:
            tasks.pop(jid, None)


async def download_direct(jid: str, req: dict[str, Any]):
    job = jobs[jid]
    temp = DATA / f'{jid}.part'
    try:
        timeout = httpx.Timeout(30, read=120)
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=False, trust_env=False) as client:
            response, final_url = await safe_request(client, req['url'], method='GET')
            try:
                response.raise_for_status()
                content_type = (response.headers.get('content-type') or '').split(';')[0].lower()
                if not (content_type.startswith('video/') or content_type.startswith('audio/') or content_type.startswith('image/')):
                    raise ValueError('Unsupported direct media type.')
                total = int(response.headers.get('content-length') or 0)
                if total and total > MAX_FILE_BYTES:
                    raise ValueError('Source file exceeds the configured size limit.')
                job.total_bytes = total or None
                job.status = 'downloading'
                with open(temp, 'wb') as handle:
                    async for chunk in response.aiter_bytes(1024 * 1024):
                        handle.write(chunk)
                        job.downloaded_bytes += len(chunk)
                        if job.downloaded_bytes > MAX_FILE_BYTES:
                            raise ValueError('Source file exceeds the configured size limit.')
                        if job.total_bytes:
                            job.progress = min(99, job.downloaded_bytes / job.total_bytes * 100)
            finally:
                response.close()

        parsed = urlparse(final_url)
        original_ext = Path(parsed.path).suffix.lstrip('.').lower() or mimetypes.guess_extension(content_type) or 'bin'
        if req.get('format') != 'original':
            raise ValueError('This direct source supports its original accessible media format only.')

        final = DATA / f'{jid}__{safe_filename(Path(parsed.path).name or jid, original_ext)}'
        shutil.move(temp, final)
        job.status = 'completed'
        job.progress = 100
        job.filename = final.name
        job.download_url = f'{PUBLIC}/files/{final.name}?token={job.file_token}'
    finally:
        temp.unlink(missing_ok=True)


async def download_ytdlp(jid: str, req: dict[str, Any], info: dict[str, Any]):
    job = jobs[jid]
    import yt_dlp

    available = {str(item.get('format_id')) for item in (info.get('formats') or []) if item.get('format_id')}
    if req['formatId'] not in available:
        raise ValueError('Requested source format is no longer available.')

    selected = next((item for item in info.get('formats', []) if str(item.get('format_id')) == req['formatId']), None)
    if not selected:
        raise ValueError('Requested source format is no longer available.')

    output_template = str(DATA / f'{jid}-%(title).80s.%(ext)s')
    output_format = req['format']
    has_audio = selected.get('acodec') not in (None, 'none')
    has_video = selected.get('vcodec') not in (None, 'none')

    if output_format in {'mp3', 'aac'}:
        download_format = req['formatId'] if not has_video and has_audio else f'{req["formatId"]}+bestaudio/best'
        postprocessors = [{'key': 'FFmpegExtractAudio', 'preferredcodec': output_format, 'preferredquality': '192'}]
        extra_options: dict[str, Any] = {}
    elif output_format == 'original':
        download_format = req['formatId'] if has_audio else f'{req["formatId"]}+bestaudio/best'
        postprocessors = []
        extra_options = {'merge_output_format': selected.get('ext') or 'mp4'}
    else:
        download_format = req['formatId'] if has_audio else f'{req["formatId"]}+bestaudio/best'
        postprocessors = []
        extra_options = {'recodevideo': output_format}

    options = {
        'quiet': True,
        'no_warnings': True,
        'noplaylist': True,
        'format': download_format,
        'outtmpl': output_template,
        'postprocessors': postprocessors,
        'restrictfilenames': True,
        'nocheckcertificate': False,
        'cookiefile': None,
        'retries': 3,
        'fragment_retries': 3,
        'concurrent_fragment_downloads': 4,
        'socket_timeout': 20,
        'progress_hooks': [progress_hook(jid)],
        'remote_components': ['ejs:github'],
        **extra_options,
    }

    job.status = 'downloading'

    def run():
        with yt_dlp.YoutubeDL(options) as downloader:
            downloader.download([req['url']])

    await asyncio.to_thread(run)

    job.status = 'processing'
    candidates = [path for path in DATA.glob(f'{jid}-*') if path.is_file() and not path.name.endswith('.part')]
    if not candidates:
        raise FileNotFoundError('No output file was created.')

    final = max(candidates, key=lambda path: path.stat().st_mtime)
    if final.stat().st_size > MAX_FILE_BYTES:
        final.unlink(missing_ok=True)
        raise ValueError('Output exceeds the configured file size limit.')

    job.total_bytes = final.stat().st_size
    job.downloaded_bytes = job.total_bytes
    job.progress = 100
    job.status = 'completed'
    job.filename = final.name
    job.download_url = f'{PUBLIC}/files/{final.name}?token={job.file_token}'


def progress_hook(jid: str):
    def hook(data: dict[str, Any]):
        job = jobs.get(jid)
        if not job:
            return
        if data.get('status') == 'downloading':
            job.status = 'downloading'
            job.downloaded_bytes = int(data.get('downloaded_bytes') or 0)
            job.total_bytes = int(data.get('total_bytes') or data.get('total_bytes_estimate') or 0) or None
            job.speed_bytes_per_second = data.get('speed')
            job.eta_seconds = data.get('eta')
            if job.total_bytes:
                job.progress = min(99, float(job.downloaded_bytes) / job.total_bytes * 100)
        elif data.get('status') == 'finished':
            job.status = 'processing'
            job.progress = 99
    return hook


async def cleanup_loop():
    while True:
        cutoff = time.time() - RETENTION
        for path in DATA.iterdir():
            try:
                if path.is_file() and path.stat().st_mtime < cutoff:
                    path.unlink(missing_ok=True)
            except OSError:
                pass
        for jid, job in list(jobs.items()):
            if job.created_at < cutoff and job.status in {'completed', 'failed', 'cancelled'}:
                jobs.pop(jid, None)
        for url, (created_at, _) in list(raw_info_cache.items()):
            if created_at < cutoff:
                raw_info_cache.pop(url, None)
        for url, (created_at, _) in list(analyze_cache.items()):
            if created_at < cutoff:
                analyze_cache.pop(url, None)
        await asyncio.sleep(300)
