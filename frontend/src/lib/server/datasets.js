/**
 * Shared helpers for the open data downloads under /data.
 *
 * These datasets are deliberately built from public tables only — apis,
 * incidents, and derived uptime. Nothing user-, subscriber-, or key-related is
 * ever selected here.
 */

export const MAX_INCIDENT_ROWS = 5000;
export const UPTIME_MONTHS = 24;

/** RFC 4180 CSV: quote every field, double internal quotes. */
export function toCsv(columns, rows) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [columns.map(esc).join(',')];
  for (const row of rows) {
    lines.push(columns.map(c => esc(row[c])).join(','));
  }
  return lines.join('\r\n') + '\r\n';
}

export function dataResponse(body, contentType, filename, { maxAge = 3600 } = {}) {
  return new Response(body, {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': `public, max-age=${maxAge}, s-maxage=${maxAge}`,
      'Access-Control-Allow-Origin': '*',
    },
  });
}
