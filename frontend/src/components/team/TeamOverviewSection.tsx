'use client'

import { useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

import type { IssueListItem } from '@/types/dashboard'

type TeamOverviewSectionProps = {
  projectId?: string
  issues?: IssueListItem[]
  loading?: boolean
  model?: unknown
  settings?: unknown
}

type AssigneeSummary = {
  key: string
  name: string
  assigneeId: number | null
  total: number
  open: number
  closed: number
  overdue: number
  dueSoon: number
  stale: number
  highPriority: number
  avgProgress: number
  recentUpdateLabel: string
  riskScore: number
  issues: IssueListItem[]
}

const TOP_ISSUE_LIMIT = 5

function normalizeText(value: unknown) {
  return String(value ?? '').trim().toLowerCase()
}

function isClosedIssue(issue: IssueListItem) {
  const statusGroup = normalizeText(issue.status_group)
  const status = normalizeText(issue.status)

  return (
    statusGroup === 'closed' ||
    statusGroup === 'done' ||
    status.includes('완료') ||
    status.includes('종료') ||
    status.includes('해결') ||
    status.includes('closed') ||
    status.includes('done') ||
    status.includes('resolved')
  )
}

function isHighPriorityIssue(issue: IssueListItem) {
  const priority = normalizeText(issue.priority)

  return (
    priority.includes('긴급') ||
    priority.includes('높음') ||
    priority.includes('상') ||
    priority.includes('high') ||
    priority.includes('urgent') ||
    priority.includes('immediate')
  )
}

function parseDate(value?: string | null) {
  if (!value) return null

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null

  return date
}

function diffDaysFromToday(date: Date) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const target = new Date(date)
  target.setHours(0, 0, 0, 0)

  return Math.ceil((target.getTime() - today.getTime()) / 86_400_000)
}

function getDaysUntilDue(issue: IssueListItem) {
  if (typeof issue.days_until_due === 'number' && Number.isFinite(issue.days_until_due)) {
    return issue.days_until_due
  }

  const dueDate = parseDate(issue.due_date)
  if (!dueDate) return null

  return diffDaysFromToday(dueDate)
}

function isOverdueIssue(issue: IssueListItem) {
  if (isClosedIssue(issue)) return false
  if (issue.is_overdue) return true
  if (typeof issue.days_overdue === 'number' && issue.days_overdue > 0) return true

  const daysUntilDue = getDaysUntilDue(issue)
  return daysUntilDue !== null && daysUntilDue < 0
}

function isDueSoonIssue(issue: IssueListItem) {
  if (isClosedIssue(issue)) return false
  if (issue.is_due_soon) return true

  const daysUntilDue = getDaysUntilDue(issue)
  return daysUntilDue !== null && daysUntilDue >= 0 && daysUntilDue <= 3
}

function isStaleIssue(issue: IssueListItem) {
  if (isClosedIssue(issue)) return false
  if (issue.is_stale) return true

  return typeof issue.days_since_update === 'number' && issue.days_since_update >= 7
}

function getDaysSinceUpdate(issue: IssueListItem) {
  if (typeof issue.days_since_update === 'number' && Number.isFinite(issue.days_since_update)) {
    return issue.days_since_update
  }

  const updatedDate = parseDate(issue.updated_on)
  if (!updatedDate) return null

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  updatedDate.setHours(0, 0, 0, 0)

  return Math.floor((today.getTime() - updatedDate.getTime()) / 86_400_000)
}

function formatUpdated(issue: IssueListItem) {
  const days = getDaysSinceUpdate(issue)

  if (days === null) return '업데이트 정보 없음'
  if (days <= 0) return '오늘 업데이트'
  if (days === 1) return '1일 전'
  return `${days}일 전`
}

function formatDue(issue: IssueListItem) {
  if (!issue.due_date) return '마감 없음'

  const days = getDaysUntilDue(issue)
  if (days === null) return issue.due_date

  if (days < 0) return `지연 ${Math.abs(days)}일`
  if (days === 0) return '오늘 마감'
  return `${days}일 남음`
}

function getAssigneeName(issue: IssueListItem) {
  return issue.assigned_to?.trim() || '미할당'
}

function getAssigneeKey(issue: IssueListItem) {
  if (issue.assigned_to_id !== null && issue.assigned_to_id !== undefined) {
    return `user-${issue.assigned_to_id}`
  }

  return getAssigneeName(issue)
}

