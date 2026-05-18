import Link from 'next/link'

import Badge from '@/components/Badge'
import EvidenceDisclosure from '@/components/EvidenceDisclosure'
import ScopeBadge from '@/components/ScopeBadge'
import SectionCard from '@/components/SectionCard'
import WorkflowActions from '@/components/WorkflowActions'
import { getIssueSignals, type ActionBucketModel, type DashboardThresholdSettings } from '@/lib/dashboard'
import {
  getActionOwnerCtaLabel,
  getActionPrimaryCtaLabel,
  getOwnerHref,
  getPresetIssuesHref,
} from '@/lib/dashboard/navigation'

interface Props {
  projectId: string
  actions: ActionBucketModel[]
  settings: DashboardThresholdSettings
  windowLabel?: string
}

export default function ActionPanel({ projectId, actions, settings, windowLabel = '전체 기준' }: Props) {
  const visibleActions = actions.filter((action) => action.count > 0).slice(0, 4)
  const priorityActions = visibleActions.slice(0, 2)
  const overflowActions = visibleActions.slice(2)

  return (
    <SectionCard
      title="즉시 조치"
      subtitle="지금 바로 확인할 항목을 먼저 보여주고, 이슈 화면이나 담당자 화면으로 바로 이어집니다."
      aside={
        <div className="flex flex-wrap justify-end gap-2">
          <ScopeBadge kind="window" label={windowLabel} />
          <ScopeBadge kind="advisory" label="권장 조치" />
        </div>
      }
      density="compact"
      className="self-start"
      bodyClassName="space-y-3"
    >
      {visibleActions.length === 0 ? (
        <div className="rounded-[20px] border border-emerald-100 bg-emerald-50 px-4 py-4 text-sm leading-6 text-emerald-900">
          지금 바로 처리할 긴급 항목은 없습니다. 아래 지표와 추이만 이어서 확인하면 됩니다.
        </div>
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-3">
            {visibleActions.slice(0, 3).map((action) => (
              <Link
                key={`summary-${action.id}`}
                href={getPresetIssuesHref(projectId, action.id)}
                className="rounded-[16px] border border-slate-200 bg-slate-50 px-3 py-3 transition-colors hover:border-slate-300 hover:bg-white"
              >
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">{action.label}</div>
                <div className="mt-1.5 flex items-center justify-between gap-3">
                  <div className="text-2xl font-semibold text-slate-950">{action.count}</div>
                  <Badge tone={action.tone}>{action.count > 0 ? '즉시 확인' : '안정'}</Badge>
                </div>
              </Link>
            ))}
          </div>

          <div className="space-y-2.5">
            {priorityActions.map((action) => (
              <div key={action.id} className="flex flex-col rounded-[18px] border border-slate-200 bg-slate-50/80 p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-[15px] font-semibold text-slate-950">{action.label}</div>
                      <Badge tone={action.tone} size="md">{action.count}</Badge>
                    </div>
                    <p className="mt-1 text-sm leading-5 text-slate-700">{action.description}</p>
                  </div>
                </div>

                <div className="mt-3 rounded-[14px] border border-white/90 bg-white px-3 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">지금 해야 할 일</div>
                  <p className="mt-1.5 text-sm leading-5 text-slate-700">{action.suggestedAction}</p>
                </div>

                <WorkflowActions
                  className="mt-3"
                  heading="바로 가기"
                  items={[
                    {
                      label: getActionPrimaryCtaLabel(action),
                      href: getPresetIssuesHref(projectId, action.id),
                      step: '1',
                      priority: 'primary',
                    },
                    ...(action.owner && getActionOwnerCtaLabel(action) && getOwnerHref(projectId, action.owner)
                      ? [{
                          label: getActionOwnerCtaLabel(action) as string,
                          href: getOwnerHref(projectId, action.owner) as string,
                          step: '2',
                          priority: 'secondary' as const,
                        }]
                      : []),
                  ]}
                />

                <EvidenceDisclosure title="판단 근거" hint={action.rootCause} className="mt-3 border-dashed border-white bg-white/80 pt-2.5">
                  <div className="mt-3 space-y-2">
                    {action.issues.slice(0, 2).map((issue) => (
                      <Link
                        key={issue.id}
                        href={`${getPresetIssuesHref(projectId, action.id)}&issueId=${issue.id}`}
                        className="block rounded-[16px] border border-slate-200 bg-slate-50 px-3.5 py-3 transition-colors hover:border-slate-300 hover:bg-white"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-[11px] font-semibold text-slate-400">#{issue.id}</div>
                            <div className="mt-1 line-clamp-2 text-sm font-semibold leading-5 text-slate-900">{issue.subject}</div>
                          </div>
                          <div className="text-xs text-slate-500">{issue.assigned_to ?? '미할당'}</div>
                        </div>
                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                          {getIssueSignals(issue, settings).slice(0, 2).map((signal) => (
                            <Badge key={`${issue.id}-${signal.label}`} tone={signal.tone}>{signal.label}</Badge>
                          ))}
                        </div>
                      </Link>
                    ))}
                  </div>
                </EvidenceDisclosure>
              </div>
            ))}
          </div>

          {overflowActions.length > 0 ? (
            <div className="rounded-[16px] border border-slate-200 bg-slate-50 px-3.5 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">추가 확인 항목</div>
              <div className="mt-2 space-y-2">
                {overflowActions.map((action) => (
                  <Link
                    key={`overflow-${action.id}`}
                    href={getPresetIssuesHref(projectId, action.id)}
                    className="flex items-center justify-between gap-3 rounded-[14px] border border-white bg-white px-3 py-3 transition-colors hover:border-slate-300"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-900">{action.label}</div>
                      <div className="mt-1 text-xs text-slate-500">{action.description}</div>
                    </div>
                    <Badge tone={action.tone}>{action.count}</Badge>
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </>
      )}
    </SectionCard>
  )
}
