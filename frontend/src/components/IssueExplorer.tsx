'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'

import Badge from '@/components/Badge'
import FilterChips from '@/components/FilterChips'
import IssueListTable, { sortIssues } from '@/components/IssueListTable'
import ScopeBadge from '@/components/ScopeBadge'
import SectionCard from '@/components/SectionCard'
import { type DashboardThresholdSettings, type ExplorerPresetModel, getIssueSignals } from '@/lib/dashboard'
import {
  formatDue,
  formatUpdated,
  getPrimaryReason,
  getPriorityTone,
  getStatusTone,
  type IssueSortDir,
  type IssueSortKey,
} from '@/lib/dashboard/presentation'
import { getPriorityLabel } from '@/lib/labels'
import type { DashboardFilter, IssueListItem, IssuePreset } from '@/types/dashboard'

interface Props {
  issues: IssueListItem[]
  settings: DashboardThresholdSettings
  loading?: boolean
  selectedIssueId: number | null
  initialSearch?: string
  filter: DashboardFilter
  presets: ExplorerPresetModel[]
  onSelectIssue: (issueId: number) => void
  onSelectPreset: (preset: IssuePreset | null) => void
  onClearFilter: (key: keyof DashboardFilter) => void
  onClearAll: () => void
}

const PAGE_SIZE_OPTIONS = [20, 50, 100] as const

function getPresetCount(presets: ExplorerPresetModel[], label: string) {
  return presets.find((preset) => preset.label === label)?.count ?? 0
}

function getTopRiskIssue(issues: IssueListItem[], settings: DashboardThresholdSettings) {
  if (issues.length === 0) return null

  return sortIssues(issues, settings, 'attention', 'desc')[0] ?? null
}

