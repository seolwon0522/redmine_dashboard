import type { AssigneeFilter, DashboardSummary, IssueListItem } from '@/types/dashboard'
import type {
  ActionBucketModel,
  CapacityMemberModel,
  DashboardModel,
  DashboardSummaryViewModel,
  DashboardThresholdSettings,
  ExplorerPresetModel,
  HealthModel,
  KpiCardModel,
  StableOperationalState,
  StatusSnapshotModel,
} from '@/types/dashboard-derived'
import { diffDays, formatDaysAgo, parseLocalDate } from '@/lib/dashboard/date'
import { buildAssigneeInsights } from '@/lib/dashboard/insights'
import { buildHealthModel } from '@/lib/dashboard/scoring'
import { evaluateIssueRisk, getToneForFlow, isActiveIssue, isHighPriorityIssue, matchesIssuePreset } from '@/lib/dashboard/thresholds'

function getStatusGroupLabel(statusGroup: string | null) {
  if (statusGroup === 'in_progress') return '진행 중'
  if (statusGroup === 'open') return '대기'
  if (statusGroup === 'closed') return '완료'
  if (statusGroup === 'other') return '기타'
  return '미분류'
}

function findDominantAssignee(issues: IssueListItem[]): { owner: AssigneeFilter; count: number; share: number } | null {
  if (issues.length === 0) return null

  const counts = new Map<string, { owner: AssigneeFilter; count: number }>()
  issues.forEach((issue) => {
    const key = String(issue.assigned_to_id ?? 'unassigned')
    const current = counts.get(key) ?? {
      owner: {
        id: issue.assigned_to_id,
        name: issue.assigned_to ?? '미할당',
      },
      count: 0,
    }
    current.count += 1
    counts.set(key, current)
  })

  const top = Array.from(counts.values()).sort((left, right) => right.count - left.count)[0]
  if (!top) return null

  return {
    owner: top.owner,
    count: top.count,
    share: top.count / issues.length,
  }
}

function hasStrongOwnerSignal(issues: IssueListItem[], dominantOwner: { count: number; share: number } | null) {
  if (!dominantOwner) return false

  const ranked = Array.from(
    issues.reduce((map, issue) => {
      const key = String(issue.assigned_to_id ?? 'unassigned')
      map.set(key, (map.get(key) ?? 0) + 1)
      return map
    }, new Map<string, number>()).values(),
  ).sort((left, right) => right - left)
  const nextCount = ranked[1] ?? 0
  const nextShare = issues.length > 0 ? nextCount / issues.length : 0

  return dominantOwner.count >= 2 && dominantOwner.share >= 0.5 && dominantOwner.share - nextShare >= 0.2
}

function findDominantStatusGroup(issues: IssueListItem[]): { label: string; count: number; share: number } | null {
  if (issues.length === 0) return null

  const counts = new Map<string, number>()
  issues.forEach((issue) => {
    counts.set(issue.status_group, (counts.get(issue.status_group) ?? 0) + 1)
  })

  const top = Array.from(counts.entries()).sort((left, right) => right[1] - left[1])[0]
  if (!top) return null

  return {
    label: getStatusGroupLabel(top[0]),
    count: top[1],
    share: top[1] / issues.length,
  }
}

function formatShare(share: number) {
  return `${Math.round(share * 100)}%`
}

function buildGuidanceFromIssues(
  issues: IssueListItem[],
  fallbackRootCause: string,
  fallbackAction: string,
  options?: {
    preferStatus?: boolean
  },
): KpiCardModel['guidance'] {
  const dominantOwner = findDominantAssignee(issues)
  const dominantStatus = findDominantStatusGroup(issues)
  const strongOwnerSignal = hasStrongOwnerSignal(issues, dominantOwner)
  const rootCause = strongOwnerSignal && dominantOwner
    ? `${formatShare(dominantOwner.share)}가 ${dominantOwner.owner.name} 담당 큐에 모여${options?.preferStatus && dominantStatus ? ` 있고 주로 ${dominantStatus.label} 상태입니다.` : ' 있습니다.'}`
    : dominantStatus && dominantStatus.share >= 0.4
      ? `특정 담당자보다 ${formatShare(dominantStatus.share)}가 ${dominantStatus.label} 상태에 몰려 있어 상태 정리가 더 먼저 보입니다.`
      : fallbackRootCause

  return {
    rootCause,
    suggestedAction: strongOwnerSignal && dominantOwner?.owner.id === null
      ? '담당자를 먼저 지정한 뒤 우선순위와 마감일을 다시 확인하세요.'
      : fallbackAction,
    owner: strongOwnerSignal ? dominantOwner?.owner ?? null : null,
  }
}

