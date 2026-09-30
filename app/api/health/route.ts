import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const worker = process.env.MEDIA_WORKER_URL?.replace(/\/$/, '');
  if (!worker) {
    return NextResponse.json(
      { ok: false, frontend: true, worker: { ok: false, error: 'MEDIA_WORKER_URL is not configured.' } },
      { status: 503 },
    );
  }

  try {
    const response = await fetch(`${worker}/health`, {
      headers: process.env.MEDIA_WORKER_TOKEN
        ? { 'x-worker-token': process.env.MEDIA_WORKER_TOKEN }
        : undefined,
      signal: AbortSignal.timeout(5000),
      cache: 'no-store',
    });

    const data = await response.json().catch(() => null);
    return NextResponse.json(
      { ok: response.ok, frontend: true, worker: data ?? { ok: response.ok } },
      { status: response.ok ? 200 : 503 },
    );
  } catch {
    return NextResponse.json(
      {
        ok: false,
        frontend: true,
        worker: {
          ok: false,
          error: 'Media worker is unreachable. Start the worker locally or configure the production worker URL.',
        },
      },
      { status: 503 },
    );
  }
}
