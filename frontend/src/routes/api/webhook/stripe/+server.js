import { json, error as kitError, text } from '@sveltejs/kit';
import { setPlatform, getSupabaseAdmin, getEnv } from '$lib/supabase-server.js';
import { getStripe } from '$lib/stripe-server.js';

export async function POST({ request, platform }) {
  setPlatform(platform);

  const stripe = getStripe();
  const webhookSecret = getEnv('STRIPE_WEBHOOK_SECRET');
  if (!webhookSecret) throw kitError(500, 'Webhook secret not configured');

  const payload = await request.text();
  const sig = request.headers.get('stripe-signature');

  let event;
  try {
    event = stripe.webhooks.constructEvent(payload, sig, webhookSecret);
  } catch (err) {
    console.error('Stripe webhook signature verification failed:', err.message);
    throw kitError(400, 'Invalid signature');
  }

  const supabase = getSupabaseAdmin();

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      if (session.mode === 'subscription') {
        const subscription = await stripe.subscriptions.retrieve(session.subscription);
        const userId = subscription.metadata.supabase_user_id || session.metadata?.supabase_user_id;
        const tier = subscription.metadata.tier || 'pro';
        if (userId) {
          await supabase.from('users').update({
            tier,
            stripe_subscription_id: subscription.id,
            billing_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          }).eq('id', userId);
        }
      }
      break;
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object;
      const userId = subscription.metadata.supabase_user_id;
      if (userId) {
        const status = subscription.status;
        const update = {
          stripe_subscription_id: subscription.id,
          billing_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        };
        // If subscription is no longer active, downgrade to free
        if (status === 'canceled' || status === 'unpaid' || status === 'past_due') {
          update.tier = 'free';
          update.stripe_subscription_id = null;
          update.billing_period_end = null;
        }
        await supabase.from('users').update(update).eq('id', userId);
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object;
      const userId = subscription.metadata.supabase_user_id;
      if (userId) {
        await supabase.from('users').update({
          tier: 'free',
          stripe_subscription_id: null,
          billing_period_end: null,
        }).eq('id', userId);
      }
      break;
    }

    default:
      // Unhandled event type — acknowledge receipt
      break;
  }

  return text('ok', { status: 200 });
}
