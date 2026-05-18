'use client'

import React, { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { AlertTriangle, Target, TrendingUp, CheckCircle, Activity, Type } from 'lucide-react'

import Badge from '@/components/Badge'
import { useDashboardProjectContext } from '@/components/shell/DashboardProjectLayout'
import { fetchDistribution, fetchVelocity, fetchTrend, type DistributionResponse, type VelocityResponse, type TrendResponse } from '@/lib/api'

type ReportRange = '7d' | '30d' | '90d'

const RANGE_OPTIONS: Array<{ id: ReportRange; label: string; days: number }> = [
  { id: '7d', label: '최근 7일', days: 7 },
  { id: '30d', label: '최근 30일', days: 30 },
  { id: '90d', label: '최근 90일', days: 90 },
]

function formatPercent(value: number) {
  return `${Math.round(value * 10) / 10}%`
}

function formatDateTime(date: Date | null) {
  if (!date) return '동기화 정보 없음'
  return date.toLocaleString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  })
}

function IconBadge({ tone, children }: { tone: 'blue' | 'violet' | 'emerald' | 'orange'; children: ReactNode }) {
  const toneClass = {
    blue: 'bg-blue-50 text-blue-600 ring-blue-100',
    violet: 'bg-violet-50 text-violet-600 ring-violet-100',
    emerald: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
    orange: 'bg-orange-50 text-orange-600 ring-orange-100',
  }[tone]
  return (
    <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ring-1 ${toneClass}`}>
      {children}
    </span>
  )
}

function MiniSparkline({ values, tone }: { values: number[]; tone: 'blue' | 'violet' | 'emerald' | 'orange' }) {
  if (!values.length) return null
  const width = 116
  const height = 38
  const max = Math.max(1, ...values)
  const min = Math.min(...values, 0)
  const span = Math.max(1, max - min)
  const step = values.length > 1 ? width / (values.length - 1) : width
  const points = values.map((value, index) => {
    const x = index * step
    const y = height - ((value - min) / span) * (height - 8) - 4
    return `${x},${y}`
  }).join(' ')
  const strokeClass = {
    blue: 'stroke-blue-500',
    violet: 'stroke-violet-500',
    emerald: 'stroke-emerald-500',
    orange: 'stroke-orange-500',
  }[tone]

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-10 w-28" role="img" aria-label="KPI 추이">
      <polyline fill="none" className={strokeClass} strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" points={points} />
      {values.map((value, index) => {
        const [x, y] = points.split(' ')[index].split(',').map(Number)
        return <circle key={`${value}-${index}`} cx={x} cy={y} r="2.4" className={strokeClass.replace('stroke', 'fill')} />
      })}
    </svg>
  )
}

function MetricCard({
  icon, title, subtitle, value, tone, sparkline,
}: {
  icon: ReactNode; title: string; subtitle: string; value: string; tone: 'blue' | 'violet' | 'emerald' | 'orange'; sparkline: number[]
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <IconBadge tone={tone}>{icon}</IconBadge>
        <MiniSparkline values={sparkline} tone={tone} />
      </div>
      <div className="mt-3">
        <p className="text-sm font-bold text-slate-900">{title}</p>
        <p className="mt-0.5 text-xs font-medium text-slate-500">{subtitle}</p>
      </div>
      <div className="mt-3 text-2xl font-black tracking-tight text-slate-950">{value}</div>
    </article>
  )
}

function Section({ title, children, action, className = '' }: { title: string; children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col ${className}`}>
      <div className="flex min-h-12 items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <h2 className="text-sm font-bold text-slate-950">{title}</h2>
        {action}
      </div>
      <div className="flex-1">
        {children}
      </div>
    </section>
  )
}

