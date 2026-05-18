'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import { fetchProjects } from '@/lib/api'
import { MAX_RECENT_PROJECTS, RECENT_PROJECTS_STORAGE_KEY } from '@/lib/dashboard'
import type { ProjectItem } from '@/types/dashboard'

interface ProjectSwitcherProps {
  currentProjectId: string
}

function buildNextDashboardPath(pathname: string, nextProjectId: string, queryString: string) {
  const segments = pathname.split('/').filter(Boolean)
  const dashboardIndex = segments.indexOf('dashboard')
  const suffix = dashboardIndex >= 0 ? segments.slice(dashboardIndex + 2).join('/') : ''
  const basePath = `/dashboard/${encodeURIComponent(nextProjectId)}${suffix ? `/${suffix}` : ''}`

  return queryString ? `${basePath}?${queryString}` : basePath
}

function rememberProject(projectId: string) {
  if (typeof window === 'undefined') return

  try {
    const stored = window.localStorage.getItem(RECENT_PROJECTS_STORAGE_KEY)
    const parsed = stored ? JSON.parse(stored) : []
    const recentIds = Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === 'string')
      : []
    const nextIds = [projectId, ...recentIds.filter((id) => id !== projectId)].slice(0, MAX_RECENT_PROJECTS)
    window.localStorage.setItem(RECENT_PROJECTS_STORAGE_KEY, JSON.stringify(nextIds))
  } catch {
    window.localStorage.setItem(RECENT_PROJECTS_STORAGE_KEY, JSON.stringify([projectId]))
  }
}

function getOptionLabel(project: ProjectItem) {
  const riskLabel = project.risk_level === 'critical' ? '위험' : project.risk_level === 'warning' ? '주의' : '안정'
  return `${project.name} · ${project.open_issues}건 · ${riskLabel}`
}

export default function ProjectSwitcher({ currentProjectId }: ProjectSwitcherProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [projects, setProjects] = useState<ProjectItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    setLoading(true)
    setError(null)

    fetchProjects()
      .then((data) => {
        if (cancelled) return
        setProjects(data.projects)
      })
      .catch((fetchError: Error) => {
        if (cancelled) return
        setError(fetchError.message)
      })
      .finally(() => {
        if (cancelled) return
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    rememberProject(currentProjectId)
  }, [currentProjectId])

  const sortedProjects = useMemo(() => {
    return [...projects].sort((left, right) => {
      if (right.risk_score !== left.risk_score) return right.risk_score - left.risk_score
      if (right.open_issues !== left.open_issues) return right.open_issues - left.open_issues
      return left.name.localeCompare(right.name, 'ko')
    })
  }, [projects])

  function handleChange(nextProjectId: string) {
    if (!nextProjectId || nextProjectId === currentProjectId) return

    rememberProject(nextProjectId)
    router.push(buildNextDashboardPath(pathname, nextProjectId, searchParams.toString()))
  }

  return (
    <div className="flex min-w-0 items-center gap-2">
      <label htmlFor="project-switcher" className="sr-only">
        프로젝트 전환
      </label>
      <select
        id="project-switcher"
        value={currentProjectId}
        onChange={(event) => handleChange(event.target.value)}
        disabled={loading || Boolean(error)}
        className="min-h-10 max-w-[48vw] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none transition hover:border-slate-300 focus:border-blue-300 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 sm:min-w-[240px] sm:max-w-[360px]"
      >
        {sortedProjects.some((project) => project.id === currentProjectId) ? null : (
          <option value={currentProjectId}>{currentProjectId}</option>
        )}
        {sortedProjects.map((project) => (
          <option key={project.id} value={project.id}>
            {getOptionLabel(project)}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => router.push('/')}
        className="hidden min-h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600 transition hover:border-slate-300 hover:bg-white hover:text-slate-950 sm:inline-flex sm:items-center"
      >
        전체 프로젝트
      </button>
    </div>
  )
}
