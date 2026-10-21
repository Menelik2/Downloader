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

export interface AnalyzeRequest {
  url: string
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
}

export interface AnalyzeResponse {
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

export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'expired'

export interface Job {
  id: string
  status: JobStatus
  progress?: number
  message?: string
  downloadToken?: string
  error?: string
  createdAt: string
  updatedAt: string
}
