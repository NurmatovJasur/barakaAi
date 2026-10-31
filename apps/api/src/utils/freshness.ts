import type { FreshnessLevel } from '@smp/shared';

export interface FreshnessPolicy {
  freshHours: number;
  staleHours: number;
}

export function freshnessOf(lastUpdated: Date, now: Date, policy: FreshnessPolicy): FreshnessLevel {
  const ageHours = (now.getTime() - lastUpdated.getTime()) / 3_600_000;
  if (ageHours <= policy.freshHours) return 'FRESH';
  if (ageHours <= policy.staleHours) return 'ATTENTION';
  return 'STALE';
}
