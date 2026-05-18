interface Props {
  kind: 'full' | 'window' | 'advisory'
  label: string
}

const CLASS_BY_KIND = {
  full: 'border-slate-200 bg-slate-50 text-slate-700',
  window: 'border-sky-200 bg-sky-50 text-sky-800',
  advisory: 'border-amber-200 bg-amber-50 text-amber-800',
} as const

const DOT_BY_KIND = {
  full: 'bg-slate-400',
  window: 'bg-sky-500',
  advisory: 'bg-amber-500',
} as const

export default function ScopeBadge({ kind, label }: Props) {
  return (
    <span className={[
      'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold whitespace-nowrap',
      CLASS_BY_KIND[kind],
    ].join(' ')}>
      <span className={['h-1.5 w-1.5 rounded-full', DOT_BY_KIND[kind]].join(' ')} />
      {label}
    </span>
  )
}