'use client'

import { useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import IssueExplorer from '@/components/IssueExplorer'
import IssueDetailDrawer from '@/components/IssueDetailDrawer'
import type { DashboardThresholdSettings, ExplorerPresetModel } from '@/lib/dashboard'
import type { DashboardFilter, IssueListItem, IssuePreset } from '@/types/dashboard'

type IssueSplitViewProps = {
  projectId?: string
  issues: IssueListItem[]
  settings: DashboardThresholdSettings
  loading?: boolean
  model?: unknown
}

const DEFAULT_FILTER: DashboardFilter = {
  statusGroup: null,
  assignee: null,
  preset: null,
}

const ISSUE_PRESETS = {
  overdue: 'overdue',
  dueSoon: 'due-soon',
  unassigned: 'unassigned',
  stale: 'stale',
  highPriority: 'high-priority',
  recentlyClosed: 'recently-closed',
} as const

type LocalIssuePreset = (typeof ISSUE_PRESETS)[keyof typeof ISSUE_PRESETS]

type IssueForPreset = IssueListItem & {
  dueDate?: string | null
  daysUntilDue?: number | null
  daysSinceUpdate?: number | null
  updatedOn?: string | null
  assignedTo?: string | null
  statusGroup?: string | null
}

function toLocalPreset(preset: IssuePreset | null): LocalIssuePreset | null {
  if (!preset) return null

  const value = String(preset)

  if (Object.values(ISSUE_PRESETS).includes(value as LocalIssuePreset)) {
    return value as LocalIssuePreset
  }

  return null
}

function normalizeText(value: unknown) {
  return String(value ?? '').trim().toLowerCase()
}

function getStatusGroup(issue: IssueForPreset) {
  return normalizeText(issue.status_group ?? issue.statusGroup)
}

function getStatus(issue: IssueForPreset) {
  return normalizeText(issue.status)
}

function isClosedIssue(issue: IssueForPreset) {
  const statusGroup = getStatusGroup(issue)
  const status = getStatus(issue)

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

function getAssignee(issue: IssueForPreset) {
  return issue.assigned_to ?? issue.assignedTo ?? null
}

function getPriority(issue: IssueForPreset) {
  return normalizeText(issue.priority)
}

function isHighPriorityIssue(issue: IssueForPreset) {
  const priority = getPriority(issue)

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

function getDaysUntilDue(issue: IssueForPreset) {
  const explicit = issue.days_until_due ?? issue.daysUntilDue
  if (typeof explicit === 'number' && Number.isFinite(explicit)) return explicit

  const dueDate = parseDate(issue.due_date ?? issue.dueDate)
  if (!dueDate) return null

  return diffDaysFromToday(dueDate)
}

function getDaysSinceUpdate(issue: IssueForPreset) {
  const explicit = issue.days_since_update ?? issue.daysSinceUpdate
  if (typeof explicit === 'number' && Number.isFinite(explicit)) return explicit

  const updatedDate = parseDate(issue.updated_on ?? issue.updatedOn)
  if (!updatedDate) return null

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  updatedDate.setHours(0, 0, 0, 0)

  return Math.floor((today.getTime() - updatedDate.getTime()) / 86_400_000)
}

function isOverdueIssue(issue: IssueForPreset) {
  if (isClosedIssue(issue)) return false

  const daysUntilDue = getDaysUntilDue(issue)
  return daysUntilDue !== null && daysUntilDue < 0
}

function isDueSoonIssue(issue: IssueForPreset) {
  if (isClosedIssue(issue)) return false

  const daysUntilDue = getDaysUntilDue(issue)
  return daysUntilDue !== null && daysUntilDue >= 0 && daysUntilDue <= 3
}

function isUnassignedIssue(issue: IssueForPreset) {
  return !getAssignee(issue)
}

function isStaleIssue(issue: IssueForPreset) {
  if (isClosedIssue(issue)) return false

  const daysSinceUpdate = getDaysSinceUpdate(issue)
  return daysSinceUpdate !== null && daysSinceUpdate >= 7
}

function isRecentlyClosedIssue(issue: IssueForPreset) {
  if (!isClosedIssue(issue)) return false

  const daysSinceUpdate = getDaysSinceUpdate(issue)
  return daysSinceUpdate !== null && daysSinceUpdate <= 14
}

function isIssueMatchedByPreset(issue: IssueListItem, preset: LocalIssuePreset | null) {
  const target = issue as IssueForPreset

  if (!preset) return true

  switch (preset) {
    case ISSUE_PRESETS.overdue:
      return isOverdueIssue(target)

    case ISSUE_PRESETS.dueSoon:
      return isDueSoonIssue(target)

    case ISSUE_PRESETS.unassigned:
      return isUnassignedIssue(target)

    case ISSUE_PRESETS.stale:
      return isStaleIssue(target)

    case ISSUE_PRESETS.highPriority:
      return isHighPriorityIssue(target)

    case ISSUE_PRESETS.recentlyClosed:
      return isRecentlyClosedIssue(target)

    default:
      return true
  }
}

function createPreset(
  id: LocalIssuePreset | null,
  label: string,
  count: number,
): ExplorerPresetModel {
  return {
    id: id as IssuePreset | null,
    label,
    count,
  }
}

function getInitialIssueId(searchParams: ReturnType<typeof useSearchParams>) {
  const issueIdParam = searchParams.get('issueId')
  if (!issueIdParam) return null

  const issueId = Number(issueIdParam)
  if (!Number.isFinite(issueId)) return null

  return issueId
}

export function IssueSplitView({
  issues,
  settings,
  loading = false,
}: IssueSplitViewProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const initialSearch = searchParams.get('q') ?? ''

  const [selectedIssueId, setSelectedIssueId] = useState<number | null>(() => getInitialIssueId(searchParams))
  const [filter, setFilter] = useState<DashboardFilter>(DEFAULT_FILTER)

  const activePreset = useMemo(() => toLocalPreset(filter.preset), [filter.preset])

  const presets = useMemo<ExplorerPresetModel[]>(() => {
    return [
      createPreset(null, '전체', issues.length),
      createPreset(
        ISSUE_PRESETS.overdue,
        '기한 초과',
        issues.filter((issue) => isIssueMatchedByPreset(issue, ISSUE_PRESETS.overdue)).length,
      ),
      createPreset(
        ISSUE_PRESETS.dueSoon,
        '임박 일정',
        issues.filter((issue) => isIssueMatchedByPreset(issue, ISSUE_PRESETS.dueSoon)).length,
      ),
      createPreset(
        ISSUE_PRESETS.unassigned,
        '미할당',
        issues.filter((issue) => isIssueMatchedByPreset(issue, ISSUE_PRESETS.unassigned)).length,
      ),
      createPreset(
        ISSUE_PRESETS.stale,
        '정체',
        issues.filter((issue) => isIssueMatchedByPreset(issue, ISSUE_PRESETS.stale)).length,
      ),
      createPreset(
        ISSUE_PRESETS.highPriority,
        '고우선',
        issues.filter((issue) => isIssueMatchedByPreset(issue, ISSUE_PRESETS.highPriority)).length,
      ),
      createPreset(
        ISSUE_PRESETS.recentlyClosed,
        '최근 완료',
        issues.filter((issue) => isIssueMatchedByPreset(issue, ISSUE_PRESETS.recentlyClosed)).length,
      ),
    ]
  }, [issues])

  const filteredIssues = useMemo(() => {
    return issues.filter((issue) => isIssueMatchedByPreset(issue, activePreset))
  }, [issues, activePreset])

  function replaceIssueIdInUrl(issueId: number | null) {
    const nextParams = new URLSearchParams(searchParams.toString())

    if (issueId) {
      nextParams.set('issueId', String(issueId))
    } else {
      nextParams.delete('issueId')
    }

    const nextQuery = nextParams.toString()
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false })
  }

  function handleSelectIssue(issueId: number) {
    setSelectedIssueId(issueId)
    replaceIssueIdInUrl(issueId)
  }

  function handleCloseDetail() {
    setSelectedIssueId(null)
    replaceIssueIdInUrl(null)
  }

  function handleSelectPreset(preset: IssuePreset | null) {
    const nextPreset = toLocalPreset(preset)

    setFilter((current) => ({
      ...current,
      preset,
    }))

    if (selectedIssueId) {
      const selectedIssueVisible = issues.some(
        (issue) => issue.id === selectedIssueId && isIssueMatchedByPreset(issue, nextPreset),
      )

      if (!selectedIssueVisible) {
        setSelectedIssueId(null)
        replaceIssueIdInUrl(null)
      }
    }
  }

  function handleClearFilter(key: keyof DashboardFilter) {
    setFilter((current) => ({
      ...current,
      [key]: null,
    }))
  }

  function handleClearAll() {
    setFilter(DEFAULT_FILTER)
  }

  return (
    <>
      <IssueExplorer
        issues={filteredIssues}
        settings={settings}
        loading={loading}
        selectedIssueId={selectedIssueId}
        initialSearch={initialSearch}
        filter={filter}
        presets={presets}
        onSelectIssue={handleSelectIssue}
        onSelectPreset={handleSelectPreset}
        onClearFilter={handleClearFilter}
        onClearAll={handleClearAll}
      />

      <IssueDetailDrawer
        issueId={selectedIssueId}
        settings={settings}
        onClose={handleCloseDetail}
        onSelectIssue={handleSelectIssue}
      />
    </>
  )
}

export default IssueSplitView