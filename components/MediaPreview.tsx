'use client';

import Image from 'next/image';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Clock3,
  Download,
  Globe2,
  HardDrive,
  Loader2,
  Square,
  XCircle,
} from 'lucide-react';

import type { Job, MediaInfo, Format } from '@/lib/types';
import {
  formatBytes,
  formatDuration,
  qualityLabel,
} from '@/lib/utils';

type Props = {
  media: MediaInfo;
  sourceUrl: string;
  onJob: (job: Job | null) => void;
};

const PRESETS = [
  {
    key: 'original',
    label: 'Best',
    min: 0,
    max: Number.POSITIVE_INFINITY,
  },
  {
    key: 'ultra',
    label: 'Ultra',
    min: 2160,
    max: Number.POSITIVE_INFINITY,
  },
  {
    key: 'high',
    label: 'High',
    min: 1080,
    max: 2159,
  },
  {
    key: 'medium',
    label: 'Medium',
    min: 480,
    max: 1079,
  },
  {
    key: 'low',
    label: 'Low',
    min: 0,
    max: 479,
  },
] as const;

function chooseForPreset(
  formats: Format[],
  preset: (typeof PRESETS)[number],
) {
  const video = formats
    .filter(
      (format) =>
        format.kind === 'video' &&
        typeof format.height === 'number',
    )
    .sort(
      (a, b) =>
        (b.height ?? 0) - (a.height ?? 0),
    );

  if (!video.length) {
    return undefined;
  }

  if (preset.key === 'original') {
    return video[0];
  }

  return video.find((format) => {
    const height = format.height ?? 0;

    return (
      height >= preset.min &&
      height <= preset.max
    );
  });
}

