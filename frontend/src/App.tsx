import { useCallback, useEffect, useRef, useState } from 'react'
import { Navbar } from '@/components/Navbar'
import { Hero } from '@/components/Hero'
import { Results } from '@/components/Results'
import { HowItWorks } from '@/components/HowItWorks'
import { Platforms } from '@/components/Platforms'
import { FAQ } from '@/components/FAQ'
import { Footer } from '@/components/Footer'
import {
  analyzeUrl,
  startDownload,
  getJob,
  cancelJob,
  getDownloadUrl,
  fetchProviders,
} from '@/lib/api'
import type { AnalyzeResponse, Job, MediaFormat, ProviderInfo } from '@/types'

export default function App() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AnalyzeResponse | null>(null)
  const [lastUrl, setLastUrl] = useState<string | null>(null)
  const [job, setJob] = useState<Job | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [providers, setProviders] = useState<ProviderInfo[]>([])
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    fetchProviders().then(setProviders).catch(() => {})
  }, [])

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  const handleAnalyze = useCallback(async (url: string) => {
    setLoading(true)
    setError(null)
    setResult(null)
    setJob(null)
    setLastUrl(url)
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }

    try {
      const data = await analyzeUrl(url)
      setResult(data)
      // Only surface a top-level error when there is no structured result to show
      if (!data.success && !data.provider) {
        setError(data.message || data.error || 'Unable to analyze this link')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed')
    } finally {
      setLoading(false)
    }
  }, [])

  const handleDownload = useCallback(
    async (format: MediaFormat) => {
      if (!lastUrl || !result?.provider) return
      setDownloading(true)
      setJob(null)

      const res = await startDownload(lastUrl, format.id, result.provider.id)
      if (!res.success || !res.job) {
        setError(res.error || 'Could not start download')
        setDownloading(false)
        return
      }

      setJob(res.job)

      if (pollRef.current) clearInterval(pollRef.current)
      pollRef.current = setInterval(async () => {
        const updated = await getJob(res.job!.id)
        if (!updated) return
        setJob(updated)

        if (updated.status === 'completed' && updated.downloadToken) {
          if (pollRef.current) {
            clearInterval(pollRef.current)
            pollRef.current = null
          }
          setDownloading(false)
          const a = document.createElement('a')
          a.href = getDownloadUrl(updated.id, updated.downloadToken)
          a.download = ''
          document.body.appendChild(a)
          a.click()
          a.remove()
        } else if (
          updated.status === 'failed' ||
          updated.status === 'cancelled' ||
          updated.status === 'expired'
        ) {
          if (pollRef.current) {
            clearInterval(pollRef.current)
            pollRef.current = null
          }
          setDownloading(false)
        }
      }, 1200)
    },
    [lastUrl, result]
  )

  const handleCancel = useCallback(async () => {
    if (!job) return
    await cancelJob(job.id)
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
    setJob((j) => (j ? { ...j, status: 'cancelled' } : null))
    setDownloading(false)
  }, [job])

  return (
    <div className="flex min-h-dvh flex-col">
      <Navbar />
      <main className="flex-1">
        <Hero onAnalyze={handleAnalyze} loading={loading} error={error} />
        {result && (
          <Results
            data={result}
            onDownload={handleDownload}
            job={job}
            downloading={downloading}
            onCancel={handleCancel}
          />
        )}
        <HowItWorks />
        <Platforms providers={providers} />
        <FAQ />
      </main>
      <Footer />
    </div>
  )
}
