import { Settings, Save, RotateCcw, SlidersHorizontal, AlertTriangle, Clock, Zap } from 'lucide-react'
import type { DashboardThresholdSettings, ThresholdPresetMode } from '@/types/dashboard-derived'

type SettingsOverviewSectionProps = {
  projectId?: string
  settings?: DashboardThresholdSettings
  onReset?: () => void
  onApplyPreset?: (preset: ThresholdPresetMode) => void
  onChangeSetting?: <K extends keyof Omit<DashboardThresholdSettings, 'weights'>>(
    key: K,
    value: DashboardThresholdSettings[K]
  ) => void
  onChangeWeight?: (key: keyof DashboardThresholdSettings['weights'], value: number) => void
}

export function SettingsOverviewSection({
  projectId,
  settings,
  onReset,
  onApplyPreset,
  onChangeSetting,
}: SettingsOverviewSectionProps) {
  if (!settings) return null

  const handleSliderChange = (key: keyof Omit<DashboardThresholdSettings, 'weights' | 'presetMode'>, e: React.ChangeEvent<HTMLInputElement>) => {
    if (onChangeSetting) {
      onChangeSetting(key, Number(e.target.value) as any)
    }
  }

  const presets: { id: ThresholdPresetMode; label: string; desc: string }[] = [
    { id: 'default', label: '기본 (권장)', desc: '일반적인 프로젝트 속도에 맞춘 균형 잡힌 기준입니다.' },
    { id: 'conservative', label: '보수적 (엄격)', desc: '지연과 정체를 빠르게 경고하여 리스크를 최소화합니다.' },
    { id: 'relaxed', label: '여유로움 (장기)', desc: '호흡이 긴 프로젝트에 적합하게 경고 발생을 늦춥니다.' },
    { id: 'custom', label: '사용자 지정', desc: '직접 설정한 세부 기준을 사용합니다.' },
  ]

  return (
    <section className="space-y-6 pb-8">
      {/* 헤더 */}
      <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Settings size={16} className="text-blue-500" />
            <span className="text-xs font-bold uppercase tracking-widest text-slate-400">기준 설정</span>
          </div>
          <h1 className="text-xl font-black tracking-tight text-slate-900">대시보드 운영 기준</h1>
          <p className="mt-1 text-sm text-slate-500">
            {projectId ? `${projectId} 프로젝트의 ` : ''}위험 지표 판별 기준과 알림 민감도를 조정합니다.
          </p>
        </div>
        <button
          onClick={onReset}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
        >
          <RotateCcw size={16} />
          초기화
        </button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_2fr]">
        {/* 프리셋 선택 */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-4">
              <SlidersHorizontal size={18} className="text-slate-700" />
              <h2 className="text-base font-bold text-slate-900">프리셋 모드</h2>
            </div>
            <div className="mt-4 space-y-3">
              {presets.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => onApplyPreset?.(preset.id)}
                  className={`w-full text-left rounded-xl border p-4 transition-all ${
                    settings.presetMode === preset.id
                      ? 'border-blue-500 bg-blue-50/50 ring-1 ring-blue-500'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`font-bold ${settings.presetMode === preset.id ? 'text-blue-700' : 'text-slate-900'}`}>
                      {preset.label}
                    </span>
                    {settings.presetMode === preset.id && (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-white">
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </span>
                    )}
                  </div>
                  <p className={`mt-1 text-xs ${settings.presetMode === preset.id ? 'text-blue-600/80' : 'text-slate-500'}`}>
                    {preset.desc}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 상세 설정 슬라이더 */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/50 px-5 py-4">
              <AlertTriangle size={18} className="text-amber-500" />
              <h2 className="text-base font-bold text-slate-900">리스크 및 알림 민감도 설정</h2>
            </div>
            <div className="divide-y divide-slate-100 p-5">
              
              <div className="py-4 first:pt-0 last:pb-0">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">이슈 정체 기준 (Stale Days)</h3>
                    <p className="mt-1 text-xs text-slate-500">이 기간 동안 업데이트가 없으면 '정체' 상태로 간주하여 경고합니다.</p>
                  </div>
                  <div className="rounded-lg bg-slate-100 px-3 py-1 text-sm font-black text-slate-700">
                    {settings.staleDays}일
                  </div>
                </div>
                <input
                  type="range"
                  min="1" max="30"
                  value={settings.staleDays}
                  onChange={(e) => handleSliderChange('staleDays', e)}
                  className="w-full accent-blue-500 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div className="py-4 first:pt-0 last:pb-0">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">마감 임박 기준 (Due Soon Days)</h3>
                    <p className="mt-1 text-xs text-slate-500">마감일이 이 기준 일수 내로 들어오면 '임박' 상태로 강조 표시합니다.</p>
                  </div>
                  <div className="rounded-lg bg-slate-100 px-3 py-1 text-sm font-black text-slate-700">
                    {settings.dueSoonDays}일
                  </div>
                </div>
                <input
                  type="range"
                  min="1" max="14"
                  value={settings.dueSoonDays}
                  onChange={(e) => handleSliderChange('dueSoonDays', e)}
                  className="w-full accent-amber-500 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div className="py-4 first:pt-0 last:pb-0">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">담당자 과부하 기준 (Overload Threshold)</h3>
                    <p className="mt-1 text-xs text-slate-500">한 담당자가 이 개수 이상의 이슈를 처리 중이면 부하가 높은 것으로 판단합니다.</p>
                  </div>
                  <div className="rounded-lg bg-slate-100 px-3 py-1 text-sm font-black text-slate-700">
                    {settings.overloadThreshold}건
                  </div>
                </div>
                <input
                  type="range"
                  min="3" max="20"
                  value={settings.overloadThreshold}
                  onChange={(e) => handleSliderChange('overloadThreshold', e)}
                  className="w-full accent-rose-500 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div className="py-4 first:pt-0 last:pb-0">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">장기 지연 기준 (Long Overdue Days)</h3>
                    <p className="mt-1 text-xs text-slate-500">마감일을 이 기준 이상 초과하면 심각한 장기 지연으로 분류됩니다.</p>
                  </div>
                  <div className="rounded-lg bg-slate-100 px-3 py-1 text-sm font-black text-slate-700">
                    {settings.longOverdueDays}일
                  </div>
                </div>
                <input
                  type="range"
                  min="3" max="60"
                  value={settings.longOverdueDays}
                  onChange={(e) => handleSliderChange('longOverdueDays', e)}
                  className="w-full accent-rose-600 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>

            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default SettingsOverviewSection
