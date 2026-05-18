'use client'

import { useEffect, useMemo, useState } from 'react'

import OverviewShell from '@/components/overview/OverviewShell'
import ConnectionStatusCard from '@/components/overview/ConnectionStatusCard'
import OverviewStatCard from '@/components/overview/OverviewStatCard'
import PriorityProjectSection from '@/components/overview/PriorityProjectSection'
import ActionRail from '@/components/overview/ActionRail'
import ProjectListSection from '@/components/overview/ProjectListSection'
import type { RedmineConnectionStatusResponse } from '@/types/redmine-connection'
import { fetchProjects } from '@/lib/api'
import { MAX_RECENT_PROJECTS, RECENT_PROJECTS_STORAGE_KEY } from '@/lib/dashboard'
import type { ProjectItem } from '@/types/dashboard'

interface Props {
  connectionStatus: RedmineConnectionStatusResponse
  onOpenConnectionSettings: () => void
  onDeleteConnection: () => Promise<void> | void
}

function StatIcon({ type }: { type: 'folder' | 'warning' | 'recent' | 'danger' }) {
  const className = 'h-5 w-5'

  if (type === 'folder') {
    return (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7.5A2.5 2.5 0 0 1 5.5 5H9l2 2h7.5A2.5 2.5 0 0 1 21 9.5v7A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5v-9z" />
      </svg>
    )
  }

  if (type === 'warning') {
    return (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v4m0 4h.01M10.3 4.5 2.8 18a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3L13.7 4.5a2 2 0 0 0-3.4 0z" />
      </svg>
    )
  }

  if (type === 'recent') {
    return (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12a9 9 0 1 0 3-6.7M3 4v6h6M12 7v5l3 2" />
      </svg>
    )
  }

  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5m6 0a3 3 0 0 1-6 0" />
    </svg>
  )
}

export default function ProjectSelectView({ connectionStatus, onOpenConnectionSettings, onDeleteConnection }: Props) {
  const [projects, setProjects] = useState<ProjectItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [recentProjectIds, setRecentProjectIds] = useState<string[]>([])
  const [previewProjectId, setPreviewProjectId] = useState<string | null>(null)

  useEffect(() => {
    fetchProjects()
      .then((data) => setProjects(data.projects))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    try {
      const stored = window.localStorage.getItem(RECENT_PROJECTS_STORAGE_KEY)
      if (!stored) return

      const parsed = JSON.parse(stored)
      if (Array.isArray(parsed)) {
        setRecentProjectIds(parsed.filter((value): value is string => typeof value === 'string').slice(0, MAX_RECENT_PROJECTS))
      }
    } catch {
      setRecentProjectIds([])
    }
  }, [])

  const sortedProjects = useMemo(() => {
    return [...projects].sort((left, right) => {
      if (right.risk_score !== left.risk_score) return right.risk_score - left.risk_score
      if (right.open_issues !== left.open_issues) return right.open_issues - left.open_issues
      return left.name.localeCompare(right.name, 'ko')
    })
  }, [projects])

  const normalizedSearch = search.trim().toLowerCase()
  const filteredProjects = useMemo(() => {
    if (!normalizedSearch) return sortedProjects
    return sortedProjects.filter((project) => (
      project.name.toLowerCase().includes(normalizedSearch) ||
      project.id.toLowerCase().includes(normalizedSearch)
    ))
  }, [normalizedSearch, sortedProjects])

  const recentProjects = useMemo(() => {
    return recentProjectIds
      .map((projectId) => sortedProjects.find((project) => project.id === projectId) ?? null)
      .filter((project): project is ProjectItem => project !== null)
  }, [recentProjectIds, sortedProjects])

  const previewProject = useMemo(() => {
    if (!filteredProjects.length) return null
    if (previewProjectId) {
      return filteredProjects.find((project) => project.id === previewProjectId) ?? filteredProjects[0]
    }
    if (!normalizedSearch && recentProjects.length > 0) return recentProjects[0]
    return filteredProjects[0]
  }, [filteredProjects, normalizedSearch, previewProjectId, recentProjects])

  useEffect(() => {
    if (!filteredProjects.length) {
      setPreviewProjectId(null)
      return
    }

    setPreviewProjectId((current) => {
      if (current && filteredProjects.some((project) => project.id === current)) return current
      return filteredProjects[0].id
    })
  }, [filteredProjects])

  if (loading) {
    return (
      <OverviewShell title="개요">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="space-y-4">
            <div className="h-28 animate-pulse rounded-[24px] bg-slate-200/60" />
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-28 animate-pulse rounded-[20px] bg-slate-200/60" />)}
            </div>
            <div className="h-56 animate-pulse rounded-[24px] bg-slate-200/60" />
          </div>
          <div className="h-96 animate-pulse rounded-[24px] bg-slate-200/60" />
        </div>
      </OverviewShell>
    )
  }

  if (error) {
    return (
      <OverviewShell title="개요">
        <div className="max-w-xl rounded-xl border border-rose-200 bg-rose-50 p-6">
          <div className="text-sm font-bold text-rose-700">오류 발생: {error}</div>
          <p className="mt-2 text-sm text-rose-700/90">백엔드 서버가 실행 중인지 확인하세요.</p>
        </div>
      </OverviewShell>
    )
  }

  if (projects.length === 0) {
    return (
      <OverviewShell title="개요">
        <div className="max-w-2xl rounded-[24px] border border-slate-200/50 bg-white/60 backdrop-blur-xl p-10 text-center shadow-lg shadow-slate-200/40">
          <p className="text-base text-slate-600 font-medium">
            현재 접근 가능한 프로젝트가 없습니다. Redmine 연결 설정이나 계정 권한을 다시 확인하세요.
          </p>
        </div>
      </OverviewShell>
    )
  }

  const warningProjects = sortedProjects.filter((project) => project.risk_level !== 'stable').length
  const criticalProjects = sortedProjects.filter((project) => project.risk_level === 'critical').length

  return (
    <OverviewShell title="개요">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px] 2xl:grid-cols-[minmax(0,1fr)_320px]">
        <main className="min-w-0 space-y-5">
          <ConnectionStatusCard
            connectionStatus={connectionStatus}
            onOpenSettings={onOpenConnectionSettings}
            onDelete={onDeleteConnection}
          />

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <OverviewStatCard icon={<StatIcon type="folder" />} label="전체 프로젝트" value={projects.length} description="연결된 프로젝트" />
            <OverviewStatCard icon={<StatIcon type="warning" />} label="주의 이상" value={warningProjects} description="위험 또는 주의 상태" variant="highlight" />
            <OverviewStatCard icon={<StatIcon type="recent" />} label="최근 접근" value={recentProjects.length} description="최근 7일 내 접근" variant="success" />
            <OverviewStatCard icon={<StatIcon type="danger" />} label="즉시 점검" value={criticalProjects} description="위험 수준 프로젝트" variant="danger" />
          </div>

          <PriorityProjectSection projects={sortedProjects} />

          <ProjectListSection
            projects={projects}
            filteredProjects={filteredProjects}
            search={search}
            onSearchChange={setSearch}
            onPreviewChange={setPreviewProjectId}
          />
        </main>

        <ActionRail
          recentProjects={recentProjects}
          previewProject={previewProject}
          search={search}
          onSearchChange={setSearch}
          onPreviewProjectChange={setPreviewProjectId}
        />
      </div>
    </OverviewShell>
  )
}
