'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'

import Badge from '@/components/Badge'
import GroupedWorkloadChart from '@/components/charts/GroupedWorkloadChart'
import HorizontalBarChart from '@/components/charts/HorizontalBarChart'
import StatusDistributionChart from '@/components/charts/StatusDistributionChart'
import ScopeBadge from '@/components/ScopeBadge'
import SectionCard from '@/components/SectionCard'
import type { DashboardTone, DashboardModel } from '@/lib/dashboard'
import type { IssueListItem } from '@/types/dashboard'
import type { DashboardThresholdSettings } from '@/types/dashboard-derived'

type LabTab = 'distribution' | 'bottleneck' | 'quality'

interface RedmineDataLabProps {
  projectId: string
  issues: IssueListItem[]
  model: DashboardModel
  settings: DashboardThresholdSettings
}

interface ChartItem {
  label: string
  count: number
  tone: DashboardTone
}

const TABS: Array<{ id: LabTab; label: string; description: string }> = [
  { id: 'distribution', label: '분포', description: '상태, 유형, 우선순위, 진척도' },
  { id: 'bottleneck', label: '병목', description: '담당자별 부하와 지연 신호' },
  { id: 'quality', label: '데이터 품질', description: 'Redmine 입력값의 활용 가능성' },
]

function getStatusLabel(statusGroup: string) {
  if (statusGroup === 'open') return '대기'
  if (statusGroup === 'in_progress') return '진행'
  if (statusGroup === 'closed') return '완료'
  if (statusGroup === 'other') return '기타'
  return '미분류'
}

function getStatusTone(statusGroup: string): DashboardTone {
  if (statusGroup === 'closed') return 'success'
  if (statusGroup === 'in_progress') return 'info'
  if (statusGroup === 'open') return 'warning'
  return 'neutral'
}

function getPriorityTone(priority: string): DashboardTone {
  const normalized = priority.toLowerCase()
  if (normalized.includes('urgent') || normalized.includes('high') || normalized.includes('높') || normalized.includes('긴급')) {
    return 'danger'
  }
  if (normalized.includes('normal') || normalized.includes('보통')) return 'info'
  if (normalized.includes('low') || normalized.includes('낮')) return 'success'
  return 'neutral'
}

function getDoneRatioBucket(doneRatio: number) {
  if (doneRatio >= 100) return { label: '100% 완료', tone: 'success' as const }
  if (doneRatio >= 75) return { label: '75% 이상', tone: 'info' as const }
  if (doneRatio >= 50) return { label: '50% 이상', tone: 'warning' as const }
  if (doneRatio > 0) return { label: '착수됨', tone: 'neutral' as const }
  return { label: '0% 미착수', tone: 'danger' as const }
}

function countBy<T extends string>(
  issues: IssueListItem[],
  getKey: (issue: IssueListItem) => T,
  getTone: (key: T) => DashboardTone,
  limit = 6,
): ChartItem[] {
  const counts = new Map<T, number>()
  issues.forEach((issue) => {
    const key = getKey(issue)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  })

  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit)
    .map(([label, count]) => ({ label, count, tone: getTone(label) }))
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) return '0%'
  return `${Math.round(value * 100)}%`
}