function getRiskTone(summary: AssigneeSummary) {
  if (summary.overdue > 0 || summary.highPriority >= 3) return 'danger'
  if (summary.stale > 0 || summary.dueSoon > 0 || summary.open >= 5) return 'warning'
  if (summary.closed > 0 && summary.open === 0) return 'success'
  return 'neutral'
}

function getRiskLabel(summary: AssigneeSummary) {
  if (summary.name === '미할당') return '소유권 필요'
  if (summary.overdue > 0) return '지연 확인'
  if (summary.stale > 0) return '정체 확인'
  if (summary.dueSoon > 0) return '일정 확인'
  if (summary.open >= 5) return '부하 높음'
  if (summary.open === 0) return '안정'
  return '정상'
}

function getToneClass(tone: 'danger' | 'warning' | 'success' | 'neutral' | 'info') {
  const classes = {
    danger: 'border-rose-200 bg-rose-50 text-rose-700',
    warning: 'border-amber-200 bg-amber-50 text-amber-700',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    neutral: 'border-slate-200 bg-slate-50 text-slate-600',
    info: 'border-blue-200 bg-blue-50 text-blue-700',
  }

  return classes[tone]
}

function getBarWidth(value: number, max: number) {
  if (max <= 0) return '0%'
  return `${Math.max(8, Math.min(100, Math.round((value / max) * 100)))}%`
}

function createAssigneeSummaries(issues: IssueListItem[]): AssigneeSummary[] {
  const grouped = new Map<string, IssueListItem[]>()

  issues.forEach((issue) => {
    const key = getAssigneeKey(issue)
    const current = grouped.get(key) ?? []
    current.push(issue)
    grouped.set(key, current)
  })

  return Array.from(grouped.entries())
    .map(([key, groupIssues]) => {
      const first = groupIssues[0]
      const name = getAssigneeName(first)
      const open = groupIssues.filter((issue) => !isClosedIssue(issue)).length
      const closed = groupIssues.filter((issue) => isClosedIssue(issue)).length
      const overdue = groupIssues.filter(isOverdueIssue).length
      const dueSoon = groupIssues.filter(isDueSoonIssue).length
      const stale = groupIssues.filter(isStaleIssue).length
      const highPriority = groupIssues.filter(isHighPriorityIssue).length
      const totalProgress = groupIssues.reduce((sum, issue) => sum + (issue.done_ratio ?? 0), 0)
      const avgProgress = groupIssues.length > 0 ? Math.round(totalProgress / groupIssues.length) : 0
      const sortedByUpdate = [...groupIssues].sort((a, b) => {
        const aDate = parseDate(a.updated_on)?.getTime() ?? 0
        const bDate = parseDate(b.updated_on)?.getTime() ?? 0
        return bDate - aDate
      })
      const riskScore = overdue * 5 + stale * 3 + dueSoon * 2 + highPriority * 2 + Math.max(0, open - 4)

      return {
        key,
        name,
        assigneeId: first.assigned_to_id ?? null,
        total: groupIssues.length,
        open,
        closed,
        overdue,
        dueSoon,
        stale,
        highPriority,
        avgProgress,
        recentUpdateLabel: sortedByUpdate[0] ? formatUpdated(sortedByUpdate[0]) : '업데이트 없음',
        riskScore,
        issues: groupIssues,
      }
    })
    .sort((a, b) => {
      if (a.name === '미할당') return -1
      if (b.name === '미할당') return 1
      if (b.riskScore !== a.riskScore) return b.riskScore - a.riskScore
      return b.open - a.open
    })
}

import { Users, UserX, AlertCircle, Clock, PlayCircle, BarChart3 } from 'lucide-react'

// ... (existing helper functions) ...

