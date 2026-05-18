import Badge from '@/components/Badge'

interface DistributionItem {
  label: string
  count: number
  tone: 'info' | 'warning' | 'danger' | 'success' | 'neutral'
}

interface Props {
  title: string
  description: string
  items: DistributionItem[]
}

const TONE_COLOR = {
  neutral: 'var(--tone-neutral)',
  info: 'var(--tone-info)',
  warning: 'var(--tone-warning)',
  danger: 'var(--tone-danger)',
  success: 'var(--tone-success)',
} as const

export default function StatusDistributionChart({ title, description, items }: Props) {
  const sanitizedItems = items.filter((item) => item.count > 0)
  const total = Math.max(1, sanitizedItems.reduce((sum, item) => sum + item.count, 0))

  let current = 0
  const gradient = sanitizedItems
    .map((item) => {
      const start = (current / total) * 100
      current += item.count
      const end = (current / total) * 100
      return `${TONE_COLOR[item.tone]} ${start}% ${end}%`
    })
    .join(', ')

  return (
    <div
      className={[
        'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/30',
        '[--tone-neutral:theme(colors.slate.400)] [--tone-info:theme(colors.blue.500)] [--tone-warning:theme(colors.amber.500)] [--tone-danger:theme(colors.rose.500)] [--tone-success:theme(colors.emerald.500)] [--tone-empty:theme(colors.slate.200)]',
      ].join(' ')}
    >
      <div>
        <div className="text-sm font-semibold text-slate-950">{title}</div>
        <div className="mt-0.5 text-[12px] leading-5 text-slate-500">{description}</div>
      </div>

      <div className="mt-2.5 grid items-center gap-2.5 sm:grid-cols-[108px_minmax(0,1fr)]">
        <div className="mx-auto flex h-[104px] w-[104px] items-center justify-center rounded-full border border-slate-200 bg-white">
          <div
            className="relative flex h-[84px] w-[84px] items-center justify-center rounded-full"
            style={{ background: gradient ? `conic-gradient(${gradient})` : 'var(--tone-empty)' }}
            role="img"
            aria-label="상태 분포"
          >
            <div className="flex h-[56px] w-[56px] items-center justify-center rounded-full bg-white text-center">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">전체</div>
                <div className="mt-0.5 text-lg font-semibold text-slate-950">{total}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          {sanitizedItems.length > 0 ? sanitizedItems.map((item) => {
            const percent = Math.round((item.count / total) * 100)
            return (
              <div key={item.label} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <div className="flex items-center gap-2 text-sm text-slate-700">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: TONE_COLOR[item.tone] }} />
                  <span>{item.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={item.tone}>{item.count}건</Badge>
                  <span className="w-9 text-right text-xs font-semibold text-slate-500">{percent}%</span>
                </div>
              </div>
            )
          }) : (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-5 text-sm text-slate-500">
              표시할 상태 분포 데이터가 없습니다.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