export default function RedmineDataLab({ projectId, issues, model, settings }: RedmineDataLabProps) {
  const [activeTab, setActiveTab] = useState<LabTab>('distribution')

  const analytics = useMemo(() => {
    const activeIssues = issues.filter((issue) => issue.status_group !== 'closed')
    const closedIssues = issues.filter((issue) => issue.status_group === 'closed')
    const totalActive = Math.max(1, activeIssues.length)
    const totalIssues = Math.max(1, issues.length)

    const statusItems = countBy(
      issues,
      (issue) => getStatusLabel(issue.status_group),
      (label) => {
        if (label === '완료') return 'success'
        if (label === '진행') return 'info'
        if (label === '대기') return 'warning'
        return 'neutral'
      },
    )

    const trackerItems = countBy(
      issues,
      (issue) => issue.tracker ?? '트래커 없음',
      () => 'info',
    )

    const priorityItems = countBy(
      activeIssues,
      (issue) => issue.priority ?? '우선순위 없음',
      getPriorityTone,
    )

    const progressItems = countBy(
      activeIssues,
      (issue) => getDoneRatioBucket(issue.done_ratio).label,
      (label) => {
        if (label.includes('100')) return 'success'
        if (label.includes('75')) return 'info'
        if (label.includes('50')) return 'warning'
        if (label.includes('0')) return 'danger'
        return 'neutral'
      },
    )

    const statusBarItems = countBy(
      issues,
      (issue) => issue.status,
      (status) => getStatusTone(issues.find((issue) => issue.status === status)?.status_group ?? 'other'),
      8,
    )

    const trackerBarItems = trackerItems.map((item) => ({
      label: item.label,
      count: item.count,
      tone: item.tone,
    }))

    const workloadItems = model.capacity.slice(0, 6).map((member) => ({
      label: member.assignee.name,
      open: member.openCount,
      overdue: member.overdueCount,
      stale: member.staleCount,
    }))

    const coverage = [
      {
        label: '담당자 지정',
        value: formatPercent(activeIssues.filter((issue) => issue.assigned_to_id !== null).length / totalActive),
        note: '미할당 이슈가 적을수록 후속 조치가 빨라집니다.',
        tone: model.health.unassignedCount > 0 ? 'warning' as const : 'success' as const,
      },
      {
        label: '마감일 입력',
        value: formatPercent(activeIssues.filter((issue) => Boolean(issue.due_date)).length / totalActive),
        note: '마감일이 있어야 지연과 임박 신호가 정확해집니다.',
        tone: activeIssues.some((issue) => !issue.due_date) ? 'warning' as const : 'success' as const,
      },
      {
        label: '최근 업데이트',
        value: formatPercent(model.health.recentlyUpdatedCount / totalActive),
        note: `${settings.recentActivityDays}일 이내 갱신된 활성 이슈 비율입니다.`,
        tone: model.health.staleCount > 0 ? 'warning' as const : 'success' as const,
      },
      {
        label: '완료 비율',
        value: formatPercent(closedIssues.length / totalIssues),
        note: 'Redmine 상태값 기준 누적 완료 비율입니다.',
        tone: closedIssues.length > activeIssues.length ? 'success' as const : 'info' as const,
      },
    ]

    const strongestSignal = [
      { label: '지연', count: model.health.overdueCount, href: 'overdue', tone: 'danger' as const },
      { label: '정체', count: model.health.staleCount, href: 'stale', tone: 'warning' as const },
      { label: '임박', count: model.health.dueSoonCount, href: 'due_soon', tone: 'warning' as const },
      { label: '미할당', count: model.health.unassignedCount, href: 'unassigned', tone: 'neutral' as const },
    ].sort((left, right) => right.count - left.count)[0]

    return {
      activeIssues,
      coverage,
      priorityItems,
      progressItems,
      statusBarItems,
      statusItems,
      strongestSignal,
      trackerBarItems,
      trackerItems,
      workloadItems,
    }
  }, [issues, model, settings.recentActivityDays])

  return (
    <SectionCard
      title="Redmine 데이터 랩"
      subtitle="Redmine에서 가져온 원천 필드를 상태 판단, 병목 탐지, 데이터 품질 점검용으로 다시 가공했습니다."
      aside={<ScopeBadge kind="full" label="원천 데이터 재해석" />}
      density="primary"
      bodyClassName="space-y-4"
    >
      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={[
              'rounded-xl px-3 py-2 text-left text-sm font-semibold transition-colors',
              activeTab === tab.id
                ? 'bg-slate-950 text-white'
                : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-950',
            ].join(' ')}
          >
            <span className="block">{tab.label}</span>
            <span className={activeTab === tab.id ? 'block text-[11px] text-slate-300' : 'block text-[11px] text-slate-400'}>
              {tab.description}
            </span>
          </button>
        ))}
      </div>

      {activeTab === 'distribution' ? (
        <div className="grid gap-3 xl:grid-cols-2">
          <StatusDistributionChart
            title="상태 그룹 분포"
            description="Redmine 상태를 대기, 진행, 완료, 기타로 묶어 전체 작업 흐름을 봅니다."
            items={analytics.statusItems}
          />
          <StatusDistributionChart
            title="우선순위 분포"
            description="활성 이슈의 Redmine 우선순위를 위험 신호와 함께 봅니다."
            items={analytics.priorityItems}
          />
          <HorizontalBarChart
            title="세부 상태 상위 항목"
            description="Redmine 상태명을 그대로 유지해 어느 단계가 많은지 확인합니다."
            items={analytics.statusBarItems}
          />
          <HorizontalBarChart
            title="트래커별 작업 유형"
            description="버그, 기능, 지원 등 Redmine 트래커 기준의 업무 구성을 봅니다."
            items={analytics.trackerBarItems}
          />
        </div>
      ) : null}

      {activeTab === 'bottleneck' ? (
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1.15fr)_minmax(300px,0.85fr)]">
          <GroupedWorkloadChart
            title="담당자별 부하"
            description="활성, 지연, 정체 항목을 같은 축에 놓고 병목 후보를 비교합니다."
            items={analytics.workloadItems}
          />
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-semibold text-slate-950">가장 먼저 볼 신호</div>
            <div className="mt-3 rounded-2xl border border-white bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Top signal
                  </div>
                  <div className="mt-1 text-3xl font-semibold text-slate-950">
                    {analytics.strongestSignal.count}
                  </div>
                  <div className="mt-1 text-sm text-slate-600">{analytics.strongestSignal.label} 이슈</div>
                </div>
                <Badge tone={analytics.strongestSignal.tone}>
                  {analytics.strongestSignal.count > 0 ? '확인 필요' : '안정'}
                </Badge>
              </div>
              <Link
                href={`/dashboard/${encodeURIComponent(projectId)}/issues?preset=${analytics.strongestSignal.href}`}
                className="mt-4 inline-flex min-h-10 items-center rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                관련 이슈 보기
              </Link>
            </div>
            <div className="mt-3 grid gap-2">
              {model.capacity.slice(0, 4).map((member) => (
                <Link
                  key={member.key}
                  href={`/dashboard/${encodeURIComponent(projectId)}/team?assignee=${encodeURIComponent(String(member.assignee.id ?? 'unassigned'))}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm transition hover:border-slate-300"
                >
                  <span className="min-w-0 truncate font-semibold text-slate-800">{member.assignee.name}</span>
                  <span className="shrink-0 text-xs text-slate-500">
                    활성 {member.openCount} · 지연 {member.overdueCount} · 정체 {member.staleCount}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === 'quality' ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {analytics.coverage.map((item) => (
            <div key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-slate-950">{item.label}</div>
                <Badge tone={item.tone}>{item.tone === 'success' ? '좋음' : '점검'}</Badge>
              </div>
              <div className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{item.value}</div>
              <p className="mt-2 text-sm leading-5 text-slate-600">{item.note}</p>
            </div>
          ))}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 md:col-span-2 xl:col-span-4">
            <div className="text-sm font-semibold text-slate-950">진척도 입력 분포</div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              {analytics.progressItems.map((item) => (
                <div key={item.label} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                  <div className="text-xs font-semibold text-slate-500">{item.label}</div>
                  <div className="mt-1 text-xl font-semibold text-slate-950">{item.count}건</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </SectionCard>
  )
}