export default function IssueExplorer({
  issues,
  settings,
  loading,
  selectedIssueId,
  initialSearch = '',
  filter,
  presets,
  onSelectIssue,
  onSelectPreset,
  onClearFilter,
  onClearAll,
}: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [search, setSearch] = useState(initialSearch)
  const [sortKey, setSortKey] = useState<IssueSortKey>('attention')
  const [sortDir, setSortDir] = useState<IssueSortDir>('desc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(20)
  const prevIssuesRef = useRef(issues)

  useEffect(() => {
    if (prevIssuesRef.current !== issues) {
      prevIssuesRef.current = issues
      setPage(1)
    }
  }, [issues])

  useEffect(() => {
    setSearch(initialSearch)
    setPage(1)
  }, [initialSearch])

  const searchedIssues = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return issues

    return issues.filter((issue) => (
      issue.subject.toLowerCase().includes(query) ||
      String(issue.id).includes(query) ||
      (issue.assigned_to?.toLowerCase().includes(query) ?? false) ||
      (issue.tracker?.toLowerCase().includes(query) ?? false) ||
      (issue.author?.toLowerCase().includes(query) ?? false)
    ))
  }, [issues, search])

  const sortedIssues = useMemo(
    () => sortIssues(searchedIssues, settings, sortKey, sortDir),
    [searchedIssues, settings, sortDir, sortKey],
  )

  const totalPages = Math.max(1, Math.ceil(sortedIssues.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const pageItems = sortedIssues.slice((safePage - 1) * pageSize, safePage * pageSize)
  const hasActiveFilter = Boolean(filter.statusGroup || filter.assignee || filter.preset)
  const activePreset = presets.find((preset) => preset.id === filter.preset) ?? null
  const activeSortLabel = {
    attention: '우선순위',
    id: '번호',
    subject: '이슈명',
    assignee: '담당자',
    priority: '우선순위',
    due: '마감',
    updated: '업데이트',
    progress: '진행률',
  }[sortKey]

  const overdueCount = getPresetCount(presets, '기한 초과')
  const dueSoonCount = getPresetCount(presets, '임박 일정')
  const unassignedCount = getPresetCount(presets, '미할당')
  const staleCount = getPresetCount(presets, '정체')
  const highPriorityCount = getPresetCount(presets, '고우선')
  const recentlyClosedCount = getPresetCount(presets, '최근 완료')
  const operationalRiskCount = unassignedCount + staleCount
  const topRiskIssue = useMemo(() => getTopRiskIssue(searchedIssues, settings), [searchedIssues, settings])
  const topRiskReason = topRiskIssue ? getPrimaryReason(topRiskIssue, settings) : null

  function toggleSort(nextKey: IssueSortKey) {
    if (sortKey === nextKey) {
      setSortDir((current) => (current === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(nextKey)
      setSortDir(nextKey === 'subject' || nextKey === 'assignee' ? 'asc' : 'desc')
    }
  }

  function handleSearchChange(nextSearch: string) {
    setSearch(nextSearch)
    setPage(1)

    const nextParams = new URLSearchParams(searchParams.toString())
    const trimmed = nextSearch.trim()
    if (trimmed) nextParams.set('q', trimmed)
    else nextParams.delete('q')
    router.replace(nextParams.size > 0 ? `${pathname}?${nextParams.toString()}` : pathname, { scroll: false })
  }

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages))
  }, [totalPages])

  return (
    <SectionCard
      title="이슈 큐"
      subtitle="개요에서 본 우선순위를 실제 이슈 목록으로 이어서 확인합니다."
      aside={
        <div className="flex flex-wrap items-center gap-2">
          <ScopeBadge kind="full" label="실제 이슈 기준" />
          <Badge tone="info" size="md">총 {issues.length}건</Badge>
        </div>
      }
      density="primary"
      bodyClassName="space-y-3"
    >
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-wrap gap-1.5">
            {presets.map((preset) => {
              const isActive = preset.id === filter.preset || (preset.id === null && filter.preset === null)

              return (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => onSelectPreset(preset.id)}
                  className={[
                    'rounded-full border px-2.5 py-1.5 text-xs font-semibold transition-colors',
                    isActive
                      ? 'border-white bg-white text-slate-950 shadow-sm shadow-slate-200/70'
                      : 'border-transparent bg-transparent text-slate-500 hover:border-white hover:bg-white hover:text-slate-900',
                  ].join(' ')}
                >
                  {preset.label}
                  <span className="ml-1 text-[11px] text-slate-400">{preset.count}</span>
                </button>
              )
            })}
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-white bg-white px-4 py-4 shadow-sm shadow-slate-200/50">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">우선 확인</div>
              <div className="mt-2 text-xl font-semibold text-slate-950">{overdueCount}</div>
              <div className="mt-1 text-xs leading-5 text-slate-500">
                마감이 지난 이슈입니다. 담당자 확인과 일정 재조정이 우선입니다.
              </div>
            </div>

            <div className="rounded-2xl border border-white bg-white px-4 py-4 shadow-sm shadow-slate-200/50">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">임박 일정</div>
              <div className="mt-2 text-xl font-semibold text-slate-950">{dueSoonCount}</div>
              <div className="mt-1 text-xs leading-5 text-slate-500">
                3일 이내 마감 예정입니다. 이번 주 처리 가능 여부를 확인하세요.
              </div>
            </div>

            <div className="rounded-2xl border border-white bg-white px-4 py-4 shadow-sm shadow-slate-200/50">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">운영 리스크</div>
              <div className="mt-2 text-xl font-semibold text-slate-950">{operationalRiskCount}</div>
              <div className="mt-1 text-xs leading-5 text-slate-500">
                정체 또는 미할당 이슈입니다. 소유권과 진행 상태 확인이 필요합니다.
              </div>
            </div>
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
            <div className="rounded-2xl border border-white bg-white px-4 py-4 shadow-sm shadow-slate-200/50">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">현재 목록 해석</div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">
                    {searchedIssues.length}건 중 {pageItems.length}건을 현재 페이지에서 보고 있습니다.
                  </div>
                </div>
                <div className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-500">
                  {activePreset?.label ?? '전체'} · {activeSortLabel}
                </div>
              </div>
              <div className="mt-3 text-xs leading-5 text-slate-500">
                검색어와 프리셋 조건을 반영한 목록입니다. 행을 선택하면 상세 드로어에서 설명, 첨부파일, 이력, 관련 이슈를 확인할 수 있습니다.
              </div>
            </div>

            <div className="rounded-2xl border border-white bg-white px-4 py-4 shadow-sm shadow-slate-200/50">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">최우선 확인 이슈</div>
              {topRiskIssue && topRiskReason ? (
                <>
                  <button
                    type="button"
                    onClick={() => onSelectIssue(topRiskIssue.id)}
                    className="mt-2 block w-full text-left"
                  >
                    <div className="truncate text-sm font-semibold text-slate-950">#{topRiskIssue.id} {topRiskIssue.subject}</div>
                    <div className="mt-1 text-xs leading-5 text-slate-500">{topRiskReason.detail}</div>
                  </button>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <Badge tone={topRiskReason.tone}>{topRiskReason.label}</Badge>
                    {topRiskIssue.assigned_to ? <Badge tone="neutral">{topRiskIssue.assigned_to}</Badge> : <Badge tone="warning">미할당</Badge>}
                  </div>
                </>
              ) : (
                <div className="mt-2 text-sm leading-6 text-slate-500">현재 조건에 해당하는 이슈가 없습니다.</div>
              )}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
            <span className="rounded-full bg-white px-2.5 py-1 shadow-sm shadow-slate-200/50">고우선 {highPriorityCount}</span>
            <span className="rounded-full bg-white px-2.5 py-1 shadow-sm shadow-slate-200/50">최근 완료 {recentlyClosedCount}</span>
            <span className="rounded-full bg-white px-2.5 py-1 shadow-sm shadow-slate-200/50">정체 {staleCount}</span>
            <span className="rounded-full bg-white px-2.5 py-1 shadow-sm shadow-slate-200/50">미할당 {unassignedCount}</span>
          </div>
        </div>

        <div className="grid content-start gap-3 sm:grid-cols-3 lg:grid-cols-1">
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">현재 큐</div>
            <div className="mt-2 text-base font-semibold text-slate-950">{activePreset?.label ?? '전체'}</div>
            <div className="mt-1 text-sm text-slate-500">{searchedIssues.length}건 기준으로 보고 있습니다.</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">정렬 기준</div>
            <div className="mt-2 text-base font-semibold text-slate-950">{activeSortLabel}</div>
            <div className="mt-1 text-sm text-slate-500">{sortDir === 'desc' ? '중요한 순서' : '오름차순'}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">필터 상태</div>
            <div className="mt-2 text-base font-semibold text-slate-950">{hasActiveFilter ? '적용 중' : '없음'}</div>
            <div className="mt-1 text-sm text-slate-500">
              {hasActiveFilter ? '아래 필터 칩에서 바로 해제할 수 있습니다.' : '전체 흐름 기준으로 우선 이슈를 보고 있습니다.'}
            </div>
          </div>
        </div>
      </div>

      <FilterChips filter={filter} onClear={onClearFilter} onClearAll={onClearAll} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full sm:w-auto">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <circle cx="11" cy="11" r="8" strokeWidth="2" />
            <path strokeLinecap="round" strokeWidth="2" d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(event) => handleSearchChange(event.target.value)}
            placeholder="이슈명, 담당자, 등록자, 번호로 검색"
            className="w-full max-w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-slate-200 sm:w-80"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <span>
            {searchedIssues.length}건
            {search.trim() ? ` · "${search.trim()}" 검색 결과` : ''}
            {!search.trim() && hasActiveFilter ? ' · 필터 적용 중' : ''}
          </span>
          <label className="inline-flex items-center gap-1 text-slate-500">
            <span>페이지당</span>
            <select
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value) as (typeof PAGE_SIZE_OPTIONS)[number])
                setPage(1)
              }}
              className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none focus:border-slate-300"
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-sm text-slate-400">이슈를 불러오는 중입니다.</div>
      ) : (
        <>
          <div className="grid gap-3 lg:hidden">
            {pageItems.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-12 text-center text-sm text-slate-500">
                {search.trim()
                  ? '검색 조건에 맞는 이슈가 없습니다. 검색 범위를 줄이거나 번호로 다시 찾아보세요.'
                  : '현재 필터에 맞는 이슈가 없습니다. 필터를 조정하면 전체 흐름으로 다시 확인할 수 있습니다.'}
              </div>
            ) : (
              pageItems.map((issue) => {
                const signals = getIssueSignals(issue, settings)
                const due = formatDue(issue, settings)
                const primaryReason = getPrimaryReason(issue, settings)

                return (
                  <button
                    key={issue.id}
                    type="button"
                    onClick={() => onSelectIssue(issue.id)}
                    className={[
                      'rounded-2xl border px-4 py-4 text-left transition-colors',
                      selectedIssueId === issue.id
                        ? 'border-slate-300 bg-slate-50'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70',
                    ].join(' ')}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[11px] font-semibold text-slate-400">#{issue.id}</div>
                        <div className="mt-1 text-sm font-semibold leading-6 text-slate-950">{issue.subject}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {issue.tracker ?? '이슈'}
                          {issue.author ? ` · ${issue.author}` : ''}
                        </div>
                      </div>
                      <Badge tone={primaryReason.tone} size="md">{primaryReason.label}</Badge>
                    </div>

                    <p className="mt-3 text-sm leading-6 text-slate-600">{primaryReason.detail}</p>

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <Badge tone={getStatusTone(issue.status_group)} size="md">{issue.status}</Badge>
                      {issue.priority ? <Badge tone={getPriorityTone(issue.priority)}>{getPriorityLabel(issue.priority)}</Badge> : null}
                      <Badge tone={due.tone}>{due.label}</Badge>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">담당자</div>
                        <div className="mt-1 text-sm font-medium text-slate-900">{issue.assigned_to ?? '미할당'}</div>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">최근 업데이트</div>
                        <div className="mt-1 text-sm font-medium text-slate-900">{formatUpdated(issue.days_since_update, issue.updated_on)}</div>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">진행률</div>
                        <div className="mt-1 text-sm font-medium text-slate-900">{issue.done_ratio}%</div>
                      </div>
                    </div>

                    {signals.length > 1 ? (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {signals
                          .filter((signal) => signal.label !== primaryReason.label)
                          .slice(0, 3)
                          .map((signal) => (
                            <Badge key={`${issue.id}-${signal.label}`} tone={signal.tone}>{signal.label}</Badge>
                          ))}
                      </div>
                    ) : null}
                  </button>
                )
              })
            )}
          </div>

          <div className="hidden lg:block">
            <IssueListTable
              issues={pageItems}
              settings={settings}
              selectedIssueId={selectedIssueId}
              onSelectIssue={onSelectIssue}
              sortKey={sortKey}
              sortDir={sortDir}
              onToggleSort={toggleSort}
              emptyMessage={search.trim()
                ? '검색 조건에 맞는 이슈가 없습니다. 검색 범위를 줄이거나 담당자·번호 기준으로 다시 찾아보세요.'
                : '현재 필터에 맞는 이슈가 없습니다. 필터를 조정하면 전체 흐름으로 다시 확인할 수 있습니다.'}
            />
          </div>

          {totalPages > 1 ? (
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs text-slate-500">
                {(safePage - 1) * pageSize + 1}-{Math.min(safePage * pageSize, sortedIssues.length)} / {sortedIssues.length}
              </div>
              <div className="flex flex-wrap items-center justify-end gap-1">
                <button
                  type="button"
                  disabled={safePage === 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 disabled:opacity-30"
                >
                  이전
                </button>
                <label className="inline-flex items-center gap-1 px-2 text-xs text-slate-500">
                  <span>페이지</span>
                  <input
                    type="number"
                    min={1}
                    max={totalPages}
                    value={safePage}
                    onChange={(event) => {
                      const next = Number(event.target.value)
                      if (!Number.isFinite(next)) return
                      setPage(Math.min(totalPages, Math.max(1, next)))
                    }}
                    className="w-14 rounded-md border border-slate-200 px-2 py-1 text-right text-xs text-slate-700 outline-none focus:border-slate-300"
                  />
                  <span>/ {totalPages}</span>
                </label>
                <button
                  type="button"
                  disabled={safePage === totalPages}
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 disabled:opacity-30"
                >
                  다음
                </button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </SectionCard>
  )
}