function isIssueActiveAt(issue: IssueListItem, date: Date): boolean {
  const createdOn = parseLocalDate(issue.created_on)
  if (!createdOn || createdOn > date) return false

  if (issue.status_group !== 'closed') {
    return true
  }

  const updatedOn = parseLocalDate(issue.updated_on)
  return updatedOn === null || updatedOn > date
}

function buildMetricTrend(
  current: number,
  previous: number,
  goal: 'higher' | 'lower' | 'balanced',
): KpiCardModel['trend'] {
  const delta = current - previous
  const direction = delta === 0 ? 'flat' : delta > 0 ? 'up' : 'down'

  let tone: KpiCardModel['trend']['tone'] = 'neutral'
  if (goal === 'lower') {
    tone = delta < 0 ? 'success' : delta > 0 ? 'danger' : 'neutral'
  } else if (goal === 'higher') {
    tone = delta > 0 ? 'success' : delta < 0 ? 'warning' : 'neutral'
  } else {
    tone = delta > 0 ? 'success' : delta < 0 ? 'warning' : 'info'
  }

  return {
    direction,
    deltaLabel: delta === 0 ? '→ 변화 없음' : `${delta > 0 ? '↑' : '↓'} ${Math.abs(delta)}`,
    comparisonLabel: delta === 0 ? '지난주와 동일' : `지난주 대비 ${delta > 0 ? '+' : '-'}${Math.abs(delta)}`,
    tone,
  }
}

function buildCountStatus(
  count: number,
  warningThreshold: number,
  criticalThreshold: number,
): Pick<KpiCardModel, 'tone' | 'status' | 'statusLabel'> {
  if (count >= criticalThreshold) {
    return { tone: 'danger', status: 'critical', statusLabel: '즉시 점검' }
  }
  if (count >= warningThreshold) {
    return { tone: 'warning', status: 'warning', statusLabel: '주의' }
  }
  return { tone: 'success', status: 'normal', statusLabel: '안정' }
}

function countAttentionAt(issues: IssueListItem[], settings: DashboardThresholdSettings, date: Date): number {
  return issues.filter((issue) => {
    if (!isIssueActiveAt(issue, date)) return false

    const dueDate = parseLocalDate(issue.due_date)
    const updatedOn = parseLocalDate(issue.updated_on)
    const daysUntilDue = dueDate ? diffDays(date, dueDate) : null
    const daysOverdue = dueDate && daysUntilDue !== null && daysUntilDue < 0 ? Math.abs(daysUntilDue) : 0
    const daysSinceUpdate = updatedOn ? diffDays(updatedOn, date) : null

    return (
      daysOverdue > 0 ||
      (daysUntilDue !== null && daysUntilDue >= 0 && daysUntilDue <= settings.dueSoonDays) ||
      (daysSinceUpdate !== null && daysSinceUpdate >= settings.staleDays) ||
      issue.assigned_to_id === null ||
      isHighPriorityIssue(issue)
    )
  }).length
}

function countOverdueAt(issues: IssueListItem[], date: Date): number {
  return issues.filter((issue) => {
    if (!isIssueActiveAt(issue, date)) return false
    const dueDate = parseLocalDate(issue.due_date)
    return !!dueDate && diffDays(date, dueDate) < 0
  }).length
}

function countActiveAt(issues: IssueListItem[], date: Date): number {
  return issues.filter((issue) => isIssueActiveAt(issue, date)).length
}

