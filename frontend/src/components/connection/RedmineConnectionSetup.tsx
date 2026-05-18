'use client'

import { useEffect, useMemo, useState } from 'react'

import { deleteRedmineConnection, saveRedmineConnection, testRedmineConnection } from '@/lib/api'
import type {
  RedmineAuthType,
  RedmineConnectionPayload,
  RedmineConnectionSource,
  RedmineConnectionStatusResponse,
  RedmineConnectionTestResponse,
} from '@/types/redmine-connection'

interface Props {
  initialStatus: RedmineConnectionStatusResponse | null
  onSaved: () => Promise<void> | void
  onCancel?: () => void
}

interface FormErrors {
  base_url?: string
  api_key?: string
  username?: string
  password?: string
}

const AUTH_METHOD_OPTIONS = [
  {
    value: 'api_key' as const,
    title: 'API 키 연결',
    detail: 'API 키로 Redmine에 연결합니다.',
    hint: 'Redmine에서 발급한 API 키를 입력하세요.',
  },
  {
    value: 'basic' as const,
    title: 'ID / 비밀번호 연결',
    detail: 'Redmine 계정으로 연결합니다.',
    hint: '가능하면 관리자만 사용하도록 제한하세요.',
  },
]

function buildInitialForm(status: RedmineConnectionStatusResponse | null): RedmineConnectionPayload {
  return {
    base_url: status?.connection?.base_url ?? '',
    auth_type: status?.connection?.auth_type ?? 'api_key',
    api_key: '',
    username: '',
    password: '',
  }
}

function buildPayload(form: RedmineConnectionPayload): RedmineConnectionPayload {
  const basePayload = {
    base_url: form.base_url.trim(),
    auth_type: form.auth_type,
  }

  if (form.auth_type === 'api_key') {
    return {
      ...basePayload,
      api_key: form.api_key?.trim() ?? '',
    }
  }

  return {
    ...basePayload,
    username: form.username?.trim() ?? '',
    password: form.password ?? '',
  }
}

function getSourceLabel(source: RedmineConnectionSource) {
  if (source === 'environment') return '환경 변수'
  if (source === 'legacy_config') return '기존 config.json'
  if (source === 'file') return '로컬 런타임 파일'
  if (source === 'cleared') return '로컬 저장 정보 삭제됨'
  return '설정되지 않음'
}