function LineTrendChart({ points }: { points: Array<{ date: string; created: number; closed: number }> }) {
  if (!points.length) return <div className="p-8 text-center text-sm text-slate-500">데이터가 없습니다.</div>
  const width = 760
  const height = 218
  const padX = 42
  const padY = 28
  const max = Math.max(1, ...points.flatMap((point) => [point.created, point.closed]))
  const step = points.length > 1 ? (width - padX * 2) / (points.length - 1) : 1
  const yFor = (value: number) => height - padY - (value / max) * (height - padY * 2)
  const toPoints = (key: 'created' | 'closed') => points.map((point, index) => `${padX + step * index},${yFor(point[key])}`).join(' ')
  const last = points[points.length - 1]
  const lastX = padX + step * Math.max(0, points.length - 1)

  return (
    <div className="px-4 pb-4 pt-3">
      <div className="mb-2 flex justify-end gap-5 text-xs font-semibold text-slate-600">
        <span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-rose-500" />유입 (신규)</span>
        <span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-500" />처리 (완료)</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[218px] w-full" role="img" aria-label="기간별 이슈 추이">
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = height - padY - ratio * (height - padY * 2)
          return (
            <g key={ratio}>
              <line x1={padX} x2={width - padX} y1={y} y2={y} className="stroke-slate-200" strokeDasharray="3 4" />
              <text x={12} y={y + 4} fontSize="11" className="fill-slate-500">{Math.round(max * ratio)}</text>
            </g>
          )
        })}
        <polyline fill="none" className="stroke-rose-500" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" points={toPoints('created')} />
        <polyline fill="none" className="stroke-emerald-500" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" points={toPoints('closed')} />
        {points.map((point, index) => {
          const x = padX + step * index
          return (
            <g key={index}>
              <circle cx={x} cy={yFor(point.created)} r="3.5" className="fill-rose-500" />
              <circle cx={x} cy={yFor(point.closed)} r="3.5" className="fill-emerald-500" />
              <text x={x} y={height - 5} textAnchor="middle" fontSize="11" className="fill-slate-500">{point.date.substring(5)}</text>
            </g>
          )
        })}
        <text x={lastX + 12} y={yFor(last.created) + 4} fontSize="12" className="fill-rose-700 font-bold">{last.created}</text>
        <text x={lastX + 12} y={yFor(last.closed) + 4} fontSize="12" className="fill-emerald-700 font-bold">{last.closed}</text>
      </svg>
    </div>
  )
}

function VelocityChart({ weeks }: { weeks: VelocityResponse['weeks'] }) {
  if (!weeks.length) return <div className="p-8 text-center text-sm text-slate-500">데이터가 없습니다.</div>
  const maxVal = Math.max(1, ...weeks.flatMap(w => [w.created, w.closed]))
  const barW = 20
  const gap = 8
  const chartW = weeks.length * (barW * 2 + gap + 4)
  const chartH = 120

  return (
    <div className="overflow-x-auto px-4 pb-4 pt-2">
      <div className="flex justify-end gap-4 text-xs font-bold text-slate-500 mb-2">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-rose-400" />생성</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-400" />해결</span>
      </div>
      <svg viewBox={`0 0 ${chartW} ${chartH + 20}`} className="w-full" style={{ minWidth: chartW }}>
        {weeks.map((w, i) => {
          const x = i * (barW * 2 + gap + 4)
          const createdH = (w.created / maxVal) * chartH
          const closedH = (w.closed / maxVal) * chartH
          return (
            <g key={w.week}>
              <rect x={x} y={chartH - createdH} width={barW} height={createdH} rx="3" fill="#fb7185" />
              <rect x={x + barW + 3} y={chartH - closedH} width={barW} height={closedH} rx="3" fill="#34d399" />
              <text x={x + barW} y={chartH + 14} textAnchor="middle" fontSize="10" fill="#64748b">{w.week}</text>
            </g>
          )
        })}
        <line x1={0} x2={chartW} y1={chartH} y2={chartH} stroke="#e2e8f0" strokeWidth="1" />
      </svg>
    </div>
  )
}

function AgeDistChart({ distribution }: { distribution: Record<string, number> }) {
  const entries = Object.entries(distribution)
  const max = Math.max(1, ...entries.map(([, v]) => v))
  const colors = ['#818cf8', '#60a5fa', '#34d399', '#fbbf24', '#f87171']
  return (
    <div className="space-y-3 px-4 py-5">
      {entries.map(([label, count], idx) => (
        <div key={label} className="flex items-center gap-3">
          <span className="w-16 shrink-0 text-xs font-bold text-slate-500">{label}</span>
          <div className="flex-1 h-3 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${(count / max) * 100}%`, background: colors[idx % colors.length] }} />
          </div>
          <span className="w-10 text-right text-sm font-black text-slate-700">{count}</span>
        </div>
      ))}
    </div>
  )
}

