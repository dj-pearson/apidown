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
