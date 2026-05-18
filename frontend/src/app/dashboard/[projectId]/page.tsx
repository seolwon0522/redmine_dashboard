'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { AlertTriangle, Clock, CheckCircle, TrendingUp, ArrowRight, Activity, Users, Zap, Shield } from 'lucide-react'

import Badge from '@/components/Badge'
import { useDashboardProjectContext } from '@/components/shell/DashboardProjectLayout'
import AiProjectInsight from '@/components/analytics/AiProjectInsight'

// ── 도넛 차트 ────────────────────────────────────────────────────────────────
function DonutChart({ segments }: { segments: Array<{ value: number; color: string; label: string }> }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0)
  const size = 120
  const r = 44
  const cx = size / 2
  const cy = size / 2
  const circumference = 2 * Math.PI * r

  let offset = 0
  const arcs = segments.map((seg) => {
    const pct = total > 0 ? seg.value / total : 0
    const arc = { ...seg, pct, offset, dash: pct * circumference, gap: (1 - pct) * circumference }
    offset += pct * circumference
    return arc
  })

  return (
    <div className="relative flex items-center justify-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f1f5f9" strokeWidth="14" />
        {arcs.map((arc) => (
          <circle
            key={arc.label}
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={arc.color}
            strokeWidth="14"
            strokeDasharray={`${arc.dash} ${arc.gap}`}
            strokeDashoffset={-arc.offset}
            strokeLinecap="butt"
          />
        ))}
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-2xl font-black text-slate-900">{total}</span>
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">전체</span>
      </div>
    </div>
  )
}

// ── 헬스 게이지 ──────────────────────────────────────────────────────────────
function HealthGauge({ score, label, tone }: { score: number; label: string; tone: string }) {
  const clamp = Math.max(0, Math.min(100, score))
  const r = 52
  const cx = 80
  const cy = 72
  const startAngle = -200
  const endAngle = 20
  const totalAngle = endAngle - startAngle
  const arcAngle = (clamp / 100) * totalAngle + startAngle

  function polar(angleDeg: number, radius: number) {
    const rad = (angleDeg * Math.PI) / 180
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) }
  }

  const start = polar(startAngle, r)
  const end = polar(endAngle, r)
  const active = polar(arcAngle, r)
  const largeArc = totalAngle > 180 ? 1 : 0
  const activeArc = arcAngle - startAngle > 180 ? 1 : 0

  const trackPath = `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`
  const activePath = `M ${start.x} ${start.y} A ${r} ${r} 0 ${activeArc} 1 ${active.x} ${active.y}`

  const color = tone === 'success' ? '#10b981' : tone === 'warning' ? '#f59e0b' : tone === 'danger' ? '#ef4444' : '#3b82f6'

  return (
    <div className="flex flex-col items-center">
      <svg width="160" height="100" viewBox="0 0 160 100">
        <path d={trackPath} fill="none" stroke="#e2e8f0" strokeWidth="12" strokeLinecap="round" />
        <path d={activePath} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round" style={{ transition: 'stroke-dasharray 0.6s ease' }} />
        <text x={cx} y={cy - 6} textAnchor="middle" fontSize="26" fontWeight="900" fill="#0f172a">{clamp}</text>
        <text x={cx} y={cy + 12} textAnchor="middle" fontSize="10" fontWeight="700" fill="#94a3b8">/ 100</text>
      </svg>
      <span className="text-sm font-bold" style={{ color }}>{label}</span>
    </div>
  )
}

// ── 미니 스파크라인 ───────────────────────────────────────────────────────────
function Sparkline({ values, color = '#3b82f6' }: { values: number[]; color?: string }) {
  const w = 80; const h = 28
  if (values.length < 2) return null
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const span = Math.max(1, max - min)
  const step = w / (values.length - 1)
  const pts = values.map((v, i) => `${i * step},${h - ((v - min) / span) * (h - 4) - 2}`).join(' ')
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <polyline fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={pts} />
    </svg>
  )
}

