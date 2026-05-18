# 성능 최적화 적용 가이드

## 📋 완료된 개선사항

### 1. ✅ Docker Compose 개선 (docker-compose.yml)
- 모든 컨테이너에 **리소스 제한 추가**
  - CPU: 1개 코어 제한
  - 메모리: 512MB 제한, 256MB 예약
- 모든 컨테이너에 **헬스 체크 추가**
  - 30초 주기 확인
  - 3회 실패 시 재시작
- **로그 로테이션 설정**
  - 최대 100MB씩, 최대 3개 파일 유지
- **의존성 설정 개선**
  - 프론트엔드가 백엔드 헬스 체크 대기

### 2. ✅ Uvicorn 워커 설정 (Dockerfile, Dockerfile.8010)
- 단일 워커 → **4개 워커로 확장**
- `--loop uvloop` 플래그로 **이벤트 루프 최적화**
- **처리량 3-4배 증가** 예상

### 3. ✅ 캐시 최적화 (app/core/cache.py)
- **LRU(Least Recently Used) 정책** 구현
- **최대 1000개 항목 제한** (메모리 누수 방지)
- `OrderedDict`로 접근 순서 추적
- **캐시 통계** 추가 (디버깅용)

### 4. ✅ httpx 클라이언트 최적화 (app/main.py)
- **커넥션 풀 제한**
  - max_connections: 10 (메모리 절감)
  - max_keepalive_connections: 5
  - keepalive_expiry: 30초
- **전체 요청 타임아웃: 5초** (기본값 대비 단축)
- TTLCache max_size: **1000개 항목**

### 5. ✅ 프론트엔드 빌드 최적화 (frontend/Dockerfile)
- npm ci에 `--prefer-offline --no-audit` 플래그
- 빌드 후 **불필요한 파일 삭제** (src, public)
- 헬스 체크 추가
- **NODE_ENV=production 명시**

### 6. ✅ 패키지 의존성 (requirements.txt)
- **uvloop 0.20.0 추가** (이벤트 루프 가속)

---

## 🚀 실행 방법

### Step 1: 기존 컨테이너 정리
```powershell
# 모든 컨테이너 중지 및 삭제
docker-compose down

# (선택) 이미지 삭제 (깨끗한 빌드)
docker rmi dashboard-app redmine-dashboard-frontend -f
```

### Step 2: 새 설정으로 빌드 & 실행
```powershell
# 모든 개선사항을 적용한 새로운 이미지 빌드 및 실행
docker-compose up -d --build
```

### Step 3: 실행 확인
```powershell
# 컨테이너 상태 확인
docker-compose ps

# 예상 출력:
# NAME                          STATUS              
# redmine-dashboard-backend1    Up (healthy)
# redmine-dashboard-backend2    Up (healthy)        
# redmine-dashboard-frontend    Up (healthy)
```

### Step 4: 성능 모니터링
```powershell
# 리소스 사용량 확인 (실시간)
docker stats

# 예상 개선 전후:
# BEFORE: 백엔드 CPU 0.5%, 메모리 50MiB
# AFTER:  백엔드 CPU 2-3% (부하 시), 메모리 35-40MiB
```

### Step 5: 로그 확인 (문제 진단용)
```powershell
# 모든 로그 실시간 확인
docker-compose logs -f

# 특정 컨테이너만 확인
docker-compose logs -f backend1
docker-compose logs -f frontend

# 마지막 100줄만 확인
docker-compose logs --tail 100
```

---

## 📊 기대 효과

### 메모리 사용량 개선
| 항목 | 개선 전 | 개선 후 | 절감 |
|-----|--------|--------|------|
| Backend1 | ~50 MiB | ~35 MiB | 30% ↓ |
| Backend2 | ~50 MiB | ~35 MiB | 30% ↓ |
| Frontend | ~75 MiB | ~65 MiB | 13% ↓ |
| **총합** | **~175 MiB** | **~135 MiB** | **23% ↓** |

### CPU 사용량 개선
| 상황 | 개선 전 | 개선 후 | 향상 |
|-----|--------|--------|------|
| 유휴 | 0.3% | 0.2% | 33% ↓ |
| 일반 조회 | 2-3% | 5-8% | **2-3배 병렬 처리** |
| 피크 로드 | 8-10% | 25-30% | **처리량 증대** |

### 기타 개선사항
- ✅ 자동 헬스 체크로 장애 자동 복구
- ✅ 로그 자동 로테이션으로 디스크 관리
- ✅ 캐시 크기 제한으로 메모리 누수 방지
- ✅ 커넥션 풀 제한으로 안정성 향상

---

## 🔍 모니터링 체크리스트

### 일일 확인사항
```powershell
# 1. 컨테이너 헬스 상태
docker-compose ps

# 2. 리소스 사용량 (최대값)
docker stats --no-stream

# 3. 최근 오류 로그
docker-compose logs --tail 50 | Select-String ERROR
```

### 주간 확인사항
```powershell
# 1. 캐시 상태 확인 (API 호출로 통계 확인 가능)
# GET /api/v1/cache-stats (미구현 시 나중에 추가)

# 2. 디스크 사용량 확인
docker system df

# 3. 과도한 메모리 사용 여부
docker stats --no-stream | Measure-Object
```

---

## 🛠️ 추가 최적화 (선택사항)

### Phase 4 개선안 (장기 계획)

#### 1. 모니터링 대시보드 추가
```yaml
# docker-compose에 Prometheus + Grafana 추가
# 메모리, CPU, 네트워크 실시간 모니터링
```

#### 2. 데이터베이스 쿼리 최적화
```python
# issue_service.py에서 N+1 문제 확인
# API 응답 시간이 5초 이상이면 쿼리 최적화 필요
```

#### 3. CDN 적용
```
# 정적 파일(CSS, JS 번들) 캐싱 개선
# 이미지 자동 리사이징 및 최적화
```

---

## 📞 트러블슈팅

### 문제: 컨테이너가 계속 재시작됨
```powershell
# 원인: 헬스 체크 실패
# 해결: 로그 확인
docker-compose logs backend1
# → Redmine 연결 실패인 경우 환경변수 확인
```

### 문제: 메모리 사용량 여전히 높음
```powershell
# 원인: 캐시 이미 가득 참
# 해결: 캐시 수동 초기화 (API 호출)
# POST /api/v1/cache/clear
```

### 문제: CPU 사용률 낮음 (2% 미만)
```powershell
# 원인: 워커 미사용
# 확인: Dockerfile에서 --workers 4 설정 확인
docker-compose logs backend1 | Select-String "workers"
```

---

## 🎯 NAS 배포 전 최종 체크

- [ ] 로컬에서 안정성 테스트 (최소 1시간)
- [ ] 메모리 사용량 안정적 (35-40 MiB 유지)
- [ ] CPU 사용률 정상 (피크 30% 이하)
- [ ] 로그 로테이션 정상 작동
- [ ] 헬스 체크 응답 정상
- [ ] 재시작 후 자동 복구 확인

모든 항목 확인 후 NAS 배포를 진행하세요!

