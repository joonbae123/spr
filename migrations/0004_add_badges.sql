-- Badges table
CREATE TABLE IF NOT EXISTS badges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  badge_id TEXT UNIQUE NOT NULL,
  unlocked_at DATETIME,
  progress INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Badge 정의는 코드에서 관리 (하드코딩)
