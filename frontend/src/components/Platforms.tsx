import type { ProviderInfo } from '@/types'
import { cn } from '@/lib/utils'

const FALLBACK_PLATFORMS: ProviderInfo[] = [
  {
    id: 'youtube',
    name: 'YouTube',
    status: 'limited',
    capabilities: ['metadata', 'official-link'],
    mediaTypes: ['video'],
    notes: 'Official link & metadata only',
  },
  {
    id: 'reddit',
    name: 'Reddit',
    status: 'available',
    capabilities: ['metadata', 'download'],
    mediaTypes: ['video', 'image'],
  },
  {
    id: 'direct-media',
    name: 'Direct Media',
    status: 'available',
    capabilities: ['metadata', 'download'],
    mediaTypes: ['video', 'audio'],
    notes: 'Public mp4, webm, mp3…',
  },
  {
    id: 'vimeo',
    name: 'Vimeo',
    status: 'limited',
    capabilities: ['metadata', 'official-link'],
    mediaTypes: ['video'],
  },
  {
    id: 'dailymotion',
    name: 'Dailymotion',
    status: 'limited',
    capabilities: ['metadata', 'official-link'],
    mediaTypes: ['video'],
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    status: 'unavailable',
    capabilities: [],
    mediaTypes: [],
    notes: 'Not enabled in this release',
  },
  {
    id: 'instagram',
    name: 'Instagram',
    status: 'unavailable',
    capabilities: [],
    mediaTypes: [],
    notes: 'Not enabled in this release',
  },
  {
    id: 'x',
    name: 'X (Twitter)',
    status: 'unavailable',
    capabilities: [],
    mediaTypes: [],
    notes: 'Not enabled in this release',
  },
]

interface PlatformsProps {
  providers?: ProviderInfo[]
}

export function Platforms({ providers }: PlatformsProps) {
  const list = providers && providers.length > 0 ? providers : FALLBACK_PLATFORMS

  return (
    <section id="platforms" className="py-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Supported Platforms</h2>
          <p className="mt-2 max-w-2xl mx-auto text-muted">
            Platform availability changes over time. Status below reflects what this deployment
            currently supports. We never claim universal coverage.
          </p>
        </div>

        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {list.map((p) => (
            <li
              key={p.id}
              className="rounded-2xl border border-border bg-surface p-5 shadow-sm transition hover:border-brand-300 dark:hover:border-brand-700"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold">{p.name}</h3>
                <span
                  className={cn(
                    'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                    p.status === 'available' &&
                      'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
                    p.status === 'limited' &&
                      'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
                    (p.status === 'unavailable' || p.status === 'maintenance') &&
                      'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                  )}
                >
                  {p.status}
                </span>
              </div>
              {p.notes && <p className="mt-2 text-xs text-muted">{p.notes}</p>}
              {p.capabilities.length > 0 && (
                <p className="mt-2 text-[11px] text-muted">
                  {p.capabilities.join(' · ')}
                </p>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
