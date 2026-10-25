/**
 * Direct public media provider.
 * Handles URLs that point directly to a publicly accessible media file
 * (mp4, webm, mp3, etc.) with no authentication or DRM.
 *
 * This is one of the few cases where a download is clearly authorized:
 * the user is requesting a file that the server already serves openly.
 */

import type { Provider } from './types.js'
import type { AnalyzeResult, MediaFormat } from '../types/index.js'
import { safeFetch } from '../utils/safe-fetch.js'
import path from 'node:path'
import { createWriteStream } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { randomBytes } from 'node:crypto'

const MEDIA_EXTENSIONS = new Set([
  'mp4',
  'webm',
  'mkv',
  'mov',
  'm4v',
  'mp3',
  'm4a',
  'ogg',
  'wav',
  'flac',
  'aac',
  'opus',
])

const MEDIA_MIME_PREFIXES = ['video/', 'audio/']

function getExtension(url: string): string | null {
  try {
    const pathname = new URL(url).pathname
    const ext = path.extname(pathname).slice(1).toLowerCase()
    return ext || null
  } catch {
    return null
  }
}

function isLikelyMediaUrl(url: string): boolean {
  const ext = getExtension(url)
  return ext !== null && MEDIA_EXTENSIONS.has(ext)
}

export const directMediaProvider: Provider = {
  info: {
    id: 'direct-media',
    name: 'Direct Media',
    status: 'available',
    capabilities: ['metadata', 'download'],
    mediaTypes: ['video', 'audio'],
    notes:
      'Supports publicly accessible direct media file URLs (mp4, webm, mp3, etc.). No DRM or private content.',
  },

  matches(hostname: string, url: string): boolean {
    return isLikelyMediaUrl(url)
  },

  async analyze(ctx): Promise<AnalyzeResult> {
    const head = await safeFetch(ctx.url, { method: 'HEAD', timeoutMs: 10_000 })
    if (!head.ok) {
      const get = await safeFetch(ctx.url, {
        method: 'GET',
        maxBytes: 64 * 1024,
        timeoutMs: 10_000,
      })
      if (!get.ok) {
        return {
          success: false,
          error: get.error,
          errorCode: get.code,
          message: 'Could not reach the media URL.',
        }
      }
      return buildResultFromResponse(ctx.url, get.response, get.finalUrl)
    }
    return buildResultFromResponse(ctx.url, head.response, head.finalUrl)
  },

  async prepareDownload(ctx, formatId) {
    if (formatId !== 'original') {
      return { ok: false, error: 'Unknown format', code: 'FORMAT_UNKNOWN' }
    }

    const tmpRoot = process.env.TMP_DIR || './tmp'
    await mkdir(tmpRoot, { recursive: true })

    const id = randomBytes(16).toString('hex')
    const ext = getExtension(ctx.url) || 'bin'
    const filename = `media-${id}.${ext}`
    const filePath = path.join(tmpRoot, filename)
    const maxBytes = (Number(process.env.MAX_FILE_SIZE_MB) || 500) * 1024 * 1024

    const { validateAndNormalizeUrl } = await import('../utils/url-validator.js')
    const validated = await validateAndNormalizeUrl(ctx.url)
    if (!validated.ok) {
      return { ok: false, error: validated.error, code: validated.code }
    }

    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 120_000)

      const res = await fetch(validated.url.href, {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'User-Agent':
            'LinkFetch/1.0 (+https://github.com/Menelik2/Downloader; media-analyzer)',
        },
      })
      clearTimeout(timer)

      if (res.status >= 300 && res.status < 400) {
        return {
          ok: false,
          error: 'Redirect not followed for security reasons. Use the final media URL directly.',
          code: 'REDIRECT_BLOCKED',
        }
      }

      if (!res.ok) {
        return {
          ok: false,
          error: `Remote server returned ${res.status}`,
          code: 'REMOTE_HTTP_ERROR',
        }
      }

      const contentLength = res.headers.get('content-length')
      if (contentLength && parseInt(contentLength, 10) > maxBytes) {
        return {
          ok: false,
          error: 'File exceeds maximum allowed size',
          code: 'FILE_TOO_LARGE',
        }
      }

      if (!res.body) {
        return { ok: false, error: 'Empty body', code: 'EMPTY_BODY' }
      }

      const reader = res.body.getReader()
      const fileStream = createWriteStream(filePath)
      let written = 0

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          written += value.byteLength
          if (written > maxBytes) {
            reader.cancel()
            fileStream.destroy()
            throw new Error('FILE_TOO_LARGE')
          }
          if (!fileStream.write(Buffer.from(value))) {
            await new Promise<void>((resolve) => fileStream.once('drain', resolve))
          }
        }
        await new Promise<void>((resolve, reject) => {
          fileStream.end(() => resolve())
          fileStream.on('error', reject)
        })
      } catch (e) {
        fileStream.destroy()
        throw e
      }

      const contentType =
        res.headers.get('content-type') ||
        (ext === 'mp3' || ext === 'm4a' ? 'audio/mpeg' : 'video/mp4')

      return {
        ok: true,
        filePath,
        contentType,
        filename: `download.${ext}`,
      }
    } catch (err) {
      try {
        const { unlink } = await import('node:fs/promises')
        await unlink(filePath)
      } catch {
        /* ignore */
      }
      const message = err instanceof Error ? err.message : 'Download failed'
      if (message === 'FILE_TOO_LARGE' || message.includes('FILE_TOO_LARGE')) {
        return { ok: false, error: 'File exceeds maximum allowed size', code: 'FILE_TOO_LARGE' }
      }
      if (err instanceof Error && err.name === 'AbortError') {
        return { ok: false, error: 'Download timed out', code: 'TIMEOUT' }
      }
      return { ok: false, error: message, code: 'DOWNLOAD_FAILED' }
    }
  },
}

function buildResultFromResponse(
  originalUrl: string,
  response: Response,
  finalUrl: string
): AnalyzeResult {
  const contentType = response.headers.get('content-type') || ''
  const contentLength = response.headers.get('content-length')
  const size = contentLength ? parseInt(contentLength, 10) : undefined

  const isMedia =
    MEDIA_MIME_PREFIXES.some((p) => contentType.startsWith(p)) ||
    isLikelyMediaUrl(finalUrl)

  if (!isMedia) {
    return {
      success: false,
      error: 'URL does not appear to be a direct media file',
      errorCode: 'NOT_MEDIA',
      message: 'This link does not point to a publicly accessible media file.',
    }
  }

  const ext = getExtension(finalUrl) || 'bin'
  const hasVideo = contentType.startsWith('video/') || ['mp4', 'webm', 'mkv', 'mov'].includes(ext)
  const hasAudio =
    contentType.startsWith('audio/') ||
    ['mp3', 'm4a', 'ogg', 'wav', 'flac', 'aac', 'opus'].includes(ext) ||
    hasVideo

  const format: MediaFormat = {
    id: 'original',
    label: hasVideo ? 'Original video' : 'Original audio',
    quality: 'original',
    ext,
    filesize: Number.isFinite(size) ? size : undefined,
    hasVideo,
    hasAudio,
    authorized: true,
    url: finalUrl,
  }

  return {
    success: true,
    provider: {
      id: 'direct-media',
      name: 'Direct Media',
      status: 'available',
      capabilities: ['metadata', 'download'],
      mediaTypes: hasVideo ? ['video'] : ['audio'],
    },
    title: path.basename(new URL(finalUrl).pathname) || 'Media file',
    formats: [format],
    officialUrl: finalUrl,
    message: 'Public media file detected. You can download it directly.',
  }
}
