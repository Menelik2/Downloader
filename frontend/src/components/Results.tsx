import { useState, useEffect } from 'react'
import {
  Download,
  ExternalLink,
  Loader2,
  CheckCircle2,
  XCircle,
  Ban,
  Film,
  Music,
  Image as ImageIcon,
} from 'lucide-react'
import type { AnalyzeResponse, Job, MediaFormat } from '@/types'
import { cn } from '@/lib/utils'

interface ResultsProps {
  data: AnalyzeResponse
  onDownload: (format: MediaFormat) => Promise<void>
  job: Job | null
  downloading: boolean
  onCancel: () => void
}

function formatBytes(n?: number) {
  if (n == null || !Number.isFinite(n)) return null
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

function formatDuration(s?: number) {
  if (s == null || !Number.isFinite(s)) return null
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

export function Results({ data, onDownload, job, downloading, onCancel }: ResultsProps) {
  if (!data.success && !data.provider) {
    return (
      <section className="mx-auto max-w-3xl px-4 pb-12 sm:px-6">
        <div className="rounded-2xl border border-border bg-surface-2 p-6 text-center">
          <XCircle className="mx-auto h-10 w-10 text-red-500" />
          <h2 className="mt-3 text-lg font-semibold">Unable to analyze</h2>
          <p className="mt-2 text-sm text-muted">{data.message || data.error}</p>
          {data.officialUrl && (
            <a
              href={data.officialUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
            >
              Open original link <ExternalLink className="h-4 w-4" />
            </a>
          )}
        </div>
      </section>
    )
  }

  const hasFormats = (data.formats?.length ?? 0) > 0
  const authorizedFormats = data.formats?.filter((f) => f.authorized) ?? []

  return (
    <section className="mx-auto max-w-3xl px-4 pb-12 sm:px-6" aria-live="polite">
      <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
        {/* Header */}
        <div className="flex flex-col gap-4 border-b border-border bg-surface-2/50 p-5 sm:flex-row sm:items-start">
          {data.thumbnail ? (
            <img
              src={data.thumbnail}
              alt=""
              className="h-28 w-48 shrink-0 rounded-xl object-cover"
            />
          ) : (
            <div className="flex h-28 w-48 shrink-0 items-center justify-center rounded-xl bg-surface-3">
              <Film className="h-10 w-10 text-muted" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-medium text-brand-800 dark:bg-brand-900/50 dark:text-brand-200">
                {data.provider?.name ?? 'Unknown'}
              </span>
              {data.provider?.status && (
                <span
                  className={cn(
                    'rounded-full px-2.5 py-0.5 text-xs font-medium',
                    data.provider.status === 'available' &&
                      'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
                    data.provider.status === 'limited' &&
                      'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
                    (data.provider.status === 'unavailable' ||
                      data.provider.status === 'maintenance') &&
                      'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200'
                  )}
                >
                  {data.provider.status}
                </span>
              )}
            </div>
            <h2 className="mt-2 line-clamp-2 text-lg font-semibold leading-snug">
              {data.title || 'Untitled media'}
            </h2>
            <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted">
              {formatDuration(data.duration) && <span>{formatDuration(data.duration)}</span>}
              {data.provider?.mediaTypes?.map((t) => (
                <span key={t} className="capitalize">
                  {t}
                </span>
              ))}
            </div>
            {data.message && (
              <p className="mt-3 text-sm text-muted">{data.message}</p>
            )}
          </div>
        </div>

        {/* Formats */}
        <div className="p-5">
          {authorizedFormats.length > 0 ? (
            <ul className="space-y-3">
              {authorizedFormats.map((fmt) => (
                <li
                  key={fmt.id}
                  className="flex flex-col gap-3 rounded-xl border border-border bg-surface-2/50 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 rounded-lg bg-surface p-2">
                      {fmt.hasVideo ? (
                        <Film className="h-5 w-5 text-brand-600" />
                      ) : fmt.hasAudio ? (
                        <Music className="h-5 w-5 text-brand-600" />
                      ) : (
                        <ImageIcon className="h-5 w-5 text-brand-600" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium">{fmt.label}</p>
                      <p className="text-xs text-muted">
                        {fmt.quality && <span>{fmt.quality} · </span>}
                        {fmt.ext.toUpperCase()}
                        {formatBytes(fmt.filesize) && (
                          <span> · {formatBytes(fmt.filesize)}</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onDownload(fmt)}
                    disabled={downloading}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-500 disabled:opacity-60"
                  >
                    {downloading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    Download
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-surface-2/30 px-4 py-8 text-center">
              <Ban className="mx-auto h-8 w-8 text-muted" />
              <p className="mt-3 text-sm font-medium">No direct download available</p>
              <p className="mt-1 text-xs text-muted">
                This platform only offers official viewing. Use the link below.
              </p>
            </div>
          )}

          {/* Job progress */}
          {job && (job.status === 'queued' || job.status === 'processing') && (
            <div className="mt-5 rounded-xl border border-border bg-surface-2 p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">
                  {job.message || (job.status === 'queued' ? 'Queued…' : 'Processing…')}
                </span>
                <button
                  type="button"
                  onClick={onCancel}
                  className="text-xs font-medium text-muted hover:text-foreground"
                >
                  Cancel
                </button>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-3">
                <div
                  className="h-full rounded-full bg-brand-500 transition-all duration-300"
                  style={{ width: `${Math.max(job.progress ?? 5, 5)}%` }}
                />
              </div>
            </div>
          )}

          {job?.status === 'completed' && job.downloadToken && (
            <div className="mt-5 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-100">
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              <span>Ready! Your download should start automatically.</span>
            </div>
          )}

          {job?.status === 'failed' && (
            <div className="mt-5 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
              <XCircle className="h-5 w-5 shrink-0" />
              <span>{job.error || job.message || 'Download failed'}</span>
            </div>
          )}

          {/* Official link always available when present */}
          {data.officialUrl && (
            <div className="mt-5 flex justify-center">
              <a
                href={data.officialUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
              >
                Open on official site <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
