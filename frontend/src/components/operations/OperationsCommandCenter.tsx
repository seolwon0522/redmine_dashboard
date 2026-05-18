'use client'

import Link from 'next/link'
import { useMemo } from 'react'

import Badge from '@/components/Badge'
import { evaluateIssueRisk, isHighPriorityIssue, matchesIssuePreset } from '@/lib/dashboard'
import { parseLocalDate } from '@/lib/dashboard/date'
import { getPrimaryReason } from '@/lib/dashboard/presentation'
import type { IssueListItem, IssuePreset } from '@/types/dashboard'
import type { DashboardModel, DashboardThresholdSettings, DashboardTone } from '@/types/dashboard-derived'

type Props = {
  projectId: string
  issues: IssueListItem[]
  model: DashboardModel
  settings: DashboardThresholdSettings
}

type Lane = {
  id: IssuePreset
  title: string
  subtitle: string
  tone: DashboardTone
  issues: IssueListItem[]
}

const DAY_MS = 86_400_000

function isActive(issue: IssueListItem) {
  return issue.status_group !== 'closed'
}

function issueRiskScore(issue: IssueListItem, settings: DashboardThresholdSettings) {
  const risk = evaluateIssueRisk(issue, settings)

  return (
    (risk.isLongOverdue ? 20 : 0) +
    (risk.isOverdue ? 12 : 0) +
    (isHighPriorityIssue(issue) ? 8 : 0) +
    (risk.isDueSoon ? 6 : 0) +
    (risk.isStale ? 4 : 0) +
    (issue.assigned_to_id === null ? 3 : 0)
  )
}

function sortByRisk(issues: IssueListItem[], settings: DashboardThresholdSettings) {
  return [...issues].sort((left, right) => {
    const riskDelta = issueRiskScore(right, settings) - issueRiskScore(left, settings)
    if (riskDelta !== 0) return riskDelta

    const leftDue = parseLocalDate(left.due_date)?.getTime() ?? Number.POSITIVE_INFINITY
    const rightDue = parseLocalDate(right.due_date)?.getTime() ?? Number.POSITIVE_INFINITY
    return leftDue - rightDue
  })
}

function formatShortDate(date: Date) {
  return `${date.getMonth() + 1}/${date.getDate()}`
}

function buildDueHeatmap(issues: IssueListItem[]) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today.getTime() + index * DAY_MS)
    const nextDate = new Date(date.getTime() + DAY_MS)
    const dueIssues = issues.filter((issue) => {
      if (!isActive(issue)) return false
      const dueDate = parseLocalDate(issue.due_date)
      if (!dueDate) return false
      return dueDate >= date && dueDate < nextDate
    })

    return {
      key: date.toISOString(),
      label: index === 0 ? '오늘' : formatShortDate(date),
      count: dueIssues.length,
      highPriority: dueIssues.filter(isHighPriorityIssue).length,
    }
  })
}

function getCapacityTone(band: string): DashboardTone {
  if (band === 'stretched') return 'danger'
  if (band === 'watch') return 'warning'
  return 'success'
}

function getCapacityLabel(band: string) {
  if (band === 'stretched') return '과부하'
  if (band === 'watch') return '주의'
  return '안정'
}

