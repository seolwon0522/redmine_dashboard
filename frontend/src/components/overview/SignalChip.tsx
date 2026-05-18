interface SignalChipProps {
  label: string
  value: number
  variant?: 'default' | 'warning' | 'danger'
  hideValue?: boolean
}

export default function SignalChip({ label, value, variant = 'default', hideValue = false }: SignalChipProps) {
  const variantClasses = {
    default: 'bg-slate-100 text-slate-700',
    warning: 'bg-orange-100 text-orange-700',
    danger: 'bg-rose-100 text-rose-700',
  }

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${variantClasses[variant]}`}>
      <span>{label}</span>
      {!hideValue ? <span className="font-bold">{value}</span> : null}
    </span>
  )
}
