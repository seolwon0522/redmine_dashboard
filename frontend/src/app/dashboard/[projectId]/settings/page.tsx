'use client'

import SettingsOverviewSection from '@/components/settings/SettingsOverviewSection'
import { useDashboardProjectContext } from '@/components/shell/DashboardProjectLayout'

function SkeletonBlock({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-xl bg-slate-200 ${className}`} />
}

export default function DashboardSettingsPage() {
  const {
    loading,
    error,
    settings,
    onResetSettings,
    onApplySettingsPreset,
    onChangeSetting,
    onChangeWeight,
  } = useDashboardProjectContext()

  if (!loading && error) {
    return (
      <div className="max-w-xl rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700 shadow-sm shadow-slate-200/25">
        <div className="font-semibold">설정 화면 데이터를 불러오지 못했습니다.</div>
        <div className="mt-1 text-xs text-rose-600">{error}</div>
      </div>
    )
  }

  return (
    <>
      {loading ? (
        <>
          <SkeletonBlock className="h-28" />
          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <SkeletonBlock className="h-[760px]" />
            <div className="space-y-6">
              <SkeletonBlock className="h-[220px]" />
              <SkeletonBlock className="h-[220px]" />
            </div>
          </div>
        </>
      ) : (
        <SettingsOverviewSection
          settings={settings}
          onReset={onResetSettings}
          onApplyPreset={onApplySettingsPreset}
          onChangeSetting={onChangeSetting}
          onChangeWeight={onChangeWeight}
        />
      )}
    </>
  )
}
