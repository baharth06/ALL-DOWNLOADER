'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, ServerCrash } from 'lucide-react';

type State = 'checking' | 'online' | 'offline';

export function WorkerStatus() {
  const [state, setState] = useState<State>('checking');

  useEffect(() => {
    let active = true;
    const check = async () => {
      try {
        const response = await fetch('/api/health', { cache: 'no-store' });
        if (active) setState(response.ok ? 'online' : 'offline');
      } catch {
        if (active) setState('offline');
      }
    };
    void check();
    const timer = window.setInterval(check, 30_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  if (state === 'checking') {
    return <div className="mt-3 inline-flex items-center gap-2 text-xs muted"><Loader2 size={13} className="animate-spin" /> Checking downloader service…</div>;
  }
  if (state === 'offline') {
    return <div className="mt-3 inline-flex items-center gap-2 text-xs text-red-600 dark:text-red-300"><ServerCrash size={13} /> Downloader service unavailable</div>;
  }
  return <div className="mt-3 inline-flex items-center gap-2 text-xs muted"><CheckCircle2 size={13} /> Downloader service ready</div>;
}
