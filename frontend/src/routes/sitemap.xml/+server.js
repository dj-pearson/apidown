import { getSupabaseAdmin, setPlatform } from "$lib/supabase-server.js";

export async function GET({ platform }) {
  setPlatform(platform);

  let apis = [];
  let incidents = [];
  let statusPages = [];

  try {
    const supabase = getSupabaseAdmin();

    // Fetch all APIs for individual /api/[slug] pages
    const { data: apisData, error: apisErr } = await supabase
      .from("apis")
      .select("slug, updated_at, current_status")
      .order("name");
    if (apisErr) console.error("Sitemap: apis query error:", apisErr.message);
    apis = apisData || [];

    // Fetch recent resolved + active incidents for individual /incidents/[id] pages
    const { data: incData, error: incErr } = await supabase
      .from("incidents")
      .select("id, started_at, updated_at, status")
      .order("started_at", { ascending: false })
      .limit(200);
    if (incErr) console.error("Sitemap: incidents query error:", incErr.message);
    incidents = incData || [];

    // Fetch public status pages for /status/[slug]
    const { data: spData, error: spErr } = await supabase
      .from("users")
      .select("public_status_slug, updated_at")
      .eq("public_status_enabled", true)
      .not("public_status_slug", "is", null);
    if (spErr) console.error("Sitemap: status pages query error:", spErr.message);
    statusPages = spData || [];
  } catch (err) {
    console.error("Sitemap: failed to connect to Supabase:", err.message);
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
    const lastmod = a.updated_at || now;
    // APIs with active issues get higher priority for crawl freshness
    const priority = a.current_status !== "operational" ? "1.0" : "0.9";
    urls.push(urlEntry(`${base}/api/${a.slug}`, lastmod, "hourly", priority));
  }

  // Public status pages  /status/[slug]
  for (const sp of statusPages) {
    const lastmod = sp.updated_at || now;
    urls.push(urlEntry(`${base}/status/${sp.public_status_slug}`, lastmod, "daily", "0.7"));
  }

  // Individual incident pages  /incidents/[id]
  for (const inc of incidents) {
    const lastmod = inc.updated_at || inc.started_at || now;
    const priority = inc.status !== "resolved" ? "0.7" : "0.5";
    const freq = inc.status !== "resolved" ? "hourly" : "monthly";
    urls.push(urlEntry(`${base}/incidents/${inc.id}`, lastmod, freq, priority));
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
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
