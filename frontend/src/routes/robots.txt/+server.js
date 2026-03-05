export function GET() {
  const body = `User-agent: *
Allow: /

Sitemap: https://apidown.net/sitemap.xml
`;

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain' },
  });
}
