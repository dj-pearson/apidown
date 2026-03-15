import { toast } from '$lib/stores/toast.js';

/** @type {import('@sveltejs/kit').HandleClientError} */
export function handleError({ error, message }) {
  console.error('Client error:', error);
  toast.error(message || 'Something went wrong. Please try again.');
  return { message };
}

// Register service worker for PWA support
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch((err) => {
    console.warn('[APIdown] Service worker registration failed:', err?.message || err);
  });
}
