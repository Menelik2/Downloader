import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { createReadStream, existsSync } from 'node:fs'
import { stat } from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import { validateAndNormalizeUrl } from './utils/url-validator.js'
import { findProvider, getAllProviders, getProviderById } from './providers/registry.js'
import {
  createJob,
  getJob,
  updateJob,
  cancelJob,
  canAcceptNewJob,
  toPublicJob,
  getJobByToken,
  cleanupAllJobs,
} from './services/job-service.js'
import type { HealthResponse } from './types/index.js'

const PORT = Number(process.env.PORT) || 3001
const VERSION = '1.0.0'

const app = express()

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
)

const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

app.use(
  cors({
    origin(origin, cb) {
      if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        cb(null, true)
      } else {
        cb(null, false)
      }
    },
    credentials: false,
  })
)

app.use(express.json({ limit: '16kb' }))

const limiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_MAX) || 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.', errorCode: 'RATE_LIMITED' },
})
app.use('/api/', limiter)

app.get('/api/health', async (_req, res) => {
  const ffmpegAvailable = existsSync(process.env.FFMPEG_PATH || '/usr/bin/ffmpeg')

  const body: HealthResponse = {
    status: 'ok',
    version: VERSION,
    timestamp: new Date().toISOString(),
    dependencies: {
      tmpDir: true,
      ffmpeg: ffmpegAvailable,
    },
    limits: {
      maxConcurrentJobs: Number(process.env.MAX_CONCURRENT_JOBS) || 5,
      maxFileSizeMb: Number(process.env.MAX_FILE_SIZE_MB) || 500,
      jobTtlMs: Number(process.env.JOB_TTL_MS) || 3_600_000,
    },
  }
  res.json(body)
})

app.get('/api/providers', (_req, res) => {
  res.json({
    providers: getAllProviders(),
    note: 'Platform support can change. Status reflects current capabilities of this deployment.',
  })
})

const analyzeSchema = z.object({
  url: z.string().min(1).max(2048),
})

app.post('/api/analyze', async (req, res) => {
  const parsed = analyzeSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error: 'Invalid request body',
      errorCode: 'VALIDATION_ERROR',
      details: parsed.error.flatten(),
    })
  }

  const validated = await validateAndNormalizeUrl(parsed.data.url)
  if (!validated.ok) {
    return res.status(400).json({
      success: false,
      error: validated.error,
      errorCode: validated.code,
      message: 'The provided URL could not be accepted for security reasons.',
    })
  }

  const provider = findProvider(validated.url.hostname, validated.url.href)
  if (!provider) {
    return res.status(422).json({
      success: false,
      error: 'Unsupported platform or URL type',
      errorCode: 'UNSUPPORTED',
      message:
        'This URL is not recognized by any enabled provider. LinkFetch only supports a limited set of public media sources and does not claim universal coverage.',
      officialUrl: validated.url.href,
    })
  }

  try {
    const result = await provider.analyze({
      url: validated.url.href,
      hostname: validated.url.hostname,
    })
    return res.status(result.success ? 200 : 422).json(result)
  } catch (err) {
    console.error('[analyze] provider error', err instanceof Error ? err.message : err)
    return res.status(500).json({
      success: false,
      error: 'Analysis failed',
      errorCode: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred while analyzing the link. Please try again later.',
    })
  }
})

const downloadSchema = z.object({
  url: z.string().min(1).max(2048),
  formatId: z.string().min(1).max(64),
  providerId: z.string().min(1).max(64).optional(),
})

