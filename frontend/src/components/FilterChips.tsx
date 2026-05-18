import { ISSUE_PRESET_LABEL, STATUS_GROUP_LABEL } from '@/lib/labels'
import type { DashboardFilter } from '@/types/dashboard'

interface Props {
  filter: DashboardFilter
  onClear: (key: keyof DashboardFilter) => void
  onClearAll: () => void
}

export default function FilterChips({ filter, onClear, onClearAll }: Props) {
  const hasAny = filter.statusGroup !== null || filter.assignee !== null || filter.preset !== null
  if (!hasAny) return null

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">적용 필터</span>

      {filter.statusGroup ? (
        <Chip
          label={`상태 ${STATUS_GROUP_LABEL[filter.statusGroup] ?? filter.statusGroup}`}
          onRemove={() => onClear('statusGroup')}
        />
      ) : null}

      {filter.assignee ? (
        <Chip
          label={`담당자 ${filter.assignee.name}`}
          onRemove={() => onClear('assignee')}
        />
      ) : null}

      {filter.preset ? (
        <Chip
          label={ISSUE_PRESET_LABEL[filter.preset] ?? filter.preset}
          onRemove={() => onClear('preset')}
          color="red"
        />
      ) : null}

      <button
        type="button"
        onClick={onClearAll}
        className="ml-1 shrink-0 rounded-full px-2.5 py-1 text-xs font-medium text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
      >
        전체 해제
      </button>
    </div>
  )
}

function Chip({
  label,
  onRemove,
  color = 'blue',
}: {
  label: string
  onRemove: () => void
  color?: 'blue' | 'red'
}) {
  const className = color === 'red'
    ? 'border-rose-200 bg-rose-50 text-rose-700'
    : 'border-slate-200 bg-slate-50 text-slate-700'

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${className}`}>
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="ml-0.5 leading-none text-current transition-opacity hover:opacity-70 focus:outline-none"
        aria-label={`${label} 필터 해제`}
      >
        ×
      </button>
    </span>
  )
}
