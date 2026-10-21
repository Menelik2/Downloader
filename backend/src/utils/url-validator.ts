/**
 * Secure URL validation and SSRF protection.
 * Treats every submitted URL as untrusted.
 */

import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { URL } from 'node:url'

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'metadata.google.internal',
  'metadata',
  'instance-data',
])

/** Private, loopback, link-local, reserved ranges (CIDR-style checks) */
function isPrivateOrReservedIp(ip: string): boolean {
  if (ip === '::1' || ip === '0.0.0.0') return true

  // IPv4
  if (isIP(ip) === 4) {
    const parts = ip.split('.').map(Number)
    const [a, b] = parts
    if (a === 10) return true // 10.0.0.0/8
    if (a === 127) return true // 127.0.0.0/8
    if (a === 0) return true // 0.0.0.0/8
    if (a === 169 && b === 254) return true // 169.254.0.0/16 (link-local / metadata)
    if (a === 172 && b >= 16 && b <= 31) return true // 172.16.0.0/12
    if (a === 192 && b === 168) return true // 192.168.0.0/16
    if (a === 100 && b >= 64 && b <= 127) return true // 100.64.0.0/10 (CGNAT)
    if (a >= 224) return true // multicast / reserved
    return false
  }

  // IPv6 simplified checks
  if (isIP(ip) === 6) {
    const lower = ip.toLowerCase()
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true // unique local
    if (lower.startsWith('fe80')) return true // link-local
    if (lower === '::' || lower === '::1') return true
    return false
  }

  return true // unknown → block
}

export interface ValidatedUrl {
  href: string
  hostname: string
  protocol: 'http:' | 'https:'
}

/**
 * Validate a user-supplied URL for safety before any outbound request.
 * Rejects non-http(s), private IPs, blocked hostnames, and overly long URLs.
 */
export async function validateAndNormalizeUrl(
  raw: string,
  options: { maxLength?: number } = {}
): Promise<{ ok: true; url: ValidatedUrl } | { ok: false; error: string; code: string }> {
  const maxLength = options.maxLength ?? 2048

  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return { ok: false, error: 'URL is required', code: 'URL_REQUIRED' }
  }

  const trimmed = raw.trim()
  if (trimmed.length > maxLength) {
    return { ok: false, error: 'URL is too long', code: 'URL_TOO_LONG' }
  }

  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return { ok: false, error: 'Invalid URL format', code: 'URL_INVALID' }
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return {
      ok: false,
      error: 'Only HTTP and HTTPS URLs are allowed',
      code: 'URL_SCHEME_NOT_ALLOWED',
    }
  }

  const hostname = parsed.hostname.toLowerCase()

  if (!hostname || hostname.length === 0) {
    return { ok: false, error: 'Hostname is required', code: 'URL_NO_HOST' }
  }

  if (BLOCKED_HOSTNAMES.has(hostname)) {
    return { ok: false, error: 'This hostname is not allowed', code: 'URL_HOST_BLOCKED' }
  }

  // Block numeric IP hostnames that resolve to private ranges
  if (isIP(hostname)) {
    if (isPrivateOrReservedIp(hostname)) {
      return {
        ok: false,
        error: 'Private or reserved IP addresses are not allowed',
        code: 'URL_PRIVATE_IP',
      }
    }
  } else {
    // Resolve DNS and check resulting addresses
    try {
      const addresses = await lookup(hostname, { all: true })
      for (const { address } of addresses) {
        if (isPrivateOrReservedIp(address)) {
          return {
            ok: false,
            error: 'Hostname resolves to a private or reserved address',
            code: 'URL_RESOLVES_PRIVATE',
          }
        }
      }
    } catch {
      return {
        ok: false,
        error: 'Unable to resolve hostname',
        code: 'URL_DNS_FAILED',
      }
    }
  }

  // Rebuild a clean href (removes credentials if any were present)
  const clean = new URL(parsed.href)
  clean.username = ''
  clean.password = ''

  return {
    ok: true,
    url: {
      href: clean.href,
      hostname: clean.hostname,
      protocol: clean.protocol as 'http:' | 'https:',
    },
  }
}

/**
 * Re-validate a redirect destination before following it.
 */
export async function validateRedirectTarget(
  location: string,
  originalHostname: string
): Promise<{ ok: true; url: ValidatedUrl } | { ok: false; error: string; code: string }> {
  const result = await validateAndNormalizeUrl(location)
  if (!result.ok) return result

  // Optional: restrict redirects to same host for extra safety in some providers
  // (commented out by default – many CDNs use different domains)
  // if (result.url.hostname !== originalHostname) { ... }

  return result
}
