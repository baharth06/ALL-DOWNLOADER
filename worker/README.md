# All Downloader media worker

Real, non-demo FastAPI worker for the All Downloader application. It uses yt-dlp for the explicitly supported public providers and `httpx` for direct public media URLs. FFmpeg is included in the Docker image for real output conversion.

## Requirements

- Docker + Docker Compose (recommended)
- Or Python 3.12+, FFmpeg, and the packages in `requirements.txt`

## Run with Docker

```bash
cp .env.example .env
# set MEDIA_WORKER_TOKEN and ALLOWED_ORIGIN

docker compose up --build
```

Health:

```bash
curl http://localhost:8000/health
```

## Runtime behavior

- `POST /analyze` returns real metadata and provider formats.
- `POST /download` creates a real download job.
- `GET /download/{id}` returns the real job state.
- `DELETE /download/{id}` cancels active jobs.
- `GET /files/{filename}` serves completed files for the configured retention window.

## Production baseline

This configuration is intentionally simple and deployable as a single long-running worker. It keeps active job state in memory and stores temporary outputs on a persistent worker volume.

For horizontal scaling, replace the in-memory job/task maps with a durable queue/state layer such as Redis/Postgres and move completed files to object storage with short-lived signed URLs.

Never expose the worker directly to the public internet without HTTPS, token authentication, external rate limiting, and network controls appropriate to your deployment.
