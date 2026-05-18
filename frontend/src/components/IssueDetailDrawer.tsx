'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

import Badge from '@/components/Badge'
import { fetchIssueDetail } from '@/lib/api'
import { evaluateIssueRisk, getIssueSignals, type DashboardThresholdSettings } from '@/lib/dashboard'
import { RELATION_LABEL, getPriorityLabel } from '@/lib/labels'
import { buildRedmineAssetProxyUrl } from '@/lib/redmineAssets'
import type { IssueAttachment, IssueDetail, IssueListItem, JournalEntry } from '@/types/dashboard'
import IssueRichContent from './IssueRichContent'

interface Props {
  issueId: number | null
  settings: DashboardThresholdSettings
  onClose: () => void
  onSelectIssue: (issueId: number) => void
}

const FIELD_LABEL: Record<string, string> = {
  status_id: '상태',
  assigned_to_id: '담당자',
  priority_id: '우선순위',
  due_date: '마감일',
  start_date: '시작일',
  subject: '제목',
  description: '설명',
  done_ratio: '진행률',
  tracker_id: '트래커',
}

function getStatusTone(statusGroup: string) {
  if (statusGroup === 'closed') return 'success'
  if (statusGroup === 'in_progress') return 'info'
  if (statusGroup === 'open') return 'warning'
  return 'neutral'
}

function getPriorityTone(priority: string | null) {
  if (priority === 'Immediate' || priority === 'Urgent') return 'danger'
  if (priority === 'High') return 'warning'
  return 'neutral'
}