function buildSummaryCards(
  summary: DashboardSummary,
  issues: IssueListItem[],
  settings: DashboardThresholdSettings,
  health: HealthModel,
): DashboardSummaryViewModel {
  const today = new Date()
  const previousWeek = new Date(today)
  previousWeek.setDate(previousWeek.getDate() - 7)

  const activeIssues = issues.filter(isActiveIssue)
  const attentionIssues = activeIssues.filter((issue) => matchesIssuePreset(issue, 'attention', settings))
  const overdueIssues = activeIssues.filter((issue) => evaluateIssueRisk(issue, settings).isOverdue)
  const attentionCount = activeIssues.filter((issue) => matchesIssuePreset(issue, 'attention', settings)).length
  const overdueCount = health.overdueCount
  const activeCount = health.activeCount
  const currentFlow = health.weeklyFlow[health.weeklyFlow.length - 1] ?? { created: 0, closed: 0 }
  const previousFlow = health.weeklyFlow[health.weeklyFlow.length - 2] ?? { created: 0, closed: 0 }
  const currentFlowBalance = currentFlow.closed - currentFlow.created
  const previousFlowBalance = previousFlow.closed - previousFlow.created

  const previousAttention = countAttentionAt(issues, settings, previousWeek)
  const previousOverdue = countOverdueAt(issues, previousWeek)
  const previousActive = countActiveAt(issues, previousWeek)

  const attentionStatus = buildCountStatus(attentionCount, 1, 4)
  const overdueStatus = buildCountStatus(overdueCount, 1, 3)
  const backlogStatus = activeCount >= previousActive + 4
    ? { tone: 'warning' as const, status: 'warning' as const, statusLabel: '주의' }
    : activeCount === 0
      ? { tone: 'neutral' as const, status: 'normal' as const, statusLabel: '안정' }
      : { tone: 'info' as const, status: 'normal' as const, statusLabel: '안정' }
  const flowTone = getToneForFlow(currentFlowBalance)
  const flowStatus = flowTone === 'danger'
    ? { tone: flowTone, status: 'critical' as const, statusLabel: '즉시 점검' }
    : flowTone === 'warning'
      ? { tone: flowTone, status: 'warning' as const, statusLabel: '주의' }
      : { tone: flowTone, status: 'normal' as const, statusLabel: '안정' }

  const cards: KpiCardModel[] = [
    {
      id: 'attention',
      label: '조치 필요 큐',
      value: String(attentionCount),
      note: attentionCount > 0
        ? '오늘 먼저 줄여야 할 위험 작업입니다.'
        : '즉시 조치할 작업은 크지 않습니다.',
      ...attentionStatus,
      trend: buildMetricTrend(attentionCount, previousAttention, 'lower'),
      tooltip: '활성 이슈 중 지연, 정체, 임박 일정, 미할당, 높은 우선순위 신호가 하나 이상 있는 작업 수입니다.',
      guidance: buildGuidanceFromIssues(
        attentionIssues,
        '리스크 신호가 여러 유형으로 분산되어 있습니다.',
        '상위 담당자 큐부터 재분배하거나 긴급 리뷰로 묶으세요.',
        { preferStatus: true },
      ),
      preset: 'attention',
    },
    {
      id: 'overdue',
      label: '기한 초과',
      value: String(overdueCount),
      note: overdueCount > 0
        ? '약속된 마감이 이미 지난 작업입니다.'
        : '현재 마감 초과는 없습니다.',
      ...overdueStatus,
      trend: buildMetricTrend(overdueCount, previousOverdue, 'lower'),
      tooltip: '오늘 기준 마감일이 지났지만 아직 닫히지 않은 활성 이슈 수입니다.',
      guidance: buildGuidanceFromIssues(
        overdueIssues,
        '지연 기여 요인이 한 곳에 집중되지는 않았습니다.',
        '담당자와 마감을 오늘 다시 확인하고 필요하면 재배정하세요.',
        { preferStatus: true },
      ),
      preset: 'overdue',
    },
    {
      id: 'active_backlog',
      label: '활성 백로그',
      value: String(activeCount),
      note: `${summary.by_status_group.in_progress ?? 0}건은 진행 중이고 나머지는 대기 중입니다.`,
      ...backlogStatus,
      trend: buildMetricTrend(activeCount, previousActive, 'lower'),
      tooltip: '현재 닫히지 않은 전체 실행 큐입니다. 단순 업무량이 아니라 처리 능력 대비 누적 여부를 보는 기준입니다.',
      guidance: buildGuidanceFromIssues(
        activeIssues,
        '활성 큐가 여러 담당자와 상태에 분산되어 있습니다.',
        '진행 중 체류 작업부터 정리하고 신규 착수는 선별하세요.',
        { preferStatus: true },
      ),
      statusGroup: 'in_progress',
    },
    {
      id: 'flow',
      label: '이번 주 처리 흐름',
      value: `${currentFlowBalance > 0 ? '+' : ''}${currentFlowBalance}`,
      note: `이번 주 유입 ${currentFlow.created}건, 완료 ${currentFlow.closed}건`,
      ...flowStatus,
      trend: buildMetricTrend(currentFlowBalance, previousFlowBalance, 'balanced'),
      tooltip: '최근 주간 유입 대비 완료 차이입니다. 음수면 누적, 양수면 소진 흐름이 우세합니다.',
      guidance: buildGuidanceFromIssues(
        currentFlowBalance < 0 ? activeIssues : issues.filter((issue) => evaluateIssueRisk(issue, settings).isRecentlyCompleted),
        currentFlowBalance < 0 ? '유입이 완료보다 빨라 누적 압력이 커지고 있습니다.' : '완료 흐름이 신규 유입을 따라가고 있습니다.',
        currentFlowBalance < 0
          ? '병목 담당자의 체류 작업부터 정리하고 신규 착수는 선별하세요.'
          : '현재 흐름을 유지하고 다음 지연 후보만 점검하세요.',
        { preferStatus: true },
      ),
      preset: 'closed_recently',
    },
  ]

  return {
    cards,
    headline: attentionCount > 0
      ? `오늘 바로 정리할 운영 리스크 ${attentionCount}건이 남아 있습니다.`
      : '긴급 신호는 크지 않습니다. 흐름과 다음 병목만 보면 됩니다.',
  }
}

