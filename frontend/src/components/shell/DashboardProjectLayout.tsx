'use client'

import type { ReactNode } from 'react'
import { createContext, useCallback, useContext, useMemo, useState } from 'react'

import useDashboardProjectData from '@/hooks/useDashboardProjectData'
import { buildDashboardModel } from '@/lib/dashboard'
import {
  DEFAULT_DASHBOARD_SETTINGS,
  getPresetSettings,
  normalizeDashboardSettings,
} from '@/lib/dashboard/settings'
import type { DashboardSummary, IssueListResponse } from '@/types/dashboard'
import type { DashboardThresholdSettings, ThresholdPresetMode } from '@/types/dashboard-derived'

type DashboardModel = ReturnType<typeof buildDashboardModel>

type DashboardProjectContextValue = {
  projectId: string
  projectName: string
  summary: DashboardSummary | null
  issueList: IssueListResponse | null
  model: DashboardModel | null
  loading: boolean
  error: string | null
  settings: DashboardThresholdSettings
  lastSynced: Date | null
  onResetSettings: () => void
  onApplySettingsPreset: (presetId: ThresholdPresetMode | string) => void
  onChangeSetting: <K extends keyof Omit<DashboardThresholdSettings, 'weights'>>(
    key: K,
    value: DashboardThresholdSettings[K],
  ) => void
  onChangeWeight: (key: keyof DashboardThresholdSettings['weights'], value: number) => void
}

const DashboardProjectContext = createContext<DashboardProjectContextValue | null>(null)

type DashboardProjectLayoutProps = {
  projectId: string
  children: ReactNode
}

export function useDashboardProjectContext() {
  const context = useContext(DashboardProjectContext)

  if (!context) {
    throw new Error('useDashboardProjectContext must be used within DashboardProjectLayout')
  }

  return context
}

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function isPresetMode(mode: string): mode is Exclude<ThresholdPresetMode, 'custom'> {
  return mode === 'conservative' || mode === 'default' || mode === 'relaxed'
}

export function DashboardProjectLayout({ projectId, children }: DashboardProjectLayoutProps) {
  const { summary, issueList, loading, error } = useDashboardProjectData(projectId)

  const [settings, setSettings] = useState<DashboardThresholdSettings>(() =>
    normalizeDashboardSettings(DEFAULT_DASHBOARD_SETTINGS),
  )

  const model = useMemo(() => {
    if (!summary || !issueList?.issues) return null
    return buildDashboardModel(summary, issueList.issues, settings)
  }, [summary, issueList, settings])

  const lastSynced = useMemo(() => {
    return toDate(summary?.cached_at)
  }, [summary?.cached_at])

  const onResetSettings = useCallback(() => {
    setSettings(normalizeDashboardSettings(DEFAULT_DASHBOARD_SETTINGS))
  }, [])

  const onApplySettingsPreset = useCallback((presetId: ThresholdPresetMode | string) => {
    if (isPresetMode(presetId)) {
      setSettings(getPresetSettings(presetId))
      return
    }

    setSettings(normalizeDashboardSettings(DEFAULT_DASHBOARD_SETTINGS))
  }, [])

  const onChangeSetting = useCallback(
    <K extends keyof Omit<DashboardThresholdSettings, 'weights'>>(
      key: K,
      value: DashboardThresholdSettings[K],
    ) => {
      setSettings((prev) =>
        normalizeDashboardSettings({
          ...prev,
          presetMode: 'custom',
          [key]: value,
        }),
      )
    },
    [],
  )

  const onChangeWeight = useCallback(
    (key: keyof DashboardThresholdSettings['weights'], value: number) => {
      setSettings((prev) =>
        normalizeDashboardSettings({
          ...prev,
          presetMode: 'custom',
          weights: {
            ...prev.weights,
            [key]: value,
          },
        }),
      )
    },
    [],
  )

  const value = useMemo<DashboardProjectContextValue>(
    () => ({
      projectId,
      projectName: projectId,
      summary,
      issueList,
      model,
      loading,
      error,
      settings,
      lastSynced,
      onResetSettings,
      onApplySettingsPreset,
      onChangeSetting,
      onChangeWeight,
    }),
    [
      projectId,
      summary,
      issueList,
      model,
      loading,
      error,
      settings,
      lastSynced,
      onResetSettings,
      onApplySettingsPreset,
      onChangeSetting,
      onChangeWeight,
    ],
  )

  return (
    <DashboardProjectContext.Provider value={value}>
      <div className="min-h-screen bg-slate-50">
        {children}
      </div>
    </DashboardProjectContext.Provider>
  )
}

export default DashboardProjectLayout