export default function OperationsCommandCenter({ projectId, issues, model, settings }: Props) {
  const activeIssues = useMemo(() => issues.filter(isActive), [issues])
  const topIssue = useMemo(() => sortByRisk(activeIssues, settings)[0] ?? null, [activeIssues, settings])
  const topReason = topIssue ? getPrimaryReason(topIssue, settings) : null

  const lanes = useMemo<Lane[]>(() => {
    const source: Lane[] = [
      {
        id: 'overdue',
        title: '복구 큐',
        subtitle: '이미 늦어진 작업',
        tone: 'danger',
        issues: activeIssues.filter((issue) => matchesIssuePreset(issue, 'overdue', settings)),
      },
      {
        id: 'due_soon',
        title: '마감 방어',
        subtitle: `${settings.dueSoonDays}일 안에 마감`,
        tone: 'warning',
        issues: activeIssues.filter((issue) => matchesIssuePreset(issue, 'due_soon', settings)),
      },
      {
        id: 'stale',
        title: '정체 해소',
        subtitle: `${settings.staleDays}일 이상 미갱신`,
        tone: 'warning',
        issues: activeIssues.filter((issue) => matchesIssuePreset(issue, 'stale', settings)),
      },
      {
        id: 'unassigned',
        title: '소유권 지정',
        subtitle: '담당자가 비어 있음',
        tone: 'info',
        issues: activeIssues.filter((issue) => matchesIssuePreset(issue, 'unassigned', settings)),
      },
    ]

    return source.map((lane) => ({
      ...lane,
      issues: sortByRisk(lane.issues, settings).slice(0, 4),
    }))
  }, [activeIssues, settings])

  const dueHeatmap = useMemo(() => buildDueHeatmap(activeIssues), [activeIssues])
  const maxDueCount = Math.max(1, ...dueHeatmap.map((item) => item.count))
  const bottleneckMembers = model.capacity.filter((member) => member.openCount > 0).slice(0, 4)
  const handoffCandidates = sortByRisk(
    activeIssues.filter((issue) => issue.assigned_to_id === null || isHighPriorityIssue(issue)),
    settings,
  ).slice(0, 5)

  const statusFlow = [
    { label: '대기', count: model.health.activeCount - (model.health.recentlyUpdatedCount ?? 0), tone: 'neutral' as const },
    { label: '최근 갱신', count: model.health.recentlyUpdatedCount, tone: 'success' as const },
    { label: '정체', count: model.health.staleCount, tone: 'warning' as const },
    { label: '지연', count: model.health.overdueCount, tone: 'danger' as const },
  ].filter((item) => item.count > 0)

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)]">
      <div className="overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-sm shadow-slate-200/40">
        <div className="border-b border-slate-100 bg-slate-950 px-5 py-4 text-white">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-200">Operations command</div>
              <h2 className="mt-1 text-xl font-semibold tracking-tight">오늘 움직일 작업 흐름</h2>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-300">
                Redmine 목록을 그대로 보여주는 대신, 실제 이슈 신호를 조합해 지금 처리 순서와 다음 행동을 압축합니다.
              </p>
            </div>
            <Link
              href={`/dashboard/${encodeURIComponent(projectId)}/issues?preset=attention`}
              className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-slate-100"
            >
              조치 큐 열기
            </Link>
          </div>

          {topIssue && topReason ? (
            <Link
              href={`/dashboard/${encodeURIComponent(projectId)}/issues?issueId=${topIssue.id}`}
              className="mt-4 block rounded-[18px] border border-white/15 bg-white/10 px-4 py-3 transition-colors hover:bg-white/15"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-sky-100">다음 한 건</div>
                  <div className="mt-1 truncate text-base font-semibold">#{topIssue.id} {topIssue.subject}</div>
                  <div className="mt-1 line-clamp-2 text-sm leading-5 text-slate-300">{topReason.detail}</div>
                </div>
                <Badge tone={topReason.tone} className="border-white/20 bg-white/90">{topReason.label}</Badge>
              </div>
            </Link>
          ) : null}
        </div>

        <div className="grid gap-px bg-slate-100 lg:grid-cols-4">
          {lanes.map((lane) => (
            <div key={lane.id} className="bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-950">{lane.title}</div>
                  <div className="mt-1 text-xs text-slate-500">{lane.subtitle}</div>
                </div>
                <Badge tone={lane.issues.length > 0 ? lane.tone : 'success'}>{lane.issues.length}</Badge>
              </div>

              <div className="mt-4 space-y-2">
                {lane.issues.length > 0 ? (
                  lane.issues.map((issue) => {
                    const reason = getPrimaryReason(issue, settings)
                    return (
                      <Link
                        key={`${lane.id}-${issue.id}`}
                        href={`/dashboard/${encodeURIComponent(projectId)}/issues?issueId=${issue.id}`}
                        className="block rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 transition-colors hover:border-slate-300 hover:bg-white"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-[11px] font-semibold text-slate-400">#{issue.id}</div>
                            <div className="mt-1 line-clamp-2 text-sm font-semibold leading-5 text-slate-900">{issue.subject}</div>
                          </div>
                          <Badge tone={reason.tone} size="xs">{reason.label}</Badge>
                        </div>
                        <div className="mt-2 truncate text-xs text-slate-500">{issue.assigned_to ?? '미할당'} · {issue.status}</div>
                      </Link>
                    )
                  })
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-8 text-center text-sm text-slate-400">
                    현재 큐 없음
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <aside className="space-y-4">
        <div className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/40">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-950">7일 마감 열지도</h3>
              <p className="mt-1 text-sm leading-5 text-slate-500">실제 마감일 기준으로 이번 주 몰림을 보여줍니다.</p>
            </div>
            <Badge tone={dueHeatmap.some((day) => day.count > 0) ? 'warning' : 'success'}>
              {dueHeatmap.reduce((sum, day) => sum + day.count, 0)}건
            </Badge>
          </div>
          <div className="mt-4 grid grid-cols-7 gap-1.5">
            {dueHeatmap.map((day) => (
              <div key={day.key} className="min-w-0">
                <div className="truncate text-center text-[11px] font-semibold text-slate-400">{day.label}</div>
                <div
                  className={[
                    'mt-1 flex h-20 flex-col items-center justify-end rounded-xl border px-1.5 py-2',
                    day.count > 0 ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-slate-50',
                  ].join(' ')}
                >
                  <div
                    className="w-full rounded-lg bg-slate-900"
                    style={{ height: `${Math.max(6, Math.round((day.count / maxDueCount) * 46))}px` }}
                  />
                  <div className="mt-1 text-xs font-semibold text-slate-900">{day.count}</div>
                </div>
                {day.highPriority > 0 ? (
                  <div className="mt-1 truncate text-center text-[10px] font-semibold text-rose-600">고 {day.highPriority}</div>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/40">
          <h3 className="text-base font-semibold text-slate-950">병목 담당자</h3>
          <div className="mt-3 space-y-2">
            {bottleneckMembers.length > 0 ? bottleneckMembers.map((member) => (
              <Link
                key={member.key}
                href={`/dashboard/${encodeURIComponent(projectId)}/team?assignee=${encodeURIComponent(String(member.assignee.id ?? 'unassigned'))}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 transition-colors hover:border-slate-300 hover:bg-white"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-950">{member.assignee.name}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    진행 {member.openCount} · 지연 {member.overdueCount} · 정체 {member.staleCount}
                  </div>
                </div>
                <Badge tone={getCapacityTone(member.band)}>{getCapacityLabel(member.band)}</Badge>
              </Link>
            )) : (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-8 text-center text-sm text-slate-400">
                현재 강한 병목 담당자가 없습니다.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/40">
          <h3 className="text-base font-semibold text-slate-950">운영 신호 믹스</h3>
          <div className="mt-3 space-y-2">
            {statusFlow.map((item) => (
              <div key={item.label} className="flex items-center gap-3">
                <div className="w-20 text-xs font-semibold text-slate-500">{item.label}</div>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={[
                      'h-full rounded-full',
                      item.tone === 'danger' ? 'bg-rose-500' : item.tone === 'warning' ? 'bg-amber-500' : item.tone === 'success' ? 'bg-emerald-500' : 'bg-slate-400',
                    ].join(' ')}
                    style={{ width: `${Math.max(8, Math.min(100, Math.round((item.count / Math.max(1, model.health.activeCount)) * 100)))}%` }}
                  />
                </div>
                <div className="w-8 text-right text-xs font-semibold text-slate-900">{item.count}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/40">
          <h3 className="text-base font-semibold text-slate-950">인수인계 후보</h3>
          <div className="mt-3 space-y-2">
            {handoffCandidates.length > 0 ? handoffCandidates.map((issue) => (
              <Link
                key={`handoff-${issue.id}`}
                href={`/dashboard/${encodeURIComponent(projectId)}/issues?issueId=${issue.id}`}
                className="block rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 transition-colors hover:border-slate-300 hover:bg-white"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="truncate text-sm font-semibold text-slate-950">#{issue.id} {issue.subject}</div>
                  <Badge tone={issue.assigned_to_id === null ? 'warning' : 'danger'} size="xs">
                    {issue.assigned_to_id === null ? '미할당' : '고우선'}
                  </Badge>
                </div>
                <div className="mt-1 text-xs text-slate-500">{issue.assigned_to ?? '담당자 없음'} · {issue.status}</div>
              </Link>
            )) : (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-8 text-center text-sm text-slate-400">
                지금 넘겨받을 후보가 없습니다.
              </div>
            )}
          </div>
        </div>
      </aside>
    </section>
  )
}
