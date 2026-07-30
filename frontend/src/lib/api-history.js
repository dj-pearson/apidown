/**
 * Shared incident-history maths for the /v1 API, the per-API history archive,
 * and the SLA receipts page. Downtime is attributed by clipping each incident's
 * interval into the window being measured, matching how the homepage and
 * leaderboard already compute uptime.
 */

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** 'YYYY-MM' key for a Date (UTC). */
export function monthKey(date) {
  const d = new Date(date);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** True for a well-formed 'YYYY-MM' string within a sane range. */
export function isValidMonthKey(key) {
  if (!/^\d{4}-\d{2}$/.test(key || '')) return false;
  const [y, m] = key.split('-').map(Number);
  return y >= 2024 && y <= 2100 && m >= 1 && m <= 12;
}

/** UTC start/end instants and a human label for a 'YYYY-MM' key. */
export function monthWindow(key) {
  const [y, m] = key.split('-').map(Number);
  const start = Date.UTC(y, m - 1, 1);
  const end = Date.UTC(m === 12 ? y + 1 : y, m === 12 ? 0 : m, 1);
  return { start, end, label: `${MONTH_NAMES[m - 1]} ${y}` };
}

/** Descending list of month keys from now back `count` months. */
export function recentMonthKeys(count, now = Date.now()) {
  const d = new Date(now);
  const keys = [];
  let y = d.getUTCFullYear();
  let m = d.getUTCMonth();
  for (let i = 0; i < count; i++) {
    keys.push(`${y}-${String(m + 1).padStart(2, '0')}`);
    m -= 1;
    if (m < 0) { m = 11; y -= 1; }
  }
  return keys;
}

/**
 * Total downtime in ms inside [windowStart, windowEnd), from incident rows
 * shaped { started_at, resolved_at }. Unresolved incidents run to `now`.
 * Overlapping incidents are merged so concurrent outages are not double-counted.
 */
export function downtimeMsInWindow(incidents, windowStart, windowEnd, now = Date.now()) {
  const clipEnd = Math.min(windowEnd, now);
  const intervals = [];

  for (const inc of incidents || []) {
    const start = new Date(inc.started_at).getTime();
    const end = inc.resolved_at ? new Date(inc.resolved_at).getTime() : now;
    if (!Number.isFinite(start)) continue;
    const s = Math.max(start, windowStart);
    const e = Math.min(Number.isFinite(end) ? end : now, clipEnd);
    if (e > s) intervals.push([s, e]);
  }

  if (intervals.length === 0) return 0;

  intervals.sort((a, b) => a[0] - b[0]);
  let total = 0;
  let [curStart, curEnd] = intervals[0];
  for (let i = 1; i < intervals.length; i++) {
    const [s, e] = intervals[i];
    if (s <= curEnd) {
      curEnd = Math.max(curEnd, e);
    } else {
      total += curEnd - curStart;
      curStart = s;
      curEnd = e;
    }
  }
  total += curEnd - curStart;
  return total;
}

/** Uptime percentage for a window, rounded to 3 decimals. */
export function uptimePctInWindow(incidents, windowStart, windowEnd, now = Date.now()) {
  const clipEnd = Math.min(windowEnd, now);
  const span = clipEnd - windowStart;
  if (span <= 0) return null;
  const down = downtimeMsInWindow(incidents, windowStart, clipEnd, now);
  return Math.round(Math.max(0, (1 - down / span)) * 100 * 1000) / 1000;
}

/** Longest single outage (ms) overlapping a window. */
export function longestOutageMsInWindow(incidents, windowStart, windowEnd, now = Date.now()) {
  const clipEnd = Math.min(windowEnd, now);
  let longest = 0;
  for (const inc of incidents || []) {
    const start = new Date(inc.started_at).getTime();
    const end = inc.resolved_at ? new Date(inc.resolved_at).getTime() : now;
    if (!Number.isFinite(start)) continue;
    const s = Math.max(start, windowStart);
    const e = Math.min(Number.isFinite(end) ? end : now, clipEnd);
    if (e > s) longest = Math.max(longest, e - s);
  }
  return longest;
}

/**
 * Per-month rollup for the archive pages.
 * @returns {Array<{month:string,label:string,incidentCount:number,downtimeMs:number,uptimePct:number|null,longestOutageMs:number,incidents:Array}>}
 */
export function monthlyBreakdown(incidents, months, now = Date.now()) {
  return recentMonthKeys(months, now).map(key => {
    const { start, end, label } = monthWindow(key);
    const inMonth = (incidents || []).filter(inc => {
      const s = new Date(inc.started_at).getTime();
      const e = inc.resolved_at ? new Date(inc.resolved_at).getTime() : now;
      return s < end && e > start;
    });
    return {
      month: key,
      label,
      incidentCount: inMonth.length,
      downtimeMs: downtimeMsInWindow(inMonth, start, end, now),
      uptimePct: uptimePctInWindow(inMonth, start, end, now),
      longestOutageMs: longestOutageMsInWindow(inMonth, start, end, now),
      incidents: inMonth.sort((a, b) => new Date(b.started_at) - new Date(a.started_at)),
    };
  });
}

/** Human duration for durations from seconds to days. */
export function formatDuration(ms) {
  if (!ms || ms < 1000) return '—';
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  if (hours < 24) return remMins ? `${hours}h ${remMins}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return remHours ? `${days}d ${remHours}h` : `${days}d`;
}