// ── KPI 미니 카드 ─────────────────────────────────────────────────────────────
function MiniKPI({ label, value, sub, icon: Icon, color, sparkValues, href }: {
  label: string; value: string | number; sub: string
  icon: React.ElementType; color: string; sparkValues?: number[]; href?: string
}) {
  const inner = (
    <div className={`group rounded-2xl border bg-white p-4 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${href ? 'cursor-pointer' : ''}`}
      style={{ borderColor: `${color}20` }}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: `${color}15` }}>
          <Icon size={16} style={{ color }} />
        </div>
        {sparkValues && <Sparkline values={sparkValues} color={color} />}
      </div>
      <div className="mt-3">
        <div className="text-2xl font-black text-slate-900">{value}</div>
        <div className="text-xs font-bold text-slate-500 mt-0.5">{label}</div>
        <div className="text-[11px] text-slate-400 mt-0.5">{sub}</div>
      </div>
    </div>
  )
  return href ? <Link href={href}>{inner}</Link> : inner
}

// ── 상태 행 ───────────────────────────────────────────────────────────────────
function StatusRow({ item, projectId }: { item: any; projectId: string }) {
  const toneColor: Record<string, string> = {
    danger: '#ef4444', warning: '#f59e0b', neutral: '#94a3b8', success: '#10b981', info: '#3b82f6'
  }
  const color = toneColor[item.tone] ?? '#94a3b8'

  return (
    <Link
      href={`/dashboard/${encodeURIComponent(projectId)}/issues?preset=${encodeURIComponent(item.preset ?? 'attention')}`}
      className="group flex items-center gap-4 rounded-xl border border-transparent px-3 py-2.5 transition-all hover:border-slate-100 hover:bg-slate-50"
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: `${color}12` }}>
        <span className="text-sm font-black" style={{ color }}>{item.count}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold text-slate-800 truncate">{item.label}</div>
        <div className="text-[11px] text-slate-400 truncate">{item.note}</div>
      </div>
      <Badge tone={item.tone} size="sm">{item.count > 0 ? '확인' : '안정'}</Badge>
      <ArrowRight size={13} className="shrink-0 text-slate-300 group-hover:text-slate-500 transition-colors" />
    </Link>
  )
}

