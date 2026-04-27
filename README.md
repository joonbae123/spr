# 🚿 SPR (Shower Performance Report)

## 프로젝트 개요

**SPR (Shower Performance Report)**는 IPR (Individual Performance Report)를 패러디한 재미있는 프로젝트입니다. 
개인의 샤워 습관을 데이터로 분석하고, 등급을 매기며, 트렌드를 추적하여 더 깨끗한 습관을 만들어가는 것을 목표로 합니다.

### 타겟 사용자
- **HW 님**: 좀 더 자주, 깨끗하게 씻기를 바라는 친구 😊

## 🎯 주요 기능

### 1. **샤워 기록 추가**
- 샤워 날짜/시간 입력
- 소요 시간 기록 (분)
- 체크리스트:
  - 🧼 비누칠 제대로 함
  - 🧴 머리 감음
  - 🪥 이 닦음
  - 🦶 발 씻음

### 2. **자동 점수 계산**
- **완성도 점수** (40%): 체크리스트 완료 항목 비율
- **주기 점수** (30%): 마지막 샤워 이후 경과일
- **시간 점수** (30%): 적정 시간(10-20분) 준수 여부

### 3. **등급 시스템** (IPR 동일)
| 등급 | 점수 | 의미 |
|------|------|------|
| **S** | 90점 이상 | 샤워의 神 🌟 |
| **A** | 80-89점 | 깨끗한 친구 😊 |
| **B** | 70-79점 | 보통 ✋ |
| **C** | 60-69점 | 좀 씻자... 😅 |
| **D** | 60점 미만 | 비상 상황 🚨 |

### 4. **고양이샤워 판정**
- 조건: 완성도 < 50% AND 시간 < 8분
- 판정 시 경고 표시 🐱

### 5. **Report 페이지**
- 전체 샤워 기록 리스트
- 날짜/시간/소요시간/점수/등급 표시
- 고양이샤워 여부 표시

### 6. **Scorecard 페이지**
- 등급별 분포 카드 (S/A/B/C/D)
- 점수 트렌드 차트 (최근 30일)
- 고양이샤워 통계
  - 전체 샤워 중 고양이샤워 비율
  - 평균 샤워 주기

## 🌐 접속 URL

### 샌드박스 (개발 환경)
- **SPR 앱**: https://3001-inv4yn5x3mtvk6th3pan9-2e1b9533.sandbox.novita.ai
- **포트**: 3001

### 기존 IPR 앱 (참고용)
- **IPR 앱**: https://3000-inv4yn5x3mtvk6th3pan9-2e1b9533.sandbox.novita.ai
- **포트**: 3000

## 📊 데이터 구조

### D1 Database: `shower_records`
```sql
CREATE TABLE shower_records (
  id INTEGER PRIMARY KEY,
  date TEXT,                  -- 샤워 날짜
  start_time TEXT,            -- 시작 시간
  duration INTEGER,           -- 소요 시간 (분)
  
  body_soap INTEGER,          -- 비누칠 (0/1)
  hair_wash INTEGER,          -- 머리 감음 (0/1)
  teeth_brush INTEGER,        -- 이 닦음 (0/1)
  feet_wash INTEGER,          -- 발 씻음 (0/1)
  
  completeness_score REAL,    -- 완성도 점수
  frequency_score REAL,       -- 주기 점수
  duration_score REAL,        -- 시간 점수
  total_score REAL,           -- 총점
  grade TEXT,                 -- 등급 (S/A/B/C/D)
  
  is_cat_shower INTEGER,      -- 고양이샤워 판정
  days_since_last INTEGER,    -- 마지막 샤워 이후 경과일
  
  created_at DATETIME,
  updated_at DATETIME
)
```

## 🎨 디자인 시스템

IPR 디자인 시스템을 그대로 재사용:
- **색상**: Blue (Primary), Purple (Secondary)
- **폰트**: Inter
- **아이콘**: Font Awesome
- **차트**: Chart.js
- **스타일**: TailwindCSS

