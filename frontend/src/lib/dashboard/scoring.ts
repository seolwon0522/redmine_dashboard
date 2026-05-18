import type { DashboardSummary, IssueListItem } from '@/types/dashboard'
import type {
  DashboardThresholdSettings,
  HealthModel,
  HealthScoreBreakdown,
  ScoreFactor,
  WeeklyFlowPoint,
} from '@/types/dashboard-derived'
import { clamp, diffDays, parseLocalDate, round, startOfWeek } from '@/lib/dashboard/date'
import { evaluateIssueRisk, isActiveIssue } from '@/lib/dashboard/thresholds'

function buildWeeklyFlow(issues: IssueListItem[]): WeeklyFlowPoint[] {
  const today = new Date()
  const currentWeek = startOfWeek(today)
  const weekStarts = Array.from({ length: 6 }, (_, index) => {
    const weekStart = new Date(currentWeek)
    weekStart.setDate(currentWeek.getDate() - (5 - index) * 7)
    return weekStart
  })

  return weekStarts.map((weekStart) => {
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 6)

    const created = issues.filter((issue) => {
      const createdOn = parseLocalDate(issue.created_on)
      return createdOn !== null && createdOn >= weekStart && createdOn <= weekEnd
    }).length

    const closed = issues.filter((issue) => {
      if (issue.status_group !== 'closed') return false
      const updatedOn = parseLocalDate(issue.updated_on)
      return updatedOn !== null && updatedOn >= weekStart && updatedOn <= weekEnd
    }).length

    return {
      label: `${weekStart.getMonth() + 1}/${weekStart.getDate()}`,
      created,
      closed,
    }
  })
}

function buildInterpretation(factors: ScoreFactor[], flowBalance: number, overdueCount: number, staleCount: number): string {
  const strongestPenalty = [...factors]
    .filter((factor) => factor.contribution < 0)
    .sort((left, right) => Math.abs(right.contribution) - Math.abs(left.contribution))[0]

  if (overdueCount === 0 && staleCount === 0 && flowBalance >= 0) {
    return '긴급 지연 신호는 크지 않고 최근 처리 흐름도 안정적으로 유지되고 있습니다.'
  }

  if (overdueCount === 0 && flowBalance < 0) {
    return '지연은 적지만 최근 유입이 처리보다 빨라 누적 가능성이 있습니다.'
  }

  if (overdueCount > 0 && flowBalance < 0) {
    return '기한 초과와 신규 유입 증가가 함께 나타나 우선순위 재정렬이 필요합니다.'
  }

  if (strongestPenalty?.id === 'stale') {
    return '정체 이슈가 상태 점수를 끌어내리고 있어 진행률 갱신과 담당 재점검이 우선입니다.'
  }

  if (strongestPenalty?.id === 'unassigned') {
    return '담당 공백이 남아 있어 실제 처리 속도보다 운영 불확실성이 더 큽니다.'
  }

  return '핵심 감점 요인을 먼저 줄이면 상태 점수가 빠르게 회복될 가능성이 있습니다.'
}

function buildFactor(
  id: string,
  label: string,
  tone: ScoreFactor['tone'],
  kind: ScoreFactor['kind'],
  itemCount: number,
  unitWeight: number,
  unitLabel: string,
  detail: string,
): ScoreFactor {
  const contribution = itemCount * unitWeight

  return {
    id,
    label,
    tone,
    kind,
    itemCount,
    unitWeight,
    unitLabel,
    contribution,
    formula: `${itemCount}${unitLabel} x ${unitWeight > 0 ? '+' : ''}${unitWeight}`,
    detail,
  }
}

