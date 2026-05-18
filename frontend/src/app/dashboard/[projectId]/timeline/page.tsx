'use client'

import React, { useMemo, useState } from 'react'
import Link from 'next/link'
import { Calendar, Clock, Filter, AlertTriangle, CheckCircle, ChevronLeft, ChevronRight } from 'lucide-react'
import { useDashboardProjectContext } from '@/components/shell/DashboardProjectLayout'
import Badge from '@/components/Badge'

type GroupBy = 'all' | 'assignee' | 'priority'
type ViewRange = 30 | 60 | 90

const PRIORITY_ORDER: Record<string, number> = { Immediate: 0, Urgent: 1, High: 2, Normal: 3, Low: 4 }
const PRIORITY_COLOR: Record<string, { bg: string; border: string; text: string }> = {
  Immediate: { bg: '#fef2f2', border: '#fca5a5', text: '#dc2626' },
  Urgent:    { bg: '#fff7ed', border: '#fdba74', text: '#ea580c' },
  High:      { bg: '#fefce8', border: '#fde047', text: '#ca8a04' },
  Normal:    { bg: '#eff6ff', border: '#93c5fd', text: '#2563eb' },
  Low:       { bg: '#f0fdf4', border: '#86efac', text: '#16a34a' },
}
const STATUS_COLOR: Record<string, string> = {
  closed: '#10b981',
  in_progress: '#3b82f6',
  new: '#8b5cf6',
  other: '#94a3b8',
}

