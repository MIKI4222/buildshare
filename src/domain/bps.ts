// Basis points math. 10000 bps = 100%. Never use floating point for ownership.
// All arithmetic is checked: overflow / underflow / out-of-range throws.

import { assertDomain, domainError } from './errors';
import type { Project } from './types';

export const BPS_TOTAL = 10000;
export const BPS_PERCENT = 100; // 1% = 100 bps

export interface OwnershipPool {
  ownershipTotal: number;
  founderBps: number;
  devPoolBps: number;
  committedBps: number;
  allocatedBps: number;
}

export interface PoolBreakdown {
  ownershipTotal: number;
  founderBps: number;
  devPoolBps: number;
  committedBps: number;
  allocatedBps: number;
  // Always computed, never stored.
  remainingBps: number;
  totalOwnedBps: number;
}

export function bpsToPercent(bps: number): number {
  return bps / 100;
}

export function bpsToPercentString(bps: number): string {
  const pct = bpsToPercent(bps);
  return pct.toFixed(pct % 1 === 0 ? 0 : 1) + '%';
}

export function percentToBps(percent: number): number {
  return Math.round(percent * 100);
}

export function isValidBps(bps: unknown): boolean {
  return (
    typeof bps === 'number' &&
    Number.isInteger(bps) &&
    bps >= 0 &&
    bps <= BPS_TOTAL
  );
}

export function assertValidBps(bps: number, label = 'bps'): void {
  assertDomain(
    isValidBps(bps),
    'INVALID_BPS',
    label + ' must be an integer between 0 and ' + BPS_TOTAL + ' (got ' + String(bps) + ').',
    { bps, label },
  );
}

export function validateSplit(founderBps: number, devPoolBps: number): boolean {
  return (
    isValidBps(founderBps) &&
    isValidBps(devPoolBps) &&
    founderBps + devPoolBps === BPS_TOTAL
  );
}

export function assertValidSplit(founderBps: number, devPoolBps: number): void {
  assertDomain(
    validateSplit(founderBps, devPoolBps),
    'INVALID_SPLIT',
    'founderBps + devPoolBps must equal ' + BPS_TOTAL + '.',
    { founderBps, devPoolBps },
  );
}

export function clampBps(bps: number): number {
  return Math.max(0, Math.min(BPS_TOTAL, Math.round(bps)));
}

export function checkedAddBps(a: number, b: number, label = 'sum'): number {
  const sum = a + b;
  assertDomain(
    Number.isInteger(sum) && sum >= 0 && sum <= BPS_TOTAL,
    'INVALID_BPS',
    'Checked add overflow for ' + label + ': ' + a + ' + ' + b + '.',
    { a, b, label },
  );
  return sum;
}

export function checkedSubBps(a: number, b: number, label = 'difference'): number {
  const diff = a - b;
  assertDomain(
    Number.isInteger(diff) && diff >= 0,
    'INVALID_BPS',
    'Checked sub underflow for ' + label + ': ' + a + ' - ' + b + '.',
    { a, b, label },
  );
  return diff;
}

// remaining = devPool - committed - allocated. Computed, never stored.
export function remainingDevPoolBps(pool: OwnershipPool): number {
  const used = pool.committedBps + pool.allocatedBps;
  if (used > pool.devPoolBps) {
    throw domainError(
      'INVARIANT_VIOLATION',
      'committedBps + allocatedBps exceeds devPoolBps.',
      { pool },
    );
  }
  return pool.devPoolBps - used;
}

export function assertPoolInvariants(pool: OwnershipPool): void {
  assertValidBps(pool.founderBps, 'founderBps');
  assertValidBps(pool.devPoolBps, 'devPoolBps');
  assertValidBps(pool.committedBps, 'committedBps');
  assertValidBps(pool.allocatedBps, 'allocatedBps');
  assertDomain(
    pool.ownershipTotal === BPS_TOTAL,
    'INVARIANT_VIOLATION',
    'ownershipTotal must be exactly ' + BPS_TOTAL + '.',
    { pool },
  );
  assertValidSplit(pool.founderBps, pool.devPoolBps);
  assertDomain(
    pool.committedBps + pool.allocatedBps <= pool.devPoolBps,
    'INVARIANT_VIOLATION',
    'committedBps + allocatedBps must not exceed devPoolBps.',
    { pool },
  );
  assertDomain(
    pool.founderBps + pool.allocatedBps <= BPS_TOTAL,
    'INVARIANT_VIOLATION',
    'founderBps + allocatedBps must not exceed ' + BPS_TOTAL + '.',
    { pool },
  );
}

export function poolBreakdown(pool: OwnershipPool | Project): PoolBreakdown {
  const p: OwnershipPool = {
    ownershipTotal: pool.ownershipTotal,
    founderBps: pool.founderBps,
    devPoolBps: pool.devPoolBps,
    committedBps: pool.committedBps,
    allocatedBps: pool.allocatedBps,
  };
  assertPoolInvariants(p);
  return {
    ownershipTotal: p.ownershipTotal,
    founderBps: p.founderBps,
    devPoolBps: p.devPoolBps,
    committedBps: p.committedBps,
    allocatedBps: p.allocatedBps,
    remainingBps: remainingDevPoolBps(p),
    totalOwnedBps: p.founderBps + p.allocatedBps,
  };
}

export function totalAllocated(members: { ownershipBps: number }[]): number {
  return members.reduce((sum, m) => sum + m.ownershipBps, 0);
}

// The sum of member ownership must equal founderBps + allocatedBps at all times.
export function assertMemberSumMatchesPool(
  pool: OwnershipPool,
  members: { ownershipBps: number }[],
): void {
  const sum = totalAllocated(members);
  assertDomain(
    sum === pool.founderBps + pool.allocatedBps,
    'INVARIANT_VIOLATION',
    'Sum of member ownership (' + sum + ') does not match founderBps + allocatedBps (' +
      (pool.founderBps + pool.allocatedBps) + ').',
    { sum, pool },
  );
}
