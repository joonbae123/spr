-- Add Bath and Exfoliation columns

ALTER TABLE shower_records ADD COLUMN bath INTEGER DEFAULT 0;
ALTER TABLE shower_records ADD COLUMN exfoliation INTEGER DEFAULT 0;

-- Bath (목욕): 욕조 사용, Body Soap + Feet Wash 자동 포함, +10 bonus
-- Exfoliation (각질제거): 목욕할 때만 가능, +5 bonus
