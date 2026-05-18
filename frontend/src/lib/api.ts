import type {
  DashboardSummary,
  IssueDetail,
  IssueListResponse,
  MemberIssuesResponse,
  ProjectListResponse,
  WorkloadResponse,
} from '@/types/dashboard'
import type {
  RedmineConnectionDeleteResponse,
  RedmineConnectionPayload,
  RedmineConnectionSaveResponse,
  RedmineConnectionStatusResponse,
  RedmineConnectionTestResponse,
} from '@/types/redmine-connection'

async function readApiErrorMessage(response: Response, fallbackPath: string): Promise<string> {
  const fallbackMessage = `API error [${response.status}]: ${fallbackPath}`

  try {
    const data = await response.json() as { detail?: string; message?: string }
    return data.detail ?? data.message ?? fallbackMessage
  } catch {
    return fallbackMessage
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  const response = await fetch(path, {
    cache: 'no-store',
    ...init,
    headers,
  })

  if (!response.ok) {
    throw new Error(await readApiErrorMessage(response, path))
  }

  return response.json() as Promise<T>
}

function withProject(base: string, projectId?: string): string {
  if (!projectId) return base
  return `${base}?project_id=${encodeURIComponent(projectId)}`
}

export async function fetchSummary(projectId?: string): Promise<DashboardSummary> {
  return apiFetch(withProject('/api/v1/dashboard/summary', projectId))
}

export async function fetchProjects(): Promise<ProjectListResponse> {
  return apiFetch('/api/v1/dashboard/projects')
}

export async function fetchWorkload(projectId?: string): Promise<WorkloadResponse> {
  return apiFetch(withProject('/api/v1/dashboard/workload', projectId))
}

export async function fetchAllIssues(projectId?: string): Promise<IssueListResponse> {
  return apiFetch(withProject('/api/v1/dashboard/issues', projectId))
}

export async function fetchMemberIssues(
  userId: number | null,
  projectId?: string,
): Promise<MemberIssuesResponse> {
  const params = new URLSearchParams()
  if (userId === null) {
    params.set('unassigned', 'true')
  } else {
    params.set('user_id', String(userId))
  }
  if (projectId) {
    params.set('project_id', projectId)
  }

  return apiFetch(`/api/v1/dashboard/workload/member?${params.toString()}`)
}

export async function fetchIssueDetail(issueId: number): Promise<IssueDetail> {
  return apiFetch(`/api/v1/dashboard/issues/${issueId}`)
}

export async function fetchConnectionStatus(): Promise<RedmineConnectionStatusResponse> {
  return apiFetch('/api/v1/redmine/connection-status')
}

export async function testRedmineConnection(payload: RedmineConnectionPayload): Promise<RedmineConnectionTestResponse> {
  return apiFetch('/api/v1/redmine/test-connection', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export async function saveRedmineConnection(payload: RedmineConnectionPayload): Promise<RedmineConnectionSaveResponse> {
  return apiFetch('/api/v1/redmine/save-connection', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export async function deleteRedmineConnection(): Promise<RedmineConnectionDeleteResponse> {
  return apiFetch('/api/v1/redmine/connection', { method: 'DELETE' })
}

export interface WikiExportJobStatus {
  id: string
  project_key: string
  state: 'queued' | 'running' | 'completed' | 'failed'
  progress: number
  step: string
  logs: string[]
  error: string | null
  created_at: string
  updated_at: string
  finished_at: string | null
  download_ready: boolean
  downloaded: boolean
}

export async function startProjectWikiExport(projectId: string): Promise<WikiExportJobStatus> {
  return apiFetch(`/api/v1/wiki-export/jobs?project_key=${encodeURIComponent(projectId)}`, {
    method: 'POST',
  })
}

export async function fetchProjectWikiExportStatus(jobId: string): Promise<WikiExportJobStatus> {
  return apiFetch(`/api/v1/wiki-export/jobs/${encodeURIComponent(jobId)}`)
}

export async function downloadProjectWikiHtml(jobId: string, fallbackProjectId: string): Promise<void> {
  const response = await fetch(`/api/v1/wiki-export/jobs/${encodeURIComponent(jobId)}/download`, {
    method: 'GET',
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(await readApiErrorMessage(response, 'wiki-export'))
  }

  const blob = await response.blob()
  const url = window.URL.createObjectURL(blob)
  const disposition = response.headers.get('content-disposition') ?? ''
  const encodedFilename = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1]
  const fallbackFilename = `${fallbackProjectId}-wiki-export.html`
  const filename = encodedFilename ? decodeURIComponent(encodedFilename) : fallbackFilename
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.append(anchor)
  anchor.click()
  anchor.remove()

  window.setTimeout(() => window.URL.revokeObjectURL(url), 60000)
}

export async function updateIssueStatus(issueId: number, statusId: number): Promise<void> {
  return apiFetch(`/api/v1/dashboard/issues/${issueId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status_id: statusId }),
  })
}

// ── Analytics API ────────────────────────────────────────────────────────────

export interface TrendPoint {
  date: string
  created: number
  closed: number
  active: number
}

export interface TrendResponse {
  project_id: string | null
  days: number
  trend: TrendPoint[]
  cached_at: string
}

export interface VelocityWeek {
  week: string
  created: number
  closed: number
  velocity: number
  net: number
}

export interface VelocityResponse {
  project_id: string | null
  weeks: VelocityWeek[]
  avg_velocity: number
  cached_at: string
}

export interface AssigneePerf {
  name: string
  total: number
  closed: number
  overdue: number
  close_rate: number
}

export interface DistributionResponse {
  project_id: string | null
  total: number
  by_priority: Record<string, number>
  by_tracker: Record<string, number>
  by_status_group: Record<string, number>
  age_distribution: Record<string, number>
  top_assignees: AssigneePerf[]
  cached_at: string
}

export interface AiSummaryResponse {
  project_id: string | null
  summary: string
  health_score: number
  metrics: {
    total: number
    active: number
    overdue: number
    unassigned: number
  }
  recommendations: string[]
  analyzed_at: string
}

export async function fetchTrend(projectId?: string, days = 30): Promise<TrendResponse> {
  const params = new URLSearchParams({ days: String(days) })
  if (projectId) params.set('project_id', projectId)
  return apiFetch(`/api/v1/analytics/trend?${params}`)
}

export async function fetchVelocity(projectId?: string): Promise<VelocityResponse> {
  const params = new URLSearchParams()
  if (projectId) params.set('project_id', projectId)
  return apiFetch(`/api/v1/analytics/velocity?${params}`)
}

export async function fetchDistribution(projectId?: string): Promise<DistributionResponse> {
  const params = new URLSearchParams()
  if (projectId) params.set('project_id', projectId)
  return apiFetch(`/api/v1/analytics/distribution?${params}`)
}

export async function fetchAiSummary(projectId?: string): Promise<AiSummaryResponse> {
  const params = new URLSearchParams()
  if (projectId) params.set('project_id', projectId)
  return apiFetch(`/api/v1/analytics/summary?${params}`)
}

