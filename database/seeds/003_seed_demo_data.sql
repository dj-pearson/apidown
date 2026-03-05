-- Seed: Demo incidents with timeline updates for presentation

-- Create a sample resolved incident for Stripe
INSERT INTO incidents (api_id, severity, title, status, started_at, resolved_at, regions, auto_created)
SELECT id, 'major', 'Stripe - Elevated Error Rates on Payment Intents API', 'resolved',
  now() - interval '3 days' - interval '2 hours',
  now() - interval '3 days' - interval '45 minutes',
  ARRAY['us-east-1', 'eu-west-1'], true
FROM apis WHERE slug = 'stripe'
ON CONFLICT DO NOTHING;

-- Create a sample resolved incident for OpenAI
INSERT INTO incidents (api_id, severity, title, status, started_at, resolved_at, regions, auto_created)
SELECT id, 'critical', 'OpenAI - Chat Completions API Unavailable', 'resolved',
  now() - interval '7 days',
  now() - interval '7 days' + interval '3 hours',
  ARRAY['us-east-1', 'us-west-2', 'eu-west-1'], true
FROM apis WHERE slug = 'openai'
ON CONFLICT DO NOTHING;

-- Create a sample resolved minor incident for Twilio
INSERT INTO incidents (api_id, severity, title, status, started_at, resolved_at, regions, auto_created)
SELECT id, 'minor', 'Twilio - Degraded SMS Delivery in EU Region', 'resolved',
  now() - interval '5 days',
  now() - interval '5 days' + interval '1 hour',
  ARRAY['eu-west-1'], true
FROM apis WHERE slug = 'twilio'
ON CONFLICT DO NOTHING;

-- Add timeline updates for the Stripe incident
INSERT INTO incident_updates (incident_id, status, message, created_at)
SELECT i.id, 'investigating', 'Anomaly detected: 35.2% error rate from 847 signals across 2 region(s). Investigating.',
  i.started_at + interval '1 minute'
FROM incidents i JOIN apis a ON i.api_id = a.id WHERE a.slug = 'stripe' AND i.title LIKE '%Stripe%' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO incident_updates (incident_id, status, message, created_at)
SELECT i.id, 'identified', 'Root cause identified: upstream provider reporting degraded service on their payment processing infrastructure.',
  i.started_at + interval '20 minutes'
FROM incidents i JOIN apis a ON i.api_id = a.id WHERE a.slug = 'stripe' AND i.title LIKE '%Stripe%' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO incident_updates (incident_id, status, message, created_at)
SELECT i.id, 'monitoring', 'Error rates decreasing. Monitoring recovery.',
  i.started_at + interval '1 hour'
FROM incidents i JOIN apis a ON i.api_id = a.id WHERE a.slug = 'stripe' AND i.title LIKE '%Stripe%' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO incident_updates (incident_id, status, message, created_at)
SELECT i.id, 'resolved', 'All signals have returned to normal. Incident resolved.',
  i.resolved_at
FROM incidents i JOIN apis a ON i.api_id = a.id WHERE a.slug = 'stripe' AND i.title LIKE '%Stripe%' LIMIT 1
ON CONFLICT DO NOTHING;
