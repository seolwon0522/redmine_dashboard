import Link from 'next/link'
import Badge from '@/components/Badge'
import SignalChip from '@/components/overview/SignalChip'
import type { ProjectItem } from '@/types/dashboard'

interface PriorityProjectSectionProps {
  projects: ProjectItem[]
}

function getRiskTone(level: ProjectItem['risk_level']) {
  if (level === 'critical') return 'danger' as const
  if (level === 'warning') return 'warning' as const
  return 'success' as const
}

function getRiskLabel(level: ProjectItem['risk_level']) {
  if (level === 'critical') return '위험'
  if (level === 'warning') return '주의'
  return '안정'
}

export default function PriorityProjectSection({ projects }: PriorityProjectSectionProps) {
  const topProject = projects[0]

  if (!topProject) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white px-5 py-8 text-center">
        <p className="text-sm text-slate-600">표시할 프로젝트가 없습니다.</p>
      </div>
    )
  }

  const linePoints = [0, 16, 12, 28, 20, 18, 30, 27, 34, 52]
    .map((value, index) => `${index * 22},${58 - value}`)
    .join(' ')

  return (
    <section className="rounded-xl border border-rose-200 bg-gradient-to-br from-rose-50 via-white to-rose-50 px-5 py-5 shadow-sm shadow-rose-100/60">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-end">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={getRiskTone(topProject.risk_level)} size="md">{getRiskLabel(topProject.risk_level)}</Badge>
            <span className="text-sm font-semibold text-slate-500">최우선 확인 프로젝트</span>
          </div>
          <h2 className="mt-4 text-2xl font-bold tracking-tight text-slate-950">{topProject.name}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{topProject.primary_reason}</p>

          <div className="mt-4 flex flex-wrap gap-2">
            <SignalChip label={`지연 ${topProject.overdue_issues}`} value={0} variant="danger" hideValue />
            <SignalChip label={`정체 ${topProject.stale_issues}`} value={0} variant="warning" hideValue />
            <SignalChip label={`미할당 ${topProject.unassigned_issues}`} value={0} hideValue />
            <SignalChip label={`고우선 ${topProject.high_priority_issues}`} value={0} hideValue />
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-4 text-sm text-slate-500">
            <span>활성 이슈 {topProject.open_issues}건</span>
            <span className="h-1 w-1 rounded-full bg-slate-400" />
            <span>임박 일정 {topProject.due_soon_issues}건</span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-4">
          <div className="text-right">
            <div className="text-3xl font-bold text-rose-600">{topProject.risk_score}</div>
            <div className="text-xs font-bold text-slate-500">위험 점수</div>
          </div>
          <svg className="h-20 w-full max-w-[280px]" viewBox="0 0 210 64" fill="none" aria-hidden>
            <polyline points={linePoints} fill="none" stroke="#fda4af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <Link
            href={`/dashboard/${encodeURIComponent(topProject.id)}`}
            className="inline-flex h-11 items-center gap-2 rounded-lg bg-blue-600 px-6 text-sm font-bold text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700"
          >
            현황판 열기
            <span aria-hidden>→</span>
          </Link>
        </div>
      </div>
    </section>
  )
}