function SimpleDistribution({ data, icon: Icon, colorClass }: { data: Record<string, number>, icon: any, colorClass: string }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1])
  if (entries.length === 0) return <div className="p-4 text-sm text-slate-500">데이터가 없습니다.</div>
  
  return (
    <div className="px-4 py-4 space-y-3">
      {entries.map(([key, count]) => (
        <div key={key} className="flex items-center justify-between border-b border-slate-50 pb-2 last:border-0 last:pb-0">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-lg ${colorClass} bg-opacity-10`}>
              <Icon size={14} className={colorClass} />
            </div>
            <span className="text-sm font-semibold text-slate-800">{key}</span>
          </div>
          <span className="text-sm font-black text-slate-600">{count}</span>
        </div>
      ))}
    </div>
  )
}

export default function ReportsPage() {
  const { projectId, projectName, issueList, loading, error, lastSynced } = useDashboardProjectContext()
  const [range, setRange] = useState<ReportRange>('7d')
  
  const [velocity, setVelocity] = useState<VelocityResponse | null>(null)
  const [distribution, setDistribution] = useState<DistributionResponse | null>(null)
  const [trend, setTrend] = useState<TrendResponse | null>(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(true)

  const loadAnalytics = useCallback(async () => {
    setAnalyticsLoading(true)
    try {
      const days = RANGE_OPTIONS.find(o => o.id === range)?.days ?? 7
      const [v, d, t] = await Promise.all([
        fetchVelocity(projectId),
        fetchDistribution(projectId),
        fetchTrend(projectId, days)
      ])
      setVelocity(v)
      setDistribution(d)
      setTrend(t)
    } catch {
      // ignore
    } finally {
      setAnalyticsLoading(false)
    }
  }, [projectId, range])

  useEffect(() => {
    loadAnalytics()
  }, [loadAnalytics])

  const issues = useMemo(() => issueList?.issues ?? [], [issueList])
  const activeIssues = useMemo(() => issues.filter(i => i.status_group !== 'closed'), [issues])

  const risks = useMemo(() => {
    const overdue = activeIssues.filter(i => i.is_overdue).length
    const dueSoon = activeIssues.filter(i => i.is_due_soon).length
    const highPriority = activeIssues.filter(i => ['Immediate', 'Urgent', 'High'].includes(i.priority ?? '')).length
    const unassigned = activeIssues.filter(i => i.assigned_to_id === null).length

    return [
      { label: '기한 초과 (Overdue)', count: overdue, tone: overdue > 0 ? 'danger' as const : 'neutral' as const },
      { label: '마감 임박 (Due soon)', count: dueSoon, tone: dueSoon > 0 ? 'warning' as const : 'neutral' as const },
      { label: '높은 우선순위 (High+)', count: highPriority, tone: highPriority > 0 ? 'warning' as const : 'neutral' as const },
      { label: '담당자 미지정', count: unassigned, tone: unassigned > 0 ? 'warning' as const : 'neutral' as const },
    ].sort((left, right) => right.count - left.count).slice(0, 4)
  }, [activeIssues])

  const handlePrint = () => window.print()

  if (!loading && error) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
        데이터를 불러오지 못했습니다. {error}
      </div>
    )
  }

  if (loading || analyticsLoading || !trend || !velocity || !distribution) {
    return (
      <div className="space-y-4">
        <div className="h-20 animate-pulse rounded-2xl bg-slate-200/50" />
        <div className="grid grid-cols-4 gap-4"><div className="h-32 animate-pulse rounded-2xl bg-slate-200/50" /><div className="h-32 animate-pulse rounded-2xl bg-slate-200/50" /><div className="h-32 animate-pulse rounded-2xl bg-slate-200/50" /><div className="h-32 animate-pulse rounded-2xl bg-slate-200/50" /></div>
        <div className="h-96 animate-pulse rounded-2xl bg-slate-200/50" />
      </div>
    )
  }

  // 지표 계산
  const totalCreated = trend.trend.reduce((acc, t) => acc + t.created, 0)
  const totalClosed = trend.trend.reduce((acc, t) => acc + t.closed, 0)
  const currentActive = trend.trend[trend.trend.length - 1]?.active ?? 0
  const avgVelocity = velocity.avg_velocity

  return (
    <div className="space-y-4 pb-8">
      {/* ── 상단 헤더 ── */}
      <section className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Activity size={16} className="text-blue-500" />
            <span className="text-xs font-bold uppercase tracking-widest text-slate-400">데이터 분석 리포트</span>
          </div>
          <h1 className="text-xl font-black tracking-tight text-slate-900">{projectName}</h1>
          <p className="mt-1 text-sm text-slate-500">
            마지막 동기화: {formatDateTime(lastSynced)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option.id}
                onClick={() => setRange(option.id)}
                className={`h-8 rounded-lg px-4 text-xs font-bold transition-colors ${
                  range === option.id ? 'bg-white text-blue-700 shadow-sm border border-slate-200/50' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <button onClick={handlePrint} className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors">
            PDF 내보내기
          </button>
        </div>
      </section>

      {/* ── 요약 KPI ── */}
      <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-4">
        <MetricCard
          icon={<AlertTriangle size={20} />}
          title="신규 유입 이슈"
          subtitle={`${range.replace('d', '일')} 동안 접수됨`}
          value={`${totalCreated}건`}
          tone="orange"
          sparkline={trend.trend.map(t => t.created)}
        />
        <MetricCard
          icon={<CheckCircle size={20} />}
          title="해결 완료 이슈"
          subtitle={`${range.replace('d', '일')} 동안 처리됨`}
          value={`${totalClosed}건`}
          tone="emerald"
          sparkline={trend.trend.map(t => t.closed)}
        />
        <MetricCard
          icon={<TrendingUp size={20} />}
          title="평균 주간 벨로시티"
          subtitle="최근 8주 평균 처리량"
          value={`${avgVelocity}건/주`}
          tone="blue"
          sparkline={velocity.weeks.map(w => w.closed)}
        />
        <MetricCard
          icon={<Target size={20} />}
          title="현재 활성 이슈"
          subtitle="처리 대기/진행 중"
          value={`${currentActive}건`}
          tone="violet"
          sparkline={trend.trend.map(t => t.active)}
        />
      </div>

      {/* ── 메인 차트 ── */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.8fr)_minmax(320px,0.8fr)]">
        <Section className="min-h-[300px]" title={`${range.replace('d', '일')} 이슈 발생 및 해결 추이`}>
          <LineTrendChart points={trend.trend} />
        </Section>
        <Section title="현재 발견된 리스크 신호">
          <div className="p-4 space-y-3">
            {risks.map((risk, index) => (
              <div key={risk.label} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50">
                <div className="flex items-center gap-3">
                  <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                    risk.tone === 'danger' ? 'bg-rose-100 text-rose-700' : 
                    risk.tone === 'warning' ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {index + 1}
                  </span>
                  <span className="text-sm font-bold text-slate-800">{risk.label}</span>
                </div>
                <div className="text-right">
                  <span className={`text-lg font-black ${
                    risk.tone === 'danger' ? 'text-rose-600' : 
                    risk.tone === 'warning' ? 'text-amber-600' : 'text-slate-500'
                  }`}>{risk.count}</span>
                  <span className="text-xs text-slate-400 ml-1">건</span>
                </div>
              </div>
            ))}
            {risks.every(r => r.count === 0) && (
              <div className="text-center py-6 text-sm text-slate-500">
                현재 확인된 주요 리스크가 없습니다 🎉
              </div>
            )}
          </div>
        </Section>
      </div>

      {/* ── 서브 차트 및 분포 ── */}
      <div className="grid gap-4 xl:grid-cols-3">
        <Section title={`주간 팀 벨로시티 (8주)`}>
          <VelocityChart weeks={velocity.weeks} />
        </Section>
        <Section title="활성 이슈 연령 분포">
          <AgeDistChart distribution={distribution.age_distribution} />
        </Section>
        <div className="space-y-4">
          <Section title="우선순위 분포">
            <SimpleDistribution data={distribution.by_priority} icon={AlertTriangle} colorClass="text-rose-500" />
          </Section>
          <Section title="트래커 분포">
            <SimpleDistribution data={distribution.by_tracker} icon={Type} colorClass="text-blue-500" />
          </Section>
        </div>
      </div>

      {/* ── 담당자 성과 ── */}
      {distribution.top_assignees.length > 0 && (
        <Section title="팀 멤버별 성과 지표">
          <div className="overflow-x-auto px-4 py-3">
            <table className="w-full text-left text-sm">
              <thead className="border-y border-slate-100 bg-slate-50 text-xs font-bold text-slate-500">
                <tr>
                  <th className="px-3 py-2">담당자</th>
                  <th className="px-3 py-2 text-center">할당된 총 이슈</th>
                  <th className="px-3 py-2 text-center">해결 완료</th>
                  <th className="px-3 py-2 text-center">기한 초과</th>
                  <th className="px-3 py-2 text-center">해결률</th>
                  <th className="px-3 py-2 min-w-[120px]">성과 바</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {distribution.top_assignees.map(a => (
                  <tr key={a.name} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-[10px] font-black text-blue-700">
                          {a.name.slice(0, 1)}
                        </span>
                        <span className="font-bold text-slate-800">{a.name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center font-bold text-slate-600">{a.total}</td>
                    <td className="px-3 py-3 text-center font-bold text-emerald-600">{a.closed}</td>
                    <td className="px-3 py-3 text-center">
                      {a.overdue > 0 ? (
                        <span className="inline-flex items-center gap-1 font-bold text-rose-500 bg-rose-50 px-2 py-0.5 rounded-md">
                          {a.overdue}
                        </span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <Badge tone={a.close_rate >= 80 ? 'success' : a.close_rate >= 50 ? 'warning' : 'neutral'} size="sm">
                        {a.close_rate}%
                      </Badge>
                    </td>
                    <td className="px-3 py-3">
                      <div className="h-2 w-full max-w-[160px] rounded-full bg-slate-100 overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${a.close_rate >= 80 ? 'bg-emerald-400' : a.close_rate >= 50 ? 'bg-amber-400' : 'bg-slate-400'}`} 
                          style={{ width: `${a.close_rate}%` }} 
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}
    </div>
  )
}