export default function DashboardHomePage() {
  const { projectId, summary, issueList, model, loading, error, lastSynced } = useDashboardProjectContext()

  const issues = useMemo(() => issueList?.issues ?? [], [issueList])

  const donutSegments = useMemo(() => {
    if (!model) return []
    const byGroup = summary?.by_status_group ?? {}
    return [
      { label: '진행 중', value: byGroup['in_progress'] ?? 0, color: '#3b82f6' },
      { label: '완료', value: byGroup['closed'] ?? 0, color: '#10b981' },
      { label: '신규', value: byGroup['new'] ?? 0, color: '#8b5cf6' },
      { label: '기타', value: byGroup['other'] ?? 0, color: '#94a3b8' },
    ].filter(s => s.value > 0)
  }, [model, summary])

  // 최근 업데이트된 이슈 5건
  const recentIssues = useMemo(() =>
    [...issues].sort((a, b) => (b.updated_on ?? '').localeCompare(a.updated_on ?? '')).slice(0, 5)
  , [issues])

  // 스파크라인용 주간 데이터 (간단 모사)
  const closedCount = issues.filter(i => i.status_group === 'closed').length
  const overdueCount = issues.filter(i => i.is_overdue).length
  const staleCount = issues.filter(i => i.is_stale).length
  const totalIssues = issues.length

  const priorityItems = model?.statusSnapshot.items.slice(0, 5) ?? []

  if (!loading && error) {
    return (
      <main className="mx-auto max-w-screen-2xl px-4 pb-8 pt-4 sm:px-6">
        <div className="max-w-xl rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700 shadow-sm">
          <div className="font-bold">대시보드 데이터를 불러오지 못했습니다.</div>
          <div className="mt-1 text-xs text-rose-500">{error}</div>
        </div>
      </main>
    )
  }

  if (!model || !summary) {
    return (
      <main className="mx-auto max-w-screen-2xl px-4 pb-8 pt-4 sm:px-6 space-y-4">
        {[400, 160, 300].map((h) => (
          <div key={h} className={`h-[${h}px] animate-pulse rounded-2xl bg-slate-200`} style={{ height: h }} />
        ))}
      </main>
    )
  }

  return (
    <main className="mx-auto flex max-w-screen-2xl flex-col gap-5 px-4 pb-10 pt-5 sm:px-6">

      {/* ── 헤더 ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-widest text-slate-400">실시간 운영 현황</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">프로젝트 개요</h1>
          <p className="mt-1 text-sm text-slate-500">전체 진행 상황과 즉시 확인이 필요한 이슈를 요약합니다.</p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/dashboard/${encodeURIComponent(projectId)}/issues`}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm shadow-blue-200 transition hover:bg-blue-500 hover:shadow-blue-300 hover:shadow-md"
          >
            <Activity size={15} />
            전체 이슈 보기
          </Link>
          <Link
            href={`/dashboard/${encodeURIComponent(projectId)}/reports`}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            보고서
          </Link>
        </div>
      </div>

      {/* ── 헬스 히어로 배너 ── */}
      <section className="relative overflow-hidden rounded-[24px] border border-slate-200/60 shadow-sm">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/90 via-violet-600/80 to-purple-700/90" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.15),transparent_60%)]" />
        <div className="relative flex flex-col lg:flex-row items-center gap-6 p-6 sm:p-8">
          {/* 게이지 */}
          <div className="shrink-0 flex flex-col items-center">
            <HealthGauge
              score={model.health.breakdown.score}
              label={model.health.breakdown.label}
              tone={model.health.breakdown.tone}
            />
          </div>

          {/* 설명 */}
          <div className="flex-1 min-w-0">
            <div className="text-xs font-black uppercase tracking-[0.2em] text-blue-200 mb-2">운영 건강도 판단</div>
            <h2 className="text-xl font-black text-white leading-snug">{model.summary.headline}</h2>
            <p className="mt-2 text-sm text-blue-100/80 leading-relaxed max-w-2xl">
              {model.health.breakdown.interpretation}
            </p>
          </div>

          {/* 빠른 통계 */}
          <div className="shrink-0 grid grid-cols-2 gap-2.5 min-w-[200px]">
            {[
              { label: '전체 이슈', value: totalIssues, icon: '📋' },
              { label: '완료', value: closedCount, icon: '✅' },
              { label: '기한 초과', value: overdueCount, icon: '🚨' },
              { label: '장기 미갱신', value: staleCount, icon: '⏳' },
            ].map(stat => (
              <div key={stat.label} className="rounded-xl bg-white/10 backdrop-blur px-3 py-2.5 text-center">
                <div className="text-lg">{stat.icon}</div>
                <div className="text-lg font-black text-white">{stat.value}</div>
                <div className="text-[10px] font-bold text-blue-200">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── AI 인사이트 ── */}
      <AiProjectInsight projectId={projectId} />

      {/* ── KPI 카드 4개 ── */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MiniKPI
          label="전체 이슈" value={totalIssues} sub="현재 추적 중"
          icon={Activity} color="#3b82f6"
          sparkValues={[totalIssues - 10, totalIssues - 6, totalIssues - 3, totalIssues]}
          href={`/dashboard/${encodeURIComponent(projectId)}/issues`}
        />
        <MiniKPI
          label="완료 이슈" value={closedCount} sub={`해결률 ${Math.round(closedCount / Math.max(1, totalIssues) * 100)}%`}
          icon={CheckCircle} color="#10b981"
          sparkValues={[closedCount - 8, closedCount - 5, closedCount - 2, closedCount]}
        />
        <MiniKPI
          label="기한 초과" value={overdueCount} sub={overdueCount > 0 ? '즉시 확인 필요' : '안정 상태'}
          icon={AlertTriangle} color={overdueCount > 0 ? '#ef4444' : '#10b981'}
          sparkValues={[overdueCount + 2, overdueCount + 1, overdueCount, overdueCount]}
          href={`/dashboard/${encodeURIComponent(projectId)}/issues?preset=overdue`}
        />
        <MiniKPI
          label="마감 임박" value={issues.filter(i => i.is_due_soon && i.status_group !== 'closed').length}
          sub="7일 내 마감"
          icon={Clock} color="#f59e0b"
          sparkValues={[3, 4, 3, issues.filter(i => i.is_due_soon).length]}
          href={`/dashboard/${encodeURIComponent(projectId)}/issues?preset=due-soon`}
        />
      </section>

      {/* ── 중간 영역: 우선조치 + 도넛 차트 ── */}
      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        {/* 우선 조치 필요 */}
        <section className="rounded-[20px] border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-50">
                <Zap size={15} className="text-rose-500" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900">우선 조치 필요</h3>
                <p className="text-[11px] text-slate-400">즉각 확인이 필요한 항목</p>
              </div>
            </div>
            <Link href={`/dashboard/${encodeURIComponent(projectId)}/issues?preset=attention`}
              className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700">
              모두 보기 <ArrowRight size={12} />
            </Link>
          </div>
          <div className="p-2">
            {priorityItems.length > 0
              ? priorityItems.map((item: any) => <StatusRow key={item.id} item={item} projectId={projectId} />)
              : <div className="py-8 text-center text-sm text-slate-400">조치가 필요한 항목이 없습니다 🎉</div>
            }
          </div>
        </section>

        {/* 도넛 차트 */}
        <section className="rounded-[20px] border border-slate-200 bg-white shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-50">
              <TrendingUp size={15} className="text-violet-500" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900">상태 분포</h3>
              <p className="text-[11px] text-slate-400">전체 이슈 비율</p>
            </div>
          </div>
          <div className="flex justify-center mb-4">
            <DonutChart segments={donutSegments} />
          </div>
          <div className="space-y-2">
            {donutSegments.map(seg => (
              <div key={seg.label} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: seg.color }} />
                  <span className="font-semibold text-slate-600">{seg.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-black text-slate-900">{seg.value}</span>
                  <span className="text-slate-400">{Math.round(seg.value / Math.max(1, summary.total) * 100)}%</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* ── 최근 활동 피드 ── */}
      <section className="rounded-[20px] border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50">
              <Users size={15} className="text-blue-500" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900">최근 업데이트</h3>
              <p className="text-[11px] text-slate-400">가장 최근에 변경된 이슈</p>
            </div>
          </div>
          <div className="text-[11px] font-bold text-slate-400">
            {lastSynced ? `${lastSynced.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 동기화` : '동기화 중'}
          </div>
        </div>
        <div className="divide-y divide-slate-50">
          {recentIssues.map((issue) => {
            const statusColor: Record<string, string> = { closed: '#10b981', in_progress: '#3b82f6', new: '#8b5cf6', other: '#94a3b8' }
            const color = statusColor[issue.status_group] ?? '#94a3b8'
            return (
              <Link
                key={issue.id}
                href={`/dashboard/${encodeURIComponent(projectId)}/issues`}
                className="group flex items-center gap-4 px-5 py-3 transition-colors hover:bg-slate-50/80"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-black" style={{ background: `${color}15`, color }}>
                  #{issue.id}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-slate-800 truncate">{issue.subject}</div>
                  <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
                    <span>{issue.assigned_to ?? '미할당'}</span>
                    <span className="opacity-40">•</span>
                    <span>{issue.status}</span>
                    {issue.is_overdue && <span className="text-rose-500 font-bold">• 지연</span>}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-[11px] font-bold text-slate-400">{issue.updated_on}</div>
                  <div className="flex items-center justify-end gap-1 mt-1">
                    <Shield size={10} style={{ color }} />
                    <span className="text-[10px] font-bold" style={{ color }}>{issue.priority ?? '—'}</span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </section>
    </main>
  )
}
