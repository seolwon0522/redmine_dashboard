'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, CheckCircle2, Download, FileArchive, Loader2 } from 'lucide-react'

import {
  downloadProjectWikiExport,
  fetchProjectWikiExportStatus,
  startProjectWikiExport,
  type WikiExportJobStatus,
} from '@/lib/api'

type ProjectWikiExportButtonProps = {
  projectId: string
}

const POLL_INTERVAL_MS = 2000

export default function ProjectWikiExportButton({ projectId }: ProjectWikiExportButtonProps) {
  const [job, setJob] = useState<WikiExportJobStatus | null>(null)
  const [isStarting, setIsStarting] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const autoDownloadedJobIdRef = useRef<string | null>(null)

  const isRunning = job?.state === 'queued' || job?.state === 'running'

  useEffect(() => {
    if (!job?.id || !isRunning) {
      return
    }

    const timeoutId = window.setTimeout(async () => {
      try {
        const nextJob = await fetchProjectWikiExportStatus(job.id)
        setJob(nextJob)
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : '위키 export 상태를 확인하지 못했습니다.')
      }
    }, POLL_INTERVAL_MS)

    return () => window.clearTimeout(timeoutId)
  }, [job?.id, isRunning, job?.updated_at])

  useEffect(() => {
    if (job?.state !== 'completed' || !job.download_ready) {
      return
    }

    if (autoDownloadedJobIdRef.current === job.id) {
      return
    }

    autoDownloadedJobIdRef.current = job.id
    void handleDownload(job)
  }, [job])

  const statusText = useMemo(() => {
    if (error) return error
    if (isDownloading) return 'ZIP 파일을 다운로드하는 중입니다.'
    if (job?.state === 'failed') return job.error || '위키 export가 실패했습니다.'
    if (job?.step) return `${job.step}${job.progress > 0 ? ` ${job.progress}%` : ''}`
    return notice
  }, [error, isDownloading, job, notice])

  async function handleDownload(targetJob: WikiExportJobStatus) {
    setIsDownloading(true)
    setError(null)

    try {
      await downloadProjectWikiExport(targetJob.id, projectId)
      setNotice('오프라인 ZIP 다운로드가 시작되었습니다.')
      const refreshedJob = await fetchProjectWikiExportStatus(targetJob.id)
      setJob(refreshedJob)
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : '위키 export 파일을 다운로드하지 못했습니다.')
      autoDownloadedJobIdRef.current = null
    } finally {
      setIsDownloading(false)
    }
  }

  async function handleStart() {
    setIsStarting(true)
    setError(null)
    setNotice(null)
    autoDownloadedJobIdRef.current = null

    try {
      const nextJob = await startProjectWikiExport(projectId)
      setJob(nextJob)
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : '위키 export를 시작하지 못했습니다.')
    } finally {
      setIsStarting(false)
    }
  }

  const busy = isStarting || isRunning || isDownloading
  const buttonLabel = busy
    ? '위키 내보내는 중'
    : job?.state === 'completed'
      ? '위키 다시 내보내기'
      : '위키 Export'

  return (
    <div className="flex flex-col items-stretch gap-1.5 sm:items-end">
      <button
        type="button"
        onClick={handleStart}
        disabled={busy}
        className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileArchive className="h-4 w-4" />}
        <span>{buttonLabel}</span>
      </button>

      {statusText ? (
        <div className="flex max-w-[320px] items-start gap-1.5 text-right text-xs text-slate-500">
          {error || job?.state === 'failed' ? (
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-500" />
          ) : job?.state === 'completed' && !isDownloading ? (
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
          ) : isDownloading ? (
            <Download className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-500" />
          ) : (
            <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin text-slate-400" />
          )}
          <span>{statusText}</span>
        </div>
      ) : null}
    </div>
  )
}