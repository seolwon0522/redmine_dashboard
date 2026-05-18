'use client'

import { useEffect, useState } from 'react'

import { fetchAllIssues, fetchSummary } from '@/lib/api'
import type { DashboardSummary, IssueListResponse } from '@/types/dashboard'

type DashboardProjectDataResult = {
  summary: DashboardSummary | null
  issueList: IssueListResponse | null
  loading: boolean
  error: string | null
}

function normalizeProjectId(projectId: string | null | undefined): string {
  if (!projectId || projectId === 'undefined' || projectId === 'null') {
    return 'bp-cloudpos'
  }

  return projectId
}

export default function useDashboardProjectData(projectId: string): DashboardProjectDataResult {
  const safeProjectId = normalizeProjectId(projectId)

  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [issueList, setIssueList] = useState<IssueListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    setLoading(true)
    setError(null)

    Promise.all([fetchSummary(safeProjectId), fetchAllIssues(safeProjectId)])
      .then(([summaryResponse, issueResponse]) => {
        if (cancelled) return

        setSummary(summaryResponse)
        setIssueList(issueResponse)
      })
      .catch((err: unknown) => {
        if (cancelled) return

        const message = err instanceof Error ? err.message : '대시보드 데이터를 불러오지 못했습니다.'
        setError(message)
        setSummary(null)
        setIssueList(null)
      })
      .finally(() => {
        if (cancelled) return
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [safeProjectId])

  return {
    summary,
    issueList,
    loading,
    error,
  }
}