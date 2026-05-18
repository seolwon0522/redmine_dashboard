'use client'

import React, { useEffect, useState, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Search, LayoutDashboard, ListTodo, Users, CalendarDays, Activity, Settings, Command } from 'lucide-react'
import { useDashboardProjectContext } from './DashboardProjectLayout'
import Badge from '@/components/Badge'

export default function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const { projectId, issueList } = useDashboardProjectContext()

  // Handle Cmd+K / Ctrl+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  const pages = useMemo(() => [
    { id: 'page-overview', title: '개요 (Overview)', icon: LayoutDashboard, href: `/dashboard/${projectId}` },
    { id: 'page-issues', title: '이슈 큐 (Issues)', icon: ListTodo, href: `/dashboard/${projectId}/issues` },
    { id: 'page-team', title: '팀 워크로드 (Team)', icon: Users, href: `/dashboard/${projectId}/team` },
    { id: 'page-timeline', title: '타임라인 (Timeline)', icon: CalendarDays, href: `/dashboard/${projectId}/timeline` },
    { id: 'page-reports', title: '분석 리포트 (Reports)', icon: Activity, href: `/dashboard/${projectId}/reports` },
    { id: 'page-settings', title: '설정 (Settings)', icon: Settings, href: `/dashboard/${projectId}/settings` },
  ], [projectId])

  const issues = useMemo(() => issueList?.issues || [], [issueList])

  const filteredItems = useMemo(() => {
    if (!query.trim()) return pages

    const q = query.toLowerCase()
    
    // 1. Filter pages
    const matchedPages = pages.filter(p => p.title.toLowerCase().includes(q))
    
    // 2. Filter issues
    const matchedIssues = issues.filter(issue => 
      String(issue.id).includes(q) || 
      issue.subject.toLowerCase().includes(q) ||
      (issue.assigned_to && issue.assigned_to.toLowerCase().includes(q))
    ).map(issue => ({
      id: `issue-${issue.id}`,
      title: `#${issue.id} ${issue.subject}`,
      subtitle: `${issue.status} · ${issue.assigned_to || '미할당'}`,
      href: `/dashboard/${projectId}/issues?issueId=${issue.id}`,
      isIssue: true,
      tone: issue.status_group === 'closed' ? 'success' as const : 'warning' as const
    })).slice(0, 10) // Limit issue results

    return [...matchedPages, ...matchedIssues]
  }, [query, pages, issues, projectId])

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open) return
      
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(i => (i + 1) % filteredItems.length)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(i => (i - 1 + filteredItems.length) % filteredItems.length)
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (filteredItems[selectedIndex]) {
          router.push(filteredItems[selectedIndex].href)
          setOpen(false)
        }
      } else if (e.key === 'Escape') {
        e.preventDefault()
        setOpen(false)
      }
    }
    
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, filteredItems, selectedIndex, router])

  if (!open) return null

  return (
    <>
      <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={() => setOpen(false)} />
      <div className="fixed inset-x-0 top-1/4 z-50 mx-auto w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200">
        <div className="flex items-center border-b border-slate-100 px-4 py-3">
          <Search className="h-5 w-5 text-slate-400" />
          <input
            ref={inputRef}
            type="text"
            className="ml-3 flex-1 bg-transparent text-sm text-slate-900 placeholder-slate-400 outline-none"
            placeholder="페이지 이동 또는 이슈(번호, 제목, 담당자) 검색..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelectedIndex(0)
            }}
          />
          <div className="ml-4 flex gap-1">
            <kbd className="hidden sm:inline-block rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">ESC</kbd>
          </div>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-2">
          {filteredItems.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              검색 결과가 없습니다.
            </div>
          ) : (
            filteredItems.map((item, i) => {
              const isSelected = i === selectedIndex
              
              if ('isIssue' in item) {
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      router.push(item.href)
                      setOpen(false)
                    }}
                    onMouseEnter={() => setSelectedIndex(i)}
                    className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-left transition-colors ${
                      isSelected ? 'bg-blue-50 text-blue-900' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{item.title}</div>
                      <div className="mt-0.5 text-xs text-slate-500">{item.subtitle}</div>
                    </div>
                    <Badge tone={item.tone}>{item.tone === 'success' ? '완료' : '진행'}</Badge>
                  </button>
                )
              }

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    router.push(item.href)
                    setOpen(false)
                  }}
                  onMouseEnter={() => setSelectedIndex(i)}
                  className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition-colors ${
                    isSelected ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {item.icon && <item.icon className="h-5 w-5 text-slate-400" />}
                  <span className="text-sm font-medium">{item.title}</span>
                </button>
              )
            })
          )}
        </div>
      </div>
    </>
  )
}
