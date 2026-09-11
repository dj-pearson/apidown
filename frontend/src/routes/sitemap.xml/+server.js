import { getSupabaseAdmin, setPlatform } from "$lib/supabase-server.js";
import { recentMonthKeys } from "$lib/api-history.js";
import { recentWeekKeys } from "$lib/weekly-digest.js";
import { allComparePairs } from "$lib/compare-pairs.js";

export async function GET({ platform }) {
  setPlatform(platform);

  let apis = [];
  let incidents = [];
  let statusPages = [];
  try {
    const supabase = getSupabaseAdmin();

    const [apisRes, incRes, spRes] = await Promise.all([
      supabase.from("apis").select("slug, name, category, current_status, owner_id").order("name"),
      supabase.from("incidents").select("id, started_at, resolved_at, status").order("started_at", { ascending: false }).limit(200),
      supabase.from("users").select("public_status_slug").eq("public_status_enabled", true).not("public_status_slug", "is", null),
    ]);

    apis = apisRes.data || [];
    incidents = incRes.data || [];
    statusPages = spRes.data || [];
  } catch (err) {
    console.error("Sitemap: Supabase error:", err.message);
  }

  const base = "https://apidown.net";
  const now = new Date().toISOString();

  // ── Static pages ──
  const staticPages = [
    { path: "/", freq: "hourly", priority: "1.0" },
    { path: "/incidents", freq: "hourly", priority: "0.8" },
    { path: "/live", freq: "hourly", priority: "0.8" },
    { path: "/stack", freq: "weekly", priority: "0.7" },
    { path: "/leaderboard", freq: "daily", priority: "0.8" },
    { path: "/sla-receipts", freq: "weekly", priority: "0.8" },
    { path: "/data", freq: "weekly", priority: "0.7" },
    { path: "/weekly", freq: "weekly", priority: "0.8" },
    { path: "/docs", freq: "weekly", priority: "0.7" },
    { path: "/pricing", freq: "monthly", priority: "0.7" },
  ];

  // ── Build URL entries ──
  const urls = [];

  // Static pages
  for (const p of staticPages) {
    urls.push(urlEntry(base + p.path, now, p.freq, p.priority));
  }

  // Individual API detail pages  /api/[slug] plus their history archive
  const archiveMonths = recentMonthKeys(12);
  for (const a of apis) {
    const priority = a.current_status !== "operational" ? "1.0" : "0.9";
    urls.push(urlEntry(`${base}/api/${a.slug}`, now, "hourly", priority));
    urls.push(urlEntry(`${base}/api/${a.slug}/history`, now, "daily", "0.7"));
    urls.push(urlEntry(`${base}/api/${a.slug}/report-card`, now, "daily", "0.6"));
    for (const [i, m] of archiveMonths.entries()) {
      // Only the current month keeps changing; older archives are stable.
      urls.push(urlEntry(`${base}/api/${a.slug}/history/${m}`, now, i === 0 ? "daily" : "monthly", i === 0 ? "0.6" : "0.5"));
    }
  }

  // Weekly digest archive  /weekly/[yyyy-Www]
  for (const [i, w] of recentWeekKeys(12).entries()) {
    urls.push(urlEntry(`${base}/weekly/${w}`, now, i === 0 ? "daily" : "monthly", i === 0 ? "0.7" : "0.5"));
  }

  // Category latency race pages  /category/[category]
  for (const c of [...new Set(apis.map(a => a.category).filter(Boolean))]) {
    urls.push(urlEntry(`${base}/category/${c}`, now, "hourly", "0.8"));
  }

  // Head-to-head comparisons  /compare/[a]/vs/[b] — canonical (ascending) order
  // only, capped per category so the sitemap cannot grow combinatorially.
  for (const [a, b] of allComparePairs(apis, { perCategory: 15 })) {
    urls.push(urlEntry(`${base}/compare/${a}/vs/${b}`, now, "daily", "0.6"));
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
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, s-maxage=0, max-age=300",
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
