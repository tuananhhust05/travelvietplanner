import { getRedis } from '../../db/redis.js';
import { ApiError } from '../../lib/http.js';

// Daily quota by tier (spec/02-api.md §14). Stored default; overridable via systemConfig.
const DAILY_QUOTA: Record<string, number> = {
  traveler: 30,
  guide: 60,
  'org.owner': 150,
  'org.admin': 150,
  admin: 1000,
  superadmin: 1000,
};

function quotaForRoles(roles: string[]): number {
  return Math.max(0, ...roles.map((r) => DAILY_QUOTA[r] ?? 0), DAILY_QUOTA.traveler);
}

export async function checkAndConsumeQuota(userId: string, roles: string[]): Promise<void> {
  const redis = getRedis();
  const limit = quotaForRoles(roles);
  const day = new Date().toISOString().slice(0, 10);
  const key = `quota:planner:${userId}:${day}`;
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, 86_400);
  if (count > limit) {
    throw new ApiError(429, 'quota_exceeded', `Daily planner quota reached (${limit}/day)`);
  }
}
