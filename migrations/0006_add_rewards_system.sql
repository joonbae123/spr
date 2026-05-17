-- Rewards System Tables

-- User points tracking
CREATE TABLE IF NOT EXISTS user_points (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  total_points INTEGER DEFAULT 0,
  lifetime_points INTEGER DEFAULT 0,
  last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Initialize default user
INSERT OR IGNORE INTO user_points (id, total_points, lifetime_points) VALUES (1, 0, 0);

-- Rewards tracking
CREATE TABLE IF NOT EXISTS rewards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reward_type TEXT NOT NULL, -- 'direct' or 'points'
  title TEXT NOT NULL,
  description TEXT,
  value TEXT, -- e.g., '~$30', '50 pts'
  achieved_date DATE NOT NULL,
  status TEXT DEFAULT 'pending', -- 'pending', 'claimed', 'delivered'
  claimed_date DATETIME,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Point transactions
CREATE TABLE IF NOT EXISTS point_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  amount INTEGER NOT NULL,
  reason TEXT NOT NULL,
  transaction_type TEXT NOT NULL, -- 'earn', 'spend'
  related_record_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (related_record_id) REFERENCES shower_records(id)
);

-- Point shop redemptions
CREATE TABLE IF NOT EXISTS point_redemptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_name TEXT NOT NULL,
  points_cost INTEGER NOT NULL,
  status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'delivered'
  redemption_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  delivery_notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_rewards_status ON rewards(status);
CREATE INDEX IF NOT EXISTS idx_rewards_achieved_date ON rewards(achieved_date DESC);
CREATE INDEX IF NOT EXISTS idx_point_transactions_date ON point_transactions(created_at DESC);
