'use client'

import { useEffect, useState } from 'react'

import ProjectSelectView from '@/components/ProjectSelectView'
import OverviewShell from '@/components/overview/OverviewShell'
import RedmineConnectionSetup from '@/components/connection/RedmineConnectionSetup'
import { deleteRedmineConnection, fetchConnectionStatus } from '@/lib/api'
import type { RedmineConnectionStatusResponse } from '@/types/redmine-connection'

const REDMINE_SESSION_ACCESS_KEY = 'REDMINE_SESSION_ACCESS_GRANTED'

export default function HomePage() {
  const [status, setStatus] = useState<RedmineConnectionStatusResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showSetup, setShowSetup] = useState(false)
  const [sessionAccessGranted, setSessionAccessGranted] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    setSessionAccessGranted(window.sessionStorage.getItem(REDMINE_SESSION_ACCESS_KEY) === 'true')
  }, [])

  function grantSessionAccess() {
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(REDMINE_SESSION_ACCESS_KEY, 'true')
    }
    setSessionAccessGranted(true)
  }

  function revokeSessionAccess() {
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(REDMINE_SESSION_ACCESS_KEY)
    }
    setSessionAccessGranted(false)
  }

  async function loadConnectionStatus() {
    setLoading(true)
    setError(null)

    try {
      const nextStatus = await fetchConnectionStatus()
      setStatus(nextStatus)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Redmine 연결 상태를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }

  async function handleDeleteConnection() {
    const confirmed = window.confirm('저장된 Redmine 연결 정보와 개인 인증 정보를 삭제할까요? 삭제 후에는 다시 입력해야 합니다.')
    if (!confirmed) return

    try {
      await deleteRedmineConnection()
      revokeSessionAccess()
      await loadConnectionStatus()
      setShowSetup(true)
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : '저장된 Redmine 연결 정보를 삭제하지 못했습니다.')
    }
  }

  useEffect(() => {
    void loadConnectionStatus()
  }, [])

  const connected = Boolean(status?.configured && status.connected)
  const canViewMainPage = connected && sessionAccessGranted && !showSetup

  if (loading) {
    return (
      <OverviewShell title="개요">
        <div className="flex items-center justify-center py-20">
          <div className="max-w-xl rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm shadow-slate-200/30">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900" />
            <div className="mt-4 text-sm font-semibold text-slate-900">Redmine 연결 상태 확인 중</div>
            <div className="mt-1 text-sm text-slate-500">프로젝트 데이터를 불러오기 전에 외부 시스템 연결 상태를 확인하고 있습니다.</div>
          </div>
        </div>
      </OverviewShell>
    )
  }

  if (error) {
    return (
      <OverviewShell title="개요">
        <div className="flex items-center justify-center py-20">
          <div className="max-w-xl rounded-2xl border border-rose-200 bg-rose-50 p-6 shadow-sm shadow-slate-200/25">
            <div className="text-sm font-semibold uppercase tracking-[0.18em] text-rose-600">연결 상태 확인 실패</div>
            <h1 className="mt-3 text-xl font-semibold tracking-tight text-slate-950">대시보드가 Redmine 연결 상태를 읽지 못했습니다</h1>
            <p className="mt-3 text-sm leading-6 text-slate-700">{error}</p>
            <button
              type="button"
              onClick={() => void loadConnectionStatus()}
              className="mt-5 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              다시 시도
            </button>
          </div>
        </div>
      </OverviewShell>
    )
  }

  if (!status || !canViewMainPage) {
    return (
      <RedmineConnectionSetup
        initialStatus={status}
        onSaved={async () => {
          await loadConnectionStatus()
          grantSessionAccess()
          setShowSetup(false)
        }}
        onCancel={connected && sessionAccessGranted ? () => setShowSetup(false) : undefined}
      />
    )
  }

  return (
    <ProjectSelectView
      connectionStatus={status}
      onOpenConnectionSettings={() => setShowSetup(true)}
      onDeleteConnection={handleDeleteConnection}
    />
  )
}
