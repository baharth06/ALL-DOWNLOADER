'use client';

import { useSyncExternalStore } from 'react';
import { Trash2, Clock3 } from 'lucide-react';

type Item = {
  id: string;
  title: string;
  source: string;
  quality: string;
  format: string;
  date: string;
  status: string;
  thumbnail?: string;
};

const HISTORY_KEY = 'ad-history';
const HISTORY_EVENT = 'ad-history-updated';

function getHistorySnapshot(): string {
  if (typeof window === 'undefined') {
    return '[]';
  }

  return localStorage.getItem(HISTORY_KEY) || '[]';
}

function getServerHistorySnapshot(): string {
  return '[]';
}

function subscribeToHistory(callback: () => void) {
  window.addEventListener('storage', callback);
  window.addEventListener(HISTORY_EVENT, callback);

  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener(HISTORY_EVENT, callback);
  };
}

function parseHistory(value: string): Item[] {
  try {
    const parsed = JSON.parse(value);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed;
  } catch {
    return [];
  }
}

export default function Page() {
  const historySnapshot = useSyncExternalStore(
    subscribeToHistory,
    getHistorySnapshot,
    getServerHistorySnapshot,
  );

  const items = parseHistory(historySnapshot);

  const clear = () => {
    localStorage.removeItem(HISTORY_KEY);

    window.dispatchEvent(
      new Event(HISTORY_EVENT),
    );
  };

  return (
    <main className="container-wide py-14 sm:py-20">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-xs font-medium uppercase tracking-[.16em] muted">
            Local only
          </div>

          <h1 className="mt-2 text-4xl font-semibold tracking-tight">
            Download history
          </h1>

          <p className="mt-3 text-sm muted">
            Stored in this browser. No database is required for basic
            history.
          </p>
        </div>

        {items.length > 0 && (
          <button
            onClick={clear}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--border)] px-4 text-sm"
          >
            <Trash2 size={15} />
            Clear
          </button>
        )}
      </div>

      <div className="mt-10 grid gap-3">
        {items.length === 0 ? (
          <div className="card p-8 text-sm muted">
            No download history yet.
          </div>
        ) : (
          items.map((item) => (
            <article
              className="card flex gap-4 p-4"
              key={item.id}
            >
              <div className="grid h-16 w-24 shrink-0 place-items-center overflow-hidden rounded-xl bg-black/5 text-xs muted dark:bg-white/5">
                {item.thumbnail ? 'IMG' : 'MEDIA'}
              </div>

              <div className="min-w-0">
                <h2 className="truncate font-medium">
                  {item.title}
                </h2>

                <div className="mt-1 flex flex-wrap gap-3 text-xs muted">
                  <span>{item.source}</span>
                  <span>{item.quality}</span>
                  <span>{item.format}</span>

                  <span className="inline-flex items-center gap-1">
                    <Clock3 size={12} />
                    {new Date(item.date).toLocaleString()}
                  </span>
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </main>
  );
}