'use client';

import { FormEvent, useState } from 'react';
import { AlertCircle, ArrowUpRight, Clipboard, Link2, Loader2, X } from 'lucide-react';
import { isValidHttpUrl } from '@/lib/validation';
import { motion, AnimatePresence } from 'motion/react';
import { MediaPreview, DownloadStatus } from './MediaPreview';
import { WorkerStatus } from './WorkerStatus';
import type { Job, MediaInfo } from '@/lib/types';

export function UrlInput() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [media, setMedia] = useState<MediaInfo | null>(null);
  const [job, setJob] = useState<Job | null>(null);

  const analyze = async (event?: FormEvent) => {
    event?.preventDefault();
    setError('');
    setMedia(null);
    setJob(null);

    if (!isValidHttpUrl(url)) {
      setError('Enter a valid public HTTP(S) URL.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = (await response.json()) as MediaInfo & { error?: string };
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'This content cannot be downloaded from this source.');
      }
      setMedia(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to analyze this URL.');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setJob(null);
    setMedia(null);
    setError('');
  };

  const paste = async () => {
    try {
      const value = await navigator.clipboard.readText();
      if (value) setUrl(value.trim());
    } catch {
      setError('Clipboard access is unavailable. Paste the URL manually.');
    }
  };

  return (
    <div>
      <form
        onSubmit={analyze}
        className="glass mx-auto flex max-w-4xl flex-col gap-2 rounded-2xl p-2 shadow-2xl shadow-slate-900/10 sm:flex-row"
      >
        <div className="flex min-w-0 flex-1 items-center gap-3 px-3">
          <Link2 className="shrink-0 muted" size={19} />
          <label htmlFor="media-url" className="sr-only">Media URL</label>
          <input
            id="media-url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="Paste your media URL…"
            className="min-w-0 flex-1 bg-transparent py-3 text-sm outline-none placeholder:text-slate-400"
            autoComplete="url"
            spellCheck={false}
            inputMode="url"
          />
          {url && (
            <button
              type="button"
              aria-label="Clear URL"
              onClick={() => { setUrl(''); setError(''); }}
              className="rounded-lg p-2 muted hover:bg-black/5 dark:hover:bg-white/5"
            >
              <X size={16} />
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void paste()}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--border)] px-4 text-sm font-medium sm:px-4"
          >
            <Clipboard size={16} /> <span className="hidden sm:inline">Paste</span>
          </button>
          <button
            disabled={loading}
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-5 text-sm font-semibold text-[var(--bg)] transition hover:opacity-90 disabled:cursor-wait disabled:opacity-60 sm:flex-none"
          >
            {loading ? <Loader2 className="animate-spin" size={17} /> : <ArrowUpRight size={17} />}
            Analyze
          </button>
        </div>
      </form>
      <div className="mx-auto max-w-4xl px-1"><WorkerStatus /></div>

      <AnimatePresence initial={false}>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="mx-auto mt-3 flex max-w-3xl items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-left text-sm text-red-700 dark:text-red-300"
            role="alert"
          >
            <AlertCircle size={17} />
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {media && <MediaPreview media={media} sourceUrl={url} onJob={setJob} />}
      {job && <DownloadStatus job={job} onReset={reset} />}
    </div>
  );
}
