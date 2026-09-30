# ALL DOWNLOADER — Production Deployment

## Architecture

Use two services in production:

```text
Browser
  ↓
Vercel / Next.js
  ↓ HTTPS + secret token
Railway / FastAPI media worker
  ├── yt-dlp + yt-dlp-ejs
  ├── Deno
  ├── FFmpeg
  └── persistent temporary storage
```

Do not move FFmpeg/media extraction into the normal Vercel UI/control deployment.

## 1. Local Windows setup

Install Node.js 22+, Python 3.12+, FFmpeg, and Deno 2.3+.

From the project root:

```powershell
npm install
py -m pip install -r worker/requirements.txt
Copy-Item .env.example .env.local
npm run preflight
npm run dev
```

Then open:

```text
http://localhost:3000
```

The same `npm run dev` starts Next.js and the FastAPI worker. The page will display the worker readiness state.

## 2. Railway worker

Create a new Railway service from the repository and set the service root directory to:

```text
worker
```

Railway will build `worker/Dockerfile` automatically.

Set:

```env
ENVIRONMENT=production
MEDIA_WORKER_TOKEN=GENERATE_A_LONG_RANDOM_SECRET
PUBLIC_WORKER_URL=https://YOUR-RAILWAY-DOMAIN
ALLOWED_ORIGIN=https://YOUR-VERCEL-DOMAIN
MAX_CONCURRENT_JOBS=2
MAX_FILE_BYTES=1073741824
RETENTION_SECONDS=3600
ANALYZE_CACHE_SECONDS=300
ANALYZE_CACHE_MAX=32
```

Attach a persistent volume at:

```text
/app/data
```

Generate the Railway public domain and verify:

```text
https://YOUR-RAILWAY-DOMAIN/health
```

Do not continue until `ok` is `true` and the runtime reports FFmpeg, Deno, and yt-dlp.

## 3. Vercel frontend

Import the repository into Vercel.

Set Production Environment Variables:

```env
NEXT_PUBLIC_SITE_URL=https://YOUR-VERCEL-DOMAIN
MEDIA_WORKER_URL=https://YOUR-RAILWAY-DOMAIN
MEDIA_WORKER_TOKEN=THE_EXACT_SAME_SECRET_AS_RAILWAY
```

Deploy.

## 4. Production smoke test

Run these checks in order:

```text
/health                 → worker ok=true
/youtube-downloader     → page loads
Public URL              → analyze succeeds
Actual formats          → formats match source response
Quality selection       → selected format changes
Output format           → only supported outputs shown
Download                → job is created
Progress                → status changes in real time
Completion              → file link appears
File download           → browser receives actual file
History                 → completed item is recorded
```

Test only content you have permission to download or content the source explicitly makes available for downloading.

## 5. Vercel custom domain

Add the domain in the Vercel project settings, then set:

```env
NEXT_PUBLIC_SITE_URL=https://your-domain.example
```

Redeploy so canonical URLs, sitemap URLs, Open Graph metadata, and structured data use the production hostname.

## 6. SEO launch

After the production hostname resolves:

```text
/robots.txt
/sitemap.xml
```

must return successfully.

Submit the sitemap to Google Search Console and Bing Webmaster Tools. Inspect the important downloader pages and check that canonical URLs use the production hostname.

## 7. Troubleshooting `fetch failed`

If the UI shows `fetch failed`, check:

```text
Vercel MEDIA_WORKER_URL
        ↓
Railway public domain
        ↓
https://YOUR-RAILWAY-DOMAIN/health
```

The most common cause is that the worker is not deployed, is sleeping/stopped, the URL is wrong, or the shared `MEDIA_WORKER_TOKEN` does not match.

The local equivalent is:

```text
http://127.0.0.1:8000/health
```

## 8. YouTube reliability

The worker image includes Deno and the default yt-dlp dependency group. The application also enables the EJS GitHub component. This is required because current yt-dlp YouTube extraction uses an external JavaScript runtime and EJS challenge-solvers.

## 9. Scaling

The included worker is designed for a single service instance with bounded concurrency and temporary storage. For multi-instance high traffic, put the job state behind a durable queue/database and move completed files into object storage before horizontal scaling.