function buildActions(issues: IssueListItem[], settings: DashboardThresholdSettings): ActionBucketModel[] {
  const activeIssues = issues.filter(isActiveIssue)
  const overdueIssues = activeIssues.filter((issue) => evaluateIssueRisk(issue, settings).isOverdue)
  const dueSoonIssues = activeIssues.filter((issue) => evaluateIssueRisk(issue, settings).isDueSoon)
  const staleIssues = activeIssues.filter((issue) => evaluateIssueRisk(issue, settings).isStale)
  const highPriorityIssues = activeIssues.filter(isHighPriorityIssue)
  const unassignedIssues = activeIssues.filter((issue) => issue.assigned_to_id === null)

  return [
    {
      id: 'overdue',
      label: '기한 초과 작업',
      description: '마감이 지난 작업입니다.',
      count: overdueIssues.length,
      tone: overdueIssues.length > 0 ? 'danger' : 'success',
      issues: overdueIssues.sort((left, right) => evaluateIssueRisk(right, settings).daysOverdue - evaluateIssueRisk(left, settings).daysOverdue).slice(0, 5),
      emptyLabel: '기한 초과 이슈가 없습니다. 현재 마감 관리 기준은 안정적입니다.',
      rootCause: buildGuidanceFromIssues(overdueIssues, '지연 원인이 분산되어 있습니다.', '재배정하거나 마감을 다시 합의하세요.', { preferStatus: true }).rootCause,
      suggestedAction: buildGuidanceFromIssues(overdueIssues, '지연 원인이 분산되어 있습니다.', '재배정하거나 마감을 다시 합의하세요.', { preferStatus: true }).suggestedAction,
      owner: buildGuidanceFromIssues(overdueIssues, '지연 원인이 분산되어 있습니다.', '재배정하거나 마감을 다시 합의하세요.', { preferStatus: true }).owner,
    },
    {
      id: 'due_soon',
      label: '임박 일정',
      description: '곧 지연으로 넘어갈 수 있는 작업입니다.',
      count: dueSoonIssues.length,
      tone: dueSoonIssues.length > 0 ? 'warning' : 'success',
      issues: dueSoonIssues.sort((left, right) => (evaluateIssueRisk(left, settings).daysUntilDue ?? 999) - (evaluateIssueRisk(right, settings).daysUntilDue ?? 999)).slice(0, 5),
      emptyLabel: '임박 일정은 없습니다. 다음으로는 정체와 담당 분산을 보시면 됩니다.',
      rootCause: buildGuidanceFromIssues(dueSoonIssues, '임박 일정이 여러 담당자에 분산되어 있습니다.', '이번 주 끝낼 작업부터 먼저 정리하세요.', { preferStatus: true }).rootCause,
      suggestedAction: buildGuidanceFromIssues(dueSoonIssues, '임박 일정이 여러 담당자에 분산되어 있습니다.', '이번 주 끝낼 작업부터 먼저 정리하세요.', { preferStatus: true }).suggestedAction,
      owner: buildGuidanceFromIssues(dueSoonIssues, '임박 일정이 여러 담당자에 분산되어 있습니다.', '이번 주 끝낼 작업부터 먼저 정리하세요.', { preferStatus: true }).owner,
    },
    {
      id: 'stale',
      label: '정체 이슈',
      description: '업데이트가 멈춘 작업입니다.',
      count: staleIssues.length,
      tone: staleIssues.length > 0 ? 'warning' : 'success',
      issues: staleIssues.sort((left, right) => (evaluateIssueRisk(right, settings).daysSinceUpdate ?? 0) - (evaluateIssueRisk(left, settings).daysSinceUpdate ?? 0)).slice(0, 5),
      emptyLabel: '정체 이슈가 없습니다. 현재 작업 흐름은 기준 내에서 유지되고 있습니다.',
      rootCause: buildGuidanceFromIssues(staleIssues, '정체 이슈가 한 곳에 집중되지는 않았습니다.', '진행 중 체류 작업을 먼저 확인하세요.', { preferStatus: true }).rootCause,
      suggestedAction: buildGuidanceFromIssues(staleIssues, '정체 이슈가 한 곳에 집중되지는 않았습니다.', '진행 중 체류 작업을 먼저 확인하세요.', { preferStatus: true }).suggestedAction,
      owner: buildGuidanceFromIssues(staleIssues, '정체 이슈가 한 곳에 집중되지는 않았습니다.', '진행 중 체류 작업을 먼저 확인하세요.', { preferStatus: true }).owner,
    },
    {
      id: 'high_priority',
      label: '높은 우선순위',
      description: '놓치면 영향이 큰 작업입니다.',
      count: highPriorityIssues.length,
      tone: highPriorityIssues.length > 0 ? 'danger' : 'neutral',
      issues: highPriorityIssues.slice(0, 5),
      emptyLabel: '높은 우선순위 활성 이슈는 없습니다.',
      rootCause: buildGuidanceFromIssues(highPriorityIssues, '고우선 작업이 특정 담당자에 집중되지는 않았습니다.', '별도 큐로 묶고 매일 확인하세요.', { preferStatus: true }).rootCause,
      suggestedAction: buildGuidanceFromIssues(highPriorityIssues, '고우선 작업이 특정 담당자에 집중되지는 않았습니다.', '별도 큐로 묶고 매일 확인하세요.', { preferStatus: true }).suggestedAction,
      owner: buildGuidanceFromIssues(highPriorityIssues, '고우선 작업이 특정 담당자에 집중되지는 않았습니다.', '별도 큐로 묶고 매일 확인하세요.', { preferStatus: true }).owner,
    },
    {
      id: 'unassigned',
      label: '미할당 작업',
      description: '실행 책임이 비어 있습니다.',
      count: unassignedIssues.length,
      tone: unassignedIssues.length > 0 ? 'warning' : 'success',
      issues: unassignedIssues.slice(0, 5),
      emptyLabel: '현재 활성 작업에는 모두 담당자가 지정되어 있습니다.',
      rootCause: unassignedIssues.length > 0 ? `${unassignedIssues.length}건 모두 실행 책임이 비어 있습니다.` : '소유권 공백은 없습니다.',
      suggestedAction: '담당자를 먼저 정하고 착수 순서를 다시 매기세요.',
      owner: null,
    },
  ]
}