function formatDate(d: Date) {
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function parseDate(s: string | null | undefined): Date | null {
  if (!s) return null
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d
}

export default function TimelinePage() {
  const { projectId, issueList, loading } = useDashboardProjectContext()
  const [groupBy, setGroupBy] = useState<GroupBy>('all')
  const [viewDays, setViewDays] = useState<ViewRange>(30)
  const [pivotOffset, setPivotOffset] = useState(0)

  const pivotStart = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() - 7 + pivotOffset * viewDays)
    d.setHours(0, 0, 0, 0)
    return d
  }, [pivotOffset, viewDays])

  const pivotEnd = useMemo(() => {
    const d = new Date(pivotStart)
    d.setDate(d.getDate() + viewDays)
    return d
  }, [pivotStart, viewDays])

  // 날짜 헤더 (7일 단위 주요 포인트)
  const dateMarkers = useMemo(() => {
    const markers: Date[] = []
    const d = new Date(pivotStart)
    while (d <= pivotEnd) {
      markers.push(new Date(d))
      d.setDate(d.getDate() + Math.ceil(viewDays / 8))
    }
    return markers
  }, [pivotStart, pivotEnd, viewDays])

  const issues = useMemo(() => {
    if (!issueList?.issues) return []
    return issueList.issues
      .filter(i => i.due_date)
      .map(i => {
        const due = parseDate(i.due_date)!
        const created = parseDate(i.created_on) ?? new Date(due.getTime() - 7 * 86400000)
        return { ...i, _due: due, _start: created }
      })
      .sort((a, b) => {
        const pa = PRIORITY_ORDER[a.priority ?? 'Normal'] ?? 3
        const pb = PRIORITY_ORDER[b.priority ?? 'Normal'] ?? 3
        return pa !== pb ? pa - pb : a._due.getTime() - b._due.getTime()
      })
  }, [issueList])

  const totalRange = pivotEnd.getTime() - pivotStart.getTime()

  function posLeft(d: Date) {
    const t = Math.max(0, d.getTime() - pivotStart.getTime())
    return Math.min(100, (t / totalRange) * 100)
  }
  function barWidth(start: Date, end: Date) {
    const s = Math.max(start.getTime(), pivotStart.getTime())
    const e = Math.min(end.getTime(), pivotEnd.getTime())
    if (e <= s) return 0
    return Math.max(0.5, ((e - s) / totalRange) * 100)
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayPct = posLeft(today)

  const grouped = useMemo(() => {
    if (groupBy === 'assignee') {
      const map = new Map<string, typeof issues>()
      issues.forEach(i => {
        const k = i.assigned_to ?? '미할당'
        if (!map.has(k)) map.set(k, [])
        map.get(k)!.push(i)
      })
      return Array.from(map.entries()).map(([key, items]) => ({ key, items }))
    }
    if (groupBy === 'priority') {
      const map = new Map<string, typeof issues>()
      issues.forEach(i => {
        const k = i.priority ?? 'Normal'
        if (!map.has(k)) map.set(k, [])
        map.get(k)!.push(i)
      })
      return Array.from(map.entries())
        .sort((a, b) => (PRIORITY_ORDER[a[0]] ?? 9) - (PRIORITY_ORDER[b[0]] ?? 9))
        .map(([key, items]) => ({ key, items }))
    }
    return [{ key: '전체 이슈', items: issues }]
  }, [issues, groupBy])

  const overdueCount = issues.filter(i => i.is_overdue).length
  const dueThisWeek = issues.filter(i => {
    const diff = (i._due.getTime() - today.getTime()) / 86400000
    return diff >= 0 && diff <= 7 && i.status_group !== 'closed'
  }).length

  if (loading) {
    return (
      <main className="mx-auto max-w-screen-2xl px-4 pb-8 pt-5 sm:px-6 space-y-4">
        <div className="h-24 animate-pulse rounded-2xl bg-slate-200" />
        <div className="h-[500px] animate-pulse rounded-2xl bg-slate-200" />
      </main>
    )
  }

  return (
    <main className="mx-auto flex max-w-screen-2xl flex-col gap-4 px-4 pb-10 pt-5 sm:px-6">

      {/* 헤더 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Calendar size={14} className="text-violet-500" />
            <span className="text-xs font-bold uppercase tracking-widest text-slate-400">일정 관리</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">프로젝트 타임라인</h1>
          <p className="mt-1 text-sm text-slate-500">마감일이 설정된 이슈의 일정을 Gantt 뷰로 파악합니다.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* 범위 선택 */}
          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1 text-xs font-bold">
            {([30, 60, 90] as ViewRange[]).map(d => (
              <button key={d} onClick={() => setViewDays(d)}
                className={`h-7 rounded-lg px-3 transition-colors ${viewDays === d ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}>
                {d}일
              </button>
            ))}
          </div>
          {/* 그룹 */}
          <div className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 p-1 text-xs font-bold">
            <Filter size={12} className="text-slate-400 ml-1" />
            {(['all', 'assignee', 'priority'] as GroupBy[]).map(g => (
              <button key={g} onClick={() => setGroupBy(g)}
                className={`h-7 rounded-lg px-2.5 transition-colors ${groupBy === g ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}>
                {g === 'all' ? '전체' : g === 'assignee' ? '담당자별' : '우선순위별'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 통계 뱃지 */}
      <div className="flex flex-wrap gap-2">
        <div className="flex items-center gap-2 rounded-xl border border-rose-100 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-600">
          <AlertTriangle size={13} /> 기한 초과 {overdueCount}건
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-amber-100 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-600">
          <Clock size={13} /> 이번 주 마감 {dueThisWeek}건
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-600">
          <CheckCircle size={13} /> 일정 있는 이슈 {issues.length}건
        </div>
      </div>

      {/* Gantt 영역 */}
      <section className="rounded-[20px] border border-slate-200 bg-white shadow-sm overflow-hidden">
        {/* 날짜 헤더 */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-2">
          <button onClick={() => setPivotOffset(p => p - 1)}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-100 transition-colors">
            <ChevronLeft size={14} />
          </button>
          <span className="text-xs font-bold text-slate-600">
            {pivotStart.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })} —{' '}
            {pivotEnd.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}
          </span>
          <button onClick={() => setPivotOffset(p => p + 1)}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-100 transition-colors">
            <ChevronRight size={14} />
          </button>
        </div>

        {/* 그리드 헤더 */}
        <div className="grid grid-cols-[240px_minmax(0,1fr)] border-b border-slate-100">
          <div className="border-r border-slate-100 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50">
            이슈
          </div>
          <div className="relative px-2 py-2 bg-slate-50">
            <div className="relative h-5">
              {dateMarkers.map((m, idx) => (
                <span key={idx} className="absolute text-[10px] font-bold text-slate-400 -translate-x-1/2"
                  style={{ left: `${posLeft(m)}%` }}>
                  {formatDate(m)}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* 이슈 행 */}
        {issues.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-400">
            마감일이 설정된 이슈가 없습니다.<br />
            <span className="text-xs">Redmine에서 이슈에 Due Date를 설정해 보세요.</span>
          </div>
        ) : (
          grouped.map(({ key, items }) => (
            <div key={key}>
              {groupBy !== 'all' && (
                <div className="grid grid-cols-[240px_minmax(0,1fr)] border-b border-slate-50 bg-gradient-to-r from-slate-50 to-transparent">
                  <div className="col-span-2 px-4 py-2 text-[11px] font-black uppercase tracking-wider text-slate-500">
                    {key} ({items.length})
                  </div>
                </div>
              )}
              {items.map(issue => {
                const pColor = PRIORITY_COLOR[issue.priority ?? 'Normal'] ?? PRIORITY_COLOR.Normal
                const sColor = STATUS_COLOR[issue.status_group] ?? '#94a3b8'
                const left = posLeft(issue._start)
                const width = barWidth(issue._start, issue._due)
                const duePct = posLeft(issue._due)
                const isClosed = issue.status_group === 'closed'
                const isOverdue = issue.is_overdue

                return (
                  <div key={issue.id}
                    className="grid grid-cols-[240px_minmax(0,1fr)] border-b border-slate-50 group hover:bg-slate-50/60 transition-colors">
                    {/* 이슈 정보 */}
                    <div className="flex items-center gap-2.5 border-r border-slate-100 px-3 py-2.5">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-black"
                        style={{ background: `${sColor}20`, color: sColor }}>
                        #{issue.id}
                      </span>
                      <div className="flex-1 min-w-0">
                        <Link href={`/dashboard/${encodeURIComponent(projectId)}/issues`}
                          className="block truncate text-xs font-bold text-slate-800 hover:text-blue-600 transition-colors">
                          {issue.subject}
                        </Link>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] text-slate-400 truncate">
                            {issue.assigned_to ?? '미할당'}
                          </span>
                          {isOverdue && <span className="text-[10px] font-bold text-rose-500">지연</span>}
                        </div>
                      </div>
                    </div>

                    {/* Gantt 바 */}
                    <div className="relative px-2 py-2.5 flex items-center" style={{ minHeight: 52 }}>
                      {/* 세로 격자선 */}
                      {dateMarkers.map((m, idx) => (
                        <div key={idx} className="absolute top-0 bottom-0 w-px bg-slate-100/60"
                          style={{ left: `${posLeft(m)}%` }} />
                      ))}

                      {/* 오늘 선 */}
                      {todayPct >= 0 && todayPct <= 100 && (
                        <div className="absolute top-0 bottom-0 w-0.5 z-10" style={{ left: `${todayPct}%`, background: '#ef4444', opacity: 0.6 }}>
                          <div className="absolute -top-0.5 -left-1.5 h-2 w-2 rounded-full bg-rose-500" />
                        </div>
                      )}

                      {/* 기간 바 */}
                      {width > 0 && (
                        <div className="absolute h-6 rounded-full flex items-center px-2 transition-all"
                          style={{
                            left: `${left}%`,
                            width: `${width}%`,
                            background: isClosed ? '#dcfce7' : isOverdue ? '#fef2f2' : pColor.bg,
                            border: `1.5px solid ${isClosed ? '#86efac' : isOverdue ? '#fca5a5' : pColor.border}`,
                          }}>
                          <span className="text-[9px] font-black truncate"
                            style={{ color: isClosed ? '#16a34a' : isOverdue ? '#dc2626' : pColor.text }}>
                            {isClosed ? '✓' : issue.priority?.slice(0, 1) ?? '•'} {issue.subject}
                          </span>
                        </div>
                      )}

                      {/* 마감일 다이아몬드 */}
                      {duePct >= 0 && duePct <= 100 && (
                        <div className="absolute z-20 h-3 w-3 rotate-45 rounded-sm -translate-x-1.5"
                          style={{
                            left: `${duePct}%`,
                            top: '50%',
                            marginTop: -6,
                            background: isClosed ? '#10b981' : isOverdue ? '#ef4444' : '#f59e0b',
                          }}
                          title={`마감: ${issue.due_date}`}
                        />
                      )}

                      {/* 마감일 라벨 (hover) */}
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                        {issue.due_date}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ))
        )}

        {/* 범례 */}
        <div className="flex flex-wrap items-center gap-4 border-t border-slate-100 px-5 py-3 text-[11px] font-bold text-slate-500">
          <span className="font-black text-slate-400 uppercase tracking-wider">범례</span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rotate-45 rounded-sm bg-rose-500" /> 마감일
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 rounded-full bg-emerald-100 border border-emerald-300 w-6" /> 완료
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 rounded-full bg-rose-100 border border-rose-300 w-6" /> 지연
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 bg-rose-500 opacity-60 w-5" /> 오늘
          </span>
          <div className="ml-auto text-slate-400">
            표시 중: {issues.filter(i => {
              return (i._due >= pivotStart && i._start <= pivotEnd)
            }).length}건 / {issues.length}건
          </div>
        </div>
      </section>
    </main>
  )
}
