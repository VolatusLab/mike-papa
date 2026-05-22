import 'server-only';
import { planLimits, checkLimit, type PlanLimits } from '@bnmp/shared';
import { repos } from '@/lib/repos';

export interface TenantUsage {
  plan: string;
  limits: PlanLimits;
  cities: { used: number; max: number };
  members: { used: number; max: number };
  telegram: { used: number; max: number };
}

/**
 * Current resource usage for a tenant vs its plan limits.
 * `members` counts active users + pending invitations (a seat is consumed
 * the moment an invite is sent).
 */
export async function getTenantUsage(tenantId: string, plan: string): Promise<TenantUsage> {
  const limits = planLimits(plan);
  const [cities, users, pendingInvites, telegram] = await Promise.all([
    repos.monitoredCity.count(tenantId),
    repos.user.countByTenant(tenantId),
    repos.invitation.countPending(tenantId),
    repos.telegramConfig.countByTenant(tenantId),
  ]);
  return {
    plan,
    limits,
    cities: { used: cities, max: limits.maxCities },
    members: { used: users + pendingInvites, max: limits.maxUsers },
    telegram: { used: telegram, max: limits.maxTelegramConfigs },
  };
}

/** Throws-free guard helper: returns the limit check for one resource. */
export async function canAddCity(tenantId: string, plan: string) {
  const used = await repos.monitoredCity.count(tenantId);
  return checkLimit(used, planLimits(plan).maxCities);
}

export async function canAddMember(tenantId: string, plan: string) {
  const [users, invites] = await Promise.all([
    repos.user.countByTenant(tenantId),
    repos.invitation.countPending(tenantId),
  ]);
  return checkLimit(users + invites, planLimits(plan).maxUsers);
}

export async function canAddTelegramConfig(tenantId: string, plan: string) {
  const used = await repos.telegramConfig.countByTenant(tenantId);
  return checkLimit(used, planLimits(plan).maxTelegramConfigs);
}
