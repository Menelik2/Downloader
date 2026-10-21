import { useState, useRef } from 'react'
import { ClipboardPaste, Search, Loader2, AlertCircle } from 'lucide-react'
import type { AnalyzeResponse } from '@/types'

interface HeroProps {
  onAnalyze: (url: string) => Promise<void>
  loading: boolean
  error: string | null
}

export function Hero({ onAnalyze, loading, error }: HeroProps) {
  const [url, setUrl] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  async function handlePaste() {
    try {
      const text = await navigator.clipboard.readText()
      if (text) {
        setUrl(text.trim())
        inputRef.current?.focus()
      }
    } catch {
      // Clipboard permission denied – ignore silently
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = url.trim()
    if (!trimmed || loading) return
    onAnalyze(trimmed)
  }

  return (
    <section id="home" className="relative overflow-hidden">
      {/* Background accent */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-brand-100/60 via-transparent to-transparent dark:from-brand-950/40"
        aria-hidden
      />

      <div className="mx-auto max-w-3xl px-4 pb-16 pt-14 sm:px-6 sm:pt-20">
        <div className="text-center">
          <p className="mb-3 text-sm font-medium uppercase tracking-wider text-brand-600 dark:text-brand-400">
            Free · No account · No quota
          </p>
          <h1 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
            Download Media from Your{' '}
            <span className="bg-gradient-to-r from-brand-600 to-purple-600 bg-clip-text text-transparent dark:from-brand-400 dark:to-purple-400">
              Favorite Platforms
            </span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-balance text-base text-muted sm:text-lg">
            Paste a public or authorized media link. LinkFetch analyzes what’s available and
            lets you download when it’s permitted — no sign-up required.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="mt-10 rounded-2xl border border-border bg-surface-2/80 p-2 shadow-lg shadow-brand-500/5 backdrop-blur sm:p-3"
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <input
                ref={inputRef}
                type="url"
                inputMode="url"
                autoComplete="off"
                spellCheck={false}
                placeholder="Paste a media URL here…"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={loading}
                className="w-full rounded-xl border border-border bg-surface px-4 py-3.5 pr-12 text-base outline-none transition placeholder:text-muted/70 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 disabled:opacity-60"
                aria-label="Media URL"
              />
              <button
                type="button"
                onClick={handlePaste}
                disabled={loading}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-muted transition hover:bg-surface-3 hover:text-foreground disabled:opacity-50"
                aria-label="Paste from clipboard"
                title="Paste"
              >
                <ClipboardPaste className="h-5 w-5" />
              </button>
            </div>
            <button
              type="submit"
              disabled={loading || !url.trim()}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-brand-700 px-6 py-3.5 text-sm font-semibold text-white shadow-md shadow-brand-600/25 transition hover:from-brand-500 hover:to-brand-600 disabled:cursor-not-allowed disabled:opacity-60 sm:shrink-0"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analyzing…
                </>
              ) : (
                <>
                  <Search className="h-4 w-4" />
                  Analyze Link
                </>
              )}
            </button>
          </div>
        </form>

        {error && (
          <div
            role="alert"
            className="mt-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <p className="mt-6 text-center text-xs text-muted">
          Supports selected public media sources. We never bypass DRM, logins, or platform
          protections.
        </p>
      </div>
    </section>
  )
}
