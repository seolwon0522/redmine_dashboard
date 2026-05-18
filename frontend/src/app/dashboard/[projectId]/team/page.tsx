'use client'

import TeamOverviewSection from '@/components/team/TeamOverviewSection'
import { useDashboardProjectContext } from '@/components/shell/DashboardProjectLayout'

function SkeletonBlock({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-xl bg-slate-200 ${className}`} />
}

export default function DashboardTeamPage() {
  const { projectId, issueList, model, loading, error, settings } = useDashboardProjectContext()

  if (!loading && error) {
    return (
      <div className="max-w-xl rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700 shadow-sm shadow-slate-200/25">
        <div className="font-semibold">팀 화면 데이터를 불러오지 못했습니다.</div>
        <div className="mt-1 text-xs text-rose-600">{error}</div>
      </div>
    )
  }

  return (
    <>
      {model ? (
        <TeamOverviewSection
          projectId={projectId}
          issues={issueList?.issues ?? []}
          model={model}
          settings={settings}
        />
      ) : (
        <>
          <SkeletonBlock className="h-28" />
          <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <SkeletonBlock className="h-[320px]" />
            <SkeletonBlock className="h-[320px]" />
          </div>
          <SkeletonBlock className="h-[280px]" />
        </>
      )}
    </>
  )
}