export function buildHealthModel(
  summary: DashboardSummary,
  issues: IssueListItem[],
  settings: DashboardThresholdSettings,
): HealthModel {
  const activeIssues = issues.filter(isActiveIssue)
  const risks = issues.map((issue) => ({ issue, risk: evaluateIssueRisk(issue, settings) }))

  const overdueCount = risks.filter(({ risk }) => risk.isOverdue).length
  const longOverdueCount = risks.filter(({ risk }) => risk.isLongOverdue).length
  const staleCount = risks.filter(({ risk }) => risk.isStale).length
  const dueSoonCount = risks.filter(({ risk }) => risk.isDueSoon).length
  const recentlyUpdatedCount = risks.filter(({ risk }) => risk.isRecentlyUpdated).length
  const recentlyCompletedCount = risks.filter(({ risk }) => risk.isRecentlyCompleted).length
  const recentlyCreatedCount = issues.filter((issue) => {
    const createdOn = parseLocalDate(issue.created_on)
    if (!createdOn) return false
    const days = diffDays(createdOn, new Date())
    return days >= 0 && days <= settings.recentActivityDays
  }).length
  const unassignedCount = activeIssues.filter((issue) => issue.assigned_to_id === null).length
  const flowBalance = recentlyCompletedCount - recentlyCreatedCount

  const factors: ScoreFactor[] = [
    buildFactor(
      'overdue',
      '기한 초과 패널티',
      overdueCount > 0 ? 'danger' : 'success',
      'penalty',
      overdueCount,
      -settings.weights.overduePenalty,
      '건',
      `기한 초과는 활성 이슈 ${overdueCount}건을 기준으로 계산됩니다.`,
    ),
    buildFactor(
      'long_overdue',
      '장기 지연 추가 패널티',
      longOverdueCount > 0 ? 'danger' : 'neutral',
      'penalty',
      longOverdueCount,
      -settings.weights.longOverduePenalty,
      '건',
      `${settings.longOverdueDays}일 이상 지연된 항목에만 추가 감점을 적용합니다.`,
    ),
    buildFactor(
      'stale',
      '정체 이슈 패널티',
      staleCount > 0 ? 'warning' : 'success',
      'penalty',
      staleCount,
      -settings.weights.stalePenalty,
      '건',
      `${settings.staleDays}일 이상 업데이트가 없는 활성 이슈를 정체로 계산합니다.`,
    ),
    buildFactor(
      'unassigned',
      '미할당 패널티',
      unassignedCount > 0 ? 'warning' : 'success',
      'penalty',
      unassignedCount,
      -settings.weights.unassignedPenalty,
      '건',
      '담당자가 없는 활성 작업은 실행 리스크로 반영합니다.',
    ),
    buildFactor(
      'due_soon',
      '임박 일정 경고',
      dueSoonCount > 0 ? 'warning' : 'neutral',
      'penalty',
      dueSoonCount,
      -settings.weights.dueSoonPenalty,
      '건',
      `${settings.dueSoonDays}일 이내 마감 예정인 활성 이슈를 경고 요인으로 집계합니다.`,
    ),
    buildFactor(
      'recent_completion',
      '최근 완료 보너스',
      recentlyCompletedCount > 0 ? 'success' : 'neutral',
      'bonus',
      recentlyCompletedCount,
      settings.weights.recentCompletionBonus,
      '건',
      `${settings.recentCompletionDays}일 이내 완료된 이슈를 보너스로 반영합니다.`,
    ),
    {
      id: 'flow_balance',
      label: '유입 대비 처리 균형',
      tone: flowBalance >= 0 ? 'success' : 'warning',
      kind: flowBalance >= 0 ? 'bonus' : 'penalty',
      itemCount: flowBalance,
      unitWeight: settings.weights.flowBalanceWeight,
      unitLabel: '건 차이',
      contribution: flowBalance * settings.weights.flowBalanceWeight,
      formula: `(${recentlyCompletedCount}완료 - ${recentlyCreatedCount}유입) x ${settings.weights.flowBalanceWeight}`,
      detail: `최근 유입 ${settings.recentActivityDays}일 대비 완료 ${settings.recentCompletionDays}일 흐름 차이를 반영합니다.`,
    },
  ]

  const positiveTotal = factors
    .filter((factor) => factor.contribution > 0)
    .reduce((sum, factor) => sum + factor.contribution, 0)
  const negativeTotal = factors
    .filter((factor) => factor.contribution < 0)
    .reduce((sum, factor) => sum + factor.contribution, 0)
  const score = clamp(100 + positiveTotal + negativeTotal, 0, 100)
  const tone = score >= 80 ? 'success' : score >= 60 ? 'warning' : 'danger'
  const label = score >= 80 ? '안정' : score >= 60 ? '주의' : '위험'

  const cycleDays = issues
    .filter((issue) => issue.status_group === 'closed')
    .map((issue) => {
      const createdOn = parseLocalDate(issue.created_on)
      const updatedOn = parseLocalDate(issue.updated_on)
      if (!createdOn || !updatedOn) return null
      return diffDays(createdOn, updatedOn)
    })
    .filter((value): value is number => value !== null)

  const averageCycleDays = cycleDays.length > 0
    ? round(cycleDays.reduce((sum, value) => sum + value, 0) / cycleDays.length)
    : null

  const completionRate = summary.total > 0
    ? Math.round(((summary.by_status_group.closed ?? 0) / summary.total) * 100)
    : 0

  const breakdown: HealthScoreBreakdown = {
    baseScore: 100,
    score,
    label,
    tone,
    interpretation: buildInterpretation(factors, flowBalance, overdueCount, staleCount),
    positiveTotal,
    negativeTotal,
    factors,
  }

  return {
    breakdown,
    activeCount: activeIssues.length,
    completionRate,
    recentlyUpdatedCount,
    recentlyCompletedCount,
    recentlyCreatedCount,
    flowBalance,
    overdueCount,
    longOverdueCount,
    staleCount,
    dueSoonCount,
    unassignedCount,
    averageCycleDays,
    agingBuckets: [
      { label: `0-${settings.recentActivityDays}d`, count: activeIssues.filter((issue) => {
        const risk = evaluateIssueRisk(issue, settings)
        return risk.daysSinceUpdate !== null && risk.daysSinceUpdate <= settings.recentActivityDays
      }).length },
      { label: `${settings.recentActivityDays + 1}-${settings.staleDays - 1}d`, count: activeIssues.filter((issue) => {
        const risk = evaluateIssueRisk(issue, settings)
        return risk.daysSinceUpdate !== null && risk.daysSinceUpdate > settings.recentActivityDays && risk.daysSinceUpdate < settings.staleDays
      }).length },
      { label: `${settings.staleDays}-${settings.longOverdueDays - 1}d`, count: activeIssues.filter((issue) => {
        const risk = evaluateIssueRisk(issue, settings)
        return risk.daysSinceUpdate !== null && risk.daysSinceUpdate >= settings.staleDays && risk.daysSinceUpdate < settings.longOverdueDays
      }).length },
      { label: `${settings.longOverdueDays}d+`, count: activeIssues.filter((issue) => {
        const risk = evaluateIssueRisk(issue, settings)
        return risk.daysSinceUpdate !== null && risk.daysSinceUpdate >= settings.longOverdueDays
      }).length },
    ],
    weeklyFlow: buildWeeklyFlow(issues),
  }
}