# Project Features

현재 코드 기준으로 구현된 기능과 책임 분리를 빠르게 파악하기 위한 문서입니다.  
설명은 실제 남아 있는 코드 경로 기준으로 정리했습니다.

## 1. 프로젝트 개요

- Redmine REST API를 직접 조회하는 운영 대시보드
- FastAPI 백엔드 + Next.js 프런트엔드 구성
- 별도 DB 없이 Redmine 실시간 조회 + 메모리 TTL 캐시 사용
- Redmine 연결 관리, 운영 대시보드, 팀 분석, 위키 export 기능 포함

## 2. Redmine 연결 관리

지원 기능:

- 현재 연결 상태 조회
- API Key / Basic 인증 테스트
- 연결 저장 및 삭제
- 환경 변수, `config.runtime.json`, `config.json` 순서로 연결 정보 로드

관련 파일:

- `app/api/v1/redmine.py`
- `app/services/redmine_connection_service.py`
- `app/core/connection_store.py`
- `app/client/redmine_client.py`
- `frontend/src/components/connection/RedmineConnectionSetup.tsx`

관련 API:

- `GET /api/v1/redmine/connection-status`
- `POST /api/v1/redmine/test-connection`
- `POST /api/v1/redmine/save-connection`
- `DELETE /api/v1/redmine/connection`

## 3. 프로젝트 선택 화면

지원 기능:

- 앱 진입 시 Redmine 연결 상태 확인
- 연결 상태에 따라 연결 설정 또는 프로젝트 선택 화면 분기
- 프로젝트 위험도(`risk_score`, `risk_level`, `primary_reason`) 표시
- 최근 방문 프로젝트 로컬 저장

관련 파일:

- `frontend/src/app/page.tsx`
- `frontend/src/components/ProjectSelectView.tsx`
- `frontend/src/components/ProjectSelect.tsx`
- `app/services/project_service.py`

관련 API:

- `GET /api/v1/dashboard/projects`

## 4. 홈 대시보드

지원 기능:

- KPI 카드
- 즉시 조치 액션 패널
- 상태 스냅샷
- 팀/운영 안정 상태 요약
- 담당자 인사이트 카드

관련 파일:

- `frontend/src/app/dashboard/[projectId]/page.tsx`
- `frontend/src/components/KPICard.tsx`
- `frontend/src/components/ActionPanel.tsx`
- `frontend/src/components/UserInsightCard.tsx`
- `frontend/src/lib/dashboard/model.ts`
- `frontend/src/lib/dashboard/scoring.ts`
- `frontend/src/lib/dashboard/insights.ts`

관련 API:

- `GET /api/v1/dashboard/summary`
- `GET /api/v1/dashboard/issues`

## 5. 이슈 탐색 화면

지원 기능:

- 이슈 전체 목록 조회
- preset 기반 필터
- 검색, 정렬, 담당자/상태 필터
- 모바일 카드 / 데스크톱 테이블 대응
- 상세 드로어 연동

상세 드로어 제공 정보:

- 기본 메타데이터
- 설명 본문
- 첨부 파일
- 저널 이력
- 관련 이슈

관련 파일:

- `frontend/src/app/dashboard/[projectId]/issues/page.tsx`
- `frontend/src/components/IssueExplorer.tsx`
- `frontend/src/components/IssueListTable.tsx`
- `frontend/src/components/IssueDetailDrawer.tsx`
- `frontend/src/components/issues/IssueSplitView.tsx`
- `app/services/issue_service.py`

관련 API:

- `GET /api/v1/dashboard/issues`
- `GET /api/v1/dashboard/issues/{issue_id}`
- `GET /api/v1/dashboard/issues/overdue`

## 6. 팀 분석 화면

지원 기능:

- 담당자별 workload 집계
- 미할당 이슈 포함 조회
- 담당자별 위험 신호 표시
- 담당자 행동/운영 인사이트
- 담당자별 상세 이슈 확인

관련 파일:

- `frontend/src/app/dashboard/[projectId]/team/page.tsx`
- `frontend/src/components/team/TeamOverviewSection.tsx`
- `frontend/src/components/TeamCapacityPanel.tsx`
- `frontend/src/components/AssigneeInsightsPanel.tsx`
- `frontend/src/components/UserInsightCard.tsx`
- `app/services/workload_service.py`

