import type { ReactNode } from 'react'

interface Props {
  title: string
  subtitle?: string
  aside?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
  density?: 'primary' | 'secondary' | 'compact'
}

const CONTAINER_CLASS = {
  primary: 'rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-200/40',
  secondary: 'rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-200/30',
  compact: 'rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-200/25',
} as const

const HEADER_CLASS = {
  primary: 'flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4',
  secondary: 'flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-3.5',
  compact: 'flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3',
} as const

const TITLE_CLASS = {
  primary: 'text-base font-semibold tracking-tight text-slate-950',
  secondary: 'text-sm font-semibold tracking-tight text-slate-950',
  compact: 'text-sm font-semibold tracking-tight text-slate-950',
} as const

const SUBTITLE_CLASS = {
  primary: 'mt-1.5 max-w-3xl text-sm leading-6 text-slate-600',
  secondary: 'mt-1 max-w-3xl text-sm leading-6 text-slate-600',
  compact: 'mt-1 max-w-2xl text-xs leading-5 text-slate-500',
} as const

const BODY_CLASS = {
  primary: 'px-5 py-5',
  secondary: 'px-5 py-4',
  compact: 'px-4 py-4',
} as const

export default function SectionCard({
  title,
  subtitle,
  aside,
  children,
  className = '',
  bodyClassName = '',
  density = 'primary',
}: Props) {
  return (
    <section className={[
      CONTAINER_CLASS[density],
      className,
    ].join(' ')}>
      <div className={[HEADER_CLASS[density], 'flex-col sm:flex-row'].join(' ')}>
        <div className="min-w-0 flex-1">
          <h2 className={TITLE_CLASS[density]}>{title}</h2>
          {subtitle ? <p className={SUBTITLE_CLASS[density]}>{subtitle}</p> : null}
        </div>
        {aside ? <div className="w-full sm:w-auto sm:shrink-0">{aside}</div> : null}
      </div>
      <div className={[BODY_CLASS[density], bodyClassName].join(' ')}>{children}</div>
    </section>
  )
}
