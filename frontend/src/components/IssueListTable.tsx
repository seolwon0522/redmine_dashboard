import Badge from '@/components/Badge'
import { PRIORITY_ORDER, STATUS_GROUP_LABEL, getPriorityLabel } from '@/lib/labels'
import { getIssueSignals, type DashboardThresholdSettings } from '@/lib/dashboard'
import {
  formatDue,
  formatUpdated,
  getAttentionScore,
  getOperationalQueueScore,
  getPrimaryReason,
  getPriorityTone,
  getStatusTone,
  type IssueSortDir,
  type IssueSortKey,
} from '@/lib/dashboard/presentation'
import type { IssueListItem } from '@/types/dashboard'

interface Props {
  issues: IssueListItem[]
  settings: DashboardThresholdSettings
  selectedIssueId?: number | null
  onSelectIssue: (issueId: number) => void
  sortKey?: IssueSortKey
  sortDir?: IssueSortDir
  onToggleSort?: (key: IssueSortKey) => void
  emptyMessage: string
  compact?: boolean
}

function SortLabel({
  label,
  active,
  dir,
}: {
  label: string
  active: boolean
  dir: IssueSortDir
}) {
  return (
    <span className="inline-flex items-center gap-1">
      <span>{label}</span>
      {active ? <span className="text-slate-700">{dir === 'asc' ? '↑' : '↓'}</span> : null}
    </span>
  )
}

export function sortIssues(
  issues: IssueListItem[],
  settings: DashboardThresholdSettings,
  sortKey: IssueSortKey,
  sortDir: IssueSortDir,
) {
  return [...issues].sort((left, right) => {
    let comparison = 0

    switch (sortKey) {
      case 'attention':
        comparison = getOperationalQueueScore(left, settings) - getOperationalQueueScore(right, settings)
        break
      case 'id':
        comparison = left.id - right.id
        break
      case 'subject':
        comparison = left.subject.localeCompare(right.subject)
        break
      case 'assignee':
        comparison = (left.assigned_to ?? 'zzzz').localeCompare(right.assigned_to ?? 'zzzz')
        break
      case 'priority':
        comparison = (PRIORITY_ORDER[left.priority ?? ''] ?? 0) - (PRIORITY_ORDER[right.priority ?? ''] ?? 0)
        break
      case 'due':
        comparison = (left.days_until_due ?? 999) - (right.days_until_due ?? 999)
        if (left.is_overdue || right.is_overdue) {
          comparison = right.days_overdue - left.days_overdue
        }
        break
      case 'updated':
        comparison = (left.days_since_update ?? 999) - (right.days_since_update ?? 999)
        break
      case 'progress':
        comparison = left.done_ratio - right.done_ratio
        break
    }

    return sortDir === 'asc' ? comparison : -comparison
  })
}

