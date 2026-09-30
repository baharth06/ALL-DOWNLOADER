import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const worker = process.env.MEDIA_WORKER_URL?.replace(/\/$/, '');
  if (!worker) {
    return NextResponse.json({ success: false, error: 'Downloader backend is not configured.' }, { status: 503 });
  }

  try {
    const response = await fetch(`${worker}/download/${encodeURIComponent(id)}`, {
      headers: process.env.MEDIA_WORKER_TOKEN ? { 'x-worker-token': process.env.MEDIA_WORKER_TOKEN } : undefined,
      signal: AbortSignal.timeout(10_000),
      cache: 'no-store',
    });
    const data = await response.json().catch(() => ({ success: false, error: 'Invalid downloader response.' }));
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json({ success: false, error: 'Downloader backend is temporarily unavailable.' }, { status: 503 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const worker = process.env.MEDIA_WORKER_URL?.replace(/\/$/, '');
  if (!worker) {
    return NextResponse.json({ success: false, error: 'Downloader backend is not configured.' }, { status: 503 });
  }

  try {
    const response = await fetch(`${worker}/download/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: process.env.MEDIA_WORKER_TOKEN ? { 'x-worker-token': process.env.MEDIA_WORKER_TOKEN } : undefined,
      signal: AbortSignal.timeout(10_000),
      cache: 'no-store',
    });
    const data = await response.json().catch(() => ({ success: response.ok }));
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json({ success: false, error: 'Unable to reach the downloader backend.' }, { status: 503 });
  }
}
