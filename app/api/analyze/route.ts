import { NextResponse } from 'next/server';
import { assertPublicUrl } from '@/lib/security';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function callWorker(worker: string, url: string) {
  return fetch(`${worker}/analyze`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(process.env.MEDIA_WORKER_TOKEN
        ? { 'x-worker-token': process.env.MEDIA_WORKER_TOKEN }
        : {}),
    },
    body: JSON.stringify({ url }),
    signal: AbortSignal.timeout(35_000),
    cache: 'no-store',
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const url = typeof body?.url === 'string' ? body.url.trim() : '';
    if (!url) {
      return NextResponse.json({ success: false, error: 'URL is required.' }, { status: 400 });
    }

    await assertPublicUrl(url);

    const worker = process.env.MEDIA_WORKER_URL?.replace(/\/$/, '');
    if (!worker) {
      return NextResponse.json(
        { success: false, error: 'Downloader backend is not configured. Set MEDIA_WORKER_URL.' },
        { status: 503 },
      );
    }

    let response: Response | undefined;
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        response = await callWorker(worker, url);
        break;
      } catch (error) {
        lastError = error;
        if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }

    if (!response) {
      return NextResponse.json(
        {
          success: false,
          error:
            process.env.NODE_ENV === 'development'
              ? 'Media worker is not running. Start ALL DOWNLOADER with npm run dev (or start-all.bat).'
              : 'Downloader backend is temporarily unavailable. Please try again shortly.',
          details: lastError instanceof Error ? lastError.name : undefined,
        },
        { status: 503 },
      );
    }

    const data = await response.json().catch(() => ({
      success: false,
      error: 'Invalid response from downloader backend.',
    }));

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to analyze this URL.';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
