export const TIER_LIMITS = {
  free: {
    apiKeys: 1,
    subscriptions: 5,
    customApis: 1,
    channels: ['email'],
  },
  pro: {
    apiKeys: 10,
    subscriptions: 50,
    customApis: 5,
    channels: ['email', 'slack', 'pagerduty', 'discord', 'teams'],
  },
  team: {
    apiKeys: Infinity,
    subscriptions: Infinity,
    customApis: Infinity,
    channels: ['email', 'slack', 'pagerduty', 'discord', 'teams'],
  },
};

export function getTierLimits(tier) {
  return TIER_LIMITS[tier] || TIER_LIMITS.free;
}

export const TIER_INFO = {
  pro: { name: 'Pro', price: '$19/mo', apiKeys: 10, subscriptions: 50, customApis: 5 },
  team: { name: 'Team', price: '$49/mo', apiKeys: 'Unlimited', subscriptions: 'Unlimited', customApis: 'Unlimited' },
};

export function getNextTier(tier) {
  if (tier === 'free') return 'pro';
  if (tier === 'pro') return 'team';
  return null;
}
