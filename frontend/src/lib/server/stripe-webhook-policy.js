/**
 * What a Stripe webhook should do to an account, decided in pure functions.
 *
 * Two things make billing webhooks go wrong quietly.
 *
 * The first is swallowing failures. A handler that catches an error and still
 * answers 200 is telling Stripe the event was processed, so Stripe never
 * retries it. If the database happened to be unreachable while
 * checkout.session.completed arrived, the customer has paid and will stay on
 * the free tier forever, with nothing but a log line to show for it. Retries
 * are the recovery mechanism; they only work if failure is reported.
 *
 * The second is ordering. Stripe makes no ordering guarantee and redelivers on
 * retry, so a subscription.updated generated before a cancellation can arrive
 * after it. Applied blindly, that hands a cancelled customer their paid tier
 * back. Every write therefore carries the event's own timestamp, and an event
 * older than the last one applied to that account is skipped.
 */

/** Subscription statuses that mean the customer no longer has a paid plan. */
const TERMINAL_STATUSES = new Set(['canceled', 'unpaid', 'past_due', 'incomplete_expired']);

export function isTerminalStatus(status) {
  return TERMINAL_STATUSES.has(status);
}

/** Event types this handler acts on. */
export const HANDLED_EVENTS = new Set([
  'checkout.session.completed',
  'customer.subscription.updated',
  'customer.subscription.deleted',
]);

/**
 * Map a subscription's price IDs to a tier.
 * Returns null when nothing matches, so the caller can decide rather than
 * silently granting a paid plan.
 */
export function tierFromPrices(subscription, { proPriceId, teamPriceId } = {}) {
  // Scan every item before deciding. Returning on the first match would hand a
  // subscription carrying both prices whichever tier happened to be listed
  // first; the customer is paying for both, so they get the higher one.
  let best = null;
  for (const item of subscription?.items?.data || []) {
    const priceId = item.price?.id || item.plan?.id;
    if (teamPriceId && priceId === teamPriceId) return 'team';
    if (proPriceId && priceId === proPriceId) best = 'pro';
  }
  return best;
}

/** Stripe's Unix seconds to an ISO string, or null. */
export function periodEndIso(subscription) {
  const ts = subscription?.current_period_end;
  if (typeof ts !== 'number' || !Number.isFinite(ts) || ts <= 0) return null;
  const date = new Date(ts * 1000);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/**
 * Is this event older than the last one already applied to the account?
 *
 * `event.created` is Stripe's own second-resolution timestamp. Equal
 * timestamps are allowed through: two events in the same second are not
 * reliably ordered either way, and re-applying the same state is harmless.
 */
export function isStaleEvent(eventCreated, lastAppliedIso) {
  if (!lastAppliedIso) return false;
  if (typeof eventCreated !== 'number' || !Number.isFinite(eventCreated)) return false;
  const lastApplied = Date.parse(lastAppliedIso);
  if (Number.isNaN(lastApplied)) return false;
  return eventCreated * 1000 < lastApplied;
}

/**
 * The account change an event implies.
 *
 * Returns `{ kind, tier, subscriptionId, customerId, userId, periodEnd }`
 * where kind is 'upgrade' | 'downgrade' | 'ignore'.
 */
export function planFromEvent(event, subscription, prices = {}) {
  const type = event?.type;

  if (type === 'checkout.session.completed') {
    const session = event.data?.object || {};
    if (session.mode !== 'subscription' || !session.subscription) {
      return { kind: 'ignore', reason: 'not a subscription checkout' };
    }
    const tier =
      tierFromPrices(subscription, prices) ||
      subscription?.metadata?.tier ||
      session.metadata?.tier ||
      null;

    return {
      kind: 'upgrade',
      tier,
      subscriptionId: subscription?.id || session.subscription,
      customerId: session.customer || subscription?.customer || null,
      userId: subscription?.metadata?.supabase_user_id || session.metadata?.supabase_user_id || null,
      periodEnd: periodEndIso(subscription),
    };
  }

  if (type === 'customer.subscription.deleted') {
    const sub = event.data?.object || {};
    return {
      kind: 'downgrade',
      tier: 'free',
      subscriptionId: sub.id || null,
      customerId: sub.customer || null,
      userId: sub.metadata?.supabase_user_id || null,
      reason: 'subscription deleted',
    };
  }

  if (type === 'customer.subscription.updated') {
    const sub = event.data?.object || {};
    if (isTerminalStatus(sub.status)) {
      return {
        kind: 'downgrade',
        tier: 'free',
        subscriptionId: sub.id || null,
        customerId: sub.customer || null,
        userId: sub.metadata?.supabase_user_id || null,
        reason: `status=${sub.status}`,
      };
    }
    return {
      kind: 'upgrade',
      tier: tierFromPrices(sub, prices) || sub.metadata?.tier || null,
      subscriptionId: sub.id || null,
      customerId: sub.customer || null,
      userId: sub.metadata?.supabase_user_id || null,
      periodEnd: periodEndIso(sub),
    };
  }

  return { kind: 'ignore', reason: `unhandled event type: ${type}` };
}

/** The row update an applied plan produces. */
export function updateForPlan(plan, eventCreated) {
  const appliedAt = typeof eventCreated === 'number' && Number.isFinite(eventCreated)
    ? new Date(eventCreated * 1000).toISOString()
    : new Date().toISOString();

  if (plan.kind === 'downgrade') {
    return {
      tier: 'free',
      stripe_subscription_id: null,
      billing_period_end: null,
      stripe_event_applied_at: appliedAt,
    };
  }

  const update = {
    tier: plan.tier,
    stripe_subscription_id: plan.subscriptionId,
    billing_period_end: plan.periodEnd ?? null,
    stripe_event_applied_at: appliedAt,
  };
  if (plan.customerId) update.stripe_customer_id = plan.customerId;
  return update;
}

/**
 * How to answer Stripe when processing did not complete.
 *
 * 'retry' (5xx) for anything that might succeed later — a database blip, a
 * timeout. 'accept' (2xx) only when retrying can never help, so the event is
 * not redelivered forever: an event we do not handle, or one whose customer we
 * genuinely cannot map to an account.
 */
export function failureResponse(kind) {
  return kind === 'unmappable' || kind === 'unhandled'
    ? { status: 200, retry: false }
    : { status: 500, retry: true };
}