export default function RedmineConnectionSetup({ initialStatus, onSaved, onCancel }: Props) {
  const [form, setForm] = useState<RedmineConnectionPayload>(() => buildInitialForm(initialStatus))
  const [errors, setErrors] = useState<FormErrors>({})
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error' | 'info'; message: string } | null>(null)
  const [testResult, setTestResult] = useState<RedmineConnectionTestResponse | null>(null)
  const [testedFingerprint, setTestedFingerprint] = useState<string | null>(null)
  const [isTesting, setIsTesting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    setForm(buildInitialForm(initialStatus))
    setErrors({})
    setTestResult(null)
    setTestedFingerprint(null)

    if (initialStatus?.configured && initialStatus.connected) {
      setFeedback({
        tone: 'info',
        message: '메인 화면에 들어가기 전에 Redmine 연결을 다시 확인하세요.',
      })
    } else if (initialStatus && initialStatus.configured && !initialStatus.connected) {
      setFeedback({ tone: 'info', message: initialStatus.message })
    } else {
      setFeedback(null)
    }
  }, [initialStatus])

  const payload = useMemo(() => buildPayload(form), [form])
  const payloadFingerprint = useMemo(() => JSON.stringify(payload), [payload])
  const needsRetest = testedFingerprint !== payloadFingerprint
  const saveBlockedBySource = initialStatus?.can_save === false
  const canDeleteStoredConnection = Boolean(initialStatus?.configured && initialStatus.can_save)
  const hasBaseUrl = form.base_url.trim().length > 0
  const hasAuthSecret = form.auth_type === 'api_key'
    ? Boolean(form.api_key?.trim())
    : Boolean(form.username?.trim() && form.password)
  const readyToTest = hasBaseUrl && hasAuthSecret
  const verifiedCurrentInput = Boolean(testResult && !needsRetest)

  function resetTransientState() {
    setTestResult(null)
    setTestedFingerprint(null)
    setFeedback(null)
  }

  function handleFieldChange(field: keyof RedmineConnectionPayload, value: string) {
    setForm((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
    resetTransientState()
  }

  function handleAuthTypeChange(authType: RedmineAuthType) {
    setForm((current) => {
      if (authType === 'api_key') {
        return {
          ...current,
          auth_type: authType,
          api_key: '',
          username: '',
          password: '',
        }
      }

      return {
        ...current,
        auth_type: authType,
        api_key: '',
        username: '',
        password: '',
      }
    })
    setErrors({})
    resetTransientState()
  }

  function validateForm(): FormErrors {
    const nextErrors: FormErrors = {}
    const normalizedUrl = form.base_url.trim()

    if (!normalizedUrl) {
      nextErrors.base_url = 'Redmine 기본 URL을 입력하세요.'
    } else if (!/^https?:\/\//i.test(normalizedUrl)) {
      nextErrors.base_url = 'http:// 또는 https:// 로 시작하는 전체 URL을 입력하세요.'
    }

    if (form.auth_type === 'api_key' && !form.api_key?.trim()) {
      nextErrors.api_key = 'Redmine API 키를 입력하세요.'
    }

    if (form.auth_type === 'basic' && !form.username?.trim()) {
      nextErrors.username = 'Redmine 사용자 ID를 입력하세요.'
    }

    if (form.auth_type === 'basic' && !form.password) {
      nextErrors.password = 'Redmine 비밀번호를 입력하세요.'
    }

    return nextErrors
  }

  async function handleTestConnection() {
    const nextErrors = validateForm()
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      setFeedback({ tone: 'error', message: '연결 테스트 전에 필수 입력값을 모두 채워주세요.' })
      return
    }

    setErrors({})
    setIsTesting(true)
    setFeedback(null)

    try {
      const response = await testRedmineConnection(payload)
      setTestResult(response)
      setTestedFingerprint(payloadFingerprint)
      setFeedback({ tone: 'success', message: response.warning ?? response.message })
    } catch (error) {
      setTestResult(null)
      setTestedFingerprint(null)
      setFeedback({ tone: 'error', message: error instanceof Error ? error.message : '연결 테스트에 실패했습니다.' })
    } finally {
      setIsTesting(false)
    }
  }

  async function handleSaveConnection() {
    const nextErrors = validateForm()
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      setFeedback({ tone: 'error', message: '저장 전에 필수 입력값을 모두 채워주세요.' })
      return
    }

    if (saveBlockedBySource) {
      setFeedback({ tone: 'error', message: '이 연결은 환경 변수로 관리되고 있어 화면에서 덮어쓸 수 없습니다.' })
      return
    }

    if (needsRetest) {
      setFeedback({ tone: 'error', message: '현재 입력값으로 다시 연결 테스트를 통과한 뒤 저장하세요.' })
      return
    }

    setIsSaving(true)
    setFeedback(null)

    try {
      const response = await saveRedmineConnection(payload)
      setFeedback({ tone: 'success', message: response.warning ?? `${response.message} 캐시 정리: ${response.cleared_cache_keys}건` })
      await onSaved()
    } catch (error) {
      setFeedback({ tone: 'error', message: error instanceof Error ? error.message : 'Redmine 연결 설정 저장에 실패했습니다.' })
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDeleteConnection() {
    if (!canDeleteStoredConnection) {
      setFeedback({ tone: 'error', message: '이 연결 정보는 화면에서 삭제할 수 없습니다.' })
      return
    }

    const confirmed = window.confirm('저장된 Redmine 연결 정보와 개인 인증 정보를 삭제할까요? 삭제 후에는 다시 입력해야 합니다.')
    if (!confirmed) return

    setIsDeleting(true)
    setFeedback(null)

    try {
      const response = await deleteRedmineConnection()
      setForm(buildInitialForm(null))
      setErrors({})
      setTestResult(null)
      setTestedFingerprint(null)
      setFeedback({ tone: 'success', message: `${response.message} 캐시 정리: ${response.cleared_cache_keys}건` })
      await onSaved()
    } catch (error) {
      setFeedback({ tone: 'error', message: error instanceof Error ? error.message : '저장된 Redmine 연결 정보 삭제에 실패했습니다.' })
    } finally {
      setIsDeleting(false)
    }
  }

  const summary = initialStatus?.connection
  const sourceLabel = summary ? getSourceLabel(summary.source) : '설정되지 않음'

  return (
    <main className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(185,28,28,0.12),_transparent_26%),radial-gradient(circle_at_top_right,_rgba(245,158,11,0.22),_transparent_22%),linear-gradient(180deg,_#fffaf5_0%,_#f6f3ee_38%,_#eef1f4_100%)] px-5 py-8 sm:px-8 lg:px-10">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="relative overflow-hidden rounded-[32px] border border-amber-200/70 bg-[#1d1a16] px-6 py-7 text-white shadow-[0_30px_80px_-44px_rgba(120,53,15,0.75)] sm:px-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(245,158,11,0.28),_transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(248,113,113,0.24),_transparent_26%)]" />
          <div className="relative">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-200">Redmine 연결 설정</div>
            <h1 className="mt-4 max-w-md text-3xl font-semibold tracking-tight sm:text-4xl">Redmine 연결 정보를 입력하세요</h1>
            <p className="mt-4 max-w-lg text-sm leading-7 text-stone-300 sm:text-[15px]">
              대시보드에서 사용할 Redmine 연결 정보를 확인하는 화면입니다.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-4 backdrop-blur">
                <div className="text-xs uppercase tracking-[0.12em] text-stone-300">현재 설정 출처</div>
                <div className="mt-2 text-base font-semibold text-white">{sourceLabel}</div>
                <div className="mt-1 text-xs text-stone-300">{summary?.base_url ?? '아직 저장된 Redmine 기본 URL이 없습니다.'}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-4 backdrop-blur">
                <div className="text-xs uppercase tracking-[0.12em] text-stone-300">운영 가이드</div>
                <div className="mt-2 text-base font-semibold text-white">관리자 권장</div>
                <div className="mt-1 text-xs text-stone-300">ID / 비밀번호 방식은 관리자만 쓰는 편이 안전합니다.</div>
              </div>
            </div>

            <div className="mt-6 rounded-[24px] border border-white/10 bg-white/10 px-5 py-5 backdrop-blur">
              <div className="text-sm font-semibold text-white">연결 절차</div>
              <ol className="mt-3 space-y-3 text-sm leading-6 text-stone-300">
                <li>1. Redmine 주소를 입력합니다.</li>
                <li>2. 인증 방식을 선택하고 값을 입력합니다.</li>
                <li>3. 연결 테스트 후 저장합니다.</li>
              </ol>
            </div>

            <div className="mt-4 rounded-[24px] border border-white/10 bg-white/10 px-5 py-5 backdrop-blur">
              <div className="text-sm font-semibold text-white">개인정보 삭제</div>
              <p className="mt-2 text-sm leading-6 text-stone-300">
                저장된 연결 정보를 지우면 다시 입력해야 메인 화면에 들어갈 수 있습니다.
              </p>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
                <div className="text-xs uppercase tracking-[0.12em] text-stone-400">입력 준비</div>
                <div className="mt-2 text-base font-semibold text-white">{hasBaseUrl ? 'URL 입력됨' : 'URL 필요'}</div>
                <div className="mt-1 text-xs text-stone-400">Redmine 주소를 입력하세요.</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
                <div className="text-xs uppercase tracking-[0.12em] text-stone-400">인증 준비</div>
                <div className="mt-2 text-base font-semibold text-white">{hasAuthSecret ? '인증값 입력됨' : '인증값 필요'}</div>
                <div className="mt-1 text-xs text-stone-400">선택한 방식의 값만 사용합니다.</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
                <div className="text-xs uppercase tracking-[0.12em] text-stone-400">검증 상태</div>
                <div className="mt-2 text-base font-semibold text-white">{verifiedCurrentInput ? '테스트 통과' : '테스트 필요'}</div>
                <div className="mt-1 text-xs text-stone-400">테스트를 통과해야 저장할 수 있습니다.</div>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[32px] border border-slate-200 bg-white/92 p-6 shadow-[0_32px_80px_-50px_rgba(15,23,42,0.5)] backdrop-blur sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-950">Redmine 접근 정보 설정</div>
              <p className="mt-1 text-sm leading-6 text-slate-600">연결에 필요한 정보만 입력하고 테스트 후 저장하세요.</p>
            </div>
            {onCancel ? (
              <button
                type="button"
                onClick={onCancel}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-950"
              >
                프로젝트 목록으로 돌아가기
              </button>
            ) : null}
          </div>

          <div className="mt-6 space-y-5">
            <section className="rounded-[28px] border border-slate-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f8fafc_100%)] px-5 py-5 shadow-sm shadow-slate-200/40">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-950">1. Redmine 서버 주소</div>
                  <p className="mt-1 text-sm leading-6 text-slate-600">연결할 Redmine 기본 주소를 입력하세요.</p>
                </div>
                <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600">
                  {hasBaseUrl ? '입력 완료' : '입력 필요'}
                </div>
              </div>

              <label className="mt-4 block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Redmine 기본 URL</span>
                <input
                  type="url"
                  value={form.base_url}
                  onChange={(event) => handleFieldChange('base_url', event.target.value)}
                  placeholder="https://redmine.example.com"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-slate-200"
                />
                <div className="mt-2 text-xs text-slate-500">예: https://redmine.example.com</div>
                {errors.base_url ? <p className="mt-2 text-sm text-rose-600">{errors.base_url}</p> : null}
              </label>
            </section>

            <section className="rounded-[28px] border border-slate-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f8fafc_100%)] px-5 py-5 shadow-sm shadow-slate-200/40">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-950">2. 인증 방식 선택</div>
                  <p className="mt-1 text-sm leading-6 text-slate-600">사용할 인증 방식을 선택하세요. 방식이 바뀌면 이전 입력값은 지워집니다.</p>
                </div>
                <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600">
                  {form.auth_type === 'api_key' ? 'API 키 방식' : 'ID / 비밀번호 방식'}
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {AUTH_METHOD_OPTIONS.map((option) => {
                  const active = form.auth_type === option.value
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleAuthTypeChange(option.value)}
                      className={[
                        'rounded-[24px] border px-4 py-4 text-left transition',
                        active
                          ? 'border-amber-400 bg-[linear-gradient(135deg,_#111827_0%,_#1f2937_100%)] text-white shadow-[0_22px_40px_-30px_rgba(17,24,39,0.85)]'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50',
                      ].join(' ')}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold">{option.title}</div>
                        <span className={[
                          'rounded-full px-2.5 py-1 text-[11px] font-semibold',
                          active ? 'bg-white/12 text-amber-200' : 'bg-slate-100 text-slate-500',
                        ].join(' ')}>
                          {active ? '선택됨' : '선택 가능'}
                        </span>
                      </div>
                      <div className={`mt-2 text-sm leading-6 ${active ? 'text-slate-200' : 'text-slate-500'}`}>{option.detail}</div>
                      <div className={`mt-3 text-xs leading-5 ${active ? 'text-amber-100' : 'text-slate-400'}`}>{option.hint}</div>
                    </button>
                  )
                })}
              </div>
            </section>

            <section className="rounded-[28px] border border-slate-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f8fafc_100%)] px-5 py-5 shadow-sm shadow-slate-200/40">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-950">3. 인증 정보 입력</div>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    현재 선택한 방식에 필요한 값만 입력하세요. {form.auth_type === 'api_key' ? 'API 키는 다시 표시하지 않습니다.' : '비밀번호는 다시 표시하지 않습니다.'}
                  </p>
                </div>
                <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600">
                  {hasAuthSecret ? '입력 완료' : '입력 필요'}
                </div>
              </div>

              {form.auth_type === 'api_key' ? (
                <div className="mt-4 rounded-[24px] border border-sky-100 bg-sky-50/70 px-4 py-4">
                  <div className="text-sm font-semibold text-slate-900">API 키 입력</div>
                  <p className="mt-1 text-sm leading-6 text-slate-600">Redmine API 키를 입력하세요.</p>
                  <label className="mt-4 block">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Redmine API 키</span>
                    <input
                      type="password"
                      value={form.api_key ?? ''}
                      onChange={(event) => handleFieldChange('api_key', event.target.value)}
                      placeholder="Redmine API 접근에 사용할 키를 입력하세요"
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-slate-200"
                    />
                    <div className="mt-2 text-xs text-slate-500">가능하면 서비스용 키를 사용하는 편이 좋습니다.</div>
                    {errors.api_key ? <p className="mt-2 text-sm text-rose-600">{errors.api_key}</p> : null}
                  </label>
                </div>
              ) : (
                <div className="mt-4 rounded-[24px] border border-amber-100 bg-amber-50/70 px-4 py-4">
                  <div className="text-sm font-semibold text-slate-900">ID / 비밀번호 입력</div>
                  <p className="mt-1 text-sm leading-6 text-slate-600">Redmine 로그인 정보를 입력하세요.</p>
                  <div className="mt-4 grid gap-5 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">사용자 ID</span>
                      <input
                        type="text"
                        autoComplete="username"
                        value={form.username ?? ''}
                        onChange={(event) => handleFieldChange('username', event.target.value)}
                        placeholder="Redmine 사용자 ID"
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-slate-200"
                      />
                      <div className="mt-2 text-xs text-slate-500">Redmine에서 사용하는 ID를 입력하세요.</div>
                      {errors.username ? <p className="mt-2 text-sm text-rose-600">{errors.username}</p> : null}
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">비밀번호</span>
                      <input
                        type="password"
                        autoComplete="current-password"
                        value={form.password ?? ''}
                        onChange={(event) => handleFieldChange('password', event.target.value)}
                        placeholder="Redmine 비밀번호"
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-slate-200"
                      />
                      <div className="mt-2 text-xs text-slate-500">비밀번호는 다시 표시하지 않습니다.</div>
                      {errors.password ? <p className="mt-2 text-sm text-rose-600">{errors.password}</p> : null}
                    </label>
                  </div>
                </div>
              )}
            </section>

            <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 px-5 py-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-950">검증 및 안전성</div>
                  <p className="mt-1 text-sm leading-6 text-slate-600">민감한 값은 다시 표시하지 않습니다. 인증 방식을 바꾸면 다른 입력값은 지워집니다.</p>
                </div>
                <div className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600">
                  {summary?.uses_https ? 'HTTPS 사용 중' : 'HTTPS 권장'}
                </div>
              </div>

              {feedback ? (
                <div className={[
                  'mt-4 rounded-2xl border px-4 py-3 text-sm',
                  feedback.tone === 'success'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    : feedback.tone === 'error'
                      ? 'border-rose-200 bg-rose-50 text-rose-700'
                      : 'border-sky-200 bg-sky-50 text-sky-700',
                ].join(' ')}>
                  {feedback.message}
                </div>
              ) : null}

              {testResult ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white bg-white px-4 py-4">
                    <div className="text-xs uppercase tracking-[0.12em] text-slate-400">확인된 계정</div>
                    <div className="mt-2 text-base font-semibold text-slate-950">{testResult.server_user ?? '인증 완료'}</div>
                  </div>
                  <div className="rounded-2xl border border-white bg-white px-4 py-4">
                    <div className="text-xs uppercase tracking-[0.12em] text-slate-400">연결 대상</div>
                    <div className="mt-2 text-base font-semibold text-slate-950">{testResult.connection.base_url}</div>
                    <div className="mt-1 text-xs text-slate-500">{testResult.connection.auth_identity}</div>
                  </div>
                </div>
              ) : null}
            </div>

            <section className="rounded-[28px] border border-slate-200 bg-slate-950 px-5 py-5 text-white shadow-[0_24px_50px_-36px_rgba(15,23,42,0.85)]">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold">4. 연결 검증 및 저장</div>
                  <p className="mt-1 text-sm leading-6 text-slate-300">연결 테스트 후 저장하면 메인 화면으로 이동합니다.</p>
                </div>
                <div className="rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-semibold text-slate-200">
                  {verifiedCurrentInput ? '현재 입력값 검증 완료' : readyToTest ? '테스트 가능' : '입력값 보완 필요'}
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                  <div className="text-xs uppercase tracking-[0.12em] text-slate-400">URL</div>
                  <div className="mt-2 text-sm font-semibold text-white">{hasBaseUrl ? '준비됨' : '비어 있음'}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                  <div className="text-xs uppercase tracking-[0.12em] text-slate-400">인증값</div>
                  <div className="mt-2 text-sm font-semibold text-white">{hasAuthSecret ? '준비됨' : '비어 있음'}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                  <div className="text-xs uppercase tracking-[0.12em] text-slate-400">테스트 상태</div>
                  <div className="mt-2 text-sm font-semibold text-white">{verifiedCurrentInput ? '통과' : '미확인'}</div>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={isTesting || isSaving || isDeleting}
                  className="rounded-full bg-amber-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:bg-amber-200"
                >
                  {isTesting ? '연결 테스트 중...' : '연결 테스트'}
                </button>
                <button
                  type="button"
                  onClick={handleSaveConnection}
                  disabled={isTesting || isSaving || isDeleting || saveBlockedBySource || needsRetest}
                  className="rounded-full border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:border-white/10 disabled:text-slate-500"
                >
                  {isSaving ? '연결 확인 중...' : '연결하고 메인으로 이동'}
                </button>
                {canDeleteStoredConnection ? (
                  <button
                    type="button"
                    onClick={handleDeleteConnection}
                    disabled={isTesting || isSaving || isDeleting}
                    className="rounded-full border border-rose-300/60 bg-rose-400/10 px-5 py-3 text-sm font-semibold text-rose-100 transition hover:bg-rose-400/20 disabled:cursor-not-allowed disabled:border-rose-200/20 disabled:text-rose-200/40"
                  >
                    {isDeleting ? '삭제 중...' : '저장된 연결 삭제'}
                  </button>
                ) : null}
              </div>
            </section>

            <div className="grid gap-3 text-sm text-slate-500 sm:grid-cols-2">
              <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-4">
                연결 테스트를 통과해야 저장할 수 있습니다.
              </div>
              <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-4">
                다른 인증 방식이 필요하면 같은 흐름에 추가할 수 있습니다.
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}