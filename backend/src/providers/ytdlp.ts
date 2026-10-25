/**
 * Real multi-platform downloader powered by yt-dlp.
 *
 * Requires yt-dlp on the server (and ideally ffmpeg for merges).
 * Install: pip install -U yt-dlp   OR   download binary from github.com/yt-dlp/yt-dlp
 *
 * Important:
 * - Only public / non-DRM content that yt-dlp can extract.
 * - Respect site ToS and local law. Hosting a public download service for
 *   platforms that forbid it may violate their terms and get IPs blocked.
 * - Private, age-gated, login-only, and DRM-protected media are not supported.
 */

import { spawn } from 'node:child_process'
import { mkdir, readdir, unlink, stat } from 'node:fs/promises'
import path from 'node:path'
import { randomBytes } from 'node:crypto'
import type { Provider } from './types.js'
import type { AnalyzeResult, MediaFormat } from '../types/index.js'

const YTDLP_BIN = process.env.YTDLP_PATH || 'yt-dlp'
const MAX_DURATION_SEC = Number(process.env.MAX_VIDEO_DURATION_SEC) || 3600
const MAX_FILE_MB = Number(process.env.MAX_FILE_SIZE_MB) || 500
const DOWNLOAD_TIMEOUT_MS = Number(process.env.YTDLP_TIMEOUT_MS) || 180_000

const HOST_PATTERNS: Array<{ test: (h: string) => boolean; name: string }> = [
  { test: (h) => h.includes('youtube.com') || h === 'youtu.be', name: 'YouTube' },
  { test: (h) => h.includes('tiktok.com'), name: 'TikTok' },
  { test: (h) => h.includes('instagram.com'), name: 'Instagram' },
  { test: (h) => h === 'x.com' || h.includes('twitter.com'), name: 'X (Twitter)' },
  { test: (h) => h.includes('facebook.com') || h.includes('fb.watch'), name: 'Facebook' },
  { test: (h) => h.includes('reddit.com') || h.includes('redd.it'), name: 'Reddit' },
  { test: (h) => h.includes('vimeo.com'), name: 'Vimeo' },
  { test: (h) => h.includes('dailymotion.com') || h.includes('dai.ly'), name: 'Dailymotion' },
  { test: (h) => h.includes('twitch.tv'), name: 'Twitch' },
  { test: (h) => h.includes('pinterest.com') || h.includes('pin.it'), name: 'Pinterest' },
  { test: (h) => h.includes('soundcloud.com'), name: 'SoundCloud' },
  { test: (h) => h.includes('bilibili.com'), name: 'Bilibili' },
]

function matchPlatform(hostname: string): string | null {
  const h = hostname.toLowerCase()
  for (const p of HOST_PATTERNS) {
    if (p.test(h)) return p.name
  }
  return null
}

interface YtDlpFormat {
  format_id: string
  ext?: string
  resolution?: string
  height?: number
  width?: number
  fps?: number
  vcodec?: string
  acodec?: string
  filesize?: number
  filesize_approx?: number
  format_note?: string
  tbr?: number
}

interface YtDlpInfo {
  id?: string
  title?: string
  thumbnail?: string
  duration?: number
  webpage_url?: string
  extractor?: string
  formats?: YtDlpFormat[]
}

function runYtDlp(
  args: string[],
  opts: { timeoutMs?: number; cwd?: string } = {}
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(YTDLP_BIN, args, {
      cwd: opts.cwd,
      env: { ...process.env, PYTHONUNBUFFERED: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      reject(new Error('yt-dlp timed out'))
    }, opts.timeoutMs ?? DOWNLOAD_TIMEOUT_MS)

    child.stdout.on('data', (d: Buffer) => {
      stdout += d.toString('utf8')
    })
    child.stderr.on('data', (d: Buffer) => {
      stderr += d.toString('utf8')
    })
    child.on('error', (err) => {
      clearTimeout(timer)
      reject(err)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      resolve({ code: code ?? 1, stdout, stderr })
    })
  })
}

let ytdlpAvailable: boolean | null = null

export async function checkYtDlpAvailable(): Promise<boolean> {
  if (ytdlpAvailable !== null) return ytdlpAvailable
  try {
    const r = await runYtDlp(['--version'], { timeoutMs: 10_000 })
    ytdlpAvailable = r.code === 0
  } catch {
    ytdlpAvailable = false
  }
  return ytdlpAvailable
}

