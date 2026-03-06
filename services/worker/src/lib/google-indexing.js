import crypto from 'crypto';

const INDEXING_API_URL = 'https://indexing.googleapis.com/v3/urlNotifications:publish';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/indexing';
const BASE_URL = 'https://apidown.net';

let cachedToken = null;
let tokenExpiresAt = 0;

/**
 * Create a JWT from the service account credentials and exchange it for an access token.
 */
async function getAccessToken(serviceAccount) {
  const now = Math.floor(Date.now() / 1000);

  // Return cached token if still valid (with 60s buffer)
  if (cachedToken && now < tokenExpiresAt - 60) {
    return cachedToken;
  }

  // Build JWT header + payload
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    iss: serviceAccount.client_email,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  })).toString('base64url');

  // Sign with the service account private key
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(`${header}.${payload}`);
  const signature = signer.sign(serviceAccount.private_key, 'base64url');

  const jwt = `${header}.${payload}.${signature}`;

  // Exchange JWT for access token
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  cachedToken = data.access_token;
  tokenExpiresAt = now + (data.expires_in || 3600);

  return cachedToken;
}

/**
 * Submit a single URL notification to Google Indexing API.
 * @param {string} accessToken
 * @param {string} url
 * @param {'URL_UPDATED'|'URL_DELETED'} type
 */
async function publishUrl(accessToken, url, type = 'URL_UPDATED') {
  const res = await fetch(INDEXING_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ url, type }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`[google-indexing] Failed to submit ${url}: ${res.status} ${text}`);
    return false;
  }

  const data = await res.json();
  console.log(`[google-indexing] Submitted ${url} → notifyTime: ${data.urlNotificationMetadata?.latestUpdate?.notifyTime || 'ok'}`);
  return true;
}

/**
 * Main loop: check for recently changed APIs and incidents, submit their URLs.
 * Uses a tracking table (indexing_queue) or falls back to updated_at timestamps.
 */
export async function runGoogleIndexing(supabase) {
  const saJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!saJson) return; // Silently skip if not configured

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(saJson);
  } catch {
    console.error('[google-indexing] Invalid GOOGLE_SERVICE_ACCOUNT_JSON');
    return;
  }

  const accessToken = await getAccessToken(serviceAccount);

  // Find URLs that need indexing from the queue
  const { data: queue, error } = await supabase
    .from('indexing_queue')
    .select('id, url, action')
    .eq('submitted', false)
    .order('created_at')
    .limit(100); // Google allows 200/day for most accounts

  if (error) {
    // Table might not exist yet — fall back to timestamp-based approach
    if (error.code === '42P01' || error.message?.includes('does not exist')) {
      await runTimestampFallback(supabase, accessToken);
      return;
    }
    console.error('[google-indexing] Queue fetch error:', error.message);
    return;
  }

  if (!queue?.length) return;

  let submitted = 0;
  for (const item of queue) {
    const success = await publishUrl(accessToken, item.url, item.action || 'URL_UPDATED');
    if (success) {
      await supabase
        .from('indexing_queue')
        .update({ submitted: true, submitted_at: new Date().toISOString() })
        .eq('id', item.id);
      submitted++;
    }
    // Small delay to be respectful of rate limits
    await new Promise(r => setTimeout(r, 100));
  }

  if (submitted > 0) {
    console.log(`[google-indexing] Submitted ${submitted} URLs to Google`);
  }
}

/**
 * Fallback: submit URLs based on updated_at timestamps (last 10 minutes).
 */
async function runTimestampFallback(supabase, accessToken) {
  const cutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const urls = [];

  // Recently updated APIs
  const { data: apis } = await supabase
    .from('apis')
    .select('slug, updated_at')
    .gt('updated_at', cutoff);

  for (const a of apis || []) {
    urls.push(`${BASE_URL}/api/${a.slug}`);
  }

  // Recently created/updated incidents
  const { data: incidents } = await supabase
    .from('incidents')
    .select('id, updated_at')
    .gt('updated_at', cutoff);

  for (const inc of incidents || []) {
    urls.push(`${BASE_URL}/incidents/${inc.id}`);
  }

  if (!urls.length) return;

  let submitted = 0;
  for (const url of urls) {
    const success = await publishUrl(accessToken, url);
    if (success) submitted++;
    await new Promise(r => setTimeout(r, 100));
  }

  if (submitted > 0) {
    console.log(`[google-indexing] Submitted ${submitted} URLs (timestamp fallback)`);
  }
}
