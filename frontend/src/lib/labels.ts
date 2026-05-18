// 공통 화면 라벨과 상태 명칭을 이 파일에서 통일합니다.

export const STATUS_GROUP_LABEL: Record<string, string> = {
  open: '대기',
  in_progress: '진행 중',
  closed: '완료',
  other: '기타',
}

export const ISSUE_PRESET_LABEL: Record<string, string> = {
  attention: '우선 확인',
  overdue: '기한 초과',
  due_soon: '마감 임박',
  stale: '장기 미갱신',
  high_priority: '높은 우선순위',
  unassigned: '미할당',
  closed_recently: '최근 완료',
}

export const DASHBOARD_NAV_LABEL = {
  home: '개요',
  issues: '이슈',
  team: '담당자',
  reports: '보고서',
  settings: '설정',
} as const

export const RELATION_LABEL: Record<string, string> = {
  parent: '상위 이슈',
  child: '하위 이슈',
  relates: '관련',
  blocks: '차단',
  blocked: '차단됨',
  precedes: '선행',
  follows: '후행',
  copied_to: '복사 대상',
  copied_from: '복사 원본',
  duplicates: '중복',
  duplicated: '중복 대상',
}

export const STATUS_GROUP_BADGE: Record<string, string> = {
  open: 'bg-yellow-100 text-yellow-800',
  in_progress: 'bg-blue-100 text-blue-800',
  closed: 'bg-green-100 text-green-800',
  other: 'bg-gray-100 text-gray-600',
}

export const PRIORITY_LABEL: Record<string, string> = {
  Immediate: '즉시',
  Urgent: '긴급',
  High: '높음',
  Normal: '보통',
  Low: '낮음',
}

export const PRIORITY_BADGE: Record<string, string> = {
  Immediate: 'bg-red-100 text-red-700',
  Urgent: 'bg-orange-100 text-orange-700',
  High: 'bg-amber-100 text-amber-700',
  Normal: 'bg-gray-100 text-gray-500',
  Low: 'bg-gray-50 text-gray-400',
}

export const PRIORITY_ORDER: Record<string, number> = {
  Immediate: 5,
  Urgent: 4,
  High: 3,
  Normal: 2,
  Low: 1,
}

export function formatSyncedLabel(date: Date): string {
  const diff = Math.round((Date.now() - date.getTime()) / 1000)

  if (diff < 60) return '방금 갱신'
  if (diff < 3600) return `${Math.round(diff / 60)}분 전 갱신`

  return `${date.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
  })} 기준 갱신`
}

export function getPriorityLabel(priority: string | null | undefined): string {
  if (!priority) return '없음'
  return PRIORITY_LABEL[priority] ?? priority
}
