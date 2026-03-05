export function GET() {
  const body = `# APIdown.net

> Real-time API health status powered by crowd-sourced production traffic.

## About

APIdown.net monitors the health of popular third-party APIs (Stripe, OpenAI, AWS, Twilio, etc.) using real production traffic from developers who integrate our lightweight SDK. Unlike vendor status pages, our data comes from actual API consumers — giving you an unbiased, real-time view of whether an API is truly down or degraded.

## Key Features

- Real-time status dashboard for 30+ popular APIs
- Crowd-sourced health signals from production traffic
- Automatic anomaly detection and incident creation
- Alert subscriptions (email, Slack, Discord, PagerDuty, Teams)
- Lightweight JavaScript SDK (~2KB) for signal reporting
- Public JSON API for programmatic status checks
- Free tier for individual developers

## URLs

- Homepage: https://apidown.net
- API Status Dashboard: https://apidown.net
- Incidents: https://apidown.net/incidents
- SDK Documentation: https://apidown.net/docs
- Pricing: https://apidown.net/pricing
- JSON API: https://apidown.net/api-status
- Sitemap: https://apidown.net/sitemap.xml

## API Categories

- Payments (Stripe, PayPal, Square, Braintree)
- AI / LLM (OpenAI, Anthropic, Google Gemini, Cohere, Replicate, Groq)
- Communications (Twilio, SendGrid, Mailgun, Postmark)
- Cloud — AWS (S3, Lambda, SES, CloudFront)
- Cloud — GCP (Cloud Functions, Cloud Storage, Vertex AI)
- Cloud — Azure (Blob Storage, Cosmos DB, Azure Functions)
- Auth & Identity (Auth0, Clerk, Firebase Auth, Okta)
- Database / Storage (Supabase, PlanetScale, MongoDB Atlas, Upstash)
- Dev Tools & Hosting (GitHub, Vercel, Netlify, Cloudflare, Railway)

## Contact

- Website: https://apidown.net
- GitHub: https://github.com/dj-pearson/apidown
`;

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
