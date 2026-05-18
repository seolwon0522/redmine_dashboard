interface Props {
  content: string
}

export default function InfoTooltip({ content }: Props) {
  return (
    <span className="group relative inline-flex">
      <span
        tabIndex={0} 
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 bg-white text-[11px] font-semibold text-slate-500 outline-none transition-colors group-hover:border-slate-300 group-hover:text-slate-700 focus:border-slate-300 focus:text-slate-700"
        aria-label={content}
      >
        i
      </span>
      <span className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-10 hidden w-56 -translate-x-1/2 rounded-2xl border border-slate-200 bg-slate-950 px-3 py-2 text-xs font-medium leading-5 text-white shadow-[0_18px_36px_-20px_rgba(15,23,42,0.8)] group-hover:block group-focus-within:block">
        {content}
      </span>
    </span>
  )
}