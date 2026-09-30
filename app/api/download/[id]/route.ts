import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function workerUrl() {
  return process.env.MEDIA_WORKER_URL?.replace(/\/$/, '') || '';
}

function workerHeaders() {
  return process.env.MEDIA_WORKER_TOKEN
    ? { 'x-worker-token': process.env.MEDIA_WORKER_TOKEN }
    : undefined;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const worker = workerUrl();
  if (!worker) return NextResponse.json({ success: false, error: 'Downloader backend is not configured.' }, { status: 503 });

  try {
    const response = await fetch(`${worker}/download/${encodeURIComponent(id)}`, {
      headers: workerHeaders(),
      signal: AbortSignal.timeout(10_000),
      cache: 'no-store',
    });
    const data = await response.json().catch(() => ({ success: false, error: 'Invalid worker response.' }));
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json({ success: false, error: 'Unable to reach the downloader backend.' }, { status: 503 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const worker = workerUrl();
  if (!worker) return NextResponse.json({ success: false, error: 'Downloader backend is not configured.' }, { status: 503 });

  try {
    const response = await fetch(`${worker}/download/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: workerHeaders(),
      signal: AbortSignal.timeout(10_000),
      cache: 'no-store',
    });
    const data = await response.json().catch(() => ({ success: response.ok }));
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json({ success: false, error: 'Unable to reach the downloader backend.' }, { status: 503 });
  }
}
