FROM python:3.12-slim
ARG DENO_VERSION=2.9.7

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl ffmpeg tini \
    && rm -rf /var/lib/apt/lists/* \
    && curl -fsSL https://deno.land/install.sh | DENO_INSTALL=/usr/local sh -s v${DENO_VERSION} \
    && deno --version

WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY app ./app

RUN useradd -r -u 10001 worker \
    && mkdir -p /app/data \
    && chown -R worker:worker /app
USER worker

ENV WORKER_DATA_DIR=/app/data
ENV PYTHONUNBUFFERED=1
EXPOSE 8000
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
