# 대시보드 프로젝트 성능 최적화 기술 검토

## 📊 현재 상황 분석

### 1. 백엔드 (Python/FastAPI) 성능 분석

#### ✅ 잘 구현된 부분
- **비동기 처리**: httpx.AsyncClient 사용으로 동시 요청 효율적 처리
- **인메모리 캐싱**: TTLCache로 Redmine API 응답 캐싱 (기본 300초)
- **에러 처리**: 재시도(retry) 로직 + 타임아웃 설정으로 안정성 확보
- **의존성 최소화**: 필수 라이브러리만 사용 (fastapi, uvicorn, httpx, textile, beautifulsoup4)

#### ⚠️ 개선 필요 부분

1. **Uvicorn 워커 설정 부재**
   ```
   현재: CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
   문제: 단일 워커 (workers=1) → CPU 활용도 낮음
   ```
   - **영향**: CPU 사용률 2-3% 미만 (낭비)
   - **해결책**: CPU 코어 기반 워커 설정
   
2. **캐시 크기 제한 없음**
   ```python
   문제: TTLCache._store가 무제한 증가 가능
   시나리오: 많은 프로젝트 조회 시 메모리 계속 증가
   ```
   - **영향**: 메모리 누수 위험
   - **해결책**: 최대 캐시 항목 수 제한 (LRU 정책)

3. **동시 커넥션 풀 미설정**
   ```python
   현재: httpx.AsyncClient() # 기본값 사용
   문제: 동시 연결 수 제한 없음
   ```
   - **영향**: 너무 많은 동시 요청 시 메모리/파일 디스크립터 증가
   - **해결책**: limits=httpx.Limits(max_connections=10, max_keepalive_connections=5)

4. **요청 타임아웃 최적화 부재**
   ```python
   현재: timeout 설정 있지만, 전체 요청 시간제한 없음
   문제: Redmine API 느릴 때 대기 시간 길어짐
   ```
   - **해결책**: timeout 재설정 (예: 10초 → 5초)

---

### 2. 프론트엔드 (Next.js) 성능 분석

#### ✅ 잘 구현된 부분
- **멀티 스테이지 빌드**: deps → builder → runner (최종 이미지 크기 작음)
- **최소 번들**: 필수 라이브러리만 사용 (React 18, Tailwind, marked, dompurify)
- **Production 최적화**: NODE_ENV=production 설정
- **API 리라이팅**: /api/v1 프록시로 CORS 해결

#### ⚠️ 개선 필요 부분

1. **패키지 설치 최적화 부재**
   ```dockerfile
   현재: npm ci # 정확하지만 느린 설치
   문제: npm ci는 package-lock.json 검증 시간 소요
   ```
   - **영향**: 빌드 시간 1-2분 증가
   - **해결책**: --prefer-offline --no-audit 플래그 추가

2. **번들 크기 분석 도구 없음**
   ```
   현재: npm run build 후 최종 이미지 크기 확인만 함
   문제: 어떤 패키지가 큰지 알 수 없음
   ```
   - **해결책**: next/bundle-analyzer 도입
   
3. **이미지 최적화 미설정**
   ```javascript
   현재: next.config.mjs에서 이미지 최적화 설정 없음
   문제: 프로덕션에서 이미지 자동 최적화 안 됨
   ```
   - **해결책**: images.unoptimized 또는 이미지 리사이징 설정

4. **캐시 정책 미설정**
   ```
   현재: 정적 파일 캐시 헤더 없음
   문제: 브라우저가 매번 새로 다운로드
   ```
   - **해결책**: next.config.mjs에서 headers 설정

---

### 3. Docker 컨테이너 설정 분석

#### ⚠️ 개선 필요 부분

1. **리소스 제한 미설정**
   ```yaml
   현재: docker-compose.yml에 resources 제한 없음
   문제: 한 컨테이너가 모든 메모리 사용 가능
   ```
   - **영향**: OOM Killer 발동 시 다른 서비스 장애
   - **해결책**: 
     ```yaml
     resources:
       limits:
         cpus: '1'
         memory: 512M
       reservations:
         memory: 256M
     ```

