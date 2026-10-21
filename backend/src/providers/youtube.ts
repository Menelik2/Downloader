/**
 * YouTube provider – compliant implementation.
 *
 * IMPORTANT: This provider does NOT extract streams, download videos,
 * or bypass any platform restrictions. It only:
 *   1. Recognizes YouTube / YouTube Shorts URLs
 *   2. Attempts to obtain public oEmbed metadata (title, thumbnail)
 *   3. Returns the official watch URL so the user can view on YouTube
 *
 * Direct file downloads are intentionally not offered.
 * See YouTube Terms of Service and developer policies.
 */

import type { Provider } from './types.js'
import type { AnalyzeResult } from '../types/index.js'
import { safeFetch } from '../utils/safe-fetch.js'

const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtu.be',
  'www.youtu.be',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
])

function extractVideoId(url: string): string | null {
  try {
    const u = new URL(url)
    if (u.hostname === 'youtu.be' || u.hostname === 'www.youtu.be') {
      return u.pathname.slice(1).split('/')[0] || null
    }
    if (u.searchParams.has('v')) {
      return u.searchParams.get('v')
    }
    // /shorts/ID or /embed/ID or /v/ID
    const match = u.pathname.match(/\/(shorts|embed|v)\/([a-zA-Z0-9_-]{6,})/)
    if (match) return match[2]
    return null
  } catch {
    return null
  }
}

export const youtubeProvider: Provider = {
  info: {
    id: 'youtube',
    name: 'YouTube',
    status: 'limited',
    capabilities: ['metadata', 'official-link'],
    mediaTypes: ['video'],
    notes:
      'Metadata and official watch link only. Direct downloads are not available through this service in accordance with YouTube terms.',
  },

  matches(hostname: string): boolean {
    return YOUTUBE_HOSTS.has(hostname.toLowerCase())
  },

  async analyze(ctx): Promise<AnalyzeResult> {
    const videoId = extractVideoId(ctx.url)
    if (!videoId) {
      return {
        success: false,
        error: 'Could not extract a valid YouTube video ID',
        errorCode: 'INVALID_YOUTUBE_URL',
        message: 'Please provide a valid YouTube or YouTube Shorts URL.',
      }
    }

    const officialUrl = `https://www.youtube.com/watch?v=${videoId}`

    // Public oEmbed endpoint (no API key required for basic metadata)
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(officialUrl)}&format=json`

    const result = await safeFetch(oembedUrl, {
      timeoutMs: 10_000,
      maxBytes: 64 * 1024,
    })

    if (!result.ok || !result.body) {
      // Still return a useful response with the official link
      return {
        success: true,
        provider: {
          id: 'youtube',
          name: 'YouTube',
          status: 'limited',
          capabilities: ['official-link'],
          mediaTypes: ['video'],
          notes: 'Metadata temporarily unavailable. You can still open the video on YouTube.',
        },
        title: `YouTube video (${videoId})`,
        officialUrl,
        formats: [],
        message:
          'Direct download is not available. Open the official link to watch on YouTube.',
      }
    }

    try {
      const text = new TextDecoder().decode(result.body)
      const data = JSON.parse(text) as {
        title?: string
        author_name?: string
        thumbnail_url?: string
      }

      return {
        success: true,
        provider: {
          id: 'youtube',
          name: 'YouTube',
          status: 'limited',
          capabilities: ['metadata', 'official-link'],
          mediaTypes: ['video'],
          notes:
            'Direct downloads are not offered. Use the official YouTube player.',
        },
        title: data.title || `YouTube video (${videoId})`,
        thumbnail: data.thumbnail_url,
        officialUrl,
        formats: [], // no authorized download formats
        message:
          'Direct download is not available through LinkFetch. Please use the official YouTube player or YouTube’s own download features where available.',
      }
    } catch {
      return {
        success: true,
        provider: {
          id: 'youtube',
          name: 'YouTube',
          status: 'limited',
          capabilities: ['official-link'],
          mediaTypes: ['video'],
        },
        title: `YouTube video (${videoId})`,
        officialUrl,
        formats: [],
        message:
          'Direct download is not available. Open the official link to watch on YouTube.',
      }
    }
  },
}
