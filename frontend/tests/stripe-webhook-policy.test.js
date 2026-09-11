import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  isTerminalStatus,
  tierFromPrices,
  periodEndIso,
  isStaleEvent,
  planFromEvent,
  updateForPlan,
  failureResponse,
  HANDLED_EVENTS,
} from '../src/lib/server/stripe-webhook-policy.js';

const PRICES = { proPriceId: 'price_pro', teamPriceId: 'price_team' };
const sub = (over = {}) => ({
  id: 'sub_1',
  customer: 'cus_1',
  status: 'active',
  current_period_end: 1789000000,
  items: { data: [{ price: { id: 'price_pro' } }] },
  metadata: {},
  ...over,
});

describe('isTerminalStatus', () => {
  test('recognises the statuses that end a paid plan', () => {
    for (const s of ['canceled', 'unpaid', 'past_due', 'incomplete_expired']) {
      assert.equal(isTerminalStatus(s), true, s);
    }
  });

  test('leaves active and trialing alone', () => {
    for (const s of ['active', 'trialing', 'incomplete', undefined]) {
      assert.equal(isTerminalStatus(s), false, String(s));
    }
  });
});

describe('tierFromPrices', () => {
  test('maps the pro and team price IDs', () => {
    assert.equal(tierFromPrices(sub(), PRICES), 'pro');
    assert.equal(tierFromPrices(sub({ items: { data: [{ price: { id: 'price_team' } }] } }), PRICES), 'team');
  });

  test('prefers team when both are present', () => {
    const s = sub({ items: { data: [{ price: { id: 'price_pro' } }, { price: { id: 'price_team' } }] } });
    assert.equal(tierFromPrices(s, PRICES), 'team');
  });

  test('reads the legacy plan.id shape', () => {
    assert.equal(tierFromPrices(sub({ items: { data: [{ plan: { id: 'price_team' } }] } }), PRICES), 'team');
  });

  test('returns null rather than guessing a paid tier', () => {
    assert.equal(tierFromPrices(sub({ items: { data: [{ price: { id: 'price_unknown' } }] } }), PRICES), null);
    assert.equal(tierFromPrices(null, PRICES), null);
    assert.equal(tierFromPrices(sub(), {}), null, 'unconfigured price IDs must not match');
  });
});

describe('periodEndIso', () => {
  test('converts Stripe seconds to an ISO string', () => {
    assert.equal(periodEndIso({ current_period_end: 1789000000 }), new Date(1789000000000).toISOString());
  });

  test('returns null for missing or nonsensical values', () => {
    for (const v of [undefined, null, 0, -1, NaN, Infinity, 'soon']) {
      assert.equal(periodEndIso({ current_period_end: v }), null, String(v));
    }
    assert.equal(periodEndIso(null), null);
  });

  test('never throws on an unrepresentable value', () => {
    assert.doesNotThrow(() => periodEndIso({ current_period_end: 1e18 }));
  });
});

describe('isStaleEvent — out-of-order protection', () => {
  const applied = '2026-09-11T12:00:00.000Z';
  const at = iso => Math.floor(Date.parse(iso) / 1000);

  test('an event older than the last applied one is stale', () => {
    assert.equal(isStaleEvent(at('2026-09-11T11:59:00.000Z'), applied), true);
  });

  test('a newer event is not stale', () => {
    assert.equal(isStaleEvent(at('2026-09-11T12:01:00.000Z'), applied), false);
  });

  test('an event from the same second is allowed through', () => {
    assert.equal(isStaleEvent(at(applied), applied), false);
  });

  test('nothing is stale when no event has been applied yet', () => {
    assert.equal(isStaleEvent(at('2020-01-01T00:00:00.000Z'), null), false);
    assert.equal(isStaleEvent(at('2020-01-01T00:00:00.000Z'), undefined), false);
  });

  test('a malformed watermark or timestamp does not block the write', () => {
    assert.equal(isStaleEvent(at(applied), 'not-a-date'), false);
    assert.equal(isStaleEvent(undefined, applied), false);
    assert.equal(isStaleEvent(NaN, applied), false);
  });

  test('the cancel-then-stale-update sequence cannot re-grant a paid tier', () => {
    // Cancellation applied at 12:00; an update generated at 11:59 arrives late.
    const lateUpdate = at('2026-09-11T11:59:30.000Z');
    assert.equal(isStaleEvent(lateUpdate, applied), true, 'this is the free-upgrade bug');
  });
});