export default function IssueListTable({
  issues,
  settings,
  selectedIssueId = null,
  onSelectIssue,
  sortKey,
  sortDir = 'desc',
  onToggleSort,
  emptyMessage,
  compact = false,
}: Props) {
  const headerClassName = compact ? 'px-3 py-3' : 'px-4 py-3'
  const cellClassName = compact ? 'px-3 py-3' : 'px-4 py-3'

  const renderHeader = (label: string, key: IssueSortKey, align: 'left' | 'right' = 'left') => {
    const className = [headerClassName, align === 'right' ? 'text-right' : 'text-left', onToggleSort ? 'cursor-pointer' : ''].join(' ')
    const content = onToggleSort && sortKey
      ? <SortLabel label={label} active={sortKey === key} dir={sortDir} />
      : label

    return (
      <th className={className} onClick={onToggleSort ? () => onToggleSort(key) : undefined}>
        {content}
      </th>
    )
  }

  return (
    <div className="overflow-x-auto rounded-[24px] border border-slate-200 bg-white shadow-sm shadow-slate-200/10">
      <table className="min-w-[960px] w-full text-sm">
        <thead className="sticky top-0 z-[1] bg-slate-50 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          <tr>
            {renderHeader('이슈', 'subject')}
            {renderHeader('우선 사유', 'attention')}
            {renderHeader('상태 / 우선순위', 'priority')}
            {renderHeader('담당자', 'assignee')}
            {renderHeader('마감', 'due')}
            {renderHeader('업데이트', 'updated')}
            {renderHeader('진행률', 'progress', 'right')}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {issues.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-4 py-16 text-center text-sm text-slate-400">{emptyMessage}</td>
            </tr>
          ) : (
            issues.map((issue) => {
              const signals = getIssueSignals(issue, settings)
              const visibleSignals = signals.slice(0, compact ? 1 : 2)
              const hiddenSignalCount = Math.max(0, signals.length - visibleSignals.length)
              const due = formatDue(issue, settings)
              const primaryReason = getPrimaryReason(issue, settings)

              return (
                <tr
                  key={issue.id}
                  onClick={() => onSelectIssue(issue.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      onSelectIssue(issue.id)
                    }
                  }}
                  tabIndex={0}
                  className={[
                    'cursor-pointer align-top border-l-2 border-transparent transition-colors hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none',
                    selectedIssueId === issue.id ? 'border-l-sky-500 bg-slate-50' : '',
                  ].join(' ')}
                >
                  <td className={cellClassName}>
                    <div className="text-[11px] font-semibold text-slate-400">#{issue.id}</div>
                    <div className="mt-1 line-clamp-2 text-sm font-medium text-slate-900">{issue.subject}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {issue.tracker ?? '이슈'}
                      {issue.author ? ` · ${issue.author}` : ''}
                    </div>
                  </td>
                  <td className={cellClassName}>
                    <Badge tone={primaryReason.tone} size="md">{primaryReason.label}</Badge>
                    <div className="mt-2 max-w-[240px] text-xs leading-5 text-slate-500">{primaryReason.detail}</div>
                    <div className="mt-2 flex max-w-[240px] flex-wrap gap-1.5">
                      {visibleSignals
                        .filter((signal) => signal.label !== primaryReason.label)
                        .map((signal) => (
                          <Badge key={`${issue.id}-${signal.label}`} tone={signal.tone}>{signal.label}</Badge>
                        ))}
                      {hiddenSignalCount > 0 ? <span className="text-xs text-slate-400">+{hiddenSignalCount}</span> : null}
                    </div>
                  </td>
                  <td className={cellClassName}>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge tone={getStatusTone(issue.status_group)} size="md">{issue.status}</Badge>
                      {issue.priority ? <Badge tone={getPriorityTone(issue.priority)}>{getPriorityLabel(issue.priority)}</Badge> : null}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">{STATUS_GROUP_LABEL[issue.status_group] ?? issue.status_group}</div>
                  </td>
                  <td className={cellClassName}>
                    <div className="text-sm text-slate-700">{issue.assigned_to ?? '미할당'}</div>
                  </td>
                  <td className={cellClassName}>
                    <Badge tone={due.tone} size="md">{due.label}</Badge>
                    {issue.due_date ? <div className="mt-1 text-xs text-slate-500">{issue.due_date}</div> : null}
                  </td>
                  <td className={cellClassName}>
                    <div className="text-sm text-slate-700">{formatUpdated(issue.days_since_update, issue.updated_on)}</div>
                    <div className="mt-1 text-xs text-slate-500">{issue.updated_on ?? '날짜 없음'}</div>
                  </td>
                  <td className={[cellClassName, 'text-right'].join(' ')}>
                    <div className="text-sm font-semibold text-slate-800">{issue.done_ratio}%</div>
                    <div className="mt-2 h-1.5 rounded-full bg-slate-100">
                      <div className="h-1.5 rounded-full bg-slate-700 transition-all" style={{ width: `${issue.done_ratio}%` }} />
                    </div>
                    <div className="mt-2 text-[11px] text-slate-400">주의 점수 {getAttentionScore(issue, settings)}</div>
                  </td>
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}
