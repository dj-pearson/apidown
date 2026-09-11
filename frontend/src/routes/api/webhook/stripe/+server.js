import { text } from '@sveltejs/kit';
import { setPlatform, getSupabaseAdmin, getEnv } from '$lib/supabase-server.js';
import { getStripe } from '$lib/stripe-server.js';
import {
  planFromEvent,
  updateForPlan,
  isStaleEvent,
  failureResponse,
} from '$lib/server/stripe-webhook-policy.js';

/**
 * Stripe webhook receiver.
 *
 * The decisions live in lib/server/stripe-webhook-policy.js; this file does
 * signature verification, the database round trip, and choosing a status code.
 * The status code matters: answering 200 after a failed write tells Stripe the
 * event is done, so it never retries and a paying customer can be left on the
 * free tier permanently.
 */
export async function POST({ request, platform }) {
  setPlatform(platform);

  const stripe = getStripe();
  const webhookSecret = getEnv('STRIPE_WEBHOOK_SECRET');
  if (!webhookSecret) {
    console.error('[stripe-webhook] STRIPE_WEBHOOK_SECRET not configured');
    return text('Webhook secret not configured', { status: 500 });
  }

  const payload = await request.text();
  const sig = request.headers.get('stripe-signature');

  let event;
  try {
    event = stripe.webhooks.constructEvent(payload, sig, webhookSecret);
  } catch (err) {
    console.error('[stripe-webhook] Signature verification failed:', err.message);
    return text('Invalid signature', { status: 400 });
  }

  const prices = {
    proPriceId: getEnv('STRIPE_PRO_PRICE_ID'),
    teamPriceId: getEnv('STRIPE_TEAM_PRICE_ID'),
  };

  try {
    const supabase = getSupabaseAdmin();

    // A checkout session references its subscription by id; fetch it so the
    // tier comes from the live price rather than possibly stale metadata.
    let subscription = null;
    if (event.type === 'checkout.session.completed') {
      const sessionSubscription = event.data?.object?.subscription;
      if (sessionSubscription) {
        subscription = await stripe.subscriptions.retrieve(sessionSubscription, { expand: ['items'] });
      }
    }

    const plan = planFromEvent(event, subscription, prices);
    if (plan.kind === 'ignore') {
      console.log(`[stripe-webhook] ${event.type} (${event.id}): ${plan.reason}`);
      return text('ok', { status: 200 });
    }

    const account = await findAccount(supabase, plan);
    if (!account) {
      // Nothing to retry against — the customer maps to no account here.
      console.error(
        `[stripe-webhook] ${event.type} (${event.id}): no account for subscription=${plan.subscriptionId} customer=${plan.customerId}`,
      );
      const { status } = failureResponse('unmappable');
      return text('no matching account', { status });
    }

    if (isStaleEvent(event.created, account.stripe_event_applied_at)) {
      console.log(
        `[stripe-webhook] ${event.type} (${event.id}): skipped, older than the event already applied to ${account.id}`,
      );
      return text('ok (stale)', { status: 200 });
    }

    if (plan.kind === 'upgrade' && !plan.tier) {
      // An unrecognised price must not silently grant or clear a paid plan.
      console.error(
        `[stripe-webhook] ${event.type} (${event.id}): no tier matches subscription ${plan.subscriptionId}; check STRIPE_PRO_PRICE_ID and STRIPE_TEAM_PRICE_ID`,
      );
      const { status } = failureResponse('unmappable');
      return text('unrecognised price', { status });
    }

    const { error } = await supabase
      .from('users')
      .update(updateForPlan(plan, event.created))
      .eq('id', account.id);

    if (error) throw new Error(`users update failed: ${error.message}`);

    console.log(
      `[stripe-webhook] ${event.type} (${event.id}): ${plan.kind} ${account.id} -> ${plan.kind === 'downgrade' ? 'free' : plan.tier}`,
    );
    return text('ok', { status: 200 });
  } catch (err) {
    // Report the failure so Stripe redelivers. Swallowing this is how a paid
    // upgrade gets lost for good when the database is briefly unavailable.
    console.error(`[stripe-webhook] ${event.type} (${event.id}) failed, asking Stripe to retry:`, err.message);
    const { status } = failureResponse('transient');
    return text('processing failed', { status });
  }
}

/** Find the account by user id, then subscription, then customer. */
async function findAccount(supabase, plan) {
  const select = 'id, stripe_event_applied_at';

  if (plan.userId) {
    const { data } = await supabase.from('users').select(select).eq('id', plan.userId).maybeSingle();
    if (data) return data;
  }
  if (plan.subscriptionId) {
    const { data } = await supabase.from('users').select(select).eq('stripe_subscription_id', plan.subscriptionId).maybeSingle();
    if (data) return data;
  }
  if (plan.customerId) {
    const { data } = await supabase.from('users').select(select).eq('stripe_customer_id', plan.customerId).maybeSingle();
    if (data) return data;
  }
  return null;
}
