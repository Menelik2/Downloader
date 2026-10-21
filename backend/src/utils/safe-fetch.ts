/**
 * Safe outbound fetch with redirect validation and size limits.
 */

import { validateAndNormalizeUrl, validateRedirectTarget } from './url-validator.js'

const DEFAULT_TIMEOUT_MS = 15_000
const MAX_REDIRECTS = 5
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024 // 2 MB for metadata responses

export interface SafeFetchOptions {
  timeoutMs?: number
  maxRedirects?: number
  maxBytes?: number
  headers?: Record<string, string>
  method?: 'GET' | 'HEAD'
}

export async function safeFetch(
  rawUrl: string,
  options: SafeFetchOptions = {}
): Promise<
  | { ok: true; response: Response; finalUrl: string; body?: ArrayBuffer }
  | { ok: false; error: string; code: string }
> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const maxRedirects = options.maxRedirects ?? MAX_REDIRECTS
  const maxBytes = options.maxBytes ?? MAX_RESPONSE_BYTES

  let currentUrl = rawUrl
  let redirects = 0

  while (true) {
    const validated = await validateAndNormalizeUrl(currentUrl)
    if (!validated.ok) {
      return { ok: false, error: validated.error, code: validated.code }
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const res = await fetch(validated.url.href, {
        method: options.method ?? 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'User-Agent':
            'LinkFetch/1.0 (+https://github.com/Menelik2/Downloader; media-analyzer)',
          Accept: 'text/html,application/json,application/xhtml+xml,*/*;q=0.8',
          ...options.headers,
        },
      })

      clearTimeout(timer)

      // Handle redirects manually so we can re-validate each hop
      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get('location')
        if (!location) {
          return { ok: false, error: 'Redirect without Location header', code: 'REDIRECT_NO_LOCATION' }
        }
        if (redirects >= maxRedirects) {
          return { ok: false, error: 'Too many redirects', code: 'TOO_MANY_REDIRECTS' }
        }
        const absolute = new URL(location, validated.url.href).href
        const revalidated = await validateRedirectTarget(absolute, validated.url.hostname)
        if (!revalidated.ok) {
          return { ok: false, error: revalidated.error, code: revalidated.code }
        }
        currentUrl = revalidated.url.href
        redirects++
        continue
      }

      if (!res.ok) {
        return {
          ok: false,
          error: `Remote server returned ${res.status}`,
          code: 'REMOTE_HTTP_ERROR',
        }
      }

      // For HEAD we just return the response
      if ((options.method ?? 'GET') === 'HEAD') {
        return { ok: true, response: res, finalUrl: validated.url.href }
      }

      // Read body with size limit
      const reader = res.body?.getReader()
      if (!reader) {
        return { ok: true, response: res, finalUrl: validated.url.href }
      }

      const chunks: Uint8Array[] = []
      let total = 0
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        total += value.byteLength
        if (total > maxBytes) {
          reader.cancel()
          return {
            ok: false,
            error: 'Response body too large for metadata fetch',
            code: 'RESPONSE_TOO_LARGE',
          }
        }
        chunks.push(value)
      }

      const body = new Uint8Array(total)
      let offset = 0
      for (const chunk of chunks) {
        body.set(chunk, offset)
        offset += chunk.byteLength
      }

      return {
        ok: true,
        response: res,
        finalUrl: validated.url.href,
        body: body.buffer,
      }
    } catch (err) {
      clearTimeout(timer)
      if (err instanceof Error && err.name === 'AbortError') {
        return { ok: false, error: 'Request timed out', code: 'TIMEOUT' }
      }
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Network error',
        code: 'NETWORK_ERROR',
      }
    }
  }
}
