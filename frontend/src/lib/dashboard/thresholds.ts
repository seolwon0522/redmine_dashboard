import type { DashboardFilter, IssueListItem, IssuePreset } from '@/types/dashboard'
import type {
  DashboardThresholdSettings,
  DashboardTone,
  DerivedIssueRisk,
  IssueSignal,
} from '@/types/dashboard-derived'
import { diffDays, parseLocalDate } from '@/lib/dashboard/date'

const HIGH_PRIORITY = new Set(['Immediate', 'Urgent', 'High'])
const ACTIVE_STATUS_GROUPS = new Set(['open', 'in_progress', 'other'])

export function isHighPriorityIssue(issue: IssueListItem): boolean {
  return issue.priority !== null && HIGH_PRIORITY.has(issue.priority) && issue.status_group !== 'closed'
}

export function isActiveIssue(issue: IssueListItem): boolean {
  return ACTIVE_STATUS_GROUPS.has(issue.status_group)
}

export function evaluateIssueRisk(
  issue: IssueListItem,
  settings: DashboardThresholdSettings,
  today = new Date(),
): DerivedIssueRisk {
  const dueDate = parseLocalDate(issue.due_date)
  const updatedOn = parseLocalDate(issue.updated_on)
  const createdOn = parseLocalDate(issue.created_on)
  const isActive = isActiveIssue(issue)
  const daysUntilDue = dueDate ? diffDays(today, dueDate) : null
  const daysOverdue = dueDate && daysUntilDue !== null && daysUntilDue < 0 ? Math.abs(daysUntilDue) : 0
  const daysSinceUpdate = updatedOn ? diffDays(updatedOn, today) : null
  const daysSinceCreated = createdOn ? diffDays(createdOn, today) : null
  const isOverdue = isActive && daysOverdue > 0

  return {
    issueId: issue.id,
    isActive,
    isOverdue,
    isLongOverdue: isOverdue && daysOverdue >= settings.longOverdueDays,
    isDueSoon: isActive && daysUntilDue !== null && daysUntilDue >= 0 && daysUntilDue <= settings.dueSoonDays,
    isStale: isActive && daysSinceUpdate !== null && daysSinceUpdate >= settings.staleDays,
    isRecentlyUpdated: isActive && daysSinceUpdate !== null && daysSinceUpdate <= settings.recentActivityDays,
    isRecentlyCompleted: issue.status_group === 'closed' && daysSinceUpdate !== null && daysSinceUpdate <= settings.recentCompletionDays,
    needsAttention:
      (isActive && daysOverdue > 0) ||
      (isActive && daysUntilDue !== null && daysUntilDue >= 0 && daysUntilDue <= settings.dueSoonDays) ||
      (isActive && daysSinceUpdate !== null && daysSinceUpdate >= settings.staleDays) ||
      (isActive && issue.assigned_to_id === null) ||
      isHighPriorityIssue(issue),
    daysOverdue,
    daysUntilDue,
    daysSinceUpdate,
    daysSinceCreated,
  }
}

export function matchesIssuePreset(
  issue: IssueListItem,
  preset: IssuePreset | null,
  settings: DashboardThresholdSettings,
): boolean {
  if (!preset) return true

  const risk = evaluateIssueRisk(issue, settings)

  switch (preset) {
    case 'attention':
      return risk.needsAttention
    case 'overdue':
      return risk.isOverdue
    case 'due_soon':
      return risk.isDueSoon
    case 'stale':
      return risk.isStale
    case 'high_priority':
      return isHighPriorityIssue(issue)
    case 'unassigned':
      return risk.isActive && issue.assigned_to_id === null
    case 'closed_recently':
      return risk.isRecentlyCompleted
    default:
      return true
  }
}

export function getIssueSignals(issue: IssueListItem, settings: DashboardThresholdSettings): IssueSignal[] {
  const signals: IssueSignal[] = []
  const risk = evaluateIssueRisk(issue, settings)

  if (risk.isOverdue) {
    signals.push({ label: `지연 ${risk.daysOverdue}일`, tone: risk.isLongOverdue ? 'danger' : 'warning' })
  } else if (risk.isDueSoon && risk.daysUntilDue !== null) {
    signals.push({
      label: risk.daysUntilDue === 0 ? '오늘 마감' : `${risk.daysUntilDue}일 남음`,
      tone: 'warning',
    })
  }

  if (risk.isStale && risk.daysSinceUpdate !== null) {
    signals.push({ label: `정체 ${risk.daysSinceUpdate}일`, tone: 'warning' })
  } else if (risk.isRecentlyUpdated && risk.daysSinceUpdate !== null) {
    signals.push({ label: `최근 갱신 ${risk.daysSinceUpdate}일`, tone: 'success' })
  }

  if (isHighPriorityIssue(issue)) {
    signals.push({ label: '높은 우선순위', tone: 'danger' })
  }

  if (risk.isActive && issue.assigned_to_id === null) {
    signals.push({ label: '미할당', tone: 'neutral' })
  }

  if (risk.isRecentlyCompleted) {
    signals.push({ label: `최근 완료 ${settings.recentCompletionDays}일`, tone: 'success' })
  }

  return signals
}

export function applyDashboardFilter(
  issues: IssueListItem[],
  filter: DashboardFilter,
  settings: DashboardThresholdSettings,
): IssueListItem[] {
  return issues.filter((issue) => {
    if (filter.statusGroup && issue.status_group !== filter.statusGroup) {
      return false
    }

    if (filter.assignee) {
      const matchesAssignee = filter.assignee.id === null
        ? issue.assigned_to_id === null
        : issue.assigned_to_id === filter.assignee.id

      if (!matchesAssignee) {
        return false
      }
    }

    return matchesIssuePreset(issue, filter.preset, settings)
  })
}

export function getToneForFlow(flowBalance: number): DashboardTone {
  if (flowBalance >= 2) return 'success'
  if (flowBalance >= 0) return 'info'
  if (flowBalance <= -3) return 'danger'
  return 'warning'
}