function pickFormats(info: YtDlpInfo): MediaFormat[] {
  const formats = info.formats || []
  const out: MediaFormat[] = []
  const seen = new Set<string>()

  const progressive = formats.filter(
    (f) =>
      f.vcodec &&
      f.vcodec !== 'none' &&
      f.acodec &&
      f.acodec !== 'none' &&
      f.ext &&
      ['mp4', 'webm', 'mkv'].includes(f.ext)
  )

  const byHeight = new Map<number, YtDlpFormat>()
  for (const f of progressive) {
    const h = f.height || 0
    if (!byHeight.has(h) || (f.filesize || 0) < (byHeight.get(h)!.filesize || Infinity)) {
      byHeight.set(h, f)
    }
  }

  const heights = [...byHeight.keys()].sort((a, b) => b - a).slice(0, 6)
  for (const h of heights) {
    const f = byHeight.get(h)!
    if (seen.has(f.format_id)) continue
    seen.add(f.format_id)
    const size = f.filesize || f.filesize_approx
    out.push({
      id: f.format_id,
      label: h ? `${h}p` : f.format_note || 'Video',
      quality: h ? `${h}p` : f.resolution || f.format_note,
      ext: f.ext || 'mp4',
      filesize: size,
      hasVideo: true,
      hasAudio: true,
      authorized: true,
    })
  }

  if (!out.some((x) => x.id.includes('+'))) {
    const bestVideo = formats
      .filter((f) => f.vcodec && f.vcodec !== 'none' && f.height)
      .sort((a, b) => (b.height || 0) - (a.height || 0))[0]
    const bestAudio = formats
      .filter((f) => f.acodec && f.acodec !== 'none' && (!f.vcodec || f.vcodec === 'none'))
      .sort((a, b) => (b.tbr || 0) - (a.tbr || 0))[0]

    if (bestVideo && bestAudio) {
      const id = `${bestVideo.format_id}+${bestAudio.format_id}`
      if (!seen.has(id)) {
        out.unshift({
          id,
          label: bestVideo.height ? `Best ${bestVideo.height}p (merged)` : 'Best quality (merged)',
          quality: bestVideo.height ? `${bestVideo.height}p` : 'best',
          ext: 'mp4',
          hasVideo: true,
          hasAudio: true,
          authorized: true,
        })
      }
    }
  }

  const audio = formats
    .filter((f) => f.acodec && f.acodec !== 'none' && (!f.vcodec || f.vcodec === 'none'))
    .sort((a, b) => (b.tbr || 0) - (a.tbr || 0))[0]
  if (audio) {
    out.push({
      id: audio.format_id,
      label: 'Audio only',
      quality: audio.format_note || 'audio',
      ext: audio.ext || 'm4a',
      filesize: audio.filesize || audio.filesize_approx,
      hasVideo: false,
      hasAudio: true,
      authorized: true,
    })
  }

  if (out.length === 0) {
    out.push({
      id: 'bv*+ba/b',
      label: 'Best available',
      quality: 'best',
      ext: 'mp4',
      hasVideo: true,
      hasAudio: true,
      authorized: true,
    })
  }

  return out.slice(0, 8)
}

