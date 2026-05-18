import Badge from '@/components/Badge'
import ScopeBadge from '@/components/ScopeBadge'
import SectionCard from '@/components/SectionCard'
import type { CapacityMemberModel, DashboardThresholdSettings } from '@/lib/dashboard'
import { getCapacityBandLabel, getCapacityBandTone } from '@/lib/dashboard/presentation'
import type { AssigneeFilter } from '@/types/dashboard'

interface Props {
  members: CapacityMemberModel[]
  settings: DashboardThresholdSettings
  activeAssignee: AssigneeFilter | null
  onSelectAssignee: (assignee: AssigneeFilter | null) => void
}

function getRecommendedAction(member: CapacityMemberModel) {
  if (member.overdueCount > 0) return '지연 이슈 먼저 확인'
  if (member.staleCount > 0) return '진행 확인 요청'
  if (member.openCount > 0 && member.band === 'stretched') return '작업 분산 검토'
  if (member.dueSoonCount > 0) return '이번 주 일정 점검'
  return '현재 흐름 유지'
}

export default function TeamCapacityPanel({ members, settings, activeAssignee, onSelectAssignee }: Props) {
  const visibleMembers = members.filter((member) => member.openCount > 0 || member.riskScore > 0)

  return (
    <SectionCard
      title="팀 작업량"
      subtitle={`${settings.overloadThreshold}건 기준으로 과부하 가능성을 보고, 먼저 확인할 담당자를 빠르게 찾습니다.`}
      aside={<ScopeBadge kind="full" label="전체 프로젝트 기준" />}
      density="primary"
      bodyClassName="space-y-4 p-0"
    >
      {visibleMembers.length === 0 ? (
        <div className="px-4 py-8 text-sm text-slate-500">
          지금은 작업량 기준으로 먼저 볼 담당자가 많지 않습니다. 이슈 화면에서 전체 흐름을 먼저 확인하는 편이 좋습니다.
        </div>
      ) : (
        <>
          <div className="grid gap-3 px-4 pt-4 md:hidden">
            {visibleMembers.slice(0, 8).map((member) => {
              const isActive = activeAssignee?.id === member.assignee.id

              return (
                <button
                  key={member.key}
                  type="button"
                  onClick={() => onSelectAssignee(isActive ? null : member.assignee)}
                  className={[
                    'rounded-[20px] border px-4 py-4 text-left transition-colors',
                    isActive ? 'border-slate-300 bg-slate-50' : 'border-slate-200 bg-white hover:border-slate-300',
                  ].join(' ')}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-950">{member.assignee.name}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        활성 {member.openCount}건 · 진행 중 {member.inProgressCount}건 · 고우선 {member.highPriorityCount}건
                      </div>
                    </div>
                    <Badge tone={getCapacityBandTone(member.band)}>{getCapacityBandLabel(member.band)}</Badge>
                  </div>

                  <div className="mt-3 h-2 rounded-full bg-slate-100">
                    <div
                      className={[
                        'h-2 rounded-full',
                        member.band === 'stretched' ? 'bg-rose-500' : member.band === 'watch' ? 'bg-amber-500' : 'bg-emerald-500',
                      ].join(' ')}
                      style={{ width: `${Math.min(100, Math.round(member.utilizationRate * 100))}%` }}
                    />
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <Badge tone={member.overdueCount > 0 ? 'danger' : 'neutral'}>지연 {member.overdueCount}</Badge>
                    <Badge tone={member.dueSoonCount > 0 ? 'warning' : 'neutral'}>임박 {member.dueSoonCount}</Badge>
                    <Badge tone={member.staleCount > 0 ? 'warning' : 'neutral'}>정체 {member.staleCount}</Badge>
                  </div>

                  <div className="mt-3 text-sm font-medium text-slate-900">{getRecommendedAction(member)}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    가동률 {Math.round(member.utilizationRate * 100)}% · 최근 업데이트 {Math.round(member.recentUpdateRate * 100)}%
                  </div>
                </button>
              )
            })}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-50/80 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left">담당자</th>
                  <th className="px-4 py-3 text-left">활성 / 가동률</th>
                  <th className="px-4 py-3 text-left">위험 신호</th>
                  <th className="px-4 py-3 text-right">다음 확인</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {visibleMembers.slice(0, 15).map((member) => {
                  const isActive = activeAssignee?.id === member.assignee.id

                  return (
                    <tr
                      key={member.key}
                      onClick={() => onSelectAssignee(isActive ? null : member.assignee)}
                      className={['cursor-pointer transition-colors hover:bg-slate-50', isActive ? 'bg-slate-50' : ''].join(' ')}
                    >
                      <td className="px-4 py-3 align-top">
                        <div className="flex items-center gap-2">
                          <div>
                            <div className="font-medium text-slate-800">{member.assignee.name}</div>
                            <div className="mt-1 text-xs text-slate-500">
                              진행 중 {member.inProgressCount}건 · 고우선 {member.highPriorityCount}건
                            </div>
                          </div>
                          <Badge tone={getCapacityBandTone(member.band)}>{getCapacityBandLabel(member.band)}</Badge>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="text-sm font-semibold text-slate-800">{member.openCount}건</div>
                        <div className="mt-2 h-1.5 rounded-full bg-slate-100">
                          <div
                            className={[
                              'h-1.5 rounded-full',
                              member.band === 'stretched' ? 'bg-rose-500' : member.band === 'watch' ? 'bg-amber-500' : 'bg-emerald-500',
                            ].join(' ')}
                            style={{ width: `${Math.min(100, Math.round(member.utilizationRate * 100))}%` }}
                          />
                        </div>
                        <div className="mt-1 text-xs text-slate-500">가동률 {Math.round(member.utilizationRate * 100)}%</div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex flex-wrap gap-1.5">
                          <Badge tone={member.overdueCount > 0 ? 'danger' : 'neutral'}>지연 {member.overdueCount}</Badge>
                          <Badge tone={member.dueSoonCount > 0 ? 'warning' : 'neutral'}>임박 {member.dueSoonCount}</Badge>
                          <Badge tone={member.staleCount > 0 ? 'warning' : 'neutral'}>정체 {member.staleCount}</Badge>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right align-top">
                        <div className="text-sm font-semibold text-slate-800">{getRecommendedAction(member)}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {getCapacityBandLabel(member.band)} · 최근 업데이트 {Math.round(member.recentUpdateRate * 100)}%
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </SectionCard>
  )
}
