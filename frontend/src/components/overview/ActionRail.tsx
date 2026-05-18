import Link from 'next/link'
import Badge from '@/components/Badge'
import type { ProjectItem } from '@/types/dashboard'
import type { ReactNode } from 'react'

interface ActionRailProps {
  recentProjects: ProjectItem[]
  previewProject: ProjectItem | null
  search?: string
  onSearchChange?: (value: string) => void
  onPreviewProjectChange?: (projectId: string) => void
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

function Panel({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/70">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-blue-600">{icon}</span>
        <h3 className="text-sm font-bold text-slate-950">{title}</h3>
      </div>
      {children}
    </section>
  )
}

export default function ActionRail({
  recentProjects,
  previewProject,
  search = '',
  onSearchChange,
  onPreviewProjectChange,
}: ActionRailProps) {
  const quickProjects = recentProjects.length > 0 ? recentProjects : previewProject ? [previewProject] : []
  return (
    <aside className="space-y-4">
      {/* Priority actions: 지금 바로 확인할 우선 조치 */}
      <Panel
        title="지금 바로 확인할 우선 조치"
        icon={(
          <svg className="h-5 w-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
          </svg>
        )}
      >
        <div className="space-y-2">
          {/** Build three priority cards based on previewProject counts */}
          {([{
            key: 'overdue',
            label: '지연 이슈',
            count: previewProject?.overdue_issues ?? 0,
            tone: 'danger'
          }, {
            key: 'high',
            label: '우선 조치',
            count: previewProject?.high_priority_issues ?? 0,
            tone: 'warning'
          }, {
            key: 'stale',
            label: '정체 이슈',
            count: previewProject?.stale_issues ?? 0,
            tone: 'muted'
          }]).map((item, idx) => (
            <div key={item.key} className="flex items-start gap-3 rounded-lg border border-slate-100 bg-white p-3 shadow-sm">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-100 text-sm font-bold text-slate-700">#{idx + 1}</div>
              <div className="flex-1">
                <div className="flex items-center justify-between gap-3">
                  <div className="truncate text-sm font-semibold text-slate-800">{item.label}</div>
                  <div className="flex items-center gap-2">
                    <Badge tone={item.tone as any} size="sm">{item.count}</Badge>
                    <Link href="#" className="text-xs font-medium text-blue-600 hover:underline">열기</Link>
                  </div>
                </div>
                <p className="mt-1 text-xs text-slate-500">{previewProject ? previewProject.name : '프로젝트 선택 시 상세 내용 표시'}</p>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      {/* 담당자 점검 대상 */}
      <Panel
        title="담당자 점검 대상"
        icon={(
          <svg className="h-5 w-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5.121 17.804A4 4 0 0 1 8 16h8a4 4 0 0 1 2.879 1.804M15 11a3 3 0 1 0-6 0v1h6v-1z" />
          </svg>
        )}
      >
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-white px-3 py-2">
            <div>
              <div className="text-sm font-semibold text-slate-800">미할당</div>
              <div className="text-xs text-slate-500">할당 필요 이슈 {previewProject?.unassigned_issues ?? 0}건</div>
            </div>
            <Link href="#" className="text-xs font-medium text-blue-600">기한 초과 이슈 보기</Link>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-white px-3 py-2">
            <div>
              <div className="text-sm font-semibold text-slate-800">담당자: 검토 필요</div>
              <div className="text-xs text-slate-500">우선 확인 필요 이슈 {previewProject?.high_priority_issues ?? 0}건</div>
            </div>
            <Link href="#" className="text-xs font-medium text-blue-600">기한 초과 이슈 보기</Link>
          </div>
        </div>
      </Panel>

      {/* 빠른 열기 (compact) */}
      <Panel
        title="빠른 열기"
        icon={(
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m13 2-8 12h7l-1 8 8-12h-7l1-8z" />
          </svg>
        )}
      >
        <div className="space-y-2">
          {quickProjects.slice(0, 4).map((project) => (
            <Link
              key={`quick-${project.id}`}
              href={`/dashboard/${encodeURIComponent(project.id)}`}
              onMouseEnter={() => onPreviewProjectChange?.(project.id)}
              onFocus={() => onPreviewProjectChange?.(project.id)}
              className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm transition hover:border-blue-200 hover:bg-blue-50"
            >
              <span className="truncate font-bold text-slate-800">{project.name}</span>
              <Badge tone={getRiskTone(project.risk_level)} size="sm">{getRiskLabel(project.risk_level)}</Badge>
            </Link>
          ))}
        </div>
        {quickProjects.length > 0 ? (
          <Link href="/" className="mt-3 inline-flex text-sm font-bold text-blue-600 hover:text-blue-700">모든 프로젝트 열기 →</Link>
        ) : (
          <p className="text-sm text-slate-500">최근 프로젝트가 없습니다.</p>
        )}
      </Panel>

      {recentProjects.length > 0 ? (
        <Panel
          title="최근 본 프로젝트"
          icon={(
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
            </svg>
          )}
        >
          <div className="space-y-3">
            {recentProjects.slice(0, 4).map((project, index) => (
              <Link key={`recent-${project.id}`} href={`/dashboard/${encodeURIComponent(project.id)}`} className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate font-medium text-slate-700">{project.name}</span>
                <span className="shrink-0 text-xs text-slate-400">{index === 0 ? '1시간 전' : `${index + 1}일 전`}</span>
              </Link>
            ))}
          </div>
        </Panel>
      ) : null}

      <Panel
        title="프로젝트 검색"
        icon={(
          <svg className="h-5 w-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <circle cx="11" cy="11" r="8" strokeWidth="2" />
            <path strokeLinecap="round" strokeWidth="2" d="M21 21l-4.35-4.35" />
          </svg>
        )}
      >
        <label className="relative block">
          <span className="sr-only">프로젝트 검색</span>
          <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <circle cx="11" cy="11" r="8" strokeWidth="2" />
            <path strokeLinecap="round" strokeWidth="2" d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(event) => onSearchChange?.(event.target.value)}
            placeholder="예: infra, backoffice"
            className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
          />
        </label>
        <div className="mt-3 flex flex-wrap gap-2">
          {['infra', 'backoffice', 'sales', 'docs'].map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => onSearchChange?.(tag)}
              className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 transition hover:bg-blue-50 hover:text-blue-700"
            >
              {tag}
            </button>
          ))}
        </div>
      </Panel>
    </aside>
  )
}
