# Redmine Operations Dashboard

Redmine REST API를 기반으로 프로젝트 운영 현황을 조회하는 대시보드입니다. 백엔드는 FastAPI, 프론트엔드는 Next.js로 구성되어 있으며 별도 데이터베이스 없이 동작합니다.

## Requirements

- Python 3.12+
- Node.js 20+
- npm
- Docker / Docker Compose (선택)
- 접근 가능한 Redmine 서버

## Quick Start

기본 실행 방법은 Docker Compose입니다.

1. 설정 파일을 복사합니다.

```powershell
Copy-Item config.example.json config.json
Copy-Item config.runtime.example.json config.runtime.json
```

2. Docker Compose로 전체 서비스를 실행합니다.

```bash
docker compose up --build
```

3. 아래 주소로 접속합니다.

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- Wiki Export API: http://localhost:8010
- Swagger UI: http://localhost:8000/docs

## Local Development

Docker 없이 개별 서비스만 실행해야 할 때 사용합니다.

### Backend

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

메인 API 실행:

```bash
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Wiki Export API 실행:

```bash
python -m uvicorn app.main:app --host 0.0.0.0 --port 8010 --reload
```

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

개발 서버 기본 주소는 http://localhost:3000 입니다.

## Configuration

### Config Files

- `config.json`: 기본 대시보드 설정
- `config.runtime.json`: UI에서 저장되는 런타임 Redmine 연결 정보

### Redmine Connection Priority

Redmine 연결 정보는 아래 순서로 적용됩니다.

1. 환경 변수
2. `config.runtime.json`
3. `config.json`

지원 환경 변수:

- `REDMINE_BASE_URL`
- `REDMINE_AUTH_TYPE` (`api_key` 또는 `basic`)
- `REDMINE_API_KEY`
- `REDMINE_USERNAME`
- `REDMINE_PASSWORD`

### Frontend API Variables

- `API_BASE_URL` (기본값: `http://localhost:8000`)
- `WIKI_API_BASE_URL` (기본값: `http://localhost:8010`)

## Project Structure

```text
app/         FastAPI backend
frontend/    Next.js frontend
k8s/         Kubernetes manifests
wikiexport/  Legacy compatibility module
```

## Deployment

배포 관련 파일은 아래 경로를 사용합니다.

- `docker-compose.yml`
- `Dockerfile`
- `Dockerfile.8010`
- `k8s/`