## 💻 기술 스택

| 구분 | 기술 |
|------|------|
| **Backend** | Hono + TypeScript |
| **Database** | Cloudflare D1 (SQLite) |
| **Frontend** | Vanilla JavaScript + TailwindCSS |
| **Charts** | Chart.js |
| **Deployment** | Cloudflare Pages |

## 🚀 로컬 개발

### 1. 프로젝트 설정
```bash
cd /home/user/spr
npm install
```

### 2. 데이터베이스 초기화
```bash
# 마이그레이션 적용
npm run db:migrate:local

# 테스트 데이터 추가
npm run db:seed
```

### 3. 빌드
```bash
npm run build
```

### 4. 개발 서버 시작
```bash
# PM2로 시작 (권장)
pm2 start ecosystem.config.cjs

# 또는 직접 실행
npm run dev:d1
```

### 5. 테스트
```bash
curl http://localhost:3001
```

## 📁 프로젝트 구조

```
/home/user/spr/
├── src/
│   └── index.tsx           # Hono 백엔드 + 점수 계산 로직
├── public/
│   └── static/
│       └── app.js          # 프론트엔드 JavaScript
├── migrations/
│   └── 0001_initial_schema.sql  # DB 스키마
├── seed.sql                # 테스트 데이터
├── ecosystem.config.cjs    # PM2 설정
├── wrangler.jsonc          # Cloudflare 설정
├── package.json
└── README.md
```

## 📈 점수 계산 로직

### 1. 완성도 점수 (40%)
```typescript
completeness_score = (checked_items / 4) * 100
```

### 2. 주기 점수 (30%)
| 경과일 | 점수 |
|--------|------|
| 1일 | 100점 |
| 2일 | 80점 |
| 3일 | 60점 |
| 4일 | 40점 |
| 5일+ | 20점 |

### 3. 시간 점수 (30%)
| 소요 시간 | 점수 |
|-----------|------|
| < 5분 | 40점 (고양이샤워 의심) |
| 5-9분 | 70점 |
| 10-20분 | 100점 (적정) |
| 21-30분 | 90점 |
| 31분+ | 70점 (물 낭비) |

### 4. 총점
```typescript
total_score = completeness_score * 0.4 + 
              frequency_score * 0.3 + 
              duration_score * 0.3
```

## 🎯 사용 시나리오

### 시나리오 1: 완벽한 샤워
```
날짜: 2026-04-27
시간: 08:00
소요: 15분
체크: 🧼✅ 🧴✅ 🪥✅ 🦶✅

결과:
- 완성도: 100점
- 주기: 100점
- 시간: 100점
- 총점: 100점
- 등급: S
- 판정: ✅ 정상 샤워
```

### 시나리오 2: 고양이샤워
```
날짜: 2026-04-26
시간: 23:30
소요: 5분
체크: 🧼❌ 🧴❌ 🪥✅ 🦶❌

결과:
- 완성도: 25점
- 주기: 100점
- 시간: 50점
- 총점: 58점
- 등급: D
- 판정: 🐱 고양이샤워
```

## 🎨 UI 특징

- **WAIV 로고**: IPR과 동일한 로고 유지
- **샤워 아이콘**: 🚿 (헤더)
- **체크리스트 이모지**: 🧼🧴🪥🦶
- **등급별 색상**: S(보라), A(파랑), B(녹색), C(노랑), D(빨강)
- **고양이샤워 경고**: 🐱 + 주황색 배경

## 🔜 향후 계획

- [ ] 주간/월간 리포트
- [ ] 샤워 시간 추천 알림
- [ ] 친구와 점수 비교
- [ ] 샤워 배지 시스템
- [ ] 물 사용량 추정 기능

## 👥 대상

- **HW 님**: 이 앱으로 샤워 습관 개선하세요! 🚿
- **개발자**: IPR 패러디 프로젝트 참고용

## 📝 라이선스

MIT License - 자유롭게 사용하세요!

---

**Made with 💧 for cleaner habits**
