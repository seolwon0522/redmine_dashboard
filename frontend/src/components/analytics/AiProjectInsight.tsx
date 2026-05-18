'use client'

import React, { useEffect, useState } from 'react'
import { Sparkles, ArrowRight, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react'
import { fetchAiSummary, type AiSummaryResponse } from '@/lib/api'

export default function AiProjectInsight({ projectId }: { projectId: string }) {
  const [data, setData] = useState<AiSummaryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchAiSummary(projectId)
      setData(res)
    } catch (err: any) {
      setError(err.message || 'AI 요약을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [projectId])

  if (loading) {
    return (
      <div className="animate-pulse rounded-3xl border border-blue-100 bg-blue-50/30 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-5 w-5 rounded-full bg-blue-200" />
          <div className="h-4 w-32 rounded bg-blue-200" />
        </div>
        <div className="space-y-2">
          <div className="h-4 w-full rounded bg-blue-100" />
          <div className="h-4 w-5/6 rounded bg-blue-100" />
        </div>
      </div>
    )
  }

  if (error || !data) return null

  return (
    <div className="group relative overflow-hidden rounded-[32px] border border-blue-200 bg-white p-6 shadow-sm transition-all hover:shadow-md">
      {/* Background Decor */}
      <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-blue-50 opacity-50 blur-3xl group-hover:bg-blue-100 transition-colors" />
      
      <div className="relative flex flex-col md:flex-row gap-6">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-200">
                <Sparkles size={16} />
              </div>
              <span className="text-sm font-black text-slate-900">AI 운영 인사이트</span>
              <div className="ml-2 flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-600">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-blue-500"></span>
                </span>
                LIVE
              </div>
            </div>
            <button 
              onClick={loadData}
              className="text-slate-400 hover:text-blue-600 transition-colors"
              title="새로고침"
            >
              <RefreshCw size={14} />
            </button>
          </div>

          <p className="text-base font-bold leading-relaxed text-slate-800">
            {data.summary}
          </p>

          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {data.recommendations.map((rec, i) => (
              <div key={i} className="flex items-start gap-2.5 rounded-2xl bg-slate-50 p-3 transition-colors hover:bg-blue-50/50">
                <div className="mt-0.5 shrink-0 text-blue-500">
                  <CheckCircle2 size={14} />
                </div>
                <span className="text-xs font-semibold text-slate-600 leading-tight">{rec}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="shrink-0 flex flex-col items-center justify-center md:border-l border-slate-100 md:pl-8 md:min-w-[160px]">
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">건강 지수</div>
          <div className="relative flex items-center justify-center">
            <svg className="h-20 w-20 -rotate-90">
              <circle cx="40" cy="40" r="34" fill="none" stroke="#f1f5f9" strokeWidth="8" />
              <circle 
                cx="40" cy="40" r="34" 
                fill="none" 
                stroke={data.health_score > 70 ? '#3b82f6' : data.health_score > 40 ? '#f59e0b' : '#ef4444'} 
                strokeWidth="8" 
                strokeDasharray={`${2 * Math.PI * 34}`}
                strokeDashoffset={`${2 * Math.PI * 34 * (1 - data.health_score / 100)}`}
                strokeLinecap="round"
                className="transition-all duration-1000 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-2xl font-black text-slate-900">{data.health_score}</span>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1.5">
             {data.health_score > 70 ? (
               <Badge tone="success">안정</Badge>
             ) : data.health_score > 40 ? (
               <Badge tone="warning">주의</Badge>
             ) : (
               <Badge tone="danger">위험</Badge>
             )}
          </div>
        </div>
      </div>
    </div>
  )
}

function Badge({ children, tone }: { children: React.ReactNode, tone: 'success' | 'warning' | 'danger' }) {
  const styles = {
    success: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
    warning: 'bg-amber-50 text-amber-600 ring-amber-100',
    danger: 'bg-rose-50 text-rose-600 ring-rose-100'
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-black ring-1 ring-inset ${styles[tone]}`}>
      {children}
    </span>
  )
}
