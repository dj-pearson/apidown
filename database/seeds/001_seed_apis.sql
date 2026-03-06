-- Seed: 30 launch APIs across all categories
-- Run after migrations

INSERT INTO apis (slug, name, category, base_domains, logo_url, status_page) VALUES
-- Payments
('stripe', 'Stripe', 'payments', ARRAY['api.stripe.com', 'js.stripe.com'], '/logos/stripe.svg', 'https://status.stripe.com'),
('paypal', 'PayPal', 'payments', ARRAY['api.paypal.com', 'api-m.paypal.com'], '/logos/paypal.svg', 'https://www.paypal-status.com'),
('square', 'Square', 'payments', ARRAY['connect.squareup.com'], '/logos/square.svg', 'https://issquareup.com'),
('braintree', 'Braintree', 'payments', ARRAY['api.braintreegateway.com', 'payments.braintree-api.com'], '/logos/braintree.svg', 'https://status.braintreepayments.com'),

-- AI / LLM
('openai', 'OpenAI', 'ai', ARRAY['api.openai.com'], '/logos/openai.svg', 'https://status.openai.com'),
('anthropic', 'Anthropic', 'ai', ARRAY['api.anthropic.com'], '/logos/anthropic.svg', 'https://status.anthropic.com'),
('google-gemini', 'Google Gemini', 'ai', ARRAY['generativelanguage.googleapis.com'], '/logos/gemini.svg', 'https://status.cloud.google.com'),
('cohere', 'Cohere', 'ai', ARRAY['api.cohere.ai', 'api.cohere.com'], '/logos/cohere.svg', NULL),
('replicate', 'Replicate', 'ai', ARRAY['api.replicate.com'], '/logos/replicate.svg', 'https://status.replicate.com'),
('groq', 'Groq', 'ai', ARRAY['api.groq.com'], '/logos/groq.svg', NULL),

-- Communications
('twilio', 'Twilio', 'communications', ARRAY['api.twilio.com'], '/logos/twilio.svg', 'https://status.twilio.com'),
('sendgrid', 'SendGrid', 'communications', ARRAY['api.sendgrid.com'], '/logos/sendgrid.svg', 'https://status.sendgrid.com'),
('mailgun', 'Mailgun', 'communications', ARRAY['api.mailgun.net'], '/logos/mailgun.svg', 'https://status.mailgun.com'),
('postmark', 'Postmark', 'communications', ARRAY['api.postmarkapp.com'], '/logos/postmark.svg', 'https://status.postmarkapp.com'),

-- Cloud - AWS
('aws-s3', 'AWS S3', 'cloud-aws', ARRAY['s3.amazonaws.com', 's3.us-east-1.amazonaws.com'], '/logos/aws-s3.svg', 'https://health.aws.amazon.com'),
('aws-lambda', 'AWS Lambda', 'cloud-aws', ARRAY['lambda.us-east-1.amazonaws.com'], '/logos/aws-lambda.svg', 'https://health.aws.amazon.com'),
('aws-ses', 'AWS SES', 'cloud-aws', ARRAY['email.us-east-1.amazonaws.com'], '/logos/aws-ses.svg', 'https://health.aws.amazon.com'),
('aws-cloudfront', 'AWS CloudFront', 'cloud-aws', ARRAY['cloudfront.amazonaws.com'], '/logos/aws-cloudfront.svg', 'https://health.aws.amazon.com'),

-- Auth & Identity
('auth0', 'Auth0', 'auth', ARRAY['auth0.com'], '/logos/auth0.svg', 'https://status.auth0.com'),
('clerk', 'Clerk', 'auth', ARRAY['api.clerk.com', 'clerk.com'], '/logos/clerk.svg', 'https://status.clerk.com'),
('firebase-auth', 'Firebase Auth', 'auth', ARRAY['identitytoolkit.googleapis.com', 'securetoken.googleapis.com'], '/logos/firebase.svg', 'https://status.firebase.google.com'),

-- Database / Storage
('supabase', 'Supabase', 'database', ARRAY['supabase.co', 'supabase.com'], '/logos/supabase.svg', 'https://status.supabase.com'),
('planetscale', 'PlanetScale', 'database', ARRAY['aws.connect.psdb.cloud'], '/logos/planetscale.svg', 'https://www.planetscalestatus.com'),
('mongodb-atlas', 'MongoDB Atlas', 'database', ARRAY['cloud.mongodb.com', 'data.mongodb-api.com'], '/logos/mongodb.svg', 'https://status.cloud.mongodb.com'),
('upstash', 'Upstash', 'database', ARRAY['api.upstash.com', 'upstash.io'], '/logos/upstash.svg', 'https://status.upstash.com'),

-- Dev Tools & Hosting
('github', 'GitHub', 'devtools', ARRAY['api.github.com'], '/logos/github.svg', 'https://www.githubstatus.com'),
('vercel', 'Vercel', 'devtools', ARRAY['api.vercel.com', 'vercel.com'], '/logos/vercel.svg', 'https://www.vercel-status.com'),
('netlify', 'Netlify', 'devtools', ARRAY['api.netlify.com'], '/logos/netlify.svg', 'https://www.netlifystatus.com'),
('cloudflare', 'Cloudflare', 'devtools', ARRAY['api.cloudflare.com'], '/logos/cloudflare.svg', 'https://www.cloudflarestatus.com'),
('railway', 'Railway', 'devtools', ARRAY['backboard.railway.app'], '/logos/railway.svg', 'https://status.railway.app')

ON CONFLICT (slug) DO NOTHING;