function buildStatusSnapshot(issues: IssueListItem[], settings: DashboardThresholdSettings): StatusSnapshotModel {
  const activeIssues = issues.filter(isActiveIssue)
  const overdueCount = activeIssues.filter((issue) => evaluateIssueRisk(issue, settings).isOverdue).length
  const dueSoonCount = activeIssues.filter((issue) => evaluateIssueRisk(issue, settings).isDueSoon).length
  const staleCount = activeIssues.filter((issue) => evaluateIssueRisk(issue, settings).isStale).length
  const unassignedCount = activeIssues.filter((issue) => issue.assigned_to_id === null).length

  return {
    title: '현재 상태 스냅샷',
    subtitle: '지금 어떤 신호를 먼저 눌러서 작업 화면으로 들어갈지 바로 고를 수 있는 요약입니다.',
    items: [
      {
        id: 'overdue',
        label: '기한 초과',
        count: overdueCount,
        note: overdueCount > 0 ? '즉시 재정렬이 필요한 지연 작업' : '현재 지연 작업 없음',
        tone: overdueCount > 0 ? 'danger' : 'success',
        preset: 'overdue',
      },
      {
        id: 'due_soon',
        label: '임박 일정',
        count: dueSoonCount,
        note: `${settings.dueSoonDays}일 이내 마감 기준`,
        tone: dueSoonCount > 0 ? 'warning' : 'neutral',
        preset: 'due_soon',
      },
      {
        id: 'stale',
        label: '정체 이슈',
        count: staleCount,
        note: `${settings.staleDays}일 이상 갱신 없음`,
        tone: staleCount > 0 ? 'warning' : 'success',
        preset: 'stale',
      },
      {
        id: 'unassigned',
        label: '미할당',
        count: unassignedCount,
        note: '실행 책임이 비어 있는 작업',
        tone: unassignedCount > 0 ? 'warning' : 'neutral',
        preset: 'unassigned',
      },
    ],
  }
}

