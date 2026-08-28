// Two separate transition tables over one shared status vocabulary.
//
// Task: REJECTED is NOT terminal, because a task can be re-claimed (retry).
// Contribution attempt: REJECTED IS terminal, because a rejected attempt is
// closed forever; a retry produces a NEW contribution attempt with its own
// evidence and audit trail.

import { assertDomain } from './errors';
import type { AppMode, ContributionStatus, LifecycleStatus, TaskStatus } from './types';

export const TASK_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  OPEN: ['CLAIMED', 'BLOCKED'],
  CLAIMED: ['SUBMITTED', 'EXPIRED', 'OPEN', 'BLOCKED'],
  SUBMITTED: ['AI_REVIEW', 'REJECTED', 'BLOCKED'],
  AI_REVIEW: ['PENDING_APPROVAL', 'REJECTED', 'BLOCKED'],
  PENDING_APPROVAL: ['APPROVED', 'REJECTED', 'BLOCKED'],
  APPROVED: ['PENDING_ONCHAIN', 'DEMO_ALLOCATED'],
  PENDING_ONCHAIN: ['ONCHAIN', 'ONCHAIN_FAILED'],
  ONCHAIN_FAILED: ['PENDING_ONCHAIN'],
  REJECTED: ['CLAIMED', 'OPEN'],
  EXPIRED: ['OPEN'],
  BLOCKED: ['OPEN'],
  ONCHAIN: [],
  DEMO_ALLOCATED: [],
};

export const CONTRIBUTION_TRANSITIONS: Record<ContributionStatus, ContributionStatus[]> = {
  SUBMITTED: ['AI_REVIEW', 'REJECTED', 'BLOCKED'],
  AI_REVIEW: ['PENDING_APPROVAL', 'REJECTED', 'BLOCKED'],
  PENDING_APPROVAL: ['APPROVED', 'REJECTED', 'BLOCKED'],
  APPROVED: ['PENDING_ONCHAIN', 'DEMO_ALLOCATED'],
  PENDING_ONCHAIN: ['ONCHAIN', 'ONCHAIN_FAILED'],
  ONCHAIN_FAILED: ['PENDING_ONCHAIN'],
  // Terminal for this attempt.
  REJECTED: [],
  ONCHAIN: [],
  DEMO_ALLOCATED: [],
  BLOCKED: [],
  // A contribution attempt never occupies these task-only states.
  OPEN: [],
  CLAIMED: [],
  EXPIRED: [],
};

export function canTransitionTask(from: TaskStatus, to: TaskStatus): boolean {
  const allowed = TASK_TRANSITIONS[from];
  return allowed ? allowed.indexOf(to) !== -1 : false;
}

export function canTransitionContribution(
  from: ContributionStatus,
  to: ContributionStatus,
): boolean {
  const allowed = CONTRIBUTION_TRANSITIONS[from];
  return allowed ? allowed.indexOf(to) !== -1 : false;
}

export function assertTaskTransition(taskId: string, from: TaskStatus, to: TaskStatus): void {
  assertDomain(
    canTransitionTask(from, to),
    'INVALID_TRANSITION',
    'Invalid task transition for ' + taskId + ': ' + from + ' -> ' + to + '.',
    { taskId, from, to },
  );
}

export function assertContributionTransition(
  contributionId: string,
  from: ContributionStatus,
  to: ContributionStatus,
): void {
  assertDomain(
    canTransitionContribution(from, to),
    'INVALID_TRANSITION',
    'Invalid contribution transition for ' + contributionId + ': ' + from + ' -> ' + to + '.',
    { contributionId, from, to },
  );
}

// Terminal success state per mode. Demo work can never reach ONCHAIN.
export const TERMINAL_SUCCESS: Record<AppMode, LifecycleStatus> = {
  demo: 'DEMO_ALLOCATED',
  live: 'ONCHAIN',
};

// The commitment is frozen the moment a task leaves OPEN.
export function isCommitmentFrozen(status: TaskStatus): boolean {
  return status !== 'OPEN';
}

export function isSettled(status: LifecycleStatus): boolean {
  return status === 'ONCHAIN' || status === 'DEMO_ALLOCATED';
}

// Task statuses whose reward is reserved (committed) out of the dev pool.
export const COMMITTING_TASK_STATUSES: TaskStatus[] = [
  'OPEN',
  'CLAIMED',
  'SUBMITTED',
  'AI_REVIEW',
  'PENDING_APPROVAL',
  'APPROVED',
  'PENDING_ONCHAIN',
  'ONCHAIN_FAILED',
  'REJECTED',
  'EXPIRED',
  'BLOCKED',
];

// Task statuses whose reward has moved from committed to allocated.
export const SETTLED_TASK_STATUSES: TaskStatus[] = ['ONCHAIN', 'DEMO_ALLOCATED'];

export const LIFECYCLE_STATUSES: LifecycleStatus[] = [
  'OPEN',
  'CLAIMED',
  'SUBMITTED',
  'AI_REVIEW',
  'PENDING_APPROVAL',
  'APPROVED',
  'REJECTED',
  'PENDING_ONCHAIN',
  'ONCHAIN',
  'ONCHAIN_FAILED',
  'DEMO_ALLOCATED',
  'EXPIRED',
  'BLOCKED',
];

export const TASK_STATUSES: TaskStatus[] = LIFECYCLE_STATUSES;
export const CONTRIBUTION_STATUSES: ContributionStatus[] = [
  'SUBMITTED',
  'AI_REVIEW',
  'PENDING_APPROVAL',
  'APPROVED',
  'REJECTED',
  'PENDING_ONCHAIN',
  'ONCHAIN',
  'ONCHAIN_FAILED',
  'DEMO_ALLOCATED',
  'BLOCKED',
];
