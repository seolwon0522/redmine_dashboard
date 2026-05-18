import Badge from '@/components/Badge'
import type { RedmineConnectionStatusResponse } from '@/types/redmine-connection'

interface ConnectionStatusCardProps {
  connectionStatus: RedmineConnectionStatusResponse
  onOpenSettings: () => void
  onDelete: () => Promise<void> | void
}

export default function ConnectionStatusCard({
  connectionStatus,
  onOpenSettings,
  onDelete,
}: ConnectionStatusCardProps) {
  const connection = connectionStatus.connection
  const authMethod = connection?.auth_type === 'basic' ? 'ID / 비밀번호' : 'API 키'

  return (
    <section className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm shadow-slate-200/70">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" d="m5 13 4 4L19 7" />
            </svg>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Badge tone="success" size="sm">연결됨</Badge>
              <span className="text-xs font-semibold text-slate-500">Redmine 연결 상태</span>
            </div>
            <h2 className="mt-1 text-base font-bold text-slate-950">Redmine가 성공적으로 연결되었습니다.</h2>
            <p className="mt-1 text-sm text-slate-500">프로젝트 및 이슈 데이터를 실시간으로 동기화합니다.</p>
          </div>
        </div>

        <div className="grid min-w-0 flex-1 gap-3 lg:grid-cols-3 xl:max-w-xl">
          <div className="border-l border-slate-200 pl-4">
            <div className="text-xs font-bold text-slate-500">서버</div>
            <div className="mt-1 truncate text-sm font-bold text-slate-950">{connection?.base_url ?? '-'}</div>
          </div>
          <div className="border-l border-slate-200 pl-4">
            <div className="text-xs font-bold text-slate-500">인증 방식</div>
            <div className="mt-1 text-sm font-bold text-slate-950">{authMethod}</div>
          </div>
          <div className="border-l border-slate-200 pl-4">
            <div className="text-xs font-bold text-slate-500">확인된 계정</div>
            <div className="mt-1 text-sm font-bold text-slate-950">{connectionStatus.server_user ?? '검증 완료'}</div>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2 xl:self-end">
          <button
            type="button"
            onClick={onOpenSettings}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <circle cx="12" cy="12" r="3" strokeWidth="2" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21a2 2 0 0 1-4 0v-.09A1.7 1.7 0 0 0 8 19.4a1.7 1.7 0 0 0-1-.6 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 3.4 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H1.6a2 2 0 0 1 0-4h.09A1.7 1.7 0 0 0 3.4 8a1.7 1.7 0 0 0-.34-1.87L3 6.07a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 8 3.4a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V1.6a2 2 0 0 1 4 0v.09A1.7 1.7 0 0 0 15 3.4a1.7 1.7 0 0 0 1 .6 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 8a1.7 1.7 0 0 0 .6 1 1.7 1.7 0 0 0 1.1.4h.09a2 2 0 0 1 0 4h-.09A1.7 1.7 0 0 0 19.4 15z" />
            </svg>
            연결 설정
          </button>
          {connectionStatus.can_save && (
            <button
              type="button"
              onClick={() => void onDelete()}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-rose-300 bg-white px-4 text-sm font-bold text-rose-600 transition hover:bg-rose-50"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3" />
              </svg>
              연결 삭제
            </button>
          )}
        </div>
      </div>
    </section>
  )
}
