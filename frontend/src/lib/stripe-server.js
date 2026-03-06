import Stripe from 'stripe';
import { getEnv } from '$lib/supabase-server.js';

let _stripe;
let _stripeKey;

export function getStripe() {
  const key = getEnv('STRIPE_SECRET_KEY');
  if (!key) throw new Error('Missing STRIPE_SECRET_KEY env var');
  // Recreate if key changed (e.g. different platform context)
  if (!_stripe || _stripeKey !== key) {
    _stripeKey = key;
    _stripe = new Stripe(key);
  }
  return _stripe;
}

/** Map tier name to its Stripe Price ID from env */
export function getPriceId(tier) {
  if (tier === 'pro') return getEnv('STRIPE_PRO_PRICE_ID');
  if (tier === 'team') return getEnv('STRIPE_TEAM_PRICE_ID');
  return null;
}

/** Determine tier from a Stripe subscription's price ID */
export function getTierFromSubscription(subscription) {
  // Check metadata first
  if (subscription?.metadata?.tier) return subscription.metadata.tier;

  // Fall back to matching the price ID against env vars
  const proPriceId = getEnv('STRIPE_PRO_PRICE_ID');
  const teamPriceId = getEnv('STRIPE_TEAM_PRICE_ID');

  const items = subscription?.items?.data || [];
  for (const item of items) {
    const priceId = item.price?.id || item.plan?.id;
    if (priceId === teamPriceId) return 'team';
    if (priceId === proPriceId) return 'pro';
  }

  return 'pro'; // final fallback
}

/** Safely convert a Stripe Unix timestamp to ISO string, or null */
export function stripePeriodEnd(subscription) {
  const ts = subscription?.current_period_end;
  if (!ts) return null;
  return new Date(ts * 1000).toISOString();
}
