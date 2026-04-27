-- Shower Records 테이블
CREATE TABLE IF NOT EXISTS shower_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,              -- 샤워 날짜 (YYYY-MM-DD)
  start_time TEXT NOT NULL,        -- 시작 시간 (HH:MM)
  duration INTEGER NOT NULL,       -- 소요 시간 (분)
  
  -- 체크리스트
  body_soap INTEGER DEFAULT 0,     -- 비누칠 제대로 함 (0/1)
  hair_wash INTEGER DEFAULT 0,     -- 머리 감음 (0/1)
  teeth_brush INTEGER DEFAULT 0,   -- 이 닦음 (0/1)
  feet_wash INTEGER DEFAULT 0,     -- 발 씻음 (0/1)
  
  -- 계산 필드
  completeness_score REAL DEFAULT 0,  -- 완성도 점수
  frequency_score REAL DEFAULT 0,     -- 주기 점수
  duration_score REAL DEFAULT 0,      -- 시간 점수
  total_score REAL DEFAULT 0,         -- 총점
  grade TEXT DEFAULT 'D',             -- 등급 (S/A/B/C/D)
  
  -- 특수 플래그
  is_cat_shower INTEGER DEFAULT 0,    -- 고양이샤워 판정 (0/1)
  days_since_last INTEGER DEFAULT 0,  -- 마지막 샤워 이후 경과일
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_shower_date ON shower_records(date DESC);
CREATE INDEX IF NOT EXISTS idx_shower_grade ON shower_records(grade);
CREATE INDEX IF NOT EXISTS idx_shower_created ON shower_records(created_at DESC);
