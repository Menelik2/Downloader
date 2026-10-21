/**
 * Generic oEmbed provider for platforms that publish public oEmbed endpoints.
 * Used as a fallback for metadata only – never claims download capability
 * unless a direct media URL is clearly present.
 */

import type { Provider } from './types.js'
import type { AnalyzeResult } from '../types/index.js'
import { safeFetch } from '../utils/safe-fetch.js'

/** Known public oEmbed endpoints (no API key required) */
const OEMBED_ENDPOINTS: { match: (host: string) => boolean; endpoint: string }[] = [
  {
    match: (h) => h === 'vimeo.com' || h === 'www.vimeo.com' || h.endsWith('.vimeo.com'),
    endpoint: 'https://vimeo.com/api/oembed.json',
  },
  {
    match: (h) =>
      h === 'soundcloud.com' || h === 'www.soundcloud.com' || h.endsWith('.soundcloud.com'),
    endpoint: 'https://soundcloud.com/oembed',
  },
  {
    match: (h) => h === 'dailymotion.com' || h === 'www.dailymotion.com',
    endpoint: 'https://www.dailymotion.com/services/oembed',
  },
]

export const genericOembedProvider: Provider = {
  info: {
    id: 'oembed',
    name: 'oEmbed (public metadata)',
    status: 'limited',
    capabilities: ['metadata', 'official-link'],
    mediaTypes: ['video', 'audio'],
    notes: 'Provides public metadata via oEmbed where available. Direct downloads are not performed through this provider.',
  },

  matches(hostname: string): boolean {
    return OEMBED_ENDPOINTS.some((e) => e.match(hostname.toLowerCase()))
  },

  async analyze(ctx): Promise<AnalyzeResult> {
    const entry = OEMBED_ENDPOINTS.find((e) => e.match(ctx.hostname.toLowerCase()))
    if (!entry) {
      return {
        success: false,
        error: 'No oEmbed endpoint configured',
        errorCode: 'NO_ENDPOINT',
      }
    }

    const oembedUrl = `${entry.endpoint}?url=${encodeURIComponent(ctx.url)}&format=json`

    const result = await safeFetch(oembedUrl, {
      timeoutMs: 10_000,
      maxBytes: 128 * 1024,
    })

    if (!result.ok || !result.body) {
      return {
        success: false,
        error: result.ok ? 'Empty oEmbed response' : result.error,
        errorCode: result.ok ? 'EMPTY' : result.code,
        message: 'Could not retrieve public metadata for this link.',
      }
    }

    try {
      const text = new TextDecoder().decode(result.body)
      const data = JSON.parse(text) as {
        title?: string
        author_name?: string
        thumbnail_url?: string
        provider_name?: string
        html?: string
        duration?: number
      }

      return {
        success: true,
        provider: {
          id: 'oembed',
          name: data.provider_name || 'oEmbed',
          status: 'limited',
          capabilities: ['metadata', 'official-link'],
          mediaTypes: ['video', 'audio'],
          notes: 'Metadata only. Direct download is not available through this provider.',
        },
        title: data.title,
        thumbnail: data.thumbnail_url,
        duration: data.duration,
        officialUrl: ctx.url,
        formats: [],
        message:
          'Public metadata retrieved. Direct download is not offered for this platform through LinkFetch. Use the official player.',
      }
    } catch {
      return {
        success: false,
        error: 'Failed to parse oEmbed response',
        errorCode: 'PARSE_ERROR',
      }
    }
  },
}
