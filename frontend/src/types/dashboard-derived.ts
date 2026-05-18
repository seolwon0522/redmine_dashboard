import type { AssigneeFilter, IssueDetail, IssueListItem, IssuePreset } from '@/types/dashboard'

export type DashboardTone = 'neutral' | 'info' | 'warning' | 'danger' | 'success'

export type ThresholdPresetMode = 'conservative' | 'default' | 'relaxed' | 'custom'

export interface DashboardScoreWeights {
  overduePenalty: number
  longOverduePenalty: number
  stalePenalty: number
  unassignedPenalty: number
  dueSoonPenalty: number
  recentCompletionBonus: number
  flowBalanceWeight: number
}

export interface DashboardThresholdSettings {
  presetMode: ThresholdPresetMode
  staleDays: number
  dueSoonDays: number
  recentActivityDays: number
  recentCompletionDays: number
  overloadThreshold: number
  longOverdueDays: number
  weights: DashboardScoreWeights
}

export interface DerivedIssueRisk {
  issueId: number
  isActive: boolean
  isOverdue: boolean
  isLongOverdue: boolean
  isDueSoon: boolean
  isStale: boolean
  isRecentlyUpdated: boolean
  isRecentlyCompleted: boolean
  needsAttention: boolean
  daysOverdue: number
  daysUntilDue: number | null
  daysSinceUpdate: number | null
  daysSinceCreated: number | null
}

export interface IssueSignal {
  label: string
  tone: DashboardTone
}

export interface ScoreFactor {
  id: string
  label: string
  tone: DashboardTone
  kind: 'penalty' | 'bonus'
  itemCount: number
  unitLabel: string
  unitWeight: number
  contribution: number
  formula: string
  detail: string
}

export interface HealthScoreBreakdown {
  baseScore: number
  score: number
  label: string
  tone: DashboardTone
  interpretation: string
  positiveTotal: number
  negativeTotal: number
  factors: ScoreFactor[]
}

export interface WeeklyFlowPoint {
  label: string
  created: number
  closed: number
}

export interface AgingBucketModel {
  label: string
  count: number
}

export interface HealthModel {
  breakdown: HealthScoreBreakdown
  activeCount: number
  completionRate: number
  recentlyUpdatedCount: number
  recentlyCompletedCount: number
  recentlyCreatedCount: number
  flowBalance: number
  overdueCount: number
  longOverdueCount: number
  staleCount: number
  dueSoonCount: number
  unassignedCount: number
  averageCycleDays: number | null
  agingBuckets: AgingBucketModel[]
  weeklyFlow: WeeklyFlowPoint[]
}

export type TrendDirection = 'up' | 'down' | 'flat'

export interface MetricTrendModel {
  direction: TrendDirection
  deltaLabel: string
  comparisonLabel: string
  tone: DashboardTone
}

export interface DecisionGuidanceModel {
  rootCause: string
  suggestedAction: string
  owner: AssigneeFilter | null
}

export interface KpiCardModel {
  id: string
  label: string
  value: string
  note: string
  tone: DashboardTone
  status: 'normal' | 'warning' | 'critical'
  statusLabel: string
  trend: MetricTrendModel
  tooltip: string
  guidance: DecisionGuidanceModel
  statusGroup?: string | null
  preset?: IssuePreset | null
}

export interface DashboardSummaryViewModel {
  cards: KpiCardModel[]
  headline: string
}

export interface StatusSnapshotItem {
  id: string
  label: string
  count: number
  note: string
  tone: DashboardTone
  preset: IssuePreset | null
}

export interface StatusSnapshotModel {
  title: string
  subtitle: string
  items: StatusSnapshotItem[]
}

export interface ActionBucketModel {
  id: IssuePreset
  label: string
  description: string
  count: number
  tone: DashboardTone
  issues: IssueListItem[]
  emptyLabel: string
  rootCause: string
  suggestedAction: string
  owner: AssigneeFilter | null
}

export interface StableOperationalItem {
  id: string
  label: string
  value: string
  note: string
}

export interface StableOperationalState {
  title: string
  description: string
  items: StableOperationalItem[]
}

export interface CapacityMemberModel {
  key: string
  assignee: AssigneeFilter
  openCount: number
  inProgressCount: number
  highPriorityCount: number
  overdueCount: number
  dueSoonCount: number
  staleCount: number
  closedRecentlyCount: number
  recentUpdateRate: number
  utilizationRate: number
  riskScore: number
  band: 'balanced' | 'watch' | 'stretched'
}

export interface ExplorerPresetModel {
  id: IssuePreset | null
  label: string
  count: number
}

export interface AssigneeEvidenceMetric {
  label: string
  value: string
}

export interface AssigneeTendencyTag {
  label: string
  tone: DashboardTone
}

export interface AssigneeTendencyInsight {
  key: string
  assignee: AssigneeFilter
  activeCount: number
  behaviorType: 'fast_unstable' | 'slow_stable' | 'high_activity_low_completion' | 'balanced_operator'
  behaviorLabel: string
  behaviorSummary: string
  recommendedAction: string
  confidenceLevel: 'high' | 'medium' | 'low'
  sampleIssueCount: number
  tendencyTags: AssigneeTendencyTag[]
  evidence: AssigneeEvidenceMetric[]
  interpretation: string
  sparkline: number[]
  averageLeadTimeDays: number | null
  onTimeRate: number | null
  recentUpdateRate: number
  staleShare: number
  sampleIssueIds: number[]
}

export interface AssigneeJournalInsight {
  sampleSize: number
  notesPerIssue: number
  changeEventsPerIssue: number
  averageJournalGapDays: number | null
  lateStageChangeRatio: number | null
  observations: string[]
  interpretation: string
  issues: Pick<IssueDetail, 'id' | 'subject' | 'status' | 'done_ratio'>[]
}

export interface DashboardModel {
  summary: DashboardSummaryViewModel
  statusSnapshot: StatusSnapshotModel
  actions: ActionBucketModel[]
  stableState: StableOperationalState
  capacity: CapacityMemberModel[]
  health: HealthModel
  insights: AssigneeTendencyInsight[]
  explorerPresets: ExplorerPresetModel[]
}