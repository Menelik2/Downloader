export type ProviderStatus = 'available' | 'limited' | 'unavailable' | 'maintenance'

export interface ProviderInfo {
  id: string
  name: string
  icon?: string
  status: ProviderStatus
  capabilities: string[]
  mediaTypes: string[]
  notes?: string
}

export interface MediaFormat {
  id: string
  label: string
  quality?: string
  ext: string
  filesize?: number
  hasVideo: boolean
  hasAudio: boolean
  authorized: boolean
  url?: string
}

export interface AnalyzeResult {
  success: boolean
  provider?: ProviderInfo
  title?: string
  thumbnail?: string
  duration?: number
  formats?: MediaFormat[]
  officialUrl?: string
  message?: string
  error?: string
  errorCode?: string
}

export type JobStatus =
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'expired'

export interface Job {
  id: string
  status: JobStatus
  progress: number
  message?: string
  downloadToken?: string
  error?: string
  createdAt: string
  updatedAt: string
  filePath?: string
  expiresAt: number
  providerId?: string
  formatId?: string
  originalUrl?: string
}

export interface HealthResponse {
  status: 'ok' | 'degraded'
  version: string
  timestamp: string
  dependencies: {
    tmpDir: boolean
    ffmpeg: boolean
    ytdlp?: boolean
  }
  limits: {
    maxConcurrentJobs: number
    maxFileSizeMb: number
    jobTtlMs: number
  }
}
