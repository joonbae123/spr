# 🚿 SPR (Shower Performance Report)

HW 친구의 위생 습관을 데이터로 개선시키는 패러디 프로젝트

## 🎯 프로젝트 개요

- **이름**: SPR (Shower Performance Report)
- **목적**: IPR (Individual Performance Report)을 패러디하여 샤워 습관을 점수화하고 추적
- **대상**: 자주 씻지 않는 HW 친구의 위생 개선
- **특징**: 고양이샤워 판정, 샤워 주기 추적, 완성도 평가

## 🌐 URLs

- **Sandbox URL**: https://3001-inv4yn5x3mtvk6th3pan9-2e1b9533.sandbox.novita.ai
- **프로젝트 위치**: `/home/user/spr/`

## 📊 KPI 시스템

### 1. 완성도 점수 (Completeness Score)
- **측정**: 체크리스트 완료율
- **항목**:
  - 🧼 비누칠 제대로 함
  - 🧴 머리 감음
  - 🪥 이 닦음
  - 🦶 발 씻음
- **계산**: (완료 항목 / 4) × 100
- **가중치**: 40%

### 2. 샤워 주기 점수 (Frequency Score)
- **측정**: 마지막 샤워 이후 경과일
- **점수**:
  - 1일: 100점 ✅
  - 2일: 80점 😊
  - 3일: 60점 😐
  - 4일: 40점 😰
  - 5일+: 20점 🚨
- **가중치**: 30%

### 3. 소요 시간 점수 (Duration Score)
- **측정**: 샤워에 소요된 시간
- **점수**:
  - 5분 미만: 40점 (고양이샤워 의심)
  - 5-9분: 70점
  - 10-20분: 100점 (이상적) ✨
  - 21-30분: 90점
  - 30분 초과: 70점 (물 낭비)
- **가중치**: 30%

### 4. 총점 & 등급
- **총점**: (완성도×0.4) + (주기×0.3) + (시간×0.3)
- **등급**:
  - **S등급** (90점 이상): 샤워의 神 🌟
  - **A등급** (80-89점): 깨끗한 친구 😊
  - **B등급** (70-79점): 보통 ✋
  - **C등급** (60-69점): 좀 씻자... 😅
  - **D등급** (60점 미만): 비상 상황 🚨

### 5. 고양이샤워 판정 🐱
- **조건**: 완성도 < 50% AND 소요시간 < 8분
- **효과**: 경고 표시 및 별도 통계 집계

## 🗂️ 데이터 구조

### shower_records 테이블

```sql
CREATE TABLE shower_records (
  id INTEGER PRIMARY KEY,
  date TEXT,              -- 샤워 날짜
  start_time TEXT,        -- 시작 시간
  duration INTEGER,       -- 소요 시간 (분)
  
  -- 체크리스트
  body_soap INTEGER,      -- 비누칠
  hair_wash INTEGER,      -- 머리감기
  teeth_brush INTEGER,    -- 이닦기
  feet_wash INTEGER,      -- 발씻기
  
  -- 계산 점수
  completeness_score REAL,
  frequency_score REAL,
  duration_score REAL,
  total_score REAL,
  grade TEXT,
  
  -- 플래그
  is_cat_shower INTEGER,
  days_since_last INTEGER
)
```

## 📈 주요 기능

### 1. Report 페이지
- 샤워 기록 리스트 조회
- 날짜, 시간, 완성도, 주기, 점수, 등급 표시
- 고양이샤워 플래그 표시

### 2. Scorecard 페이지
- 등급별 통계 (S/A/B/C/D 분포)
- 점수 트렌드 차트 (최근 30일)
- 고양이샤워 통계
  - 고양이샤워 비율
  - 총 샤워 횟수
  - 평균 샤워 주기

### 3. 샤워 기록 추가
- 날짜/시간 입력
- 소요 시간 입력
- 4가지 체크리스트 선택
- 자동 점수 계산 및 등급 부여

## 🎨 디자인 시스템

