'use client'

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'

import Badge from '@/components/Badge'
import ScopeBadge from '@/components/ScopeBadge'
import SectionCard from '@/components/SectionCard'
import { fetchIssueDetail } from '@/lib/api'
import { summarizeAssigneeJournalActivity, type AssigneeJournalInsight, type AssigneeTendencyInsight, type DashboardThresholdSettings } from '@/lib/dashboard'

interface Props {
  insights: AssigneeTendencyInsight[]
  settings: DashboardThresholdSettings
  mode?: 'condensed' | 'focused'
  selectedKey?: string | null
  onSelectKey?: (key: string | null) => void
  onSelectIssue: (issueId: number) => void
}

interface DetailState {
  loading: boolean
  error: string | null
  data: AssigneeJournalInsight | null
}

function getRecommendedAction(insight: AssigneeTendencyInsight) {
  const tagLabels = insight.tendencyTags.map((tag) => tag.label)

  if (tagLabels.includes('장기 보유 비중 높음')) {
    return '중간 체크포인트를 더 자주 잡고, 오래 묶인 작업의 막힌 지점을 먼저 확인하세요.'
  }

  if (tagLabels.includes('병렬 작업량 높음')) {
    return '동시에 잡고 있는 작업 수를 줄일 수 있는지 확인하고, 급한 항목부터 재배치하세요.'
  }

  if (tagLabels.includes('마감 안정') || tagLabels.includes('처리 속도 빠름')) {
    return '현재 방식은 유지하되, 급한 작업이 새로 몰릴 때만 우선순위 재조정이 필요한지 확인하세요.'
  }

  return '진행 상황이 끊기지 않는지, 최근 업데이트와 담당 범위를 함께 점검하세요.'
}

function Sparkline({ values }: { values: number[] }) {
  const maxValue = Math.max(...values, 1)

  return (
    <div className="flex h-8 items-end gap-1">
      {values.map((value, index) => (
        <div
          key={`${value}-${index}`}
          className="w-2 rounded-t bg-slate-300"
          style={{ height: `${Math.max(5, Math.round((value / maxValue) * 30))}px` }}
          title={`${value}건`}
        />
      ))}
    </div>
  )
}