export const ytdlpProvider: Provider = {
  info: {
    id: 'ytdlp',
    name: 'Multi-platform (yt-dlp)',
    status: 'available',
    capabilities: ['metadata', 'download'],
    mediaTypes: ['video', 'audio'],
    notes:
      'Real downloads via yt-dlp for public media. Requires yt-dlp installed on the server. Private, DRM, and login-only content are not supported.',
  },

  matches(hostname: string): boolean {
    return matchPlatform(hostname) !== null
  },

  async analyze(ctx): Promise<AnalyzeResult> {
    const platform = matchPlatform(ctx.hostname) || 'Unknown'
    const available = await checkYtDlpAvailable()
    if (!available) {
      return {
        success: false,
        error: 'yt-dlp is not installed on this server',
        errorCode: 'YTDLP_MISSING',
        message:
          'Real downloads need yt-dlp. Install with: pip install -U yt-dlp (or set YTDLP_PATH).',
        officialUrl: ctx.url,
      }
    }

    try {
      const { code, stdout, stderr } = await runYtDlp(
        [
          '--dump-single-json',
          '--no-playlist',
          '--no-warnings',
          '--skip-download',
          '--no-check-certificates',
          '--',
          ctx.url,
        ],
        { timeoutMs: 45_000 }
      )

      if (code !== 0) {
        const err = stderr.slice(0, 400) || 'yt-dlp failed'
        return {
          success: false,
          error: err,
          errorCode: 'EXTRACT_FAILED',
          message:
            'Could not extract media from this link. It may be private, geo-blocked, age-gated, or unsupported.',
          officialUrl: ctx.url,
        }
      }

      const info = JSON.parse(stdout) as YtDlpInfo

      if (info.duration && info.duration > MAX_DURATION_SEC) {
        return {
          success: false,
          error: 'Video too long',
          errorCode: 'TOO_LONG',
          message: `Maximum duration is ${Math.floor(MAX_DURATION_SEC / 60)} minutes.`,
          officialUrl: info.webpage_url || ctx.url,
        }
      }

      const formats = pickFormats(info)

      return {
        success: true,
        provider: {
          id: 'ytdlp',
          name: platform,
          status: 'available',
          capabilities: ['metadata', 'download'],
          mediaTypes: ['video', 'audio'],
          notes: `Extracted with yt-dlp (${info.extractor || 'generic'}).`,
        },
        title: info.title || `${platform} media`,
        thumbnail: info.thumbnail,
        duration: info.duration,
        formats,
        officialUrl: info.webpage_url || ctx.url,
        message: formats.length
          ? 'Select a quality and download. Public media only.'
          : 'Metadata found but no downloadable formats.',
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Analysis failed'
      return {
        success: false,
        error: message,
        errorCode: 'YTDLP_ERROR',
        message: 'Failed to analyze this link with yt-dlp.',
        officialUrl: ctx.url,
      }
    }
  },

  async prepareDownload(ctx, formatId) {
    const available = await checkYtDlpAvailable()
    if (!available) {
      return { ok: false, error: 'yt-dlp is not installed', code: 'YTDLP_MISSING' }
    }

    const tmpRoot = process.env.TMP_DIR || './tmp'
    await mkdir(tmpRoot, { recursive: true })
    const jobDir = path.join(tmpRoot, `yt-${randomBytes(8).toString('hex')}`)
    await mkdir(jobDir, { recursive: true })

    const outTemplate = path.join(jobDir, 'media.%(ext)s')
    const maxBytes = MAX_FILE_MB * 1024 * 1024

    try {
      const args = [
        '--no-playlist',
        '--no-warnings',
        '--no-check-certificates',
        '-f',
        formatId || 'bv*+ba/b',
        '--merge-output-format',
        'mp4',
        '-o',
        outTemplate,
        '--max-filesize',
        `${MAX_FILE_MB}M`,
        '--',
        ctx.url,
      ]

      const { code, stderr } = await runYtDlp(args, {
        timeoutMs: DOWNLOAD_TIMEOUT_MS,
        cwd: jobDir,
      })

      if (code !== 0) {
        await cleanupDir(jobDir)
        return {
          ok: false,
          error: stderr.slice(0, 300) || 'Download failed',
          code: 'DOWNLOAD_FAILED',
        }
      }

      const files = await readdir(jobDir)
      const media = files.find((f) => !f.endsWith('.part') && !f.endsWith('.ytdl'))
      if (!media) {
        await cleanupDir(jobDir)
        return { ok: false, error: 'No output file produced', code: 'NO_OUTPUT' }
      }

      const filePath = path.join(jobDir, media)
      const st = await stat(filePath)
      if (st.size > maxBytes) {
        await cleanupDir(jobDir)
        return { ok: false, error: 'File exceeds size limit', code: 'FILE_TOO_LARGE' }
      }

      const ext = path.extname(media).slice(1).toLowerCase() || 'mp4'
      const contentType =
        ext === 'mp3' || ext === 'm4a' || ext === 'opus' || ext === 'ogg'
          ? 'audio/mpeg'
          : ext === 'webm'
            ? 'video/webm'
            : 'video/mp4'

      return {
        ok: true,
        filePath,
        contentType,
        filename: `download.${ext}`,
      }
    } catch (err) {
      await cleanupDir(jobDir)
      const message = err instanceof Error ? err.message : 'Download failed'
      return { ok: false, error: message, code: 'DOWNLOAD_FAILED' }
    }
  },
}

async function cleanupDir(dir: string) {
  try {
    const files = await readdir(dir)
    await Promise.all(files.map((f) => unlink(path.join(dir, f)).catch(() => {})))
  } catch {
    /* ignore */
  }
}
