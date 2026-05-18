import type { DashboardThresholdSettings, ThresholdPresetMode } from '@/types/dashboard-derived'

export const DASHBOARD_SETTINGS_STORAGE_KEY = 'redmine-dashboard-threshold-settings'
export const RECENT_PROJECTS_STORAGE_KEY = 'redmine-dashboard-recent-projects'
export const MAX_RECENT_PROJECTS = 5

const PRESET_SETTINGS: Record<Exclude<ThresholdPresetMode, 'custom'>, DashboardThresholdSettings> = {
  conservative: {
    presetMode: 'conservative',
    staleDays: 5,
    dueSoonDays: 7,
    recentActivityDays: 3,
    recentCompletionDays: 7,
    overloadThreshold: 4,
    longOverdueDays: 10,
    weights: {
      overduePenalty: 7,
      longOverduePenalty: 4,
      stalePenalty: 3,
      unassignedPenalty: 5,
      dueSoonPenalty: 2,
      recentCompletionBonus: 2,
      flowBalanceWeight: 2,
    },
  },
  default: {
    presetMode: 'default',
    staleDays: 7,
    dueSoonDays: 5,
    recentActivityDays: 3,
    recentCompletionDays: 7,
    overloadThreshold: 5,
    longOverdueDays: 14,
    weights: {
      overduePenalty: 5,
      longOverduePenalty: 3,
      stalePenalty: 2,
      unassignedPenalty: 4,
      dueSoonPenalty: 1,
      recentCompletionBonus: 2,
      flowBalanceWeight: 1,
    },
  },
  relaxed: {
    presetMode: 'relaxed',
    staleDays: 10,
    dueSoonDays: 3,
    recentActivityDays: 5,
    recentCompletionDays: 10,
    overloadThreshold: 7,
    longOverdueDays: 21,
    weights: {
      overduePenalty: 4,
      longOverduePenalty: 2,
      stalePenalty: 1,
      unassignedPenalty: 3,
      dueSoonPenalty: 1,
      recentCompletionBonus: 1,
      flowBalanceWeight: 1,
    },
  },
}

export const DEFAULT_DASHBOARD_SETTINGS = getPresetSettings('default')

export function getPresetSettings(mode: Exclude<ThresholdPresetMode, 'custom'>): DashboardThresholdSettings {
  return JSON.parse(JSON.stringify(PRESET_SETTINGS[mode])) as DashboardThresholdSettings
}

export function getPresetLabel(mode: ThresholdPresetMode): string {
  if (mode === 'conservative') return '보수적'
  if (mode === 'relaxed') return '완화'
  if (mode === 'custom') return '사용자 지정'
  return '기본'
}

export function normalizeDashboardSettings(
  value: Partial<DashboardThresholdSettings> | null | undefined,
): DashboardThresholdSettings {
  const base = getPresetSettings('default')
  if (!value) return base

  const recentActivityDays = clampInteger(value.recentActivityDays, 1, 21, base.recentActivityDays)
  const staleDays = Math.max(recentActivityDays + 1, clampInteger(value.staleDays, 3, 30, base.staleDays))
  const longOverdueDays = Math.max(staleDays + 1, clampInteger(value.longOverdueDays, 3, 45, base.longOverdueDays))

  return {
    presetMode: value.presetMode ?? base.presetMode,
    staleDays,
    dueSoonDays: clampInteger(value.dueSoonDays, 1, 21, base.dueSoonDays),
    recentActivityDays,
    recentCompletionDays: clampInteger(value.recentCompletionDays, 1, 30, base.recentCompletionDays),
    overloadThreshold: clampInteger(value.overloadThreshold, 1, 20, base.overloadThreshold),
    longOverdueDays,
    weights: {
      overduePenalty: clampInteger(value.weights?.overduePenalty, 0, 15, base.weights.overduePenalty),
      longOverduePenalty: clampInteger(value.weights?.longOverduePenalty, 0, 10, base.weights.longOverduePenalty),
      stalePenalty: clampInteger(value.weights?.stalePenalty, 0, 10, base.weights.stalePenalty),
      unassignedPenalty: clampInteger(value.weights?.unassignedPenalty, 0, 10, base.weights.unassignedPenalty),
      dueSoonPenalty: clampInteger(value.weights?.dueSoonPenalty, 0, 10, base.weights.dueSoonPenalty),
      recentCompletionBonus: clampInteger(value.weights?.recentCompletionBonus, 0, 10, base.weights.recentCompletionBonus),
      flowBalanceWeight: clampInteger(value.weights?.flowBalanceWeight, 0, 10, base.weights.flowBalanceWeight),
    },
  }
}

function clampInteger(value: number | undefined, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return fallback
  return Math.min(max, Math.max(min, Math.round(value)))
}