function buildStableState(issues: IssueListItem[], settings: DashboardThresholdSettings): StableOperationalState {
  const activeIssues = issues.filter(isActiveIssue)
  const recentlyUpdatedCount = activeIssues.filter((issue) => evaluateIssueRisk(issue, settings).isRecentlyUpdated).length
  const overdueResolved = issues
    .filter((issue) => issue.status_group === 'closed' && issue.due_date && issue.updated_on)
    .map((issue) => {
      const dueDate = parseLocalDate(issue.due_date)
      const updatedOn = parseLocalDate(issue.updated_on)
      if (!dueDate || !updatedOn || updatedOn <= dueDate) return null
      return { issue, daysAgo: diffDays(updatedOn, new Date()) }
    })
    .filter((value): value is { issue: IssueListItem; daysAgo: number } => value !== null)
    .sort((left, right) => left.daysAgo - right.daysAgo)[0]

  const workload = new Map<string, { name: string; openCount: number; watchCount: number }>()
  activeIssues.forEach((issue) => {
    const key = String(issue.assigned_to_id ?? 'unassigned')
    const current = workload.get(key) ?? {
      name: issue.assigned_to ?? '미할당',
      openCount: 0,
      watchCount: 0,
    }
    const risk = evaluateIssueRisk(issue, settings)
    current.openCount += 1
    if (risk.isDueSoon || risk.daysSinceUpdate === settings.staleDays - 1) {
      current.watchCount += 1
    }
    workload.set(key, current)
  })

  const workloadValues = Array.from(workload.values())
  const topLoad = workloadValues.sort((left, right) => right.openCount - left.openCount)[0]
  const nextBottleneck = Array.from(workload.values()).sort((left, right) => right.watchCount - left.watchCount)[0]

  return {
    title: '현재 운영 안정',
    description: '긴급 조치 큐는 비어 있습니다. 대신 현재 진행 흐름과 다음 병목 후보를 짧게 확인하세요.',
    items: [
      {
        id: 'last-overdue',
        label: '최근 지연 종료',
        value: overdueResolved ? formatDaysAgo(overdueResolved.daysAgo) : '기록 없음',
        note: overdueResolved ? `최근 지연 종료 이슈 #${overdueResolved.issue.id}` : '최근 종료 이슈 중 지연 완료 흔적이 없습니다.',
      },
      {
        id: 'recently-updated',
        label: '기준 내 업데이트',
        value: `${recentlyUpdatedCount}/${activeIssues.length}`,
        note: `${settings.recentActivityDays}일 이내 갱신된 활성 이슈 비율`,
      },
      {
        id: 'top-load',
        label: '현재 가장 바쁜 담당자',
        value: topLoad ? `${topLoad.name} · ${topLoad.openCount}건` : '없음',
        note: '현재 진행 중 작업량 기준',
      },
      {
        id: 'next-bottleneck',
        label: '다음 병목 후보',
        value: nextBottleneck && nextBottleneck.watchCount > 0 ? `${nextBottleneck.name} · ${nextBottleneck.watchCount}건` : '뚜렷한 후보 없음',
        note: '임박 일정 또는 정체 임계값 근접 기준',
      },
    ],
  }
}

