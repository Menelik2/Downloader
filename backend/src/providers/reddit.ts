/**
 * Reddit provider – public posts / media when available via public endpoints.
 * Does not bypass any authentication or private subreddit restrictions.
 */

import type { Provider } from './types.js'
import type { AnalyzeResult, MediaFormat } from '../types/index.js'
import { safeFetch } from '../utils/safe-fetch.js'

const REDDIT_HOSTS = new Set([
  'reddit.com',
  'www.reddit.com',
  'old.reddit.com',
  'm.reddit.com',
  'redd.it',
  'www.redd.it',
])

export const redditProvider: Provider = {
  info: {
    id: 'reddit',
    name: 'Reddit',
    status: 'limited',
    capabilities: ['metadata', 'download'],
    mediaTypes: ['video', 'image'],
    notes:
      'Supports public Reddit posts with direct media. Private or restricted content is not accessible.',
  },

  matches(hostname: string): boolean {
    return REDDIT_HOSTS.has(hostname.toLowerCase()) || hostname.endsWith('.redd.it')
  },

  async analyze(ctx): Promise<AnalyzeResult> {
    // Prefer the .json endpoint for public posts
    let jsonUrl = ctx.url
    if (!jsonUrl.endsWith('.json') && !jsonUrl.includes('.json?')) {
      // Clean trailing slash and append .json
      jsonUrl = ctx.url.replace(/\/?$/, '') + '.json'
    }

    const result = await safeFetch(jsonUrl, {
      timeoutMs: 12_000,
      maxBytes: 512 * 1024,
      headers: {
        // Reddit sometimes prefers a browser-like UA for the JSON endpoint
        'User-Agent': 'LinkFetch/1.0 (public media analyzer)',
      },
    })

    if (!result.ok || !result.body) {
      return {
        success: false,
        error: result.ok ? 'Empty response' : result.error,
        errorCode: result.ok ? 'EMPTY' : result.code,
        message: 'Could not fetch public Reddit post data. The post may be private, deleted, or restricted.',
      }
    }

    try {
      const text = new TextDecoder().decode(result.body)
      const data = JSON.parse(text)

      // Reddit JSON is usually an array of listings
      const post =
        Array.isArray(data) && data[0]?.data?.children?.[0]?.data
          ? data[0].data.children[0].data
          : data?.data?.children?.[0]?.data

      if (!post) {
        return {
          success: false,
          error: 'Unexpected Reddit response shape',
          errorCode: 'PARSE_ERROR',
          message: 'Could not parse the Reddit post.',
        }
      }

      const title: string = post.title || 'Reddit post'
      const permalink: string = post.permalink
        ? `https://www.reddit.com${post.permalink}`
        : ctx.url

      const formats: MediaFormat[] = []

      // Direct video (v.redd.it)
      if (post.is_video && post.media?.reddit_video?.fallback_url) {
        const videoUrl = post.media.reddit_video.fallback_url.split('?')[0]
        formats.push({
          id: 'reddit-video',
          label: 'Reddit video',
          quality: post.media.reddit_video.height
            ? `${post.media.reddit_video.height}p`
            : undefined,
          ext: 'mp4',
          hasVideo: true,
          hasAudio: false, // note: Reddit often separates audio
          authorized: true,
          url: videoUrl,
        })
      }

      // Preview / image
      if (post.url && /\.(jpg|jpeg|png|gif|webp)$/i.test(post.url)) {
        formats.push({
          id: 'reddit-image',
          label: 'Image',
          ext: post.url.split('.').pop()?.toLowerCase() || 'jpg',
          hasVideo: false,
          hasAudio: false,
          authorized: true,
          url: post.url,
        })
      }

      // Gallery or other secure_media
      if (post.secure_media?.reddit_video?.fallback_url) {
        const videoUrl = post.secure_media.reddit_video.fallback_url.split('?')[0]
        if (!formats.some((f) => f.url === videoUrl)) {
          formats.push({
            id: 'reddit-secure-video',
            label: 'Reddit video',
            ext: 'mp4',
            hasVideo: true,
            hasAudio: false,
            authorized: true,
            url: videoUrl,
          })
        }
      }

      if (formats.length === 0) {
        return {
          success: true,
          provider: {
            id: 'reddit',
            name: 'Reddit',
            status: 'limited',
            capabilities: ['metadata'],
            mediaTypes: [],
          },
          title,
          officialUrl: permalink,
          formats: [],
          message:
            'No directly downloadable media was found on this public post. You can open it on Reddit.',
        }
      }

      return {
        success: true,
        provider: {
          id: 'reddit',
          name: 'Reddit',
          status: 'available',
          capabilities: ['metadata', 'download'],
          mediaTypes: formats.some((f) => f.hasVideo) ? ['video'] : ['image'],
        },
        title,
        thumbnail: post.thumbnail && post.thumbnail.startsWith('http') ? post.thumbnail : undefined,
        officialUrl: permalink,
        formats,
        message: 'Public media found. You can download the available format(s).',
      }
    } catch (err) {
      return {
        success: false,
        error: 'Failed to parse Reddit response',
        errorCode: 'PARSE_ERROR',
        message: 'The post may be private, deleted, or the format changed.',
      }
    }
  },

  async prepareDownload(ctx, formatId) {
    // Re-analyze to get the fresh authorized URL
    const analysis = await this.analyze(ctx)
    if (!analysis.success || !analysis.formats) {
      return { ok: false, error: 'Could not refresh media info', code: 'REFRESH_FAILED' }
    }
    const format = analysis.formats.find((f) => f.id === formatId)
    if (!format || !format.authorized || !format.url) {
      return { ok: false, error: 'Format not available for download', code: 'FORMAT_UNAVAILABLE' }
    }

    // Delegate to a simple stream download (reuse logic similar to direct-media)
    const { directMediaProvider } = await import('./direct-media.js')
    return directMediaProvider.prepareDownload!(
      { url: format.url, hostname: new URL(format.url).hostname },
      'original'
    )
  },
}
