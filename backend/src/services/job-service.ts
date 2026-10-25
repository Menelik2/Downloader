/**
 * In-memory job tracking with automatic expiration and cleanup.
 * No database. Jobs disappear on process restart (documented limitation).
 */

import { randomBytes } from 'node:crypto'
import { unlink } from 'node:fs/promises'
import type { Job } from '../types/index.js'

const jobs = new Map<string, Job>()

const JOB_TTL_MS = Number(process.env.JOB_TTL_MS) || 60 * 60 * 1000 // 1 hour
const MAX_CONCURRENT = Number(process.env.MAX_CONCURRENT_JOBS) || 5
const CLEANUP_INTERVAL_MS = 60_000

function generateId(): string {
  return randomBytes(16).toString('hex')
}

function generateToken(): string {
  return randomBytes(24).toString('hex')
}

export function createJob(partial: {
  providerId?: string
  formatId?: string
  originalUrl?: string
}): Job {
  const now = Date.now()
  const id = generateId()
  const job: Job = {
    id,
    status: 'queued',
    progress: 0,
    createdAt: new Date(now).toISOString(),
    updatedAt: new Date(now).toISOString(),
    expiresAt: now + JOB_TTL_MS,
    downloadToken: generateToken(),
    providerId: partial.providerId,
    formatId: partial.formatId,
    originalUrl: partial.originalUrl,
  }
  jobs.set(id, job)
  return job
}

export function getJob(id: string): Job | undefined {
  const job = jobs.get(id)
  if (!job) return undefined
  if (Date.now() > job.expiresAt && job.status !== 'expired') {
    job.status = 'expired'
    job.updatedAt = new Date().toISOString()
    // schedule file cleanup
    if (job.filePath) {
      unlink(job.filePath).catch(() => {})
      job.filePath = undefined
    }
  }
  return job
}

export function updateJob(
  id: string,
  updates: Partial<Pick<Job, 'status' | 'progress' | 'message' | 'error' | 'filePath'>>
): Job | undefined {
  const job = jobs.get(id)
  if (!job) return undefined
  Object.assign(job, updates, { updatedAt: new Date().toISOString() })
  return job
}

export function cancelJob(id: string): boolean {
  const job = jobs.get(id)
  if (!job) return false
  if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
    return false
  }
  job.status = 'cancelled'
  job.updatedAt = new Date().toISOString()
  if (job.filePath) {
    unlink(job.filePath).catch(() => {})
    job.filePath = undefined
  }
  return true
}

export function countActiveJobs(): number {
  let count = 0
  for (const job of jobs.values()) {
    if (job.status === 'queued' || job.status === 'processing') count++
  }
  return count
}

export function canAcceptNewJob(): boolean {
  return countActiveJobs() < MAX_CONCURRENT
}

/** Public-safe view of a job (no filePath) */
export function toPublicJob(job: Job) {
  return {
    id: job.id,
    status: job.status,
    progress: job.progress,
    message: job.message,
    downloadToken: job.status === 'completed' ? job.downloadToken : undefined,
    error: job.error,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  }
}

export function getJobByToken(id: string, token: string): Job | undefined {
  const job = getJob(id)
  if (!job || job.downloadToken !== token) return undefined
  return job
}

// Periodic cleanup
setInterval(() => {
  const now = Date.now()
  for (const [id, job] of jobs.entries()) {
    if (now > job.expiresAt) {
      if (job.filePath) {
        unlink(job.filePath).catch(() => {})
      }
      jobs.delete(id)
    }
  }
}, CLEANUP_INTERVAL_MS)

// Graceful shutdown helper
export async function cleanupAllJobs(): Promise<void> {
  for (const job of jobs.values()) {
    if (job.filePath) {
      await unlink(job.filePath).catch(() => {})
    }
  }
  jobs.clear()
}