app.post('/api/download', async (req, res) => {
  const parsed = downloadSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error: 'Invalid request body',
      errorCode: 'VALIDATION_ERROR',
    })
  }

  if (!canAcceptNewJob()) {
    return res.status(503).json({
      success: false,
      error: 'Server is at capacity',
      errorCode: 'CAPACITY',
      message: 'Too many concurrent jobs. Please try again in a few moments.',
    })
  }

  const validated = await validateAndNormalizeUrl(parsed.data.url)
  if (!validated.ok) {
    return res.status(400).json({
      success: false,
      error: validated.error,
      errorCode: validated.code,
    })
  }

  const provider =
    (parsed.data.providerId && getProviderById(parsed.data.providerId)) ||
    findProvider(validated.url.hostname, validated.url.href)

  if (!provider || !provider.prepareDownload) {
    return res.status(422).json({
      success: false,
      error: 'Download not supported for this provider',
      errorCode: 'DOWNLOAD_NOT_SUPPORTED',
      message:
        'This provider does not offer authorized direct downloads. Use the official link when available.',
    })
  }

  const job = createJob({
    providerId: provider.info.id,
    formatId: parsed.data.formatId,
    originalUrl: validated.url.href,
  })

  setImmediate(async () => {
    updateJob(job.id, { status: 'processing', progress: 10, message: 'Starting download…' })
    try {
      const result = await provider.prepareDownload!(
        { url: validated.url.href, hostname: validated.url.hostname },
        parsed.data.formatId
      )
      if (!result.ok) {
        updateJob(job.id, {
          status: 'failed',
          progress: 0,
          error: result.error,
          message: result.error,
        })
        return
      }
      updateJob(job.id, {
        status: 'completed',
        progress: 100,
        message: 'Ready',
        filePath: result.filePath,
      })
    } catch (err) {
      console.error('[download] error', err instanceof Error ? err.message : err)
      updateJob(job.id, {
        status: 'failed',
        progress: 0,
        error: 'Processing failed',
        message: 'An error occurred while preparing the file.',
      })
    }
  })

  return res.status(202).json({
    success: true,
    job: toPublicJob(job),
  })
})

app.get('/api/jobs/:id', (req, res) => {
  const jobId = String(req.params.id || '')
  const job = getJob(jobId)
  if (!job) {
    return res.status(404).json({
      error: 'Job not found or expired',
      errorCode: 'JOB_NOT_FOUND',
    })
  }
  return res.json({ job: toPublicJob(job) })
})

app.get('/api/download/:id', async (req, res) => {
  const token = req.query.token
  if (typeof token !== 'string' || token.length < 16) {
    return res.status(400).json({
      error: 'Missing or invalid download token',
      errorCode: 'TOKEN_REQUIRED',
    })
  }

  const jobId = String(req.params.id || '')
  const job = getJobByToken(jobId, token)
  if (!job) {
    return res.status(404).json({
      error: 'Job not found, expired, or token mismatch',
      errorCode: 'JOB_NOT_FOUND',
    })
  }

  if (job.status !== 'completed' || !job.filePath) {
    return res.status(409).json({
      error: 'File is not ready',
      errorCode: 'NOT_READY',
      status: job.status,
    })
  }

  try {
    const stats = await stat(job.filePath)
    const filename = path.basename(job.filePath)
    res.setHeader('Content-Type', 'application/octet-stream')
    res.setHeader('Content-Length', stats.size)
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename.replace(/[^\w.\-]/g, '_')}"`
    )
    res.setHeader('Cache-Control', 'no-store')
    createReadStream(job.filePath).pipe(res)
  } catch {
    return res.status(410).json({
      error: 'File no longer available',
      errorCode: 'FILE_GONE',
    })
  }
})

app.delete('/api/jobs/:id', (req, res) => {
  const ok = cancelJob(String(req.params.id || ''))
  if (!ok) {
    return res.status(404).json({
      error: 'Job not found or already finished',
      errorCode: 'JOB_NOT_FOUND',
    })
  }
  return res.json({ success: true, message: 'Job cancelled' })
})

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found', errorCode: 'NOT_FOUND' })
})

app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error('[error]', err.message)
    res.status(500).json({
      error: 'Internal server error',
      errorCode: 'INTERNAL_ERROR',
    })
  }
)

const server = app.listen(PORT, () => {
  console.log(`LinkFetch backend listening on http://localhost:${PORT}`)
})

async function shutdown() {
  console.log('Shutting down…')
  await cleanupAllJobs()
  server.close(() => process.exit(0))
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