2. **헬스 체크 미설정**
   ```
   현재: healthcheck 없음
   문제: 컨테이너 실행 중이지만 응답 불가 상태 감지 불가
   ```
   - **해결책**: healthcheck 추가

3. **로그 드라이버 미설정**
   ```
   현재: 기본 json-file 드라이버
   문제: 로그가 계속 증가하면 디스크 차지
   ```
   - **해결책**: 로그 로테이션 설정

4. **멀티 플랫폼 빌드 미지원**
   ```
   현재: docker build . (Linux x86_64만 대상)
   문제: NAS가 ARM 아키텍처면 호환성 문제
   ```
   - **해결책**: docker buildx 사용

---

### 4. 메모리 사용량 분석

| 컴포넌트 | 현재 추정치 | 우려사항 | 개선 후 예상치 |
|---------|----------|--------|--------------|
| Backend1 (8000) | 45-50 MiB | 캐시 무제한 증가 | 30-35 MiB |
| Backend2 (8010) | 45-50 MiB | 캐시 무제한 증가 | 30-35 MiB |
| Frontend (3000) | 70-80 MiB | 크기 적절 | 60-70 MiB |
| **총합** | **160-180 MiB** | - | **120-140 MiB** |

---

### 5. CPU 사용량 분석

| 상태 | 현재 CPU 사용률 | 문제점 | 개선 후 예상 |
|-----|--------------|------|-----------|
| 유휴 상태 | 0.3-0.5% | 정상 | 0.2-0.3% |
| 대시보드 조회 | 2-3% | 워커 1개만 사용 | 5-8% (병렬 처리 가능) |
| 피크 로드 | 8-10% | 처리량 부족 | 25-30% (4 코어 기반) |

---

## 🎯 우선순위별 개선안

### Phase 1 (즉시 적용, 5분)
```yaml
1. Docker 리소스 제한 추가
2. Uvicorn 워커 설정
3. 헬스 체크 추가
```

### Phase 2 (단기, 30분)
```yaml
1. 캐시 크기 제한 (LRU 정책)
2. httpx 커넥션 풀 최적화
3. 요청 타임아웃 단축
```

### Phase 3 (중기, 2시간)
```yaml
1. Next.js 번들 분석 및 최적화
2. 프론트엔드 캐시 정책 설정
3. 로그 로테이션 설정
```

### Phase 4 (장기, 1일)
```yaml
1. 모니터링 대시보드 (Prometheus + Grafana)
2. 데이터베이스 쿼리 최적화 (N+1 문제 확인)
3. CDN 및 이미지 최적화
```

---

## 📋 실행 계획

### 1단계: Docker Compose 개선
```yaml
resources:
  limits:
    cpus: '1'
    memory: 512M
  reservations:
    memory: 256M
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:8000/docs"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s
logging:
  driver: "json-file"
  options:
    max-size: "100m"
    max-file: "3"
```

### 2단계: Uvicorn 워커 설정
```bash
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
```

### 3단계: 캐시 최적화
```python
# TTLCache에 max_size 추가
class TTLCache:
    def __init__(self, default_ttl: int = 300, max_size: int = 1000):
        self._max_size = max_size
        # LRU 정책으로 가장 오래된 항목 제거
```

---

## 💾 메모리 절감 추정치

| 개선 항목 | 예상 절감 | 달성율 |
|---------|---------|------|
| 캐시 크기 제한 | 15-20 MiB | 10% |
| httpx 커넥션 제한 | 5-10 MiB | 5% |
| 프론트엔드 번들 최적화 | 10-15 MiB | 8% |
| **총 절감** | **30-45 MiB** | **20-25%** |
| **최종 예상 메모리** | **120-140 MiB** | - |

---

## 🚀 NAS 배포 전 체크리스트

- [ ] 리소스 제한 설정 (CPU, 메모리)
- [ ] 헬스 체크 추가
- [ ] 로그 로테이션 설정
- [ ] Uvicorn 워커 설정
- [ ] 캐시 크기 제한
- [ ] 모니터링 대시보드 구성
- [ ] 부하 테스트 (100 동시 사용자)
- [ ] 메모리 프로파일링
- [ ] CPU 사용률 모니터링

