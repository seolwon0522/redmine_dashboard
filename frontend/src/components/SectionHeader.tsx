import type { ReactNode } from 'react'

interface Props {
  title: string
  description?: string
  eyebrow?: string
  action?: ReactNode
  className?: string
}

export default function SectionHeader({
  title,
  description,
  eyebrow,
  action,
  className = '',
}: Props) {
  return (
    <div className={[
      'flex flex-wrap items-end justify-between gap-3',
      className,
    ].join(' ')}>
      <div className="min-w-0">
        {eyebrow ? <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{eyebrow}</div> : null}
        <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">{title}</h2>
        {description ? <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p> : null}
      </div>
      {action ? <div className="w-full sm:w-auto">{action}</div> : null}
    </div>
  )
}