describe('planFromEvent — checkout.session.completed', () => {
  const event = (session, created = 1789000000) => ({
    type: 'checkout.session.completed', created, data: { object: session },
  });

  test('upgrades on a subscription checkout', () => {
    const plan = planFromEvent(
      event({ mode: 'subscription', subscription: 'sub_1', customer: 'cus_1', metadata: { supabase_user_id: 'u1' } }),
      sub(), PRICES,
    );
    assert.equal(plan.kind, 'upgrade');
    assert.equal(plan.tier, 'pro');
    assert.equal(plan.userId, 'u1');
    assert.equal(plan.customerId, 'cus_1');
  });

  test('prefers the user id on the subscription metadata', () => {
    const plan = planFromEvent(
      event({ mode: 'subscription', subscription: 'sub_1', metadata: { supabase_user_id: 'from-session' } }),
      sub({ metadata: { supabase_user_id: 'from-sub' } }), PRICES,
    );
    assert.equal(plan.userId, 'from-sub');
  });

  test('ignores a one-off payment checkout', () => {
    assert.equal(planFromEvent(event({ mode: 'payment' }), null, PRICES).kind, 'ignore');
  });

  test('falls back to metadata when the price is unrecognised', () => {
    const plan = planFromEvent(
      event({ mode: 'subscription', subscription: 'sub_1' }),
      sub({ items: { data: [{ price: { id: 'price_x' } }] }, metadata: { tier: 'team' } }), PRICES,
    );
    assert.equal(plan.tier, 'team');
  });

  test('reports a null tier rather than inventing one', () => {
    const plan = planFromEvent(
      event({ mode: 'subscription', subscription: 'sub_1' }),
      sub({ items: { data: [{ price: { id: 'price_x' } }] } }), PRICES,
    );
    assert.equal(plan.tier, null, 'the caller must decide, not silently grant pro');
  });
});

describe('planFromEvent — subscription lifecycle', () => {
  test('deleted downgrades to free', () => {
    const plan = planFromEvent({ type: 'customer.subscription.deleted', data: { object: sub() } }, null, PRICES);
    assert.equal(plan.kind, 'downgrade');
    assert.equal(plan.tier, 'free');
  });

  test('updated with a terminal status downgrades', () => {
    for (const status of ['canceled', 'unpaid', 'past_due', 'incomplete_expired']) {
      const plan = planFromEvent(
        { type: 'customer.subscription.updated', data: { object: sub({ status }) } }, null, PRICES,
      );
      assert.equal(plan.kind, 'downgrade', status);
      assert.match(plan.reason, new RegExp(status));
    }
  });

  test('updated while active syncs the tier', () => {
    const plan = planFromEvent(
      { type: 'customer.subscription.updated', data: { object: sub({ items: { data: [{ price: { id: 'price_team' } }] } }) } },
      null, PRICES,
    );
    assert.equal(plan.kind, 'upgrade');
    assert.equal(plan.tier, 'team');
  });

  test('a plan change from pro to team is picked up', () => {
    const plan = planFromEvent(
      { type: 'customer.subscription.updated', data: { object: sub({ items: { data: [{ price: { id: 'price_team' } }] }, metadata: { tier: 'pro' } }) } },
      null, PRICES,
    );
    assert.equal(plan.tier, 'team', 'the price is authoritative over stale metadata');
  });

  test('ignores event types it does not handle', () => {
    assert.equal(planFromEvent({ type: 'invoice.paid', data: { object: {} } }, null, PRICES).kind, 'ignore');
    assert.equal(planFromEvent({}, null, PRICES).kind, 'ignore');
  });

  test('the handled set matches what planFromEvent acts on', () => {
    for (const type of HANDLED_EVENTS) {
      const plan = planFromEvent({ type, data: { object: sub({ mode: 'subscription', subscription: 'sub_1' }) } }, sub(), PRICES);
      assert.notEqual(plan.kind, 'ignore', type);
    }
  });
});

describe('updateForPlan', () => {
  test('an upgrade writes tier, subscription and period end', () => {
    const u = updateForPlan(
      { kind: 'upgrade', tier: 'pro', subscriptionId: 'sub_1', customerId: 'cus_1', periodEnd: '2026-10-01T00:00:00.000Z' },
      1789000000,
    );
    assert.equal(u.tier, 'pro');
    assert.equal(u.stripe_subscription_id, 'sub_1');
    assert.equal(u.stripe_customer_id, 'cus_1');
    assert.equal(u.billing_period_end, '2026-10-01T00:00:00.000Z');
  });

  test('a downgrade clears the subscription and period end', () => {
    const u = updateForPlan({ kind: 'downgrade', tier: 'free' }, 1789000000);
    assert.equal(u.tier, 'free');
    assert.equal(u.stripe_subscription_id, null);
    assert.equal(u.billing_period_end, null);
  });

  test('stamps the event time so a later event can detect staleness', () => {
    const u = updateForPlan({ kind: 'downgrade' }, 1789000000);
    assert.equal(u.stripe_event_applied_at, new Date(1789000000000).toISOString());
  });

  test('falls back to now when the event carries no timestamp', () => {
    const u = updateForPlan({ kind: 'downgrade' }, undefined);
    assert.ok(!Number.isNaN(Date.parse(u.stripe_event_applied_at)));
  });

  test('omits the customer id rather than nulling it when absent', () => {
    const u = updateForPlan({ kind: 'upgrade', tier: 'pro', subscriptionId: 's', periodEnd: null }, 1);
    assert.ok(!('stripe_customer_id' in u), 'must not wipe a known customer id');
  });
});

describe('failureResponse', () => {
  test('asks Stripe to retry a transient failure', () => {
    const r = failureResponse('transient');
    assert.equal(r.status, 500);
    assert.equal(r.retry, true);
  });

  test('a database error is retried — this is the paid-but-not-upgraded bug', () => {
    assert.equal(failureResponse('database').status, 500);
  });

  test('does not ask for retries that can never succeed', () => {
    assert.equal(failureResponse('unmappable').status, 200);
    assert.equal(failureResponse('unhandled').status, 200);
    assert.equal(failureResponse('unmappable').retry, false);
  });
});