function formatValue(value: string | null | undefined): string {
  if (!value) return '미지정'
  return value
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value

  return parsed.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDate(value: string | null | undefined): string {
  return value ?? '—'
}

function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return '크기 정보 없음'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function renderChange(change: JournalEntry['changes'][number]) {
  const label = FIELD_LABEL[change.field] ?? change.field
  return (
    <div className="text-xs text-slate-600">
      <span className="font-medium text-slate-500">{label}</span>
      <span className="mx-1 text-slate-300">:</span>
      <span className="text-slate-400">{formatValue(change.old_value)}</span>
      <span className="mx-1 text-slate-300">→</span>
      <span className="text-slate-800">{formatValue(change.new_value)}</span>
    </div>
  )
}

function toIssueListItem(detail: IssueDetail): IssueListItem {
  return {
    id: detail.id,
    subject: detail.subject,
    status: detail.status,
    status_id: detail.status_id ?? 0,
    status_group: detail.status_group,
    priority: detail.priority,
    assigned_to: detail.assigned_to,
    assigned_to_id: detail.assigned_to_id,
    author: detail.author,
    tracker: detail.tracker,
    due_date: detail.due_date,
    created_on: detail.created_on,
    updated_on: detail.updated_on,
    done_ratio: detail.done_ratio,
    is_overdue: false,
    days_overdue: 0,
    is_due_soon: false,
    days_until_due: null,
    is_stale: false,
    days_since_update: null,
    url: detail.url,
  }
}

function getOperationalSummary(detail: IssueDetail, settings: DashboardThresholdSettings) {
  const issue = toIssueListItem(detail)
  const risk = evaluateIssueRisk(issue, settings)
  const signals = getIssueSignals(issue, settings)

  if (risk.isOverdue) {
    return {
      tone: risk.isLongOverdue ? 'danger' as const : 'warning' as const,
      headline: `마감이 ${risk.daysOverdue}일 지연된 상태입니다.`,
      action: '지연 사유를 먼저 확인하고, 담당자와 마감 일정을 바로 다시 정리하는 편이 좋습니다.',
      helper: detail.assigned_to
        ? `${detail.assigned_to} 담당으로 잡혀 있으니 일정 재합의 또는 병목 제거가 우선입니다.`
        : '담당자가 비어 있으면 일정 재정리 전에 소유권부터 정해야 합니다.',
      signals,
    }
  }

  if (risk.isStale && risk.daysSinceUpdate !== null) {
    return {
      tone: 'warning' as const,
      headline: `${risk.daysSinceUpdate}일 동안 업데이트가 끊긴 작업입니다.`,
      action: '현재 실제로 진행 중인지, 아니면 막혀 있는지부터 짧게 확인해야 합니다.',
      helper: detail.assigned_to
        ? `${detail.assigned_to} 담당 작업이라 중간 확인 요청이 가장 빠른 개입입니다.`
        : '담당자가 정해지지 않았다면 정체 해소보다 먼저 담당 배정이 필요합니다.',
      signals,
    }
  }

  if (risk.isDueSoon && risk.daysUntilDue !== null) {
    return {
      tone: 'warning' as const,
      headline: risk.daysUntilDue === 0 ? '오늘 마감 예정인 작업입니다.' : `${risk.daysUntilDue}일 안에 마감이 다가옵니다.`,
      action: '이번 주 안에 끝낼 수 있는지 확인하고, 어렵다면 지금 일정 조정 여부를 판단해야 합니다.',
      helper: detail.done_ratio > 0
        ? `현재 진행률 ${detail.done_ratio}% 기준으로 남은 작업량이 일정 안에 들어오는지 확인하세요.`
        : '아직 진척이 거의 없으면 일정 리스크가 빠르게 커질 수 있습니다.',
      signals,
    }
  }

  if (detail.assigned_to_id === null && detail.status_group !== 'closed') {
    return {
      tone: 'neutral' as const,
      headline: '담당자가 정해지지 않은 작업입니다.',
      action: '진행 여부를 보기 전에 먼저 소유권을 정해야 실제 후속 조치가 가능해집니다.',
      helper: '미할당 상태가 길어질수록 일정과 업데이트 신호가 함께 악화되기 쉽습니다.',
      signals,
    }
  }

  if (detail.priority === 'Immediate' || detail.priority === 'Urgent' || detail.priority === 'High') {
    return {
      tone: 'danger' as const,
      headline: '우선순위가 높은 작업입니다.',
      action: '다른 지연 신호가 없더라도 이번 사이클 안에서 처리 순서를 다시 확인하는 편이 좋습니다.',
      helper: '같은 담당자에게 급한 작업이 겹치면 팀 화면에서 분산 여부까지 함께 보는 것이 안전합니다.',
      signals,
    }
  }

  if (detail.status_group === 'closed') {
    return {
      tone: 'success' as const,
      headline: '이미 마감된 작업입니다.',
      action: '최근 완료 흐름과 변경 이력만 확인하면 충분합니다.',
      helper: '재오픈 징후가 있는지, 마지막 변경에서 담당이나 마감 조정이 있었는지만 보면 됩니다.',
      signals,
    }
  }

  return {
    tone: 'info' as const,
    headline: '지금은 대표 위험 신호가 크지 않은 작업입니다.',
    action: '진행률, 최근 업데이트, 관련 이슈만 짧게 확인하면 됩니다.',
    helper: '급한 신호가 커지면 이 화면보다 작업 목록에서 먼저 상단으로 올라오게 됩니다.',
    signals,
  }
}

function AttachmentList({ attachments, baseUrl }: { attachments: IssueAttachment[]; baseUrl: string }) {
  if (attachments.length === 0) return null
  return (
    <section>
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">첨부파일</h3>
      <div className="mt-3 space-y-2">
        {attachments.map((attachment) => (
          <a
            key={attachment.id}
            href={buildRedmineAssetProxyUrl(attachment.content_url, baseUrl)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm transition-colors hover:border-slate-300"
          >
            <div className="min-w-0">
              <div className="truncate font-medium text-slate-800">{attachment.filename}</div>
              <div className="mt-1 text-xs text-slate-500">{attachment.content_type ?? '파일'} • {formatFileSize(attachment.filesize)}</div>
            </div>
            <span className="text-xs font-medium text-slate-500">열기</span>
          </a>
        ))}
      
      </div>
    </section>
  )
}

function JournalTimeline({ journals, baseUrl }: { journals: JournalEntry[]; baseUrl: string }) {
  const sorted = [...journals].reverse()

  if (sorted.length === 0) {
    return <div className="rounded-xl border border-dashed border-slate-200 px-3 py-5 text-sm text-slate-400">이슈 이력이 없습니다.</div>
  }

  return (
    <div className="space-y-4">
      {sorted.map((journal, index) => {
        if (!journal.notes && journal.changes.length === 0) return null

        return (
          <div key={journal.id ?? index} className="relative pl-5">
            <div className="absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full bg-slate-300" />
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-sm shadow-slate-200/10">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium text-slate-800">{journal.user || '시스템'}</div>
                <div className="text-[11px] text-slate-400">{formatDateTime(journal.created_on)}</div>
              </div>

              {journal.changes.length > 0 ? (
                <div className="mt-3 space-y-1 rounded-lg bg-slate-50 px-3 py-2">
                  {journal.changes.map((change, changeIndex) => (
                    <div key={`${journal.id ?? index}-${changeIndex}`}>{renderChange(change)}</div>
                  ))}
                </div>
              ) : null}

              {journal.notes ? (
                <div className="mt-3 rounded-lg border border-amber-100 bg-amber-50 px-3 py-3">
                  <IssueRichContent html={journal.notes_html} raw={journal.notes} baseUrl={baseUrl} />
                </div>
              ) : null}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function CollapsibleSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <section className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm shadow-slate-200/10">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{title}</h3>
        <span className="text-xs text-slate-400">{open ? '접기' : '보기'}</span>
      </button>
      {open ? <div className="mt-4">{children}</div> : null}
    </section>
  )
}

function InfoGrid({ detail }: { detail: IssueDetail }) {
  const items = [
    { label: '담당자', value: detail.assigned_to ?? '미할당' },
    { label: '작성자', value: detail.author ?? '미상' },
    { label: '트래커', value: detail.tracker ?? '—' },
    { label: '카테고리', value: detail.category ?? '—' },
    { label: '버전', value: detail.version ?? '—' },
    { label: '시작일', value: formatDate(detail.start_date) },
    { label: '마감일', value: formatDate(detail.due_date) },
    { label: '생성일', value: formatDateTime(detail.created_on) },
    { label: '수정일', value: formatDateTime(detail.updated_on) },
  ]

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.label} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 shadow-sm shadow-slate-200/10">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{item.label}</div>
          <div className="mt-1 text-sm text-slate-800">{item.value}</div>
        </div>
      ))}
    </div>
  )
}

function OperationalSummary({ detail, settings }: { detail: IssueDetail; settings: DashboardThresholdSettings }) {
  const summary = useMemo(() => getOperationalSummary(detail, settings), [detail, settings])

  return (
    <section className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4 shadow-sm shadow-slate-200/10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">운영 요약</div>
          <div className="mt-2 text-base font-semibold text-slate-950">{summary.headline}</div>
        </div>
        <Badge tone={summary.tone} size="md">우선 판단</Badge>
      </div>

      <div className="mt-4 rounded-2xl border border-white bg-white px-4 py-4">
        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">권장 액션</div>
        <div className="mt-2 text-sm leading-6 text-slate-900">{summary.action}</div>
        <div className="mt-2 text-sm leading-6 text-slate-500">{summary.helper}</div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-white bg-white px-4 py-4">
          <div className="text-xs uppercase tracking-[0.12em] text-slate-400">담당 상태</div>
          <div className="mt-2 text-sm font-semibold text-slate-950">{detail.assigned_to ?? '미할당'}</div>
          <div className="mt-1 text-xs text-slate-500">소유권 기준 첫 판단</div>
        </div>
        <div className="rounded-2xl border border-white bg-white px-4 py-4">
          <div className="text-xs uppercase tracking-[0.12em] text-slate-400">마감</div>
          <div className="mt-2 text-sm font-semibold text-slate-950">{detail.due_date ?? '미설정'}</div>
          <div className="mt-1 text-xs text-slate-500">일정 재조정 필요 여부</div>
        </div>
        <div className="rounded-2xl border border-white bg-white px-4 py-4">
          <div className="text-xs uppercase tracking-[0.12em] text-slate-400">최근 업데이트</div>
          <div className="mt-2 text-sm font-semibold text-slate-950">{formatDateTime(detail.updated_on)}</div>
          <div className="mt-1 text-xs text-slate-500">진행 신선도 확인용</div>
        </div>
      </div>

      {summary.signals.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {summary.signals.map((signal) => (
            <Badge key={signal.label} tone={signal.tone}>{signal.label}</Badge>
          ))}
        </div>
      ) : null}
    </section>
  )
}

