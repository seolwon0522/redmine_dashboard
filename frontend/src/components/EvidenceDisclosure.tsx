import type { ReactNode } from 'react'

interface Props {
  title: string
  children: ReactNode
  className?: string
  hint?: string
}

export default function EvidenceDisclosure({ title, children, className = '', hint }: Props) {
  return (
    <details className={['group rounded-[16px] border border-slate-200 bg-slate-50/80 px-3.5 py-3 transition-colors open:border-slate-300 open:bg-white', className].join(' ')}>
      <summary className="cursor-pointer list-none rounded-xl outline-none transition-colors group-open:text-slate-950 focus-visible:ring-2 focus-visible:ring-sky-200 focus-visible:ring-offset-2">
        <div className="flex min-h-[36px] items-start justify-between gap-3 text-sm font-semibold text-slate-700">
          <div className="min-w-0">
            <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-slate-500">{title}</div>
            {hint ? <div className="mt-1 line-clamp-1 text-xs font-medium leading-4 text-slate-400">{hint}</div> : null}
          </div>
          <div className="flex shrink-0 items-center">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-transform group-open:rotate-180">
              <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </span>
          </div>
        </div>
      </summary>
      <div className="mt-3 space-y-3">{children}</div>
    </details>
  )
}
