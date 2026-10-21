import type { Provider } from './types.js'
import type { ProviderInfo } from '../types/index.js'
import { directMediaProvider } from './direct-media.js'
import { youtubeProvider } from './youtube.js'
import { genericOembedProvider } from './oembed.js'
import { redditProvider } from './reddit.js'

/**
 * Modular provider registry.
 * Add new providers here without touching the rest of the application.
 */
const providers: Provider[] = [
  directMediaProvider,
  youtubeProvider,
  redditProvider,
  genericOembedProvider, // fallback for some public oEmbed endpoints
]

export function getAllProviders(): ProviderInfo[] {
  return providers.map((p) => ({ ...p.info }))
}

export function findProvider(hostname: string, url: string): Provider | null {
  // Prefer more specific providers first
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
