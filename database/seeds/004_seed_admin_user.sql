-- Seed: Platform admin user
-- User: Pearsonperformance@gmaill.com (UUID: 9e40a579-783d-4cd0-9887-d904bbcd0e86)
-- Run this after migration 012 (users table)

INSERT INTO users (id, email, display_name, tier, is_admin)
VALUES (
  '9e40a579-783d-4cd0-9887-d904bbcd0e86',
  'Pearsonperformance@gmaill.com',
  'DJ Pearson',
  'pro',
  true
)
ON CONFLICT (id) DO UPDATE SET is_admin = true;
