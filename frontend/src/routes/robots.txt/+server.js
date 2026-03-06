export function GET() {
  const body = `User-agent: *
Allow: /
Disallow: /admin
Disallow: /dashboard
Disallow: /login
Disallow: /checkout
Disallow: /unsubscribe

Sitemap: https://apidown.net/sitemap.xml

# LLMs.txt — https://llmstxt.org
# Summary: https://apidown.net/llms.txt
# Full: https://apidown.net/llms-full.txt
`;

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
