import type { AnalyzeResponse, Job, ProviderInfo } from '@/types'

const API_BASE = import.meta.env.VITE_API_URL || '/api'

async function request<T>(
  path: string,
  options?: RequestInit
): Promise<{ ok: true; data: T } | { ok: false; error: string; status: number }> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return {
        ok: false,
        error: data.message || data.error || `Request failed (${res.status})`,
        status: res.status,
      }
    }
    return { ok: true, data: data as T }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Network error',
      status: 0,
    }
  }
}

export async function fetchProviders(): Promise<ProviderInfo[]> {
  const res = await request<{ providers: ProviderInfo[] }>('/providers')
  return res.ok ? res.data.providers : []
}

export async function analyzeUrl(url: string): Promise<AnalyzeResponse> {
  const res = await request<AnalyzeResponse>('/analyze', {
    method: 'POST',
    body: JSON.stringify({ url }),
  })
  if (res.ok) return res.data
  return {
    success: false,
    error: res.error,
    message: res.error,
  }
}

export async function startDownload(
  url: string,
  formatId: string,
  providerId?: string
): Promise<{ success: boolean; job?: Job; error?: string }> {
  const res = await request<{ success: boolean; job: Job }>('/download', {
    method: 'POST',
    body: JSON.stringify({ url, formatId, providerId }),
  })
  if (res.ok) return res.data
  return { success: false, error: res.error }
}

export async function getJob(id: string): Promise<Job | null> {
  const res = await request<{ job: Job }>(`/jobs/${id}`)
  return res.ok ? res.data.job : null
}

export async function cancelJob(id: string): Promise<boolean> {
  const res = await request(`/jobs/${id}`, { method: 'DELETE' })
  return res.ok
}

export function getDownloadUrl(jobId: string, token: string): string {
  return `${API_BASE}/download/${jobId}?token=${encodeURIComponent(token)}`
}
