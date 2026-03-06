-- Migration 019: Track MFA enrollment status on users table
-- Supabase Auth handles the actual TOTP secrets — we just track display state

ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN DEFAULT false;
