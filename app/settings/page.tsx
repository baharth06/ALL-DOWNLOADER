'use client';

import { useSyncExternalStore } from 'react';
import { useTheme } from '@/components/ThemeProvider';

const SETTINGS_EVENT = 'ad-settings-updated';

function subscribe(callback: () => void) {
  window.addEventListener('storage', callback);
  window.addEventListener(SETTINGS_EVENT, callback);

  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener(SETTINGS_EVENT, callback);
  };
}

function getQualitySnapshot() {
  if (typeof window === 'undefined') {
    return 'best';
  }

  return localStorage.getItem('ad-quality') || 'best';
}

function getFormatSnapshot() {
  if (typeof window === 'undefined') {
    return 'mp4';
  }

  return localStorage.getItem('ad-format') || 'mp4';
}

function getServerQualitySnapshot() {
  return 'best';
}

function getServerFormatSnapshot() {
  return 'mp4';
}

export default function Page() {
  const { theme, setTheme } = useTheme();

  const quality = useSyncExternalStore(
    subscribe,
    getQualitySnapshot,
    getServerQualitySnapshot,
  );

  const format = useSyncExternalStore(
    subscribe,
    getFormatSnapshot,
    getServerFormatSnapshot,
  );

  const updateQuality = (value: string) => {
    localStorage.setItem('ad-quality', value);

    window.dispatchEvent(
      new Event(SETTINGS_EVENT),
    );
  };

  const updateFormat = (value: string) => {
    localStorage.setItem('ad-format', value);

    window.dispatchEvent(
      new Event(SETTINGS_EVENT),
    );
  };

  const clearHistory = () => {
    localStorage.removeItem('ad-history');

    window.dispatchEvent(
      new Event('ad-history-updated'),
    );

    alert('Local history cleared.');
  };

  return (
    <main className="container-narrow py-14 sm:py-20">
      <h1 className="text-4xl font-semibold tracking-tight">
        Settings
      </h1>

      <div className="mt-10 grid gap-4">
        <section className="card p-5">
          <label className="text-sm font-medium">
            Default quality

            <select
              value={quality}
              onChange={(event) =>
                updateQuality(event.target.value)
              }
              className="mt-2 min-h-11 w-full rounded-xl border border-[var(--border)] bg-transparent px-3"
            >
              <option value="best">
                Original / best available
              </option>

              <option value="ultra">
                Ultra
              </option>

              <option value="high">
                High
              </option>

              <option value="medium">
                Medium
              </option>

              <option value="low">
                Low
              </option>
            </select>
          </label>
        </section>

        <section className="card p-5">
          <label className="text-sm font-medium">
            Default format

            <select
              value={format}
              onChange={(event) =>
                updateFormat(event.target.value)
              }
              className="mt-2 min-h-11 w-full rounded-xl border border-[var(--border)] bg-transparent px-3"
            >
              <option value="mp4">
                MP4
              </option>

              <option value="webm">
                WebM
              </option>

              <option value="mp3">
                MP3
              </option>

              <option value="aac">
                AAC
              </option>
            </select>
          </label>
        </section>

        <section className="card p-5">
          <label className="text-sm font-medium">
            Theme

            <select
              value={theme}
              onChange={(event) =>
                setTheme(
                  event.target.value as
                    | 'light'
                    | 'dark'
                    | 'system',
                )
              }
              className="mt-2 min-h-11 w-full rounded-xl border border-[var(--border)] bg-transparent px-3"
            >
              <option value="system">
                System
              </option>

              <option value="light">
                Light
              </option>

              <option value="dark">
                Dark
              </option>
            </select>
          </label>
        </section>

        <section className="card p-5">
          <button
            onClick={clearHistory}
            className="rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm"
          >
            Clear history
          </button>
        </section>
      </div>
    </main>
  );
}