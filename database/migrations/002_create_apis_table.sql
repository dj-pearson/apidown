-- Migration 002: APIs table
-- Stores all monitored third-party APIs

CREATE TABLE IF NOT EXISTS apis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  base_domains TEXT[] NOT NULL,
  logo_url TEXT,
  status_page TEXT,
  current_status TEXT DEFAULT 'operational'
    CHECK (current_status IN ('operational', 'degraded', 'down')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for quick lookups by slug
CREATE INDEX IF NOT EXISTS idx_apis_slug ON apis (slug);
CREATE INDEX IF NOT EXISTS idx_apis_category ON apis (category);
