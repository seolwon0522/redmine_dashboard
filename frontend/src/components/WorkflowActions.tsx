import Link from 'next/link'

interface WorkflowActionItem {
  label: string
  href: string
  priority?: 'primary' | 'secondary'
  step: string
}

interface Props {
  items: WorkflowActionItem[]
  className?: string
  heading?: string
}

export default function WorkflowActions({ items, className = '', heading = '다음 단계' }: Props) {
  return (
    <div className={['space-y-2', className].join(' ')}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">{heading}</div>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <Link
            key={`${item.step}-${item.label}`}
            href={item.href}
            className={[
              'inline-flex min-h-[40px] items-center gap-2 rounded-full px-3.5 py-2 text-sm font-semibold leading-5 transition-colors',
              item.priority === 'secondary'
                ? 'border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:text-slate-950'
                : 'bg-slate-950 text-white hover:bg-slate-800',
            ].join(' ')}
          >
            <span className={[
              'inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px]',
              item.priority === 'secondary' ? 'bg-slate-100 text-slate-600' : 'bg-white/20 text-white',
            ].join(' ')}>
              {item.step}
            </span>
            <span>{item.label}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
