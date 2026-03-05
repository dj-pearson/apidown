-- Seed: Additional APIs for coverage expansion

INSERT INTO apis (slug, name, category, base_domains, logo_url, status_page) VALUES
-- Cloud - GCP
('gcp-cloud-run', 'GCP Cloud Run', 'cloud-gcp', ARRAY['run.googleapis.com'], '/logos/gcp-cloudrun.svg', 'https://status.cloud.google.com'),
('gcp-cloud-sql', 'GCP Cloud SQL', 'cloud-gcp', ARRAY['sqladmin.googleapis.com'], '/logos/gcp-cloudsql.svg', 'https://status.cloud.google.com'),
('gcp-cloud-storage', 'GCP Cloud Storage', 'cloud-gcp', ARRAY['storage.googleapis.com'], '/logos/gcp-storage.svg', 'https://status.cloud.google.com'),
('gcp-bigquery', 'GCP BigQuery', 'cloud-gcp', ARRAY['bigquery.googleapis.com'], '/logos/gcp-bigquery.svg', 'https://status.cloud.google.com'),

-- Cloud - Azure
('azure-functions', 'Azure Functions', 'cloud-azure', ARRAY['management.azure.com'], '/logos/azure-functions.svg', 'https://status.azure.com'),
('azure-blob', 'Azure Blob Storage', 'cloud-azure', ARRAY['blob.core.windows.net'], '/logos/azure-blob.svg', 'https://status.azure.com'),
('azure-cosmos-db', 'Azure Cosmos DB', 'cloud-azure', ARRAY['documents.azure.com'], '/logos/azure-cosmos.svg', 'https://status.azure.com'),

-- Commerce & Shipping
('shopify', 'Shopify', 'commerce', ARRAY['admin.shopify.com', 'api.shopify.com'], '/logos/shopify.svg', 'https://status.shopify.com'),
('woocommerce', 'WooCommerce', 'commerce', ARRAY['woocommerce.com'], '/logos/woocommerce.svg', NULL),
('shippo', 'Shippo', 'commerce', ARRAY['api.goshippo.com'], '/logos/shippo.svg', NULL),
('easypost', 'EasyPost', 'commerce', ARRAY['api.easypost.com'], '/logos/easypost.svg', 'https://status.easypost.com'),

-- Additional Auth & Identity
('okta', 'Okta', 'auth', ARRAY['dev-12345.okta.com'], '/logos/okta.svg', 'https://status.okta.com'),
('auth0-2', 'Auth0', 'auth', ARRAY['auth0.com'], '/logos/auth0.svg', 'https://status.auth0.com'),
('clerk', 'Clerk', 'auth', ARRAY['api.clerk.com', 'clerk.com'], '/logos/clerk.svg', 'https://status.clerk.com'),

-- Additional Database / Storage
('planetscale', 'PlanetScale', 'database', ARRAY['api.planetscale.com'], '/logos/planetscale.svg', 'https://status.planetscale.com'),
('neon', 'Neon', 'database', ARRAY['console.neon.tech'], '/logos/neon.svg', 'https://neonstatus.com'),
('upstash', 'Upstash', 'database', ARRAY['api.upstash.com'], '/logos/upstash.svg', NULL),
('cloudflare-r2', 'Cloudflare R2', 'database', ARRAY['r2.cloudflarestorage.com'], '/logos/cloudflare-r2.svg', 'https://www.cloudflarestatus.com')

ON CONFLICT (slug) DO NOTHING;