function DetailPanel({ detail, onSelectIssue }: { detail: AssigneeJournalInsight; onSelectIssue: (issueId: number) => void }) {
  return (
    <div className="space-y-5 rounded-[24px] border border-slate-200 bg-slate-50/80 px-4 py-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">표본 이슈</div>
          <div className="mt-2 text-lg font-semibold text-slate-900">{detail.sampleSize}건</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">메모 빈도</div>
          <div className="mt-2 text-lg font-semibold text-slate-900">{detail.notesPerIssue}회</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">상태/진행 갱신</div>
          <div className="mt-2 text-lg font-semibold text-slate-900">{detail.changeEventsPerIssue}회</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">이력 간격</div>
          <div className="mt-2 text-lg font-semibold text-slate-900">{detail.averageJournalGapDays ?? '—'}일</div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
        <div className="text-sm font-semibold text-slate-900">추가 관찰</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {detail.observations.length > 0 ? detail.observations.map((observation) => (
            <Badge key={observation} tone="neutral">{observation}</Badge>
          )) : <span className="text-xs text-slate-400">추가 관찰 포인트가 충분하지 않습니다.</span>}
        </div>
        <p className="mt-3 text-sm text-slate-600">{detail.interpretation}</p>
      </div>

      <div>
        <div className="text-sm font-semibold text-slate-900">표본 이슈</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {detail.issues.map((issue) => (
            <button
              key={issue.id}
              type="button"
              onClick={() => onSelectIssue(issue.id)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-left text-xs text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
            >
              <div className="font-semibold text-slate-900">#{issue.id}</div>
              <div className="mt-1 max-w-[220px] truncate">{issue.subject}</div>
              <div className="mt-1 text-slate-500">{issue.status} · 진행 {issue.done_ratio}%</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function AssigneeInsightsPanel({ insights, settings, mode = 'condensed', selectedKey: controlledSelectedKey, onSelectKey, onSelectIssue }: Props) {
  const [internalSelectedKey, setInternalSelectedKey] = useState<string | null>(null)
  const [detailMap, setDetailMap] = useState<Record<string, DetailState>>({})

  const selectedKey = controlledSelectedKey !== undefined ? controlledSelectedKey : internalSelectedKey
  const focusedInsight = useMemo(() => {
    if (insights.length === 0) return null
    if (selectedKey) {
      return insights.find((insight) => insight.key === selectedKey) ?? insights[0]
    }
    return insights[0]
  }, [insights, selectedKey])

  const loadDetail = useCallback(async (insight: AssigneeTendencyInsight) => {
    if (insight.sampleIssueIds.length === 0) {
      setDetailMap((current) => ({
        ...current,
        [insight.key]: {
          loading: false,
          error: null,
          data: {
            sampleSize: 0,
            notesPerIssue: 0,
            changeEventsPerIssue: 0,
            averageJournalGapDays: null,
            lateStageChangeRatio: null,
            observations: [],
            interpretation: '표본으로 확인할 최근 이슈가 없습니다.',
            issues: [],
          },
        },
      }))
      return
    }

    setDetailMap((current) => ({
      ...current,
      [insight.key]: {
        loading: true,
        error: null,
        data: current[insight.key]?.data ?? null,
      },
    }))

    try {
      const details = await Promise.all(insight.sampleIssueIds.map((issueId) => fetchIssueDetail(issueId)))
      const summary = summarizeAssigneeJournalActivity(details, settings)
      setDetailMap((current) => ({
        ...current,
        [insight.key]: {
          loading: false,
          error: null,
          data: summary,
        },
      }))
    } catch (error) {
      const message = error instanceof Error ? error.message : '상세 근거를 불러오지 못했습니다.'
      setDetailMap((current) => ({
        ...current,
        [insight.key]: {
          loading: false,
          error: message,
          data: null,
        },
      }))
    }
  }, [settings])

  useEffect(() => {
    if (mode !== 'focused' || !focusedInsight) return
    if (detailMap[focusedInsight.key]) return
    void loadDetail(focusedInsight)
  }, [detailMap, focusedInsight, loadDetail, mode])

  function toggleInsight(insight: AssigneeTendencyInsight) {
    const nextSelected = selectedKey === insight.key ? null : insight.key
    if (onSelectKey) {
      onSelectKey(nextSelected)
    } else {
      setInternalSelectedKey(nextSelected)
    }

    if (nextSelected && !detailMap[insight.key]) {
      void loadDetail(insight)
    }
  }

  if (mode === 'focused') {
    if (!focusedInsight) {
      return (
        <SectionCard
          title="선택한 후속 점검 신호"
          subtitle="담당자를 선택하면 실제 작업 흐름 근거와 후속 점검 포인트를 바로 확인할 수 있습니다."
          aside={<ScopeBadge kind="advisory" label="후속 점검용 판단" />}
          density="primary"
          bodyClassName="space-y-4"
        >
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-500">
            선택한 담당자에게는 아직 뚜렷한 작업 패턴 신호가 없습니다. 팀 전체 우선 확인 목록에서 다른 담당자를 먼저 보는 편이 더 유효합니다.
          </div>
        </SectionCard>
      )
    }

    const detail = detailMap[focusedInsight.key]

    return (
      <SectionCard
        title="선택한 후속 점검 신호"
        subtitle="선택한 담당자가 바로 문제라는 뜻이 아니라, 후속 점검이 필요한지 판단할 근거와 관리 액션을 함께 확인합니다."
        aside={<ScopeBadge kind="advisory" label="후속 점검용 판단" />}
        density="primary"
        bodyClassName="space-y-5"
      >
        <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-5 py-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-lg font-semibold text-slate-950">{focusedInsight.assignee.name}</div>
              <p className="mt-2 text-sm leading-6 text-slate-600">{focusedInsight.interpretation}</p>
            </div>
            <Badge tone="info" size="md">활성 {focusedInsight.activeCount}건</Badge>
          </div>

          <div className="mt-4 flex flex-wrap gap-1.5">
            {focusedInsight.tendencyTags.slice(0, 2).map((tag) => (
              <Badge key={`${focusedInsight.key}-${tag.label}`} tone={tag.tone}>{tag.label}</Badge>
            ))}
          </div>
        </div>

        <div>
          <div className="text-sm font-semibold text-slate-900">핵심 근거</div>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {focusedInsight.evidence.map((item) => (
              <div key={`${focusedInsight.key}-${item.label}`} className="rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-sm shadow-slate-200/20">
                <div className="text-xs text-slate-500">{item.label}</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">{item.value}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[24px] border border-amber-100 bg-amber-50 px-4 py-4">
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-700">권장 관리 액션</div>
          <div className="mt-2 text-sm leading-6 text-amber-900">{getRecommendedAction(focusedInsight)}</div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm shadow-slate-200/20">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-slate-900">최근 6주 완료 흐름</div>
            <div className="text-xs text-slate-500">패턴 추이</div>
          </div>
          <div className="mt-3">
            <Sparkline values={focusedInsight.sparkline} />
          </div>
        </div>

        {detail?.loading ? (
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-5 text-sm text-slate-500">최근 이력 표본을 불러오는 중입니다...</div>
        ) : detail?.error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-5 text-sm text-rose-700">{detail.error}</div>
        ) : detail?.data ? (
          <DetailPanel detail={detail.data} onSelectIssue={onSelectIssue} />
        ) : null}
      </SectionCard>
    )
  }

  return (
    <SectionCard
      title="팀 후속 점검 신호"
      subtitle="긴급 이슈 큐가 아니라 담당·부하 점검 후보를 보여주고, 선택 후에는 관련 근거와 후속 액션까지 이어서 확인합니다."
      aside={<ScopeBadge kind="advisory" label="후속 점검용 판단" />}
      density="secondary"
      bodyClassName="space-y-4"
    >
      {insights.length === 0 ? (
        <div className="px-4 py-8 text-sm text-slate-400">작업 패턴을 읽을 데이터가 아직 충분하지 않습니다.</div>
      ) : (
        <div className="grid gap-2.5 lg:grid-cols-2 2xl:grid-cols-3">
          {insights.map((insight) => {
            const isSelected = selectedKey === insight.key

            return (
              <Fragment key={insight.key}>
                <article className={[
                  'rounded-[16px] border px-3.5 py-3.5 transition-colors',
                  isSelected
                    ? 'border-slate-300 bg-slate-50 shadow-sm shadow-slate-200/35'
                    : 'border-slate-200 bg-white shadow-sm shadow-slate-100/70',
                ].join(' ')}>
                  <button type="button" onClick={() => toggleInsight(insight)} className="w-full text-left">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-base font-semibold text-slate-950">{insight.assignee.name}</div>
                        <p className="mt-1.5 line-clamp-2 text-[13px] leading-5 text-slate-600">{insight.interpretation}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <Badge tone={isSelected ? 'neutral' : 'info'}>활성 {insight.activeCount}건</Badge>
                      </div>
                    </div>

                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {insight.tendencyTags.slice(0, 2).map((tag) => (
                        <Badge key={`${insight.key}-${tag.label}`} tone={tag.tone}>{tag.label}</Badge>
                      ))}
                    </div>

                    <div className="mt-2.5 rounded-[10px] border border-slate-200 bg-slate-50 px-2.5 py-2 text-[11px] font-medium text-slate-500">
                      권장 후속 점검: {getRecommendedAction(insight)}
                    </div>
                  </button>
                </article>
              </Fragment>
            )
          })}
        </div>
      )}
    </SectionCard>
  )
}