-- Goal Claims Tracking
-- Track when users claim goal rewards to prevent duplicate claims

CREATE TABLE IF NOT EXISTS goal_claims (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  goal_id TEXT NOT NULL, -- 'strong_week', 'great_week', '30_day_streak', etc.
  claimed_date DATE NOT NULL,
  period_start DATE, -- For weekly goals
  period_end DATE,   -- For weekly goals
  average_score REAL, -- Record the score that achieved the goal
  streak_count INTEGER, -- For streak goals
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index for checking recent claims
CREATE INDEX IF NOT EXISTS idx_goal_claims_goal_date ON goal_claims(goal_id, claimed_date DESC);
CREATE INDEX IF NOT EXISTS idx_goal_claims_period ON goal_claims(goal_id, period_start, period_end);
