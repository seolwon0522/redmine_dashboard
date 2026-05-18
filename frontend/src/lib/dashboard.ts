export { applyDashboardFilter, evaluateIssueRisk, getIssueSignals, isHighPriorityIssue, matchesIssuePreset } from '@/lib/dashboard/thresholds'
export { buildDashboardModel } from '@/lib/dashboard/model'
export {
  DASHBOARD_SETTINGS_STORAGE_KEY,
  DEFAULT_DASHBOARD_SETTINGS,
  MAX_RECENT_PROJECTS,
  getPresetLabel,
  getPresetSettings,
  normalizeDashboardSettings,
  RECENT_PROJECTS_STORAGE_KEY,
} from '@/lib/dashboard/settings'
export { summarizeAssigneeJournalActivity } from '@/lib/dashboard/insights'

export type {
  ActionBucketModel,
  AgingBucketModel,
  AssigneeEvidenceMetric,
  AssigneeJournalInsight,
  AssigneeTendencyInsight,
  AssigneeTendencyTag,
  CapacityMemberModel,
  DashboardModel,
  DashboardScoreWeights,
  DashboardSummaryViewModel,
  DashboardThresholdSettings,
  DashboardTone,
  DecisionGuidanceModel,
  DerivedIssueRisk,
  ExplorerPresetModel,
  HealthModel,
  HealthScoreBreakdown,
  IssueSignal,
  KpiCardModel,
  MetricTrendModel,
  ScoreFactor,
  StableOperationalState,
  StatusSnapshotItem,
  StatusSnapshotModel,
  ThresholdPresetMode,
  TrendDirection,
  WeeklyFlowPoint,
} from '@/types/dashboard-derived'