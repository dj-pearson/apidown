import { env as pubEnv } from '$env/dynamic/public';

export async function load({ url }) {
  const token = url.searchParams.get('token');

  if (!token) {
    return { status: 'error', message: 'Missing unsubscribe token.' };
  }

  // Call the ingest service to unsubscribe
  try {
    const ingestUrl = pubEnv.PUBLIC_INGEST_URL || 'https://ingest.apidown.net';
    const res = await fetch(`${ingestUrl}/v1/unsubscribe?token=${encodeURIComponent(token)}`);
    const data = await res.json();

    if (res.ok && data.unsubscribed) {
      return { status: 'success', message: 'You have been unsubscribed from alerts.' };
    } else if (res.status === 404) {
      return { status: 'error', message: 'Subscription not found or already removed.' };
    } else {
      return { status: 'error', message: data.error || 'Failed to unsubscribe.' };
    }
  } catch {
    return { status: 'error', message: 'Unable to process request. Please try again later.' };
  }
}
