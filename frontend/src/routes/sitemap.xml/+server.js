import { getSupabaseAdmin, setPlatform } from "$lib/supabase-server.js";

export async function GET({ platform }) {
  setPlatform(platform);

  let apis = [];
  let incidents = [];
  let statusPages = [];
  let debug = "";

  try {
    const cf = platform?.env || {};
    const envKeys = Object.keys(cf);
    debug = `platform=${!!platform}, envKeys=${envKeys.length}`;

    const supabase = getSupabaseAdmin();

    const [apisRes, incRes, spRes] = await Promise.all([
      supabase.from("apis").select("slug, current_status").order("name"),
      supabase.from("incidents").select("id, started_at, resolved_at, status").order("started_at", { ascending: false }).limit(200),
      supabase.from("users").select("public_status_slug").eq("public_status_enabled", true).not("public_status_slug", "is", null),
    ]);

    apis = apisRes.data || [];
    incidents = incRes.data || [];
    statusPages = spRes.data || [];

    if (apisRes.error) debug += `, apisErr=${apisRes.error.message}`;
    if (incRes.error) debug += `, incErr=${incRes.error.message}`;
    if (spRes.error) debug += `, spErr=${spRes.error.message}`;
    debug += `, apis=${apis.length}, incidents=${incidents.length}, statusPages=${statusPages.length}`;
  } catch (err) {
    debug += `, catch=${err.message}`;
  }

  const base = "https://apidown.net";
  const now = new Date().toISOString();

  // ── Static pages ──
  const staticPages = [
    { path: "/", freq: "hourly", priority: "1.0" },
    { path: "/incidents", freq: "hourly", priority: "0.8" },
    { path: "/docs", freq: "weekly", priority: "0.7" },
    { path: "/pricing", freq: "monthly", priority: "0.7" },
    { path: "/login", freq: "monthly", priority: "0.5" },
    { path: "/sla", freq: "monthly", priority: "0.5" },
    { path: "/dashboard", freq: "daily", priority: "0.4" },
  ];

  // ── Build URL entries ──
  const urls = [];

  // Static pages
  for (const p of staticPages) {
    urls.push(urlEntry(base + p.path, now, p.freq, p.priority));
  }

  // Individual API detail pages  /api/[slug]
  for (const a of apis) {
    const priority = a.current_status !== "operational" ? "1.0" : "0.9";
    urls.push(urlEntry(`${base}/api/${a.slug}`, now, "hourly", priority));
  }

  // Public status pages  /status/[slug]
  for (const sp of statusPages) {
    urls.push(urlEntry(`${base}/status/${sp.public_status_slug}`, now, "daily", "0.7"));
  }

  // Individual incident pages  /incidents/[id]
  for (const inc of incidents) {
    const lastmod = inc.resolved_at || inc.started_at || now;
    const priority = inc.status !== "resolved" ? "0.7" : "0.5";
    const freq = inc.status !== "resolved" ? "hourly" : "monthly";
    urls.push(urlEntry(`${base}/incidents/${inc.id}`, lastmod, freq, priority));
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!-- debug: ${debug} -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=3600",
    },
  });
}

/** Helper to build a single <url> entry */
function urlEntry(loc, lastmod, changefreq, priority) {
  return `  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}