function RelatedIssues({ detail, onSelectIssue }: { detail: IssueDetail; onSelectIssue: (issueId: number) => void }) {
  if (detail.related_issues.length === 0) return null

  return (
    <section>
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">관련 이슈</h3>
      <div className="mt-3 flex flex-wrap gap-2">
        {detail.related_issues.map((related) => (
          <button
            key={`${related.relation_type}-${related.id}`}
            type="button"
            onClick={() => onSelectIssue(related.id)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left transition-colors hover:border-slate-300 hover:bg-white"
          >
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              {RELATION_LABEL[related.relation_type] ?? related.relation_type}
            </div>
            <div className="mt-1 text-sm font-medium text-slate-800">#{related.id}</div>
            <div className="mt-1 text-xs text-slate-500">{related.label}</div>
          </button>
        ))}
      </div>
    </section>
  )
}

function RecentOperationalChanges({ journals }: { journals: JournalEntry[] }) {
  const changes = useMemo(() => {
    return [...journals]
      .reverse()
      .flatMap((journal) => {
        return journal.changes
          .filter((change) => ['status_id', 'assigned_to_id', 'priority_id', 'due_date'].includes(change.field))
          .map((change) => ({
            label: FIELD_LABEL[change.field] ?? change.field,
            createdOn: journal.created_on,
            user: journal.user,
            oldValue: formatValue(change.old_value),
            newValue: formatValue(change.new_value),
          }))
      })
      .slice(0, 4)
  }, [journals])

  if (changes.length === 0) return null

  return (
    <section>
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">최근 운영 변경</h3>
      <div className="mt-3 space-y-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 shadow-sm shadow-slate-200/10">
        {changes.map((change, index) => (
          <div key={`${change.label}-${index}`} className="text-sm text-slate-700">
            <span className="font-medium text-slate-900">{change.label}</span>
            <span className="mx-1 text-slate-300">·</span>
            <span className="text-slate-500">{change.user || '시스템'}</span>
            <span className="mx-1 text-slate-300">·</span>
            <span className="text-slate-500">{formatDateTime(change.createdOn)}</span>
            <div className="mt-1 text-xs text-slate-500">{change.oldValue} → {change.newValue}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

export default function IssueDetailDrawer({ issueId, settings, onClose, onSelectIssue }: Props) {
  const [detail, setDetail] = useState<IssueDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cacheRef = useRef<Map<number, IssueDetail>>(new Map())
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }

    if (issueId !== null) {
      document.addEventListener('keydown', onKeyDown)
      document.body.style.overflow = 'hidden'
      return () => {
        document.removeEventListener('keydown', onKeyDown)
        document.body.style.overflow = ''
      }
    }

    return undefined
  }, [issueId, onClose])

  useEffect(() => {
    if (issueId === null) {
      setDetail(null)
      return
    }

    const cached = cacheRef.current.get(issueId)
    if (cached) {
      setDetail(cached)
      setError(null)
      return
    }

    setLoading(true)
    setError(null)

    fetchIssueDetail(issueId)
      .then((response) => {
        cacheRef.current.set(issueId, response)
        setDetail(response)
      })
      .catch((fetchError: Error) => setError(fetchError.message))
      .finally(() => setLoading(false))
  }, [issueId])

  useEffect(() => {
    if (detail && panelRef.current) {
      panelRef.current.scrollTop = 0
    }
  }, [detail])

  if (issueId === null) return null

  return (
    <>
      <div className="fixed inset-0 z-30 bg-slate-900/20" onClick={onClose} />
      <aside
        ref={panelRef}
        className="fixed right-0 top-0 z-40 h-full w-full overflow-y-auto border-l border-slate-200 bg-white shadow-2xl sm:w-[620px]"
      >
        <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              {loading && !detail ? (
                <div className="space-y-2">
                  <div className="h-4 w-16 animate-pulse rounded bg-slate-200" />
                  <div className="h-5 w-60 animate-pulse rounded bg-slate-200" />
                </div>
              ) : detail ? (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-xs font-semibold text-slate-400">#{detail.id}</div>
                    <Badge tone={getStatusTone(detail.status_group)} size="md">{detail.status}</Badge>
                    {detail.priority ? <Badge tone={getPriorityTone(detail.priority)} size="md">{getPriorityLabel(detail.priority)}</Badge> : null}
                    <Badge tone="neutral" size="md">진행 {detail.done_ratio}%</Badge>
                  </div>
                  <h2 className="mt-3 text-lg font-semibold leading-tight text-slate-900">{detail.subject}</h2>
                </>
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              {detail ? (
                <a
                  href={detail.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-900"
                >
                  Redmine에서 보기
                </a>
              ) : null}
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-900"
              >
                닫기
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-5 px-5 py-5">
          {loading && !detail ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-16 animate-pulse rounded-xl bg-slate-100" />
              ))}
            </div>
          ) : null}

          {error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
              이슈 상세를 불러오지 못했습니다: {error}
            </div>
          ) : null}

          {!loading && !error && detail ? (
            <>
              <OperationalSummary detail={detail} settings={settings} />
              <InfoGrid detail={detail} />
              <RecentOperationalChanges journals={detail.journals} />
              {detail.related_issues.length > 0 ? (
                <CollapsibleSection title="관련 이슈">
                  <RelatedIssues detail={detail} onSelectIssue={onSelectIssue} />
                </CollapsibleSection>
              ) : null}

              <section>
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">설명</h3>
                <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 shadow-sm shadow-slate-200/10">
                  <IssueRichContent
                    html={detail.description_html}
                    raw={detail.description}
                    baseUrl={detail.redmine_base_url}
                  />
                </div>
              </section>

              {detail.attachments.length > 0 ? (
                <CollapsibleSection title="첨부파일">
                  <AttachmentList attachments={detail.attachments} baseUrl={detail.redmine_base_url} />
                </CollapsibleSection>
              ) : null}

              <CollapsibleSection title="이력">
                <JournalTimeline journals={detail.journals} baseUrl={detail.redmine_base_url} />
              </CollapsibleSection>
            </>
          ) : null}
        </div>
      </aside>
    </>
  )
}