IPR 디자인을 그대로 계승:
- **색상**: Tailwind CSS 기본 컬러 (Blue, Purple, Green, Red)
- **폰트**: Inter (Google Fonts)
- **아이콘**: Font Awesome 6.4.0
- **차트**: Chart.js
- **레이아웃**: Responsive Grid (Tailwind)

## 🚀 배포 & 실행

### 로컬 개발

```bash
# 빌드
npm run build

# 데이터베이스 초기화
npm run db:reset

# PM2로 서버 시작
pm2 start ecosystem.config.cjs

# 테스트
curl http://localhost:3001
```

### 데이터베이스 관리

```bash
# 마이그레이션 적용
npm run db:migrate:local

# 테스트 데이터 추가
npm run db:seed

# DB 리셋
npm run db:reset
```

### Git 명령어

```bash
# 커밋
npm run git:commit "커밋 메시지"

# 포트 정리
npm run clean-port
```

## 📁 프로젝트 구조

```
/home/user/spr/
├── src/
│   └── index.tsx           # Hono 백엔드 (API + 프론트엔드)
├── public/
│   └── static/
│       └── app.js          # 프론트엔드 JavaScript
├── migrations/
│   └── 0001_initial_schema.sql
├── seed.sql                # 테스트 데이터
├── ecosystem.config.cjs    # PM2 설정
├── wrangler.jsonc          # Cloudflare Pages 설정
├── package.json
└── README.md
```

## 🎯 테스트 데이터

7개의 샘플 샤워 기록 포함:
- S등급: 2회 (완벽한 샤워)
- A등급: 2회 (괜찮은 샤워)
- B등급: 1회 (5일만에 샤워)
- D등급: 2회 (고양이샤워 🐱)

## 🔧 기술 스택

| 카테고리 | 기술 |
|---------|------|
| **프레임워크** | Hono 4.x |
| **런타임** | Cloudflare Workers |
| **데이터베이스** | Cloudflare D1 (SQLite) |
| **프론트엔드** | Vanilla JS + Tailwind CSS |
| **차트** | Chart.js |
| **배포** | Cloudflare Pages |

## 📝 사용 가이드

### 1. 샤워 기록 추가
1. 우측 상단 "샤워 기록 추가" 버튼 클릭
2. 날짜, 시간, 소요 시간 입력
3. 체크리스트 선택 (비누칠, 머리감기, 이닦기, 발씻기)
4. "저장" 버튼 클릭
5. 자동으로 점수 계산 및 등급 부여

### 2. Report 보기
- 전체 샤워 기록을 시간순으로 확인
- 각 기록의 완성도, 주기, 점수, 등급 표시
- 고양이샤워 플래그 확인

### 3. Scorecard 보기
- 등급별 통계 카드 (S/A/B/C/D)
- 점수 트렌드 그래프
- 고양이샤워 비율 및 경고

## 🎭 패러디 요소

| IPR | SPR |
|-----|-----|
| Worker Performance | Shower Performance |
| Utilization | 완성도 (Completeness) |
| Efficiency | 샤워 주기 (Frequency) |
| Total Score | 총점 |
| Grade (S/A/B/C/D) | 등급 (S/A/B/C/D) |
| Outlier Detection | 고양이샤워 판정 |
| MOD | Days Since Last |
| Process | Checklist Items |

## 🚨 주의사항

- 고양이샤워 비율이 30%를 넘으면 경고 표시
- 5일 이상 샤워를 안 하면 등급이 크게 하락
- 소요 시간이 너무 짧으면 자동으로 고양이샤워로 판정

## 🔮 향후 계획

- [ ] 샤워 기록 수정/삭제 기능
- [ ] 주간/월간 리포트
- [ ] 샤워 알림 기능 (n일째 안 씻음!)
- [ ] 친구들과 비교 (멀티 유저)
- [ ] 샤워 뱃지 시스템
- [ ] PDF 리포트 다운로드

## 📞 문의

IPR 패러디 프로젝트입니다. 실제 HW 친구의 위생 개선을 위해 만들어졌습니다! 🚿

---

**Last Updated**: 2026-04-27
**Version**: 1.0.0
**Status**: ✅ Active
