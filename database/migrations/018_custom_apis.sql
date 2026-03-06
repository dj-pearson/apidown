-- Migration 018: Custom APIs support
-- Allows users to add their own APIs for monitoring

-- Add columns to apis table for custom API support
ALTER TABLE apis ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE apis ADD COLUMN IF NOT EXISTS is_custom BOOLEAN DEFAULT false;
ALTER TABLE apis ADD COLUMN IF NOT EXISTS probe_url TEXT;
ALTER TABLE apis ADD COLUMN IF NOT EXISTS expected_status INTEGER DEFAULT 200;

-- Encrypted auth header for custom API probing.
-- Stores AES-256-GCM ciphertext (iv:authTag:ciphertext, base64).
-- The encryption key is an env var on worker/ingest, never in the DB.
ALTER TABLE apis ADD COLUMN IF NOT EXISTS probe_auth_encrypted TEXT;

-- Only store a masked hint for display (e.g. "Authorization: Bearer sk-ant-...xxxx")
ALTER TABLE apis ADD COLUMN IF NOT EXISTS probe_auth_hint TEXT;

-- Index for finding a user's custom APIs quickly
CREATE INDEX IF NOT EXISTS idx_apis_owner_id ON apis (owner_id) WHERE owner_id IS NOT NULL;
