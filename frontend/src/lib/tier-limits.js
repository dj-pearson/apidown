export const TIER_LIMITS = {
  free: {
    apiKeys: 1,
    subscriptions: 5,
    channels: ['email'],
  },
  pro: {
    apiKeys: 10,
    subscriptions: 50,
    channels: ['email', 'slack', 'pagerduty', 'discord', 'teams'],
  },
  team: {
    apiKeys: Infinity,
    subscriptions: Infinity,
    channels: ['email', 'slack', 'pagerduty', 'discord', 'teams'],
  },
};

export function getTierLimits(tier) {
  return TIER_LIMITS[tier] || TIER_LIMITS.free;
}
