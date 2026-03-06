import { text } from '@sveltejs/kit';
import { setPlatform, getSupabaseAdmin, getEnv } from '$lib/supabase-server.js';
import { getStripe } from '$lib/stripe-server.js';

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

  console.log(`[stripe-webhook] Received event: ${event.type} (${event.id})`);

  const supabase = getSupabaseAdmin();

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        console.log(`[stripe-webhook] Checkout completed: mode=${session.mode}, subscription=${session.subscription}`);
        if (session.mode === 'subscription' && session.subscription) {
          const subscription = await stripe.subscriptions.retrieve(session.subscription);
          const userId = subscription.metadata?.supabase_user_id || session.metadata?.supabase_user_id;
          const tier = subscription.metadata?.tier || session.metadata?.tier || 'pro';

          if (userId) {
            console.log(`[stripe-webhook] Upgrading user ${userId} to ${tier}`);
            await supabase.from('users').update({
              tier,
              stripe_subscription_id: subscription.id,
              stripe_customer_id: session.customer,
              billing_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            }).eq('id', userId);
          } else {
            // Try to find user by stripe_customer_id
            const { data: userRow } = await supabase
              .from('users')
              .select('id')
              .eq('stripe_customer_id', session.customer)
              .single();
            if (userRow) {
              console.log(`[stripe-webhook] Found user by customer ID, upgrading ${userRow.id} to ${tier}`);
              await supabase.from('users').update({
                tier,
                stripe_subscription_id: subscription.id,
                billing_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
              }).eq('id', userRow.id);
            } else {
              console.error('[stripe-webhook] Could not find user for checkout session:', session.id);
            }
          }
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const userId = subscription.metadata?.supabase_user_id;
        const status = subscription.status;
        console.log(`[stripe-webhook] Subscription updated: ${subscription.id}, status=${status}, user=${userId}`);

        const findUser = userId
          ? { id: userId }
          : (await supabase.from('users').select('id').eq('stripe_subscription_id', subscription.id).single()).data;

        if (findUser?.id) {
          if (status === 'canceled' || status === 'unpaid' || status === 'past_due') {
            await supabase.from('users').update({
              tier: 'free',
              stripe_subscription_id: null,
              billing_period_end: null,
            }).eq('id', findUser.id);
          } else {
            await supabase.from('users').update({
              stripe_subscription_id: subscription.id,
              billing_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            }).eq('id', findUser.id);
          }
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const userId = subscription.metadata?.supabase_user_id;
        console.log(`[stripe-webhook] Subscription deleted: ${subscription.id}, user=${userId}`);

        const findUser = userId
          ? { id: userId }
          : (await supabase.from('users').select('id').eq('stripe_subscription_id', subscription.id).single()).data;

        if (findUser?.id) {
          await supabase.from('users').update({
            tier: 'free',
            stripe_subscription_id: null,
            billing_period_end: null,
          }).eq('id', findUser.id);
        }
        break;
      }

      default:
        console.log(`[stripe-webhook] Unhandled event type: ${event.type}`);
        break;
    }
  } catch (err) {
    console.error(`[stripe-webhook] Error processing ${event.type}:`, err.message);
    // Still return 200 to prevent Stripe from retrying
  }

  return text('ok', { status: 200 });
}
