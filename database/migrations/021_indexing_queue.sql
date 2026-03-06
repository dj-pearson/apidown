-- Migration 021: Google Indexing API queue table
-- Tracks URLs that need to be submitted to Google for indexing

CREATE TABLE IF NOT EXISTS indexing_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL,
  action TEXT NOT NULL DEFAULT 'URL_UPDATED',  -- URL_UPDATED or URL_DELETED
  submitted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  submitted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_indexing_queue_pending ON indexing_queue(submitted, created_at)
  WHERE submitted = false;

-- Function to enqueue a URL for Google indexing
CREATE OR REPLACE FUNCTION enqueue_indexing(p_url TEXT, p_action TEXT DEFAULT 'URL_UPDATED')
RETURNS void AS $$
BEGIN
  INSERT INTO indexing_queue (url, action)
  VALUES (p_url, p_action)
  ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Trigger: when an API status changes, enqueue its URL
CREATE OR REPLACE FUNCTION trg_api_status_changed()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.current_status IS DISTINCT FROM NEW.current_status THEN
    INSERT INTO indexing_queue (url, action)
    VALUES ('https://apidown.net/api/' || NEW.slug, 'URL_UPDATED');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS api_index_on_status_change ON apis;
CREATE TRIGGER api_index_on_status_change
  AFTER UPDATE ON apis
  FOR EACH ROW EXECUTE FUNCTION trg_api_status_changed();

-- Trigger: when a new incident is created, enqueue its URL + the incidents list
CREATE OR REPLACE FUNCTION trg_incident_created()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO indexing_queue (url, action) VALUES
    ('https://apidown.net/incidents/' || NEW.id, 'URL_UPDATED'),
    ('https://apidown.net/incidents', 'URL_UPDATED');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS incident_index_on_create ON incidents;
CREATE TRIGGER incident_index_on_create
  AFTER INSERT ON incidents
  FOR EACH ROW EXECUTE FUNCTION trg_incident_created();

-- Trigger: when an incident is resolved, re-index it
CREATE OR REPLACE FUNCTION trg_incident_resolved()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO indexing_queue (url, action)
    VALUES ('https://apidown.net/incidents/' || NEW.id, 'URL_UPDATED');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS incident_index_on_resolve ON incidents;
CREATE TRIGGER incident_index_on_resolve
  AFTER UPDATE ON incidents
  FOR EACH ROW EXECUTE FUNCTION trg_incident_resolved();
