-- Migration 022: Status Page as a Service (Revenue Stream #1)
-- Upgrades the basic public status page into a full product with branding,
-- component selection, incident history, and subscriber notifications.

-- ============================================================
-- 1. Status Pages table (replaces user-column approach)
-- ============================================================
CREATE TABLE IF NOT EXISTS status_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL DEFAULT 'Status',
  description TEXT,
  is_enabled BOOLEAN DEFAULT false,

  -- Branding
  logo_url TEXT,
  accent_color TEXT DEFAULT '#06b4d4',
  custom_css TEXT,
  show_powered_by BOOLEAN DEFAULT true,

  -- Component visibility toggles
  show_uptime_bars BOOLEAN DEFAULT true,
  show_latency_chart BOOLEAN DEFAULT true,
  show_incidents BOOLEAN DEFAULT true,
  show_subscriber_form BOOLEAN DEFAULT true,

  -- Layout
  incidents_count INTEGER DEFAULT 5,
  uptime_days INTEGER DEFAULT 90,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_status_pages_user ON status_pages(user_id);
CREATE INDEX IF NOT EXISTS idx_status_pages_slug ON status_pages(slug);

ALTER TABLE status_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "status_pages_own" ON status_pages FOR ALL
  USING (auth.uid() = user_id);

-- Public read access for enabled pages (needed for the public route)
CREATE POLICY "status_pages_public_read" ON status_pages FOR SELECT
  USING (is_enabled = true);

-- ============================================================
-- 2. Status Page APIs junction table (which APIs appear on which page)
-- ============================================================
CREATE TABLE IF NOT EXISTS status_page_apis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status_page_id UUID NOT NULL REFERENCES status_pages(id) ON DELETE CASCADE,
  api_id UUID NOT NULL REFERENCES apis(id) ON DELETE CASCADE,
  display_order INTEGER DEFAULT 0,
  custom_label TEXT,  -- optional override of the API name on this page
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(status_page_id, api_id)
);

CREATE INDEX IF NOT EXISTS idx_status_page_apis_page ON status_page_apis(status_page_id);

ALTER TABLE status_page_apis ENABLE ROW LEVEL SECURITY;

-- Owner can manage their page's APIs
CREATE POLICY "status_page_apis_own" ON status_page_apis FOR ALL
  USING (
    status_page_id IN (SELECT id FROM status_pages WHERE user_id = auth.uid())
  );

-- Public read for enabled pages
CREATE POLICY "status_page_apis_public_read" ON status_page_apis FOR SELECT
  USING (
    status_page_id IN (SELECT id FROM status_pages WHERE is_enabled = true)
  );

-- ============================================================
-- 3. Status Page Subscribers (visitors who want notifications)
-- ============================================================
CREATE TABLE IF NOT EXISTS status_page_subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status_page_id UUID NOT NULL REFERENCES status_pages(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  verified BOOLEAN DEFAULT false,
  verify_token TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(status_page_id, email)
);

CREATE INDEX IF NOT EXISTS idx_sp_subscribers_page ON status_page_subscribers(status_page_id);

ALTER TABLE status_page_subscribers ENABLE ROW LEVEL SECURITY;

-- Page owners can view their subscribers
CREATE POLICY "sp_subscribers_own" ON status_page_subscribers FOR SELECT
  USING (
    status_page_id IN (SELECT id FROM status_pages WHERE user_id = auth.uid())
  );

-- Anyone can subscribe (insert) — public endpoint handles validation
CREATE POLICY "sp_subscribers_insert" ON status_page_subscribers FOR INSERT
  WITH CHECK (true);

-- ============================================================
-- 4. Migrate existing status page data from users table
-- ============================================================
INSERT INTO status_pages (user_id, slug, title, description, is_enabled)
SELECT
  id,
  public_status_slug,
  COALESCE(public_status_title, 'Status'),
  public_status_description,
  public_status_enabled
FROM users
WHERE public_status_slug IS NOT NULL
ON CONFLICT (slug) DO NOTHING;

-- Migrate pinned APIs into status_page_apis for migrated pages
INSERT INTO status_page_apis (status_page_id, api_id, display_order)
SELECT sp.id, pa.api_id, ROW_NUMBER() OVER (PARTITION BY sp.id ORDER BY pa.created_at)
FROM status_pages sp
JOIN pinned_apis pa ON pa.user_id = sp.user_id
ON CONFLICT (status_page_id, api_id) DO NOTHING;
