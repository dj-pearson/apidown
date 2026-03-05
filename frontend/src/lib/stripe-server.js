import Stripe from 'stripe';
import { getEnv } from '$lib/supabase-server.js';

let _stripe;

export function getStripe() {
  if (!_stripe) {
    const key = getEnv('STRIPE_SECRET_KEY');
    if (!key) throw new Error('Missing STRIPE_SECRET_KEY env var');
    _stripe = new Stripe(key, { apiVersion: '2024-06-20' });
  }
  return _stripe;
}

/** Map tier name to its Stripe Price ID from env */
export function getPriceId(tier) {
  if (tier === 'pro') return getEnv('STRIPE_PRO_PRICE_ID');
  if (tier === 'team') return getEnv('STRIPE_TEAM_PRICE_ID');
  return null;
}
