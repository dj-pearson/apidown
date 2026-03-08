import { toast } from '$lib/stores/toast.js';

/** @type {import('@sveltejs/kit').HandleClientError} */
export function handleError({ error, message }) {
  console.error('Client error:', error);
  toast.error(message || 'Something went wrong. Please try again.');
  return { message };
}

// Register service worker for PWA support
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {
    // SW registration failed — not critical
  });
}
