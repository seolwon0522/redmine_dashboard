'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Clock, AlertCircle, Users, FileBarChart, Settings, ChevronRight } from 'lucide-react'

type SidebarNavProps = {
  projectId?: string
  projectSubtitle?: string
}

const navItems = [
  {
    label: '개요',
    href: '',
    icon: LayoutDashboard,
    description: '핵심 지표 및 상태',
    color: 'from-blue-500 to-blue-600',
    softColor: 'bg-blue-50 text-blue-700 ring-blue-200',
  },
  {
    label: '타임라인',
    href: 'timeline',
    icon: Clock,
    description: '일정 및 마감 관리',
    color: 'from-violet-500 to-purple-600',
    softColor: 'bg-violet-50 text-violet-700 ring-violet-200',
  },
  {
    label: '이슈',
    href: 'issues',
    icon: AlertCircle,
    description: '이슈 탐색 및 필터',
    color: 'from-orange-500 to-rose-500',
    softColor: 'bg-orange-50 text-orange-700 ring-orange-200',
  },
  {
    label: '팀',
    href: 'team',
    icon: Users,
    description: '담당자 워크로드',
    color: 'from-emerald-500 to-teal-600',
    softColor: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  },
  {
    label: '보고서',
    href: 'reports',
    icon: FileBarChart,
    description: 'SLA 및 성과 분석',
    color: 'from-amber-500 to-orange-500',
    softColor: 'bg-amber-50 text-amber-700 ring-amber-200',
  },
  {
    label: '설정',
    href: 'settings',
    icon: Settings,
    description: '임계값 및 연결 설정',
    color: 'from-slate-500 to-slate-600',
    softColor: 'bg-slate-100 text-slate-700 ring-slate-200',
  },
]

export function SidebarNav({ projectId = 'bp-cloudpos', projectSubtitle = 'Redmine 운영 관제' }: SidebarNavProps) {
  const pathname = usePathname()
  const basePath = `/dashboard/${encodeURIComponent(projectId)}`

  return (
    <aside className="flex h-full flex-col px-3 py-4 gap-1">
      {/* 프로젝트 ID 카드 */}
      <div className="mb-4 rounded-2xl border border-slate-200/80 bg-gradient-to-br from-slate-50 to-white px-3.5 py-3.5 shadow-sm">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
          Redmine Hub
        </p>
        <h2 className="mt-1.5 truncate text-[15px] font-black text-slate-900 leading-tight">{projectId}</h2>
        <div className="mt-2 flex items-center gap-1.5">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <p className="text-[11px] font-semibold text-slate-500">{projectSubtitle}</p>
        </div>
      </div>

      <nav className="flex flex-col gap-0.5">
        {navItems.map((item) => {
          const href = item.href ? `${basePath}/${item.href}` : basePath
          const active = item.href ? pathname === href : pathname === basePath

          return (
            <Link
              key={item.label}
              href={href}
              className={[
                'group relative flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm transition-all duration-150',
                active
                  ? `${item.softColor} ring-1 font-bold`
                  : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 font-semibold',
              ].join(' ')}
            >
              <span
                className={[
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-all duration-150',
                  active
                    ? `bg-gradient-to-br ${item.color} text-white shadow-sm`
                    : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200',
                ].join(' ')}
              >
                <item.icon size={15} />
              </span>
              <div className="flex-1 min-w-0">
                <div className="truncate leading-tight">{item.label}</div>
                {active && (
                  <div className="text-[10px] font-medium opacity-70 truncate leading-tight mt-0.5">
                    {item.description}
                  </div>
                )}
              </div>
              {active && (
                <ChevronRight size={13} className="shrink-0 opacity-50" />
              )}
            </Link>
          )
        })}
      </nav>

      <div className="mt-auto pt-3 border-t border-slate-100">
        <Link
          href="/"
          className="flex min-h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-500 transition-all hover:border-slate-300 hover:text-slate-700 hover:shadow-sm"
        >
          전체 프로젝트 목록
        </Link>
      </div>
    </aside>
  )
}

export default SidebarNav
