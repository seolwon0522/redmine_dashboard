import Link from 'next/link'

import type { ReactNode } from 'react'

interface Props {
  label: string
  value: string | number
  note?: string
  deltaLabel?: string
  tone?: 'neutral' | 'info' | 'warning' | 'danger' | 'success'
  accent?: ReactNode
  href?: string
  className?: string
}

const DELTA_CLASS = {
  neutral: 'text-slate-500',
  info: 'text-blue-700',
  warning: 'text-amber-700',
  danger: 'text-rose-700',
  success: 'text-emerald-700',
} as const

function Inner({ label, value, note, deltaLabel, tone = 'neutral', accent }: Omit<Props, 'href' | 'className'>) {
  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</div>
        {accent ? <div className="shrink-0">{accent}</div> : null}
      </div>
      <div className="mt-2 text-[30px] font-semibold leading-none tracking-tight text-slate-950">{value}</div>
      {deltaLabel ? <div className={['mt-1.5 text-[12px] font-semibold', DELTA_CLASS[tone]].join(' ')}>{deltaLabel}</div> : null}
      {note ? <p className="mt-1 text-[11px] leading-4 text-slate-500">{note}</p> : null}
    </>
  )
}

export default function MetricTile({
  label,
  value,
  note,
  deltaLabel,
  tone = 'neutral',
  accent,
  href,
  className = '',
}: Props) {
  const containerClassName = [
    'block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/35 transition-colors',
    href ? 'hover:border-slate-300 hover:bg-slate-50/30' : '',
    className,
  ].join(' ')

  if (href) {
    return (
      <Link href={href} className={containerClassName}>
        <Inner label={label} value={value} note={note} deltaLabel={deltaLabel} tone={tone} accent={accent} />
      </Link>
    )
  }

  return (
    <div className={containerClassName}>
      <Inner label={label} value={value} note={note} deltaLabel={deltaLabel} tone={tone} accent={accent} />
    </div>
  )
}
