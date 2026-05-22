// SaaS plan tiers. Tenant.plan stores one of these slugs (default 'free').
// Billing integration (Stripe etc.) is out of scope — limits are enforced in
// server actions; upgrading a plan today is a DB update on Tenant.plan.

export const PLANS = ['free', 'pro', 'enterprise'] as const;
export type Plan = (typeof PLANS)[number];

export interface PlanLimits {
  maxCities: number;
  maxUsers: number;
  maxTelegramConfigs: number;
}

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free: { maxCities: 3, maxUsers: 2, maxTelegramConfigs: 2 },
  pro: { maxCities: 25, maxUsers: 15, maxTelegramConfigs: 10 },
  enterprise: { maxCities: 1000, maxUsers: 500, maxTelegramConfigs: 100 },
};

export const PLAN_LABELS: Record<Plan, string> = {
  free: 'Free',
  pro: 'Pro',
  enterprise: 'Enterprise',
};

export function isPlan(value: string): value is Plan {
  return (PLANS as readonly string[]).includes(value);
}

/** Limits for a plan slug. Unknown / malformed slugs fall back to `free`. */
export function planLimits(plan: string): PlanLimits {
  return isPlan(plan) ? PLAN_LIMITS[plan] : PLAN_LIMITS.free;
}

export interface LimitCheck {
  allowed: boolean;
  current: number;
  max: number;
  remaining: number;
}

/**
 * Pure limit check. `current` is the existing count; the action is allowed
 * when adding one more stays within `max`.
 */
export function checkLimit(current: number, max: number): LimitCheck {
  const allowed = current < max;
  return { allowed, current, max, remaining: Math.max(0, max - current) };
}
