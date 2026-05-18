import type { ActionBucketModel, KpiCardModel } from '@/types/dashboard-derived'

export function getPresetIssuesHref(projectId: string, preset: string): string {
  return `/dashboard/${encodeURIComponent(projectId)}/issues?preset=${encodeURIComponent(preset)}`
}

export function getOwnerHref(projectId: string, owner: { id: number | null } | null): string | null {
  if (!owner) return null
  if (owner.id === null) return `/dashboard/${encodeURIComponent(projectId)}/issues?assignee=unassigned`
  return `/dashboard/${encodeURIComponent(projectId)}/team?assignee=${encodeURIComponent(String(owner.id))}`
}

export function getMetricPrimaryCtaLabel(metric: KpiCardModel): string {
  if (metric.preset === 'unassigned') return '미할당 이슈 보기'
  if (metric.preset === 'overdue') return '지연 이슈 보기'
  if (metric.preset === 'attention') return '우선 확인 이슈 보기'
  if (metric.statusGroup === 'in_progress') return '진행 이슈 보기'
  if (metric.preset === 'closed_recently') return '최근 완료 이슈 보기'
  return '관련 이슈 보기'
}

export function getMetricOwnerCtaLabel(metric: KpiCardModel): string | null {
  if (!metric.guidance.owner) return null
  if (metric.guidance.owner.id === null) return '미할당 상태 보기'
  if (metric.preset === 'overdue') return '담당자 일정 보기'
  if (metric.statusGroup === 'in_progress') return '담당자 작업 보기'
  return '담당자 보기'
}

export function getActionPrimaryCtaLabel(action: ActionBucketModel): string {
  if (action.id === 'unassigned') return '미할당 이슈 보기'
  if (action.id === 'stale') return '장기 미갱신 이슈 보기'
  if (action.id === 'overdue') return '지연 이슈 보기'
  if (action.id === 'due_soon') return '마감 임박 이슈 보기'
  return '이슈 보기'
}

export function getActionOwnerCtaLabel(action: ActionBucketModel): string | null {
  if (!action.owner) return null
  if (action.owner.id === null) return '미할당 이슈 보기'
  return '담당자 보기'
}
