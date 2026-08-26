// Basis points math. 10000 bps = 100%. Never use floating point for ownership.

export const BPS_TOTAL = 10000;
export const BPS_PERCENT = 100; // 1% = 100 bps

export function bpsToPercent(bps: number): number {
  return bps / 100;
}

export function bpsToPercentString(bps: number): string {
  const pct = bpsToPercent(bps);
  return `${pct.toFixed(pct % 1 === 0 ? 0 : 1)}%`;
}

export function percentToBps(percent: number): number {
  return Math.round(percent * 100);
}

export function validateSplit(founderBps: number, devPoolBps: number): boolean {
  return founderBps + devPoolBps === BPS_TOTAL && founderBps >= 0 && devPoolBps >= 0;
}

export function clampBps(bps: number): number {
  return Math.max(0, Math.min(BPS_TOTAL, Math.round(bps)));
}

export function remainingDevPool(
  devPoolBps: number,
  tasks: { rewardBps: number; status: string }[],
): number {
  // Count rewards from tasks that are still active (not COMPLETED/REJECTED)
  const activeStatuses = ['OPEN', 'CLAIMED', 'SUBMITTED', 'VERIFYING', 'APPROVED'];
  const committed = tasks
    .filter((t) => activeStatuses.includes(t.status))
    .reduce((sum, t) => sum + t.rewardBps, 0);
  return Math.max(0, devPoolBps - committed);
}

export function totalAllocated(members: { ownershipBps: number }[]): number {
  return members.reduce((sum, m) => sum + m.ownershipBps, 0);
}
