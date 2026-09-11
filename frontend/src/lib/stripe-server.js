import Stripe from 'stripe';
import { getEnv } from '$lib/supabase-server.js';
import { tierFromPrices, periodEndIso } from '$lib/server/stripe-webhook-policy.js';

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

/**
 * Determine tier from a Stripe subscription's price ID.
 *
 * Delegates the matching to the tested policy module so the reconciliation
 * paths here and the webhook cannot disagree. Keeps the historical 'pro'
 * fallback for these callers, which are user-initiated syncs where refusing to
 * name a tier would leave a paying customer with none.
 */
export function getTierFromSubscription(subscription) {
  const matched = tierFromPrices(subscription, {
    proPriceId: getEnv('STRIPE_PRO_PRICE_ID'),
    teamPriceId: getEnv('STRIPE_TEAM_PRICE_ID'),
  });
  if (matched) return matched;

  // Metadata may be stale if the plan was changed via the billing portal.
  if (subscription?.metadata?.tier) return subscription.metadata.tier;

  return 'pro';
}

/** Safely convert a Stripe Unix timestamp to ISO string, or null */
export function stripePeriodEnd(subscription) {
  return periodEndIso(subscription);
}