export function MediaPreview({
  media,
  sourceUrl,
  onJob,
}: Props) {
  /*
   * These values are initialized from the analyzed media.
   *
   * MediaPreview is mounted only after a successful analysis,
   * so we don't need an effect to synchronize these values.
   *
   * This also avoids React's set-state-in-effect lint error.
   */
  const firstVideo = useMemo(
    () =>
      chooseForPreset(
        media.formats,
        PRESETS[0],
      ),
    [media.formats],
  );

  const [selectedId, setSelectedId] =
    useState(
      firstVideo?.id ??
        media.formats[0]?.id ??
        '',
    );

  const [outputFormat, setOutputFormat] =
    useState(
      media.outputFormats[0] ??
        'original',
    );

  const [busy, setBusy] =
    useState(false);

  const pollingRef =
    useRef<ReturnType<typeof setInterval> | null>(
      null,
    );

  const currentJobRef =
    useRef<string | null>(null);

  /*
   * Stop polling when the component unmounts.
   */
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(
          pollingRef.current,
        );

        pollingRef.current = null;
      }
    };
  }, []);

  /*
   * Currently selected source format.
   */
  const selected = useMemo(
    () =>
      media.formats.find(
        (format) =>
          format.id === selectedId,
      ) ??
      media.formats[0],
    [
      media.formats,
      selectedId,
    ],
  );

  /*
   * Build the visible quality buttons.
   */
  const qualityOptions = useMemo(() => {
    const seen = new Set<string>();

    return PRESETS.map((preset) => {
      const format =
        chooseForPreset(
          media.formats,
          preset,
        );

      if (
        !format ||
        seen.has(format.id)
      ) {
        return null;
      }

      seen.add(format.id);

      return {
        preset,
        format,
      };
    }).filter(Boolean) as {
      preset: (typeof PRESETS)[number];
      format: Format;
    }[];
  }, [media.formats]);

  /*
   * Save successful downloads to local browser history.
   */
  const saveHistory = (job: Job) => {
    if (job.status !== 'completed') {
      return;
    }

    try {
      const existing =
        JSON.parse(
          localStorage.getItem(
            'ad-history',
          ) || '[]',
        ) as unknown[];

      const item = {
        id: job.id,
        title: media.title,
        source: media.source,
        quality: selected?.height
          ? `${selected.height}p`
          : 'Original',
        format: outputFormat,
        date: new Date().toISOString(),
        status: job.status,
        thumbnail: media.thumbnail,
      };

      localStorage.setItem(
        'ad-history',
        JSON.stringify(
          [
            item,
            ...existing,
          ].slice(0, 100),
        ),
      );
    } catch {
      /*
       * Local history is optional.
       * Never allow history errors to break downloads.
       */
    }
  };

  /*
   * Read the current job status.
   */
  const getStatus = async (
    jobId: string,
  ) => {
    const response = await fetch(
      `/api/download/${jobId}/status`,
      {
        cache: 'no-store',
      },
    );

    const data =
      (await response
        .json()
        .catch(() => ({}))) as Job & {
        error?: string;
      };

    if (
      !response.ok ||
      !data.status
    ) {
      throw new Error(
        data.error ||
          'The downloader backend is temporarily unavailable.',
      );
    }

    /*
     * Send the latest job information
     * to the parent component.
     */
    onJob({
      ...data,

      history: {
        title: media.title,
        source: media.source,

        quality: selected?.height
          ? `${selected.height}p`
          : 'Original',

        format: outputFormat,

        thumbnail:
          media.thumbnail,
      },
    });

    /*
     * Stop polling when the job reaches
     * a final state.
     */
    if (
      data.status === 'completed' ||
      data.status === 'failed' ||
      data.status === 'cancelled'
    ) {
      if (pollingRef.current) {
        clearInterval(
          pollingRef.current,
        );
      }

      pollingRef.current = null;

      currentJobRef.current = null;

      setBusy(false);

      saveHistory(data);
    }
  };

  /*
   * Start a real download job.
   */
  const download = async () => {
    if (!selected) {
      return;
    }

    setBusy(true);

    onJob(null);

    try {
      const response = await fetch(
        '/api/download',
        {
          method: 'POST',

          headers: {
            'content-type':
              'application/json',
          },

          body: JSON.stringify({
            url: sourceUrl,

            formatId:
              selected.id,

            quality:
              qualityLabel(
                selected.height,
              ),

            format:
              outputFormat,
          }),
        },
      );

      const job =
        (await response.json()) as Job & {
          success?: boolean;
        };

      if (
        !response.ok ||
        !job.id
      ) {
        throw new Error(
          job.error ||
            'Unable to start the download.',
        );
      }

      /*
       * Store the active job ID.
       */
      currentJobRef.current =
        job.id;

      /*
       * Immediately display the queued job.
       */
      onJob({
        ...job,

        history: {
          title: media.title,

          source: media.source,

          quality: selected?.height
            ? `${selected.height}p`
            : 'Original',

          format: outputFormat,

          thumbnail:
            media.thumbnail,
        },
      });

      /*
       * Clear any previous polling timer.
       */
      if (pollingRef.current) {
        clearInterval(
          pollingRef.current,
        );

        pollingRef.current = null;
      }

      /*
       * Get the first status immediately
       * instead of waiting one second.
       */
      try {
        await getStatus(job.id);
      } catch (error) {
        setBusy(false);

        onJob({
          id: job.id,

          status: 'failed',

          progress: 0,

          error:
            error instanceof Error
              ? error.message
              : 'Unable to read download status.',
        });

        return;
      }

      /*
       * Poll every second while the worker
       * processes the download.
       */
      pollingRef.current =
        setInterval(() => {
          void getStatus(
            job.id,
          ).catch((error) => {
            setBusy(false);

            if (
              pollingRef.current
            ) {
              clearInterval(
                pollingRef.current,
              );

              pollingRef.current =
                null;
            }

            onJob({
              id: job.id,

              status: 'failed',

              progress: 0,

              error:
                error instanceof Error
                  ? error.message
                  : 'Unable to read download status.',
            });
          });
        }, 1000);
    } catch (error) {
      setBusy(false);

      onJob({
        id: 'error',

        status: 'failed',

        progress: 0,

        error:
          error instanceof Error
            ? error.message
            : 'Download failed.',
      });
    }
  };

  return (
    <section
      className="mx-auto mt-6 max-w-4xl"
      aria-label="Media result"
    >
      <div className="card overflow-hidden p-3 shadow-xl shadow-slate-950/5 sm:p-5">
        <div className="grid gap-6 md:grid-cols-[280px_1fr]">
          {/* Thumbnail */}
          <div className="relative min-h-56 overflow-hidden rounded-2xl bg-black/5 dark:bg-white/5">
            {media.thumbnail ? (
              <Image
                src={media.thumbnail}
                alt={`${media.title} thumbnail`}
                fill
                sizes="(max-width: 768px) 100vw, 280px"
                className="object-cover"
                unoptimized
              />
            ) : (
              <div className="grid h-full min-h-56 place-items-center text-sm muted">
                No thumbnail
              </div>
            )}
          </div>

          {/* Media information */}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] muted">
              <span>
                {media.source}
              </span>

              <span className="rounded-full border border-[var(--border)] px-2 py-1 normal-case tracking-normal">
                {media.mediaType}
              </span>
            </div>

            <h2 className="mt-2 line-clamp-2 text-2xl font-semibold tracking-tight">
              {media.title}
            </h2>

            {/* Metadata */}
            <div className="mt-3 flex flex-wrap gap-3 text-xs muted">
              <span className="inline-flex items-center gap-1.5">
                <Globe2 size={14} />

                {media.creator ||
                  'Unknown creator'}
              </span>

              <span className="inline-flex items-center gap-1.5">
                <Clock3 size={14} />

                {formatDuration(
                  media.duration,
                )}
              </span>

              <span className="inline-flex items-center gap-1.5">
                <HardDrive size={14} />

                {formatBytes(
                  media.estimatedSize,
                )}
              </span>
            </div>

            {/* Quality presets */}
            {qualityOptions.length >
              0 && (
              <div className="mt-7">
                <div className="text-xs font-medium uppercase tracking-[0.16em] muted">
                  Quality
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {qualityOptions.map(
                    ({
                      preset,
                      format,
                    }) => {
                      const isSelected =
                        selected?.id ===
                        format.id;

                      return (
                        <button
                          type="button"
                          key={
                            preset.key
                          }
                          onClick={() =>
                            setSelectedId(
                              format.id,
                            )
                          }
                          className={`min-h-11 rounded-xl border px-3.5 text-sm transition ${
                            isSelected
                              ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--bg)] shadow-sm'
                              : 'border-[var(--border)] hover:bg-black/5 dark:hover:bg-white/5'
                          }`}
                        >
                          {
                            preset.label
                          }{' '}
                          ·{' '}
                          {
                            format.height
                          }
                          p
                        </button>
                      );
                    },
                  )}
                </div>
              </div>
            )}

            {/* Exact source format */}
            <label className="mt-6 block">
              <span className="text-xs font-medium uppercase tracking-[0.16em] muted">
                Exact source
                format
              </span>

              <select
                value={
                  selectedId
                }
                onChange={(
                  event,
                ) =>
                  setSelectedId(
                    event.target
                      .value,
                  )
                }
                className="mt-2 min-h-11 w-full rounded-xl border border-[var(--border)] bg-transparent px-3 text-sm outline-none"
              >
                {media.formats.map(
                  (format) => (
                    <option
                      value={
                        format.id
                      }
                      key={
                        format.id
                      }
                    >
                      {format.height
                        ? `${format.height}p`
                        : format.label}

                      {' · '}

                      {format.container.toUpperCase()}

                      {format.fps
                        ? ` · ${Math.round(
                            format.fps,
                          )}fps`
                        : ''}

                      {format.filesize
                        ? ` · ${formatBytes(
                            format.filesize,
                          )}`
                        : ''}
                    </option>
                  ),
                )}
              </select>
            </label>

            {/* Output format + Download */}
            <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
              <label className="block">
                <span className="text-xs font-medium uppercase tracking-[0.16em] muted">
                  Output format
                </span>

                <select
                  value={
                    outputFormat
                  }
                  onChange={(
                    event,
                  ) =>
                    setOutputFormat(
                      event.target
                        .value,
                    )
                  }
                  className="mt-2 min-h-11 w-full rounded-xl border border-[var(--border)] bg-transparent px-3 text-sm outline-none"
                >
                  {media.outputFormats.map(
                    (
                      extension,
                    ) => (
                      <option
                        key={
                          extension
                        }
                        value={
                          extension
                        }
                      >
                        {extension ===
                        'original'
                          ? 'ORIGINAL'
                          : extension.toUpperCase()}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <button
                type="button"
                onClick={() =>
                  void download()
                }
                disabled={
                  busy ||
                  !selected
                }
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-5 text-sm font-semibold text-[var(--bg)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? (
                  <Loader2
                    size={17}
                    className="animate-spin"
                  />
                ) : (
                  <Download
                    size={17}
                  />
                )}

                {busy
                  ? 'Starting…'
                  : 'Download'}
              </button>
            </div>

            <p className="mt-3 text-xs muted">
              Only formats returned by
              the source are shown.
              Conversion options are
              available only when the
              worker is configured for
              them.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/*
 * Download progress/status component.
 */
export function DownloadStatus({
  job,
  onReset,
}: {
  job: Job;
  onReset: () => void;
}) {
  const percent = Math.min(
    100,
    Math.max(
      0,
      job.progress ?? 0,
    ),
  );

  const completed =
    job.status ===
    'completed';

  const failed =
    job.status ===
    'failed';

  const cancelled =
    job.status ===
    'cancelled';

  return (
    <div className="mx-auto mt-5 max-w-4xl rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-5 shadow-xl shadow-slate-950/5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 font-semibold">
            {completed ? (
              <Check size={18} />
            ) : failed ||
              cancelled ? (
              <XCircle size={18} />
            ) : (
              <Loader2
                size={18}
                className="animate-spin"
              />
            )}

            {completed
              ? 'Download complete'
              : failed
                ? 'Download failed'
                : cancelled
                  ? 'Download cancelled'
                  : 'Downloading'}
          </div>

          <p className="mt-1 text-sm muted">
            {job.error ||
              (completed
                ? job.filename
                : 'Your media is being processed by the worker.')}
          </p>
        </div>

        <span className="text-sm font-semibold tabular-nums">
          {Math.round(
            percent,
          )}
          %
        </span>
      </div>

      {/* Progress bar */}
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
        <div
          className="h-full rounded-full bg-[var(--accent-2)] transition-[width] duration-300"
          style={{
            width: `${percent}%`,
          }}
        />
      </div>

      {/* Transfer information */}
      <div className="mt-3 flex flex-wrap justify-between gap-2 text-xs muted">
        <span>
          {job.downloadedBytes
            ? formatBytes(
                job.downloadedBytes,
              )
            : 'Preparing'}

          {job.totalBytes
            ? ` / ${formatBytes(
                job.totalBytes,
              )}`
            : ''}
        </span>

        <span>
          {job.speedBytesPerSecond
            ? `${formatBytes(
                job.speedBytesPerSecond,
              )}/s`
            : ''}

          {job.etaSeconds
            ? ` · ETA ${job.etaSeconds}s`
            : ''}
        </span>
      </div>

      {/* Actions */}
      <div className="mt-5 flex flex-wrap gap-2">
        {/* Download completed file */}
        {completed &&
          job.downloadUrl && (
            <a
              href={
                job.downloadUrl
              }
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--bg)]"
            >
              <Download
                size={16}
              />

              Download file
            </a>
          )}

        {/* Cancel active job */}
        {!completed &&
          !failed &&
          !cancelled && (
            <button
              type="button"
              onClick={async () => {
                try {
                  await fetch(
                    `/api/download/${job.id}/status`,
                    {
                      method:
                        'DELETE',
                    },
                  );
                } finally {
                  onReset();
                }
              }}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--border)] px-4 text-sm font-medium"
            >
              <Square
                size={14}
              />

              Cancel
            </button>
          )}

        {/* Start another download */}
        {(completed ||
          failed ||
          cancelled) && (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--border)] px-4 text-sm font-medium"
          >
            New URL
          </button>
        )}
      </div>
    </div>
  );
}