import type { ReactNode } from 'react'

interface OverviewStatCardProps {
  icon?: ReactNode
  label: string
  value: number | string
  description?: string
  variant?: 'default' | 'highlight' | 'danger' | 'success'
}

const variantClass = {
  default: 'border-slate-200 bg-white text-blue-600',
  highlight: 'border-amber-200 bg-white text-amber-600',
  danger: 'border-rose-200 bg-white text-rose-600',
  success: 'border-emerald-200 bg-white text-emerald-600',
} as const

export default function OverviewStatCard({
  icon,
  label,
  value,
  description,
  variant = 'default',
}: OverviewStatCardProps) {
  return (
    <div className={`rounded-xl border p-4 shadow-sm shadow-slate-200/60 ${variantClass[variant]}`}>
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-current/10">
          {icon ?? <span className="h-2.5 w-2.5 rounded-full bg-current" />}
        </div>
        <div className="min-w-0">
          <div className="text-xs font-semibold text-slate-500">{label}</div>
          <div className="mt-1 text-2xl font-bold leading-none text-slate-950">{value}</div>
          {description ? <div className="mt-1 truncate text-xs text-slate-500">{description}</div> : null}
        </div>
      </div>
    </div>
  )
}
