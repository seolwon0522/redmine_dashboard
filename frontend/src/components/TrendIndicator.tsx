import type { MetricTrendModel } from '@/types/dashboard-derived'

interface Props {
  trend: MetricTrendModel
}

const TONE_CLASS = {
  neutral: 'bg-slate-100 text-slate-600',
  info: 'bg-sky-50 text-sky-700',
  warning: 'bg-amber-50 text-amber-700',
  danger: 'bg-rose-50 text-rose-700',
  success: 'bg-emerald-50 text-emerald-700',
} as const

export default function TrendIndicator({ trend }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className={['inline-flex items-center rounded-full px-2.5 py-1 font-semibold', TONE_CLASS[trend.tone]].join(' ')}>
        {trend.deltaLabel}
      </span>
      <span className="text-slate-500">{trend.comparisonLabel}</span>
    </div>
  )
}