export function TeamOverviewSection({
  projectId,
  issues = [],
  loading = false,
}: TeamOverviewSectionProps) {
  const searchParams = useSearchParams()
  const [selectedAssigneeKey, setSelectedAssigneeKey] = useState<string | null>(null)

  const assigneeSummaries = useMemo(() => createAssigneeSummaries(issues), [issues])
  const totalIssues = issues.length
  const openIssues = issues.filter((issue) => !isClosedIssue(issue)).length
  const closedIssues = issues.filter((issue) => isClosedIssue(issue)).length
  const unassignedIssues = issues.filter((issue) => getAssigneeName(issue) === '미할당').length
  const overdueIssues = issues.filter(isOverdueIssue).length
  const staleIssues = issues.filter(isStaleIssue).length
  const maxOpen = Math.max(1, ...assigneeSummaries.map((summary) => summary.open))
  const selectedAssignee = assigneeSummaries.find((summary) => summary.key === selectedAssigneeKey) ?? assigneeSummaries[0] ?? null
  const highRiskAssignees = assigneeSummaries.filter((summary) => getRiskTone(summary) === 'danger').length
  const activeAssignees = assigneeSummaries.filter((summary) => summary.name !== '미할당').length

  useEffect(() => {
    const assigneeParam = searchParams.get('assignee')
    if (!assigneeParam || assigneeSummaries.length === 0) return

    const nextSelection =
      assigneeParam === 'unassigned'
        ? assigneeSummaries.find((summary) => summary.assigneeId === null)
        : assigneeSummaries.find((summary) => String(summary.assigneeId) === assigneeParam)

    if (nextSelection) {
      setSelectedAssigneeKey(nextSelection.key)
    }
  }, [assigneeSummaries, searchParams])

  return (
    <section className="space-y-4 pb-8">
      {/* ── 헤더 영역 ── */}
      <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Users size={16} className="text-blue-500" />
            <span className="text-xs font-bold uppercase tracking-widest text-slate-400">팀 워크로드</span>
          </div>
          <h1 className="text-xl font-black tracking-tight text-slate-900">담당자 현황 분석</h1>
          <p className="mt-1 text-sm text-slate-500">
            {projectId ? `${projectId} 프로젝트의 ` : ''}담당자별 작업 부하와 지연 상태를 점검합니다.
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-bold text-slate-600 shadow-sm">
          기준 데이터: 총 <span className="text-slate-900">{totalIssues}</span>건
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-28 animate-pulse rounded-2xl bg-slate-200" />
          ))}
        </div>
      ) : (
        <>
          {/* ── KPI 메트릭 ── */}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 ring-1 ring-blue-100">
                  <Users size={20} />
                </span>
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400">활성 담당자</div>
                  <div className="mt-1 text-2xl font-black text-slate-950">{activeAssignees}<span className="text-sm font-semibold text-slate-500 ml-1">명</span></div>
                </div>
              </div>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">
                  <PlayCircle size={20} />
                </span>
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400">진행 중 이슈</div>
                  <div className="mt-1 text-2xl font-black text-slate-950">{openIssues}<span className="text-sm font-semibold text-slate-500 ml-1">건</span></div>
                </div>
              </div>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 ring-1 ring-amber-100">
                  <UserX size={20} />
                </span>
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400">미할당 이슈</div>
                  <div className="mt-1 text-2xl font-black text-slate-950">{unassignedIssues}<span className="text-sm font-semibold text-slate-500 ml-1">건</span></div>
                </div>
              </div>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 ring-1 ring-rose-100">
                  <AlertCircle size={20} />
                </span>
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400">위험 담당자</div>
                  <div className="mt-1 text-2xl font-black text-slate-950">{highRiskAssignees}<span className="text-sm font-semibold text-slate-500 ml-1">명</span></div>
                </div>
              </div>
            </article>
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">담당자 부하 상태</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    담당자별 진행 중 이슈, 지연, 정체, 고우선 작업을 기준으로 우선 확인 대상을 정리합니다.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                  <span className="rounded-full bg-slate-50 px-2.5 py-1">완료 {closedIssues}</span>
                  <span className="rounded-full bg-slate-50 px-2.5 py-1">지연 {overdueIssues}</span>
                  <span className="rounded-full bg-slate-50 px-2.5 py-1">정체 {staleIssues}</span>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {assigneeSummaries.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-12 text-center text-sm text-slate-500">
                    담당자 기준으로 표시할 이슈가 없습니다.
                  </div>
                ) : (
                  assigneeSummaries.map((summary) => {
                    const tone = getRiskTone(summary)
                    const isSelected = selectedAssignee?.key === summary.key

                    return (
                      <button
                        key={summary.key}
                        type="button"
                        onClick={() => setSelectedAssigneeKey(summary.key)}
                        className={[
                          'w-full rounded-2xl border px-4 py-4 text-left transition-colors',
                          isSelected
                            ? 'border-blue-200 bg-blue-50/50'
                            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50',
                        ].join(' ')}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="truncate text-sm font-semibold text-slate-950">{summary.name}</div>
                              <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${getToneClass(tone)}`}>
                                {getRiskLabel(summary)}
                              </span>
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                              전체 {summary.total}건 · 진행 {summary.open}건 · 완료 {summary.closed}건 · 최근 {summary.recentUpdateLabel}
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="text-sm font-semibold text-slate-950">{summary.avgProgress}%</div>
                            <div className="text-[11px] text-slate-400">평균 진행률</div>
                          </div>
                        </div>

                        <div className="mt-4">
                          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-slate-800"
                              style={{ width: getBarWidth(summary.open, maxOpen) }}
                            />
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                            <span>진행 {summary.open}</span>
                            <span>지연 {summary.overdue}</span>
                            <span>임박 {summary.dueSoon}</span>
                            <span>정체 {summary.stale}</span>
                            <span>고우선 {summary.highPriority}</span>
                          </div>
                        </div>
                      </button>
                    )
                  })
                )}
              </div>
            </div>

            <aside className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">선택 담당자</div>
                {selectedAssignee ? (
                  <>
                    <div className="mt-2 text-lg font-semibold text-slate-950">{selectedAssignee.name}</div>
                    <div className="mt-1 text-sm text-slate-500">
                      진행 {selectedAssignee.open}건, 지연 {selectedAssignee.overdue}건, 정체 {selectedAssignee.stale}건을 확인합니다.
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                        <div className="text-[11px] font-semibold text-slate-400">전체</div>
                        <div className="mt-1 text-lg font-semibold text-slate-900">{selectedAssignee.total}</div>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                        <div className="text-[11px] font-semibold text-slate-400">진행</div>
                        <div className="mt-1 text-lg font-semibold text-slate-900">{selectedAssignee.open}</div>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                        <div className="text-[11px] font-semibold text-slate-400">지연</div>
                        <div className="mt-1 text-lg font-semibold text-slate-900">{selectedAssignee.overdue}</div>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                        <div className="text-[11px] font-semibold text-slate-400">평균 진행률</div>
                        <div className="mt-1 text-lg font-semibold text-slate-900">{selectedAssignee.avgProgress}%</div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="mt-2 text-sm text-slate-500">담당자를 선택하면 상세 현황이 표시됩니다.</div>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">우선 확인 이슈</div>
                <div className="mt-3 space-y-2">
                  {selectedAssignee?.issues
                    .filter((issue) => !isClosedIssue(issue))
                    .sort((a, b) => {
                      const aScore = (isOverdueIssue(a) ? 5 : 0) + (isStaleIssue(a) ? 3 : 0) + (isDueSoonIssue(a) ? 2 : 0) + (isHighPriorityIssue(a) ? 2 : 0)
                      const bScore = (isOverdueIssue(b) ? 5 : 0) + (isStaleIssue(b) ? 3 : 0) + (isDueSoonIssue(b) ? 2 : 0) + (isHighPriorityIssue(b) ? 2 : 0)
                      return bScore - aScore
                    })
                    .slice(0, TOP_ISSUE_LIMIT)
                    .map((issue) => (
                      <a
                        key={issue.id}
                        href={`/dashboard/${projectId ?? ''}/issues?issueId=${issue.id}`}
                        className="block rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 transition-colors hover:border-slate-300 hover:bg-white"
                      >
                        <div className="text-xs font-semibold text-slate-400">#{issue.id}</div>
                        <div className="mt-1 line-clamp-2 text-sm font-medium text-slate-900">{issue.subject}</div>
                        <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-slate-500">
                          <span className="rounded-full bg-white px-2 py-0.5">{issue.status}</span>
                          <span className="rounded-full bg-white px-2 py-0.5">{formatDue(issue)}</span>
                          <span className="rounded-full bg-white px-2 py-0.5">{formatUpdated(issue)}</span>
                        </div>
                      </a>
                    ))}

                  {selectedAssignee && selectedAssignee.issues.filter((issue) => !isClosedIssue(issue)).length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 px-3 py-6 text-center text-sm text-slate-400">
                      진행 중인 이슈가 없습니다.
                    </div>
                  ) : null}
                </div>
              </div>
            </aside>
          </div>
        </>
      )}
    </section>
  )
}

export default TeamOverviewSection