관련 API:

- `GET /api/v1/dashboard/workload`
- `GET /api/v1/dashboard/workload/member`

## 7. 설정 화면

지원 기능:

- 대시보드 기준값 preset 적용
- 점수 가중치 및 임계값 조정
- localStorage 저장
- 설정 변경 즉시 화면 계산 반영

관련 파일:

- `frontend/src/app/dashboard/[projectId]/settings/page.tsx`
- `frontend/src/components/settings/SettingsOverviewSection.tsx`
- `frontend/src/components/settings/ThresholdSettingsForm.tsx`
- `frontend/src/lib/dashboard/settings.ts`
- `frontend/src/lib/dashboard/thresholds.ts`

## 8. 공통 프로젝트 shell

지원 기능:

- Home / Issues / Team / Settings 공통 레이아웃
- 프로젝트 전환 드롭다운
- 마지막 동기화 시각 표시
- 공통 데이터 로딩 / refresh 처리
- 위키 export 버튼과 상태 표시

관련 파일:

- `frontend/src/components/shell/DashboardProjectLayout.tsx`
- `frontend/src/hooks/useDashboardProjectData.ts`

## 9. Redmine 자산 프록시

지원 기능:

- Redmine 첨부 파일/이미지 프록시 조회
- 현재 인증 정보를 사용해 보호 리소스 접근
- 동일 origin 검증

관련 파일:

- `app/api/v1/dashboard.py`
- `app/client/redmine_client.py`
- `frontend/src/lib/redmineAssets.ts`

관련 API:

- `GET /api/v1/dashboard/assets`

## 10. 위키 오프라인 export

지원 기능:

- Redmine Wiki를 오프라인용 HTML + assets ZIP으로 export
- 작업 생성 후 백그라운드 비동기 처리
- 진행률/로그/완료 상태 조회
- 완료 후 ZIP 다운로드

관련 파일:

- `app/api/v1/wiki_export.py`
- `app/services/wiki_export_service.py`
- `app/services/wiki_export_jobs.py`
- `frontend/src/lib/api.ts`
- `frontend/src/components/shell/DashboardProjectLayout.tsx`

관련 API:

- `POST /api/v1/wiki-export/jobs`
- `GET /api/v1/wiki-export/jobs/{job_id}`
- `GET /api/v1/wiki-export/jobs/{job_id}/download`

## 11. 백엔드 책임 범위

- FastAPI 앱 초기화와 예외 처리
- Redmine 비동기 HTTP 호출
- 프로젝트/이슈/workload 집계
- 연결 상태 관리
- 위키 export 작업 처리
- Pydantic 응답 스키마 제공

핵심 파일:

- `app/main.py`
- `app/client/redmine_client.py`
- `app/services/*.py`
- `app/schemas/*.py`
- `app/api/v1/*.py`

## 12. 프런트엔드 책임 범위

- App Router 기반 화면 구성
- API fetch 래퍼
- 대시보드 view model 계산
- 위험 신호, 점수, 인사이트 계산
- 차트 및 카드 UI 렌더링
- 로컬 설정 저장

핵심 파일:

- `frontend/src/app/**/*`
- `frontend/src/components/**/*`
- `frontend/src/lib/api.ts`
- `frontend/src/lib/dashboard/**/*`
- `frontend/src/types/**/*`

## 13. 주요 설정/운영 방식

- 백엔드 기본 주소: `http://localhost:8000`
- 프런트 기본 주소: `http://localhost:3000`
- 프런트는 rewrite로 `/api/v1/*`를 백엔드로 프록시
- Redmine 연결 정보는 환경 변수 또는 로컬 설정 파일에서 로드
- 캐시는 프로세스 메모리에 저장되므로 서버 재시작 시 초기화

관련 파일:

- `frontend/next.config.mjs`
- `config.json`
- `config.runtime.json`

## 14. 현재 한계

- 별도 영속 DB가 없음
- 캐시가 프로세스 메모리 단위라 다중 인스턴스 간 공유되지 않음
- 장기 히스토리 기반 지표는 제한적
- Redmine 응답 속도와 연결 상태에 직접 영향받음
