import Badge from '@/components/Badge'
import WorkflowActions from '@/components/WorkflowActions'
import type { AssigneeTendencyInsight, CapacityMemberModel } from '@/lib/dashboard'

interface Props {
  projectId: string
  member: CapacityMemberModel
  insight: AssigneeTendencyInsight | null
  windowLabel: string
}

function getRiskLevel(member: CapacityMemberModel) {
  if (member.overdueCount > 0 || member.band === 'stretched') {
    return { label: '위험', tone: 'danger' as const }
  }

  if (member.staleCount > 0 || member.band === 'watch') {
    return { label: '주의', tone: 'warning' as const }
  }

  return { label: '안정', tone: 'success' as const }
}

function getReasonLine(member: CapacityMemberModel, insight: AssigneeTendencyInsight | null) {
  if (member.overdueCount > 0) {
    return `기한 초과 ${member.overdueCount}건으로 즉시 확인이 필요합니다.`
  }

  if (member.staleCount > 0) {
    return `장기 미갱신 이슈 ${member.staleCount}건이 남아 있어 진행 확인이 필요합니다.`
  }

  if (insight?.behaviorSummary) {
    return insight.behaviorSummary
  }

  return '현재는 큰 리스크 없이 운영 흐름을 유지하고 있습니다.'
}

function getActionLabel(member: CapacityMemberModel) {
  if (member.overdueCount > 0) return '기한 초과 이슈 보기'
  if (member.staleCount > 0) return '장기 미갱신 이슈 보기'
  return '담당 이슈 보기'
}

export default function UserInsightCard({ projectId, member, insight, windowLabel: _windowLabel }: Props) {
  const risk = getRiskLevel(member)
  const reasonLine = getReasonLine(member, insight)
  const actionHref = `/dashboard/${encodeURIComponent(projectId)}/issues?assignee=${encodeURIComponent(String(member.assignee.id ?? 'unassigned'))}&preset=${encodeURIComponent(member.overdueCount > 0 ? 'overdue' : member.staleCount > 0 ? 'stale' : 'attention')}`
  const actionLabel = getActionLabel(member)

  return (
    <article
      className={[
        'flex min-h-[158px] flex-col rounded-[16px] border bg-white p-3 shadow-[0_10px_20px_-22px_rgba(15,23,42,0.2)]',
        member.band === 'stretched' ? 'border-rose-200' : member.band === 'watch' ? 'border-amber-200' : 'border-slate-200',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[16px] font-semibold text-slate-950">{member.assignee.name}</div>
          <div className="mt-1.5">
            <Badge tone={risk.tone} size="sm">{risk.label}</Badge>
          </div>
        </div>
      </div>

      <p className="mt-2.5 line-clamp-1 text-[13px] font-medium leading-5 text-slate-700">
        {reasonLine}
      </p>

      <WorkflowActions
        className="mt-auto pt-2.5"
        heading="액션"
        items={[
          {
            label: actionLabel,
            href: actionHref,
            step: '1',
            priority: 'primary',
          },
        ]}
      />
    </article>
  )
}
