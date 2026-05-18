import type { IssueListItem } from '@/types/dashboard'
import type { CapacityMemberModel, DashboardThresholdSettings } from '@/types/dashboard-derived'

import { evaluateIssueRisk, isHighPriorityIssue } from '@/lib/dashboard/thresholds'

export type IssueSortKey = 'attention' | 'id' | 'subject' | 'assignee' | 'priority' | 'due' | 'updated' | 'progress'
export type IssueSortDir = 'asc' | 'desc'

export function getStatusTone(statusGroup: string) {
  if (statusGroup === 'closed') return 'success' as const
  if (statusGroup === 'in_progress') return 'info' as const
  if (statusGroup === 'open') return 'warning' as const
  return 'neutral' as const
}

export function getPriorityTone(priority: string | null) {
  if (priority === 'Immediate' || priority === 'Urgent') return 'danger' as const
  if (priority === 'High') return 'warning' as const
  if (priority === 'Normal') return 'neutral' as const
  return 'neutral' as const
}

export function getCapacityBandTone(band: CapacityMemberModel['band']) {
  if (band === 'stretched') return 'danger' as const
  if (band === 'watch') return 'warning' as const
  return 'success' as const
}

export function getCapacityBandLabel(band: CapacityMemberModel['band']) {
  if (band === 'stretched') return '과부하'
  if (band === 'watch') return '주의'
  return '안정'
}

export function formatDue(issue: IssueListItem, settings: DashboardThresholdSettings) {
  const risk = evaluateIssueRisk(issue, settings)

  if (risk.isOverdue) {
    return { label: `지연 ${risk.daysOverdue}일`, tone: 'danger' as const }
  }
  if (risk.daysUntilDue === 0) {
    return { label: '오늘 마감', tone: 'warning' as const }
  }
  if (risk.daysUntilDue !== null && risk.daysUntilDue > 0) {
    return {
      label: `${risk.daysUntilDue}일 남음`,
      tone: risk.daysUntilDue <= settings.dueSoonDays ? 'warning' as const : 'neutral' as const,
    }
  }
  return { label: issue.due_date ?? '마감 없음', tone: 'neutral' as const }
}

export function formatUpdated(daysSinceUpdate: number | null, updatedOn: string | null) {
  if (daysSinceUpdate === null) return updatedOn ?? '업데이트 없음'
  if (daysSinceUpdate === 0) return '오늘'
  if (daysSinceUpdate === 1) return '1일 전'
  return `${daysSinceUpdate}일 전`
}

export function getAttentionScore(issue: IssueListItem, settings: DashboardThresholdSettings) {
  const risk = evaluateIssueRisk(issue, settings)

  return (
    (risk.isLongOverdue ? 120 : 0) +
    risk.daysOverdue * 8 +
    (risk.isOverdue ? 40 : 0) +
    (risk.isStale ? 28 : 0) +
    (risk.daysSinceUpdate ?? 0) +
    (risk.isDueSoon ? 18 : 0) +
    (issue.assigned_to_id === null && risk.isActive ? 20 : 0) +
    (issue.priority === 'Immediate' || issue.priority === 'Urgent' ? 16 : 0) +
    (issue.priority === 'High' ? 10 : 0)
  )
}

export function getOperationalQueueScore(issue: IssueListItem, settings: DashboardThresholdSettings) {
  const risk = evaluateIssueRisk(issue, settings)

  if (risk.isActive) {
    return (
      1000 +
      getAttentionScore(issue, settings) +
      (issue.status_group === 'in_progress' ? 40 : 0) +
      (risk.isOverdue ? 80 : 0) +
      (risk.isStale ? 50 : 0) +
      (risk.isDueSoon ? 30 : 0) +
      (issue.assigned_to_id === null ? 30 : 0) +
      (isHighPriorityIssue(issue) ? 20 : 0)
    )
  }

  if (risk.isRecentlyCompleted) {
    return 200 - (risk.daysSinceUpdate ?? settings.recentCompletionDays)
  }

  return -(risk.daysSinceUpdate ?? 999)
}

export function getPrimaryReason(issue: IssueListItem, settings: DashboardThresholdSettings) {
  const risk = evaluateIssueRisk(issue, settings)

  if (risk.isOverdue) {
    return {
      label: `마감 지연 ${risk.daysOverdue}일`,
      detail: '일정 조정이나 담당 확인이 먼저 필요한 상태입니다.',
      tone: risk.isLongOverdue ? 'danger' as const : 'warning' as const,
    }
  }

  if (risk.isStale && risk.daysSinceUpdate !== null) {
    return {
      label: `업데이트 없음 ${risk.daysSinceUpdate}일`,
      detail: '진행 여부와 막힘 지점을 다시 확인해야 합니다.',
      tone: 'warning' as const,
    }
  }

  if (risk.isDueSoon && risk.daysUntilDue !== null) {
    return {
      label: risk.daysUntilDue === 0 ? '오늘 마감' : `${risk.daysUntilDue}일 후 마감`,
      detail: '이번 주 안에 끝낼 수 있는지 먼저 확인해야 합니다.',
      tone: 'warning' as const,
    }
  }

  if (risk.isActive && issue.assigned_to_id === null) {
    return {
      label: '미할당',
      detail: '담당자가 정해져야 실제 진행을 시작할 수 있습니다.',
      tone: 'neutral' as const,
    }
  }

  if (issue.priority === 'Immediate' || issue.priority === 'Urgent' || issue.priority === 'High') {
    return {
      label: '고우선',
      detail: '다른 신호와 겹치면 가장 먼저 처리해야 하는 이슈입니다.',
      tone: 'danger' as const,
    }
  }

  if (issue.status_group === 'closed') {
    return {
      label: '최근 완료',
      detail: '최근 완료 흐름 확인이 필요한 이슈입니다.',
      tone: 'success' as const,
    }
  }

  return {
    label: '일반 확인',
    detail: '큰 위험 신호는 없지만 계속 볼 필요가 있습니다.',
    tone: 'info' as const,
  }
}