function buildCapacity(issues: IssueListItem[], settings: DashboardThresholdSettings): CapacityMemberModel[] {
  const members = new Map<string, CapacityMemberModel>()

  issues.forEach((issue) => {
    if (!isActiveIssue(issue) && issue.status_group !== 'closed') return

    const key = String(issue.assigned_to_id ?? 'unassigned')
    const risk = evaluateIssueRisk(issue, settings)
    const existing = members.get(key) ?? {
      key,
      assignee: {
        id: issue.assigned_to_id,
        name: issue.assigned_to ?? '미할당',
      },
      openCount: 0,
      inProgressCount: 0,
      highPriorityCount: 0,
      overdueCount: 0,
      dueSoonCount: 0,
      staleCount: 0,
      closedRecentlyCount: 0,
      recentUpdateRate: 0,
      utilizationRate: 0,
      riskScore: 0,
      band: 'balanced' as const,
    }

    if (risk.isActive) {
      existing.openCount += 1
      existing.inProgressCount += issue.status_group === 'in_progress' ? 1 : 0
      existing.highPriorityCount += isHighPriorityIssue(issue) ? 1 : 0
      existing.overdueCount += risk.isOverdue ? 1 : 0
      existing.dueSoonCount += risk.isDueSoon ? 1 : 0
      existing.staleCount += risk.isStale ? 1 : 0
      existing.recentUpdateRate += risk.isRecentlyUpdated ? 1 : 0
    }

    if (risk.isRecentlyCompleted) {
      existing.closedRecentlyCount += 1
    }

    members.set(key, existing)
  })

  return Array.from(members.values())
    .map((member) => {
      const riskScore =
        member.overdueCount * 5 +
        member.staleCount * 3 +
        member.dueSoonCount * 2 +
        Math.max(0, member.openCount - settings.overloadThreshold) * 2
      const utilizationRate = settings.overloadThreshold > 0 ? member.openCount / settings.overloadThreshold : 0
      const recentUpdateRate = member.openCount > 0 ? member.recentUpdateRate / member.openCount : 0
      const band: CapacityMemberModel['band'] = utilizationRate >= 1.2 || riskScore >= 10
        ? 'stretched'
        : utilizationRate >= 0.8 || riskScore >= 5
          ? 'watch'
          : 'balanced'

      return {
        ...member,
        recentUpdateRate,
        utilizationRate,
        riskScore,
        band,
      }
    })
    .sort((left, right) => {
      if (right.riskScore !== left.riskScore) {
        return right.riskScore - left.riskScore
      }
      return right.openCount - left.openCount
    })
}

function buildExplorerPresets(issues: IssueListItem[], settings: DashboardThresholdSettings): ExplorerPresetModel[] {
  const countByPreset = (preset: ExplorerPresetModel['id']) => issues.filter((issue) => matchesIssuePreset(issue, preset, settings)).length

  return [
    { id: null, label: '기본 운영 큐', count: issues.length },
    { id: 'attention', label: '조치 필요', count: countByPreset('attention') },
    { id: 'overdue', label: '기한 초과', count: countByPreset('overdue') },
    { id: 'due_soon', label: '임박 일정', count: countByPreset('due_soon') },
    { id: 'stale', label: '정체', count: countByPreset('stale') },
    { id: 'high_priority', label: '높은 우선순위', count: countByPreset('high_priority') },
    { id: 'unassigned', label: '미할당', count: countByPreset('unassigned') },
    { id: 'closed_recently', label: `최근 완료 ${settings.recentCompletionDays}일`, count: countByPreset('closed_recently') },
  ]
}

export function buildDashboardModel(
  summary: DashboardSummary,
  issues: IssueListItem[],
  settings: DashboardThresholdSettings,
): DashboardModel {
  const health = buildHealthModel(summary, issues, settings)

  return {
    summary: buildSummaryCards(summary, issues, settings, health),
    statusSnapshot: buildStatusSnapshot(issues, settings),
    actions: buildActions(issues, settings),
    stableState: buildStableState(issues, settings),
    capacity: buildCapacity(issues, settings),
    health,
    insights: buildAssigneeInsights(issues, settings),
    explorerPresets: buildExplorerPresets(issues, settings),
  }
}