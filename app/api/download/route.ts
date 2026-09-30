import { NextResponse } from 'next/server';
import { assertPublicUrl } from '@/lib/security';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const url = typeof body?.url === 'string' ? body.url.trim() : '';
    const formatId = typeof body?.formatId === 'string' ? body.formatId : '';
    const format = typeof body?.format === 'string' ? body.format : '';
    const quality = typeof body?.quality === 'string' ? body.quality : 'best';

    if (!url) return NextResponse.json({ success: false, error: 'URL is required.' }, { status: 400 });
    if (!formatId) return NextResponse.json({ success: false, error: 'A source format must be selected.' }, { status: 400 });
    if (!['original', 'mp4', 'webm', 'mp3', 'aac'].includes(format)) {
      return NextResponse.json({ success: false, error: 'Unsupported output format.' }, { status: 400 });
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
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        response = await fetch(`${worker}/download`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            ...(process.env.MEDIA_WORKER_TOKEN
              ? { 'x-worker-token': process.env.MEDIA_WORKER_TOKEN }
              : {}),
          },
          body: JSON.stringify({ url, formatId, format, quality }),
          signal: AbortSignal.timeout(20_000),
          cache: 'no-store',
        });
        break;
      } catch {
        if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }

    if (!response) {
      return NextResponse.json(
        { success: false, error: 'Downloader backend is temporarily unavailable. Please try again shortly.' },
        { status: 503 },
      );
    }

    const data = await response.json().catch(() => ({
      success: false,
      error: 'Invalid response from downloader backend.',
    }));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create the download job.';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
