interface WorkloadItem {
  label: string
  open: number
  overdue: number
  stale: number
}

interface Props {
  title: string
  description: string
  items: WorkloadItem[]
}

export default function GroupedWorkloadChart({ title, description, items }: Props) {
  const visibleItems = items.slice(0, 6)
  const maxValue = Math.max(1, ...visibleItems.flatMap((item) => [item.open, item.overdue, item.stale]))

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/30">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-950">{title}</div>
          <div className="mt-0.5 text-xs leading-4 text-slate-500">{description}</div>
        </div>
        <div className="space-y-1 text-xs text-slate-500">
          <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-slate-900" />활성</div>
          <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-rose-500" />지연</div>
          <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-500" />정체</div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        {visibleItems.map((item) => (
          <div key={item.label} className="rounded-xl border border-slate-100 bg-slate-50 px-2 py-2">
            <div className="truncate text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">{item.label}</div>
            <div className="mt-2 flex h-16 items-end justify-center gap-1">
              {[
                { value: item.open, color: 'bg-slate-900' },
                { value: item.overdue, color: 'bg-rose-500' },
                { value: item.stale, color: 'bg-amber-500' },
              ].map((bar, index) => {
                const height = `${Math.max(6, Math.round((bar.value / maxValue) * 100))}%`
                return <div key={`${item.label}-${index}`} className={`w-2 rounded-t-lg ${bar.color}`} style={{ height }} />
              })}
            </div>
            <div className="mt-1.5 grid gap-0.5 text-[9px] text-slate-500">
              <div>활성 {item.open}</div>
              <div>지연 {item.overdue}</div>
              <div>정체 {item.stale}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}