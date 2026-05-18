// 백엔드 API 응답 타입 정의
// 백엔드 schemas/dashboard.py의 Pydantic 모델과 1:1 대응

// GET /api/v1/dashboard/summary 응답
export interface DashboardSummary {
  project_id: string
  total: number
  by_status_group: Record<string, number>
  overdue: number
  cached_at: string
}

// GET /api/v1/dashboard/projects 응답 내 항목
export interface ProjectItem {
  id: string
  name: string
  open_issues: number
  overdue_issues: number
  stale_issues: number
  unassigned_issues: number
  high_priority_issues: number
  due_soon_issues: number
  risk_score: number
  risk_level: 'stable' | 'warning' | 'critical'
  primary_reason: string
}

export interface ProjectListResponse {
  projects: ProjectItem[]
  cached_at: string
}

// GET /api/v1/dashboard/workload 응답 내 항목
export interface WorkloadItem {
  user_id: number | null
  name: string
  open_issues: number
  overdue_issues: number
}

export interface WorkloadResponse {
  project_id: string
  workload: WorkloadItem[]
  cached_at: string
}

// GET /api/v1/dashboard/workload/member 응답 내 항목
export interface MemberIssueItem {
  id: number
  subject: string
  status: string
  priority: string | null
  due_date: string | null
  is_overdue: boolean
  days_overdue: number
  url: string
}

export interface MemberIssuesResponse {
  project_id: string
  user_id: number | null
  user_name: string
  total: number
  overdue_count: number
  issues: MemberIssueItem[]
  cached_at: string
}

// GET /api/v1/dashboard/issues 응답
export interface IssueListItem {
  id: number
  subject: string
  status: string
  status_id: number
  status_group: string
  priority: string | null
  assigned_to: string | null
  assigned_to_id: number | null
  author: string | null
  tracker: string | null
  due_date: string | null
  created_on: string | null
  updated_on: string | null
  done_ratio: number
  is_overdue: boolean
  days_overdue: number
  is_due_soon: boolean
  days_until_due: number | null
  is_stale: boolean
  days_since_update: number | null
  url: string
}

export interface IssueListResponse {
  project_id: string
  total: number
  issues: IssueListItem[]
  cached_at: string
}

// 대시보드 공유 필터 상태
export interface AssigneeFilter {
  id: number | null // null = 미할당
  name: string
}

export type IssuePreset =
  | 'attention'
  | 'overdue'
  | 'due_soon'
  | 'stale'
  | 'high_priority'
  | 'unassigned'
  | 'closed_recently'

export interface DashboardFilter {
  statusGroup: string | null
  assignee: AssigneeFilter | null
  preset: IssuePreset | null
}

// GET /api/v1/dashboard/issues/{id} 응답 내 변경 이력

export interface JournalChange {
  field: string
  property: string
  old_value: string | null
  new_value: string | null
}

export interface JournalEntry {
  id: number | null
  user: string
  created_on: string
  notes: string | null
  notes_html: string | null
  changes: JournalChange[]
}

export interface IssueAttachment {
  id: number
  filename: string
  filesize: number | null
  content_type: string | null
  content_url: string
}

export interface RelatedIssue {
  id: number
  label: string
  relation_type: string
  url: string
}

export interface IssueDetail {
  id: number
  subject: string
  description: string | null
  description_html: string | null
  status: string
  status_id: number | null
  status_group: string
  priority: string | null
  assigned_to: string | null
  assigned_to_id: number | null
  author: string | null
  tracker: string | null
  category: string | null
  version: string | null
  start_date: string | null
  due_date: string | null
  done_ratio: number
  created_on: string | null
  updated_on: string | null
  url: string
  redmine_base_url: string
  attachments: IssueAttachment[]
  journals: JournalEntry[]
  related_issues: RelatedIssue[]
}
