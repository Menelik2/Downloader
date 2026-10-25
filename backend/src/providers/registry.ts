import type { Provider } from './types.js'
import type { ProviderInfo } from '../types/index.js'
import { directMediaProvider } from './direct-media.js'
import { ytdlpProvider } from './ytdlp.js'
import { genericOembedProvider } from './oembed.js'
import { redditProvider } from './reddit.js'

/**
 * Modular provider registry.
 * Order matters: first match wins.
 * ytdlp handles major social platforms with real downloads when installed.
 */
const providers: Provider[] = [
  directMediaProvider, // exact .mp4/.mp3 etc. URLs first
  ytdlpProvider,       // real downloads: YouTube, TikTok, IG, X, FB, Reddit, …
  redditProvider,      // fallback if ytdlp missing
  genericOembedProvider,
]

export function getAllProviders(): ProviderInfo[] {
  return providers.map((p) => ({ ...p.info }))
}

export function findProvider(hostname: string, url: string): Provider | null {
  for (const p of providers) {
    if (p.matches(hostname, url)) {
      return p
    }
  }
  return null
}

export function getProviderById(id: string): Provider | null {
  return providers.find((p) => p.info.id === id) ?? null
}
