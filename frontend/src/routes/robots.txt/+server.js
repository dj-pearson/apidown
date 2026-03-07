export function GET() {
  const body = `# === Standard crawlers ===
User-agent: *
Allow: /
Disallow: /admin
Disallow: /dashboard
Disallow: /login
Disallow: /checkout
Disallow: /unsubscribe
Disallow: /sla
Disallow: /api/billing/
Disallow: /api/checkout
Disallow: /api/webhook/
Disallow: /auth/

Sitemap: https://apidown.net/sitemap.xml

# LLMs.txt — https://llmstxt.org
# Summary: https://apidown.net/llms.txt
# Full: https://apidown.net/llms-full.txt

# === AI Search / Retrieval agents (ALLOWED) ===
# These agents retrieve content to answer user queries with attribution
User-agent: OAI-SearchBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: Applebot-Extended
Allow: /

User-agent: ClaudeBot
Allow: /

# === AI Training scrapers (BLOCKED) ===
# These agents scrape content for model training without attribution
User-agent: GPTBot
Disallow: /

User-agent: CCBot
Disallow: /

User-agent: anthropic-ai
Disallow: /

User-agent: cohere-ai
Disallow: /

User-agent: Bytespider
Disallow: /

User-agent: FacebookBot
Disallow: /

User-agent: Omgilibot
Disallow: /

User-agent: Diffbot
Disallow: /
`;

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
