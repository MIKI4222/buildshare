import type {
  TaskStatus,
  ContributionStatus,
} from './types';

// Valid task state transitions. The frontend cannot set arbitrary statuses.
const TASK_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  OPEN: ['CLAIMED'],
  CLAIMED: ['SUBMITTED', 'OPEN'],
  SUBMITTED: ['VERIFYING', 'REJECTED'],
  VERIFYING: ['APPROVED', 'REJECTED'],
  APPROVED: ['COMPLETED'],
  REJECTED: ['OPEN'],
  COMPLETED: [],
};

const CONTRIBUTION_TRANSITIONS: Record<ContributionStatus, ContributionStatus[]> = {
  PENDING: ['AI_REVIEW'],
  AI_REVIEW: ['PENDING_APPROVAL'],
  PENDING_APPROVAL: ['APPROVED', 'REJECTED'],
  APPROVED: ['ONCHAIN'],
  REJECTED: [],
  ONCHAIN: [],
  FAILED: ['PENDING_APPROVAL'],
};

export function canTransitionTask(from: TaskStatus, to: TaskStatus): boolean {
  return TASK_TRANSITIONS[from]?.includes(to) ?? false;
}

export function canTransitionContribution(from: ContributionStatus, to: ContributionStatus): boolean {
  return CONTRIBUTION_TRANSITIONS[from]?.includes(to) ?? false;
}

export function nextTaskStatus(status: TaskStatus): TaskStatus | null {
  const allowed = TASK_TRANSITIONS[status];
  return allowed && allowed.length === 1 ? allowed[0] : null;
}

export const TASK_STATUSES: TaskStatus[] = [
  'OPEN', 'CLAIMED', 'SUBMITTED', 'VERIFYING', 'APPROVED', 'REJECTED', 'COMPLETED',
];

export const CONTRIBUTION_STATUSES: ContributionStatus[] = [
  'PENDING', 'AI_REVIEW', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'ONCHAIN', 'FAILED',
];
