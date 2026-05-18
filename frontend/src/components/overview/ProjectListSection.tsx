import Link from 'next/link'
import Badge from '@/components/Badge'
import SignalChip from '@/components/overview/SignalChip'
import type { ProjectItem } from '@/types/dashboard'

interface ProjectListSectionProps {
  projects: ProjectItem[]
  filteredProjects: ProjectItem[]
  search: string
  onSearchChange: (value: string) => void
  onPreviewChange?: (projectId: string) => void
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

export default function ProjectListSection({
  filteredProjects,
  search,
  onSearchChange,
  onPreviewChange,
}: ProjectListSectionProps) {
  return (
    <section>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-950">프로젝트 목록</h2>
          <p className="mt-1 text-sm text-slate-500">{filteredProjects.length}개 프로젝트를 우선순위 기준으로 정렬했습니다.</p>
        </div>
        <Link href="/" className="text-sm font-bold text-blue-600 hover:text-blue-700">
          전체 프로젝트 보기 →
        </Link>
      </div>

      <div className="mb-4 lg:hidden">
        <label className="relative block">
          <span className="sr-only">프로젝트 검색</span>
          <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <circle cx="11" cy="11" r="8" strokeWidth="2" />
            <path strokeLinecap="round" strokeWidth="2" d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="예: infra, backoffice, project-id"
            className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
          />
        </label>
      </div>

      {filteredProjects.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredProjects.slice(0, 6).map((project) => (
            <Link
              key={project.id}
              href={`/dashboard/${encodeURIComponent(project.id)}`}
              onMouseEnter={() => onPreviewChange?.(project.id)}
              onFocus={() => onPreviewChange?.(project.id)}
              className="group flex min-h-[178px] flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/70 transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md hover:shadow-slate-200/80"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Badge tone={getRiskTone(project.risk_level)} size="sm">{getRiskLabel(project.risk_level)}</Badge>
                  <h3 className="mt-3 truncate text-base font-bold text-slate-950">{project.name}</h3>
                </div>
                <span className="text-xl font-bold text-slate-300 transition group-hover:text-blue-500">···</span>
              </div>

              <p className="mt-2 line-clamp-2 text-sm leading-5 text-slate-500">{project.primary_reason}</p>

              <div className="mt-4 flex flex-wrap gap-1.5">
                <SignalChip label={`지연 ${project.overdue_issues}`} value={0} variant={project.overdue_issues > 0 ? 'danger' : 'default'} hideValue />
                <SignalChip label={`정체 ${project.stale_issues}`} value={0} variant={project.stale_issues > 0 ? 'warning' : 'default'} hideValue />
                <SignalChip label={`미할당 ${project.unassigned_issues}`} value={0} hideValue />
                <SignalChip label={`고우선 ${project.high_priority_issues}`} value={0} hideValue />
              </div>

              <div className="mt-auto flex items-center justify-between pt-4 text-xs text-slate-500">
                <span>활성 이슈 {project.open_issues}건</span>
                <span>현황판 열기</span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white py-12 text-center">
          <p className="text-sm text-slate-500">검색 조건과 맞는 프로젝트가 없습니다.</p>
        </div>
      )}
    </section>
  )
}
