// Pure domain reducers: (db, input) -> new db.
//
// Every P0 invariant lives here, NOT in the UI. The React store is only an
// orchestrator: it calls these reducers and the providers, it never mutates
// ownership or statuses by itself.
//
// Ownership accounting model
// --------------------------
// The reward reservation belongs to the TASK, not to a contribution attempt:
//   createTask       -> committedBps += rewardBps        (reservation)
//   claimTask        -> committedBps unchanged           (retry-safe)
//   rejectContribution -> committedBps unchanged         (reservation survives)
//   settleAllocation -> committedBps -= rewardBps, allocatedBps += rewardBps
//   cancelTask       -> committedBps -= rewardBps        (reservation released)
// remainingBps is always computed: devPoolBps - committedBps - allocatedBps.

import {
  assertMemberSumMatchesPool,
  assertPoolInvariants,
  assertValidBps,
  assertValidSplit,
  BPS_TOTAL,
  checkedAddBps,
  checkedSubBps,
  poolBreakdown,
  remainingDevPoolBps,
  type PoolBreakdown,
} from './bps';
import {
  claimExpiryFrom,
  computeCommitmentHashes,
  DEFAULT_CLAIM_WINDOW_DAYS,
  isClaimExpired,
} from './commitment';
import { assertDomain } from './errors';
import { computeEvidenceHash } from './evidence';
import {
  assertContributionTransition,
  assertTaskTransition,
  isCommitmentFrozen,
  isSettled,
} from './state-machine';
import type {
  AIEvaluation,
  AIRecommendation,
  AppDB,
  AuditEventType,
  AuditLog,
  Contribution,
  Difficulty,
  Project,
  ProjectMember,
  PullRequest,
  Settlement,
  Task,
  TaskCommitment,
  User,
} from './types';

export interface Deps {
  now: () => string;
  newId: (prefix: string) => string;
}

export const defaultDeps: Deps = {
  now: () => new Date().toISOString(),
  newId: (prefix: string) =>
    prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8),
};

export const MIN_REJECT_REASON = 10;

export const IMMUTABLE_AFTER_CLAIM = [
  'rewardBps',
  'acceptanceCriteria',
  'repositoryFullName',
  'baseBranch',
] as const;

// ---------------------------------------------------------------- lookups

export function requireProject(db: AppDB, projectId: string): Project {
  const project = db.projects.find((p) => p.id === projectId);
  assertDomain(project, 'PROJECT_NOT_FOUND', 'Project not found: ' + projectId, { projectId });
  return project as Project;
}

export function requireTask(db: AppDB, taskId: string): Task {
  const task = db.tasks.find((t) => t.id === taskId);
  assertDomain(task, 'TASK_NOT_FOUND', 'Task not found: ' + taskId, { taskId });
  return task as Task;
}

export function requireContribution(db: AppDB, contributionId: string): Contribution {
  const contribution = db.contributions.find((c) => c.id === contributionId);
  assertDomain(
    contribution,
    'CONTRIBUTION_NOT_FOUND',
    'Contribution not found: ' + contributionId,
    { contributionId },
  );
  return contribution as Contribution;
}

export function requireUser(db: AppDB, userId: string): User {
  const user = db.users.find((u) => u.id === userId);
  assertDomain(user, 'USER_NOT_FOUND', 'User not found: ' + userId, { userId });
  return user as User;
}

export function assertRequireAuthority(project: Project, actorUserId: string): void {
  assertDomain(
    project.ownerUserId === actorUserId,
    'NOT_AUTHORIZED',
    'Only the project founder may perform this action.',
    { projectId: project.id, actorUserId },
  );
}

export function projectPool(db: AppDB, projectId: string): PoolBreakdown {
  return poolBreakdown(requireProject(db, projectId));
}

// ---------------------------------------------------------------- audit

export interface AuditInput {
  projectId: string;
  userId: string | null;
  eventType: AuditEventType;
  entityType: string;
  entityId: string;
  metadata?: Record<string, string | number | boolean | null>;
  // A signature is only ever recorded when it comes from a real on-chain
  // settlement. A demo settlement structurally has no signature field.
  settlement?: Settlement | null;
}

export function appendAudit(db: AppDB, input: AuditInput, deps: Deps = defaultDeps): AppDB {
  const settlement = input.settlement;
  const log: AuditLog = {
    id: deps.newId('aud'),
    projectId: input.projectId,
    userId: input.userId,
    eventType: input.eventType,
    entityType: input.entityType,
    entityId: input.entityId,
    metadata: input.metadata || {},
    createdAt: deps.now(),
    signature: settlement && settlement.kind === 'onchain' ? settlement.signature : null,
    network: settlement && settlement.kind === 'onchain' ? settlement.network : null,
  };
  return { ...db, auditLogs: [log, ...db.auditLogs] };
}

function replaceProject(db: AppDB, project: Project): AppDB {
  return { ...db, projects: db.projects.map((p) => (p.id === project.id ? project : p)) };
}

function replaceTask(db: AppDB, task: Task): AppDB {
  return { ...db, tasks: db.tasks.map((t) => (t.id === task.id ? task : t)) };
}

function replaceContribution(db: AppDB, contribution: Contribution): AppDB {
  return {
    ...db,
    contributions: db.contributions.map((c) => (c.id === contribution.id ? contribution : c)),
  };
}

// ---------------------------------------------------------------- project

export interface CreateProjectInput {
  name: string;
  slug: string;
  description: string;
  ownerUserId: string;
  founderWallet: string;
  founderBps: number;
  devPoolBps: number;
  category: string;
  githubRepo?: string | null;
}

export function createProject(
  db: AppDB,
  input: CreateProjectInput,
  deps: Deps = defaultDeps,
): { db: AppDB; project: Project; member: ProjectMember } {
  assertValidSplit(input.founderBps, input.devPoolBps);
  const at = deps.now();
  const projectId = deps.newId('prj');
  const repo = input.githubRepo ? input.githubRepo.split('/') : [];
  const project: Project = {
    id: projectId,
    name: input.name,
    slug:
      input.slug ||
      input.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
    description: input.description,
    ownerUserId: input.ownerUserId,
    founderWallet: input.founderWallet,
    solanaProjectPda: null,
    githubInstallationId: null,
    githubRepoOwner: repo.length === 2 ? repo[0] : null,
    githubRepoName: repo.length === 2 ? repo[1] : null,
    ownershipTotal: BPS_TOTAL,
    founderBps: input.founderBps,
    devPoolBps: input.devPoolBps,
    committedBps: 0,
    allocatedBps: 0,
    status: 'active',
    category: input.category,
    createdAt: at,
    updatedAt: at,
  };
  assertPoolInvariants(project);
  const member: ProjectMember = {
    id: deps.newId('mem'),
    projectId,
    userId: input.ownerUserId,
    role: 'OWNER',
    ownershipBps: input.founderBps,
    allocationCount: 0,
    joinedAt: at,
  };
  let next: AppDB = {
    ...db,
    projects: [...db.projects, project],
    members: [...db.members, member],
  };
  next = appendAudit(
    next,
    {
      projectId,
      userId: input.ownerUserId,
      eventType: 'PROJECT_CREATED',
      entityType: 'project',
      entityId: projectId,
      metadata: { founderBps: input.founderBps, devPoolBps: input.devPoolBps },
    },
    deps,
  );
  return { db: next, project, member };
}

// ---------------------------------------------------------------- tasks

export interface CreateTaskInput {
  projectId: string;
  actorUserId: string;
  title: string;
  description: string;
  acceptanceCriteria: string;
  rewardBps: number;
  difficulty: Difficulty;
  deadline: string | null;
  githubIssueNumber: number | null;
  repositoryFullName?: string;
  baseBranch?: string;
}

export function createTask(
  db: AppDB,
  input: CreateTaskInput,
  deps: Deps = defaultDeps,
): { db: AppDB; task: Task } {
  const project = requireProject(db, input.projectId);
  assertRequireAuthority(project, input.actorUserId);
  assertValidBps(input.rewardBps, 'rewardBps');
  assertDomain(input.rewardBps > 0, 'INVALID_BPS', 'Task reward must be greater than 0 bps.', {
    rewardBps: input.rewardBps,
  });

  const remaining = remainingDevPoolBps(project);
  assertDomain(
    input.rewardBps <= remaining,
    'POOL_EXCEEDED',
    'Task reward ' +
      input.rewardBps +
      ' bps exceeds the remaining development pool (' +
      remaining +
      ' bps).',
    { rewardBps: input.rewardBps, remaining },
  );

  const at = deps.now();
  const existing = db.tasks.filter((t) => t.projectId === input.projectId);
  const externalKey = 'BUILD-' + String(existing.length + 1).padStart(3, '0');
  const repoFullName =
    input.repositoryFullName ||
    (project.githubRepoOwner && project.githubRepoName
      ? project.githubRepoOwner + '/' + project.githubRepoName
      : '');

  const task: Task = {
    id: deps.newId('tsk'),
    projectId: input.projectId,
    externalKey,
    title: input.title,
    description: input.description,
    acceptanceCriteria: input.acceptanceCriteria,
    rewardBps: input.rewardBps,
    status: 'OPEN',
    assignedUserId: null,
    githubIssueNumber: input.githubIssueNumber,
    repositoryFullName: repoFullName,
    baseBranch: input.baseBranch || 'main',
    deadline: input.deadline,
    difficulty: input.difficulty,
    attempt: 0,
    commitment: null,
    createdAt: at,
    updatedAt: at,
  };

  const updatedProject: Project = {
    ...project,
    committedBps: checkedAddBps(project.committedBps, input.rewardBps, 'committedBps'),
    updatedAt: at,
  };
  assertPoolInvariants(updatedProject);

  let next = replaceProject({ ...db, tasks: [...db.tasks, task] }, updatedProject);
  next = appendAudit(
    next,
    {
      projectId: input.projectId,
      userId: input.actorUserId,
      eventType: 'TASK_CREATED',
      entityType: 'task',
      entityId: task.id,
      metadata: { key: externalKey, rewardBps: input.rewardBps, committedBps: updatedProject.committedBps },
    },
    deps,
  );
  return { db: next, task };
}

export interface TaskPatch {
  title?: string;
  description?: string;
  acceptanceCriteria?: string;
  rewardBps?: number;
  repositoryFullName?: string;
  baseBranch?: string;
  deadline?: string | null;
  difficulty?: Difficulty;
  githubIssueNumber?: number | null;
}

export function updateTask(
  db: AppDB,
  input: { taskId: string; actorUserId: string; patch: TaskPatch },
  deps: Deps = defaultDeps,
): { db: AppDB; task: Task } {
  const task = requireTask(db, input.taskId);
  const project = requireProject(db, task.projectId);
  assertRequireAuthority(project, input.actorUserId);

  const patch = input.patch;
  if (isCommitmentFrozen(task.status)) {
    for (const field of IMMUTABLE_AFTER_CLAIM) {
      const value = (patch as Record<string, unknown>)[field];
      if (value === undefined) continue;
      if (value === (task as unknown as Record<string, unknown>)[field]) continue;
      assertDomain(
        false,
        'IMMUTABLE_AFTER_CLAIM',
        'Field "' + field + '" is immutable once the task has left OPEN (current status: ' +
          task.status + ').',
        { taskId: task.id, field, status: task.status },
      );
    }
  }

  const at = deps.now();
  let updatedProject = project;

  if (patch.rewardBps !== undefined && patch.rewardBps !== task.rewardBps) {
    assertValidBps(patch.rewardBps, 'rewardBps');
    assertDomain(patch.rewardBps > 0, 'INVALID_BPS', 'Task reward must be greater than 0 bps.', {
      rewardBps: patch.rewardBps,
    });
    const released = checkedSubBps(project.committedBps, task.rewardBps, 'committedBps');
    const candidate: Project = { ...project, committedBps: released, updatedAt: at };
    const remaining = remainingDevPoolBps(candidate);
    assertDomain(
      patch.rewardBps <= remaining,
      'POOL_EXCEEDED',
      'New task reward exceeds the remaining development pool (' + remaining + ' bps).',
      { rewardBps: patch.rewardBps, remaining },
    );
    updatedProject = {
      ...candidate,
      committedBps: checkedAddBps(released, patch.rewardBps, 'committedBps'),
    };
    assertPoolInvariants(updatedProject);
  }

  const updatedTask: Task = {
    ...task,
    title: patch.title !== undefined ? patch.title : task.title,
    description: patch.description !== undefined ? patch.description : task.description,
    acceptanceCriteria:
      patch.acceptanceCriteria !== undefined ? patch.acceptanceCriteria : task.acceptanceCriteria,
    rewardBps: patch.rewardBps !== undefined ? patch.rewardBps : task.rewardBps,
    repositoryFullName:
      patch.repositoryFullName !== undefined ? patch.repositoryFullName : task.repositoryFullName,
    baseBranch: patch.baseBranch !== undefined ? patch.baseBranch : task.baseBranch,
    deadline: patch.deadline !== undefined ? patch.deadline : task.deadline,
    difficulty: patch.difficulty !== undefined ? patch.difficulty : task.difficulty,
    githubIssueNumber:
      patch.githubIssueNumber !== undefined ? patch.githubIssueNumber : task.githubIssueNumber,
    updatedAt: at,
  };

  let next = replaceTask(db, updatedTask);
  if (updatedProject !== project) next = replaceProject(next, updatedProject);
  next = appendAudit(
    next,
    {
      projectId: task.projectId,
      userId: input.actorUserId,
      eventType: 'TASK_UPDATED',
      entityType: 'task',
      entityId: task.id,
      metadata: { fields: Object.keys(patch).join(',') },
    },
    deps,
  );
  return { db: next, task: updatedTask };
}

// Cancelling an unclaimed task releases its reservation back into the pool.
export function cancelTask(
  db: AppDB,
  input: { taskId: string; actorUserId: string },
  deps: Deps = defaultDeps,
): { db: AppDB; task: Task } {
  const task = requireTask(db, input.taskId);
  const project = requireProject(db, task.projectId);
  assertRequireAuthority(project, input.actorUserId);
  assertTaskTransition(task.id, task.status, 'BLOCKED');

  const at = deps.now();
  const updatedTask: Task = { ...task, status: 'BLOCKED', commitment: null, assignedUserId: null, updatedAt: at };
  const updatedProject: Project = {
    ...project,
    committedBps: checkedSubBps(project.committedBps, task.rewardBps, 'committedBps'),
    updatedAt: at,
  };
  assertPoolInvariants(updatedProject);

  let next = replaceProject(replaceTask(db, updatedTask), updatedProject);
  next = appendAudit(
    next,
    {
      projectId: task.projectId,
      userId: input.actorUserId,
      eventType: 'TASK_CANCELLED',
      entityType: 'task',
      entityId: task.id,
      metadata: { releasedBps: task.rewardBps },
    },
    deps,
  );
  return { db: next, task: updatedTask };
}

// ---------------------------------------------------------------- claim

export async function claimTask(
  db: AppDB,
  input: { taskId: string; userId: string; claimWindowDays?: number },
  deps: Deps = defaultDeps,
): Promise<{ db: AppDB; task: Task }> {
  const task = requireTask(db, input.taskId);
  const project = requireProject(db, task.projectId);
  const user = requireUser(db, input.userId);

  assertDomain(
    task.status === 'OPEN' || task.status === 'REJECTED',
    'NOT_CLAIMABLE',
    'Task ' + task.externalKey + ' cannot be claimed from status ' + task.status + '.',
    { taskId: task.id, status: task.status },
  );
  assertTaskTransition(task.id, task.status, 'CLAIMED');

  const at = deps.now();
  const attempt = task.attempt + 1;
  const hashes = await computeCommitmentHashes({
    projectId: task.projectId,
    taskId: task.id,
    taskExternalKey: task.externalKey,
    acceptanceCriteria: task.acceptanceCriteria,
    rewardBps: task.rewardBps,
    repositoryFullName: task.repositoryFullName,
    baseBranch: task.baseBranch,
    contributorWallet: user.walletAddress,
    attempt,
  });

  const commitment: TaskCommitment = {
    attempt,
    contributorUserId: user.id,
    contributorWallet: user.walletAddress,
    claimedAt: at,
    claimExpiresAt: claimExpiryFrom(at, input.claimWindowDays || DEFAULT_CLAIM_WINDOW_DAYS),
    rewardBps: task.rewardBps,
    acceptanceCriteria: task.acceptanceCriteria,
    repositoryFullName: task.repositoryFullName,
    baseBranch: task.baseBranch,
    acceptanceCriteriaHash: hashes.acceptanceCriteriaHash,
    commitmentHash: hashes.commitmentHash,
  };

  const updatedTask: Task = {
    ...task,
    status: 'CLAIMED',
    assignedUserId: user.id,
    attempt,
    commitment,
    updatedAt: at,
  };

  // committedBps intentionally untouched: the reservation was made when the
  // task was created and belongs to the task, not to this attempt.
  let next = replaceTask(db, updatedTask);
  next = appendAudit(
    next,
    {
      projectId: task.projectId,
      userId: user.id,
      eventType: 'TASK_CLAIMED',
      entityType: 'task',
      entityId: task.id,
      metadata: {
        attempt,
        commitmentHash: commitment.commitmentHash,
        claimExpiresAt: commitment.claimExpiresAt,
        committedBps: project.committedBps,
      },
    },
    deps,
  );
  return { db: next, task: updatedTask };
}

export function expireClaims(
  db: AppDB,
  deps: Deps = defaultDeps,
): { db: AppDB; expired: string[] } {
  const at = deps.now();
  const expired: string[] = [];
  let next = db;
  for (const task of db.tasks) {
    if (task.status !== 'CLAIMED') continue;
    if (!isClaimExpired(task.commitment, at)) continue;
    assertTaskTransition(task.id, task.status, 'EXPIRED');
    const commitmentHash = task.commitment ? task.commitment.commitmentHash : null;
    const updated: Task = {
      ...task,
      status: 'EXPIRED',
      assignedUserId: null,
      commitment: null,
      updatedAt: at,
    };
    next = replaceTask(next, updated);
    next = appendAudit(
      next,
      {
        projectId: task.projectId,
        userId: task.assignedUserId,
        eventType: 'TASK_CLAIM_EXPIRED',
        entityType: 'task',
        entityId: task.id,
        metadata: { attempt: task.attempt, commitmentHash },
      },
      deps,
    );
    expired.push(task.id);
  }
  return { db: next, expired };
}

// EXPIRED / REJECTED / BLOCKED / CLAIMED -> OPEN, so the task can be claimed again.
export function releaseClaim(
  db: AppDB,
  input: { taskId: string },
  deps: Deps = defaultDeps,
): { db: AppDB; task: Task } {
  const task = requireTask(db, input.taskId);
  assertTaskTransition(task.id, task.status, 'OPEN');
  const updated: Task = {
    ...task,
    status: 'OPEN',
    assignedUserId: null,
    commitment: null,
    updatedAt: deps.now(),
  };
  return { db: replaceTask(db, updated), task: updated };
}

// ---------------------------------------------------------------- contribution

export interface PullRequestInput {
  githubPrId: string;
  githubPrNumber: number;
  repository: string;
  authorGithubId: string;
  title: string;
  description: string;
  url: string;
  baseBranch: string;
  headBranch: string;
  additions: number;
  deletions: number;
  changedFiles: number;
  mergeCommitSha: string;
  openedAt: string;
  mergedAt: string;
}

export function submitContribution(
  db: AppDB,
  input: { taskId: string; userId: string; pullRequest: PullRequestInput },
  deps: Deps = defaultDeps,
): { db: AppDB; contribution: Contribution; pullRequest: PullRequest } {
  const task = requireTask(db, input.taskId);
  requireProject(db, task.projectId);
  const commitment = task.commitment;
  assertDomain(
    commitment,
    'NO_COMMITMENT',
    'Task ' + task.externalKey + ' has no active commitment.',
    { taskId: task.id },
  );
  const c = commitment as TaskCommitment;
  const at = deps.now();
  assertDomain(
    !isClaimExpired(c, at),
    'CLAIM_EXPIRED',
    'The claim for ' + task.externalKey + ' expired at ' + c.claimExpiresAt + '.',
    { taskId: task.id, claimExpiresAt: c.claimExpiresAt },
  );
  assertDomain(
    c.contributorUserId === input.userId,
    'NOT_AUTHORIZED',
    'Only the contributor who claimed the task may submit a contribution.',
    { taskId: task.id, userId: input.userId },
  );
  assertTaskTransition(task.id, task.status, 'SUBMITTED');

  const pr: PullRequest = {
    id: deps.newId('pr'),
    projectId: task.projectId,
    taskId: task.id,
    githubPrId: input.pullRequest.githubPrId,
    githubPrNumber: input.pullRequest.githubPrNumber,
    repository: input.pullRequest.repository,
    authorGithubId: input.pullRequest.authorGithubId,
    title: input.pullRequest.title,
    description: input.pullRequest.description,
    url: input.pullRequest.url,
    baseBranch: input.pullRequest.baseBranch,
    headBranch: input.pullRequest.headBranch,
    state: 'closed',
    merged: true,
    additions: input.pullRequest.additions,
    deletions: input.pullRequest.deletions,
    changedFiles: input.pullRequest.changedFiles,
    mergeCommitSha: input.pullRequest.mergeCommitSha,
    openedAt: input.pullRequest.openedAt,
    mergedAt: input.pullRequest.mergedAt,
  };

  const contribution: Contribution = {
    id: deps.newId('ctr'),
    projectId: task.projectId,
    taskId: task.id,
    userId: input.userId,
    pullRequestId: pr.id,
    attempt: c.attempt,
    rewardBps: c.rewardBps,
    status: 'SUBMITTED',
    commitmentHash: c.commitmentHash,
    evidenceHash: null,
    aiScore: null,
    aiRecommendation: null,
    aiEvaluationHash: null,
    verificationReason: null,
    settlement: null,
    allocationError: null,
    rejectReason: null,
    rejectedBy: null,
    rejectedAt: null,
    createdAt: at,
    verifiedAt: null,
    approvedAt: null,
  };

  const updatedTask: Task = { ...task, status: 'SUBMITTED', updatedAt: at };
  let next: AppDB = {
    ...db,
    pullRequests: [...db.pullRequests, pr],
    contributions: [...db.contributions, contribution],
  };
  next = replaceTask(next, updatedTask);
  next = appendAudit(
    next,
    {
      projectId: task.projectId,
      userId: input.userId,
      eventType: 'PR_MERGED',
      entityType: 'pullRequest',
      entityId: pr.id,
      metadata: { prNumber: pr.githubPrNumber, mergeCommitSha: pr.mergeCommitSha },
    },
    deps,
  );
  next = appendAudit(
    next,
    {
      projectId: task.projectId,
      userId: input.userId,
      eventType: 'CONTRIBUTION_SUBMITTED',
      entityType: 'contribution',
      entityId: contribution.id,
      metadata: { attempt: contribution.attempt, commitmentHash: contribution.commitmentHash },
    },
    deps,
  );
  return { db: next, contribution, pullRequest: pr };
}

export interface VerificationRecord {
  model: string;
  promptVersion: string;
  requirementScore: number;
  qualityScore: number;
  testScore: number;
  securityScore: number;
  overallScore: number;
  recommendation: AIRecommendation;
  reason: string;
  codeSummary: string;
  rawResponse: string;
  // Null when the caller has not pre-computed the hash: recordVerification
  // stores it as-is and the hash can be sealed later.
  evaluationHash: string | null;
}

export function recordVerification(
  db: AppDB,
  input: { contributionId: string; verification: VerificationRecord },
  deps: Deps = defaultDeps,
): { db: AppDB; contribution: Contribution; evaluation: AIEvaluation } {
  const contribution = requireContribution(db, input.contributionId);
  const task = requireTask(db, contribution.taskId);
  const v = input.verification;

  // SUBMITTED -> AI_REVIEW -> PENDING_APPROVAL, both steps validated.
  assertContributionTransition(contribution.id, contribution.status, 'AI_REVIEW');
  assertContributionTransition(contribution.id, 'AI_REVIEW', 'PENDING_APPROVAL');
  assertTaskTransition(task.id, task.status, 'AI_REVIEW');
  assertTaskTransition(task.id, 'AI_REVIEW', 'PENDING_APPROVAL');

  const at = deps.now();
  const evaluation: AIEvaluation = {
    id: deps.newId('eval'),
    contributionId: contribution.id,
    model: v.model,
    promptVersion: v.promptVersion,
    taskRequirements: task.acceptanceCriteria,
    codeSummary: v.codeSummary,
    qualityScore: v.qualityScore,
    requirementScore: v.requirementScore,
    testScore: v.testScore,
    securityScore: v.securityScore,
    overallScore: v.overallScore,
    recommendation: v.recommendation,
    rawResponse: v.rawResponse,
    evaluationHash: v.evaluationHash,
    createdAt: at,
  };

  const updatedContribution: Contribution = {
    ...contribution,
    status: 'PENDING_APPROVAL',
    aiScore: v.overallScore,
    aiRecommendation: v.recommendation,
    aiEvaluationHash: v.evaluationHash,
    verificationReason: v.reason,
    verifiedAt: at,
  };
  const updatedTask: Task = { ...task, status: 'PENDING_APPROVAL', updatedAt: at };

  let next: AppDB = { ...db, evaluations: [...db.evaluations, evaluation] };
  next = replaceContribution(next, updatedContribution);
  next = replaceTask(next, updatedTask);
  next = appendAudit(
    next,
    {
      projectId: contribution.projectId,
      userId: null,
      eventType: 'AI_VERIFIED',
      entityType: 'contribution',
      entityId: contribution.id,
      metadata: {
        score: v.overallScore,
        recommendation: v.recommendation,
        evaluationHash: v.evaluationHash,
        advisory: true,
      },
    },
    deps,
  );
  return { db: next, contribution: updatedContribution, evaluation };
}

// Founder approval. This is where the evidence hash is fixed.
export async function approveContribution(
  db: AppDB,
  input: { contributionId: string; approverUserId: string },
  deps: Deps = defaultDeps,
): Promise<{ db: AppDB; contribution: Contribution; evidenceHash: string }> {
  const contribution = requireContribution(db, input.contributionId);
  const task = requireTask(db, contribution.taskId);
  const project = requireProject(db, contribution.projectId);
  assertRequireAuthority(project, input.approverUserId);
  const approver = requireUser(db, input.approverUserId);
  const contributor = requireUser(db, contribution.userId);

  assertContributionTransition(contribution.id, contribution.status, 'APPROVED');
  assertTaskTransition(task.id, task.status, 'APPROVED');

  const commitment = task.commitment;
  assertDomain(commitment, 'NO_COMMITMENT', 'Task has no commitment to approve against.', {
    taskId: task.id,
  });
  const c = commitment as TaskCommitment;

  const pr = db.pullRequests.find((p) => p.id === contribution.pullRequestId);
  assertDomain(pr, 'INVARIANT_VIOLATION', 'Contribution has no linked pull request.', {
    contributionId: contribution.id,
  });
  const pullRequest = pr as PullRequest;

  const at = deps.now();
  const evidenceHash = await computeEvidenceHash({
    projectId: project.id,
    taskId: task.id,
    taskExternalKey: task.externalKey,
    acceptanceCriteriaHash: c.acceptanceCriteriaHash,
    rewardBps: c.rewardBps,
    repositoryFullName: c.repositoryFullName,
    baseBranch: c.baseBranch,
    prNumber: pullRequest.githubPrNumber,
    mergeCommitSha: pullRequest.mergeCommitSha || '',
    contributorGithubId: contributor.githubUserId,
    contributorWallet: c.contributorWallet,
    aiEvaluationHash: contribution.aiEvaluationHash,
    approvedByWallet: approver.walletAddress,
    approvedAt: at,
  });

  const updatedContribution: Contribution = {
    ...contribution,
    status: 'APPROVED',
    evidenceHash,
    approvedAt: at,
  };
  const updatedTask: Task = { ...task, status: 'APPROVED', updatedAt: at };

  let next = replaceContribution(db, updatedContribution);
  next = replaceTask(next, updatedTask);
  next = appendAudit(
    next,
    {
      projectId: project.id,
      userId: approver.id,
      eventType: 'CONTRIBUTION_APPROVED',
      entityType: 'contribution',
      entityId: contribution.id,
      metadata: {
        attempt: contribution.attempt,
        evidenceHash,
        rewardBps: contribution.rewardBps,
        aiScore: contribution.aiScore,
      },
    },
    deps,
  );
  return { db: next, contribution: updatedContribution, evidenceHash };
}

// ---------------------------------------------------------------- allocation

// Live mode only: APPROVED -> PENDING_ONCHAIN before a transaction is sent.
export function beginAllocation(
  db: AppDB,
  input: { contributionId: string },
  deps: Deps = defaultDeps,
): { db: AppDB; contribution: Contribution } {
  const contribution = requireContribution(db, input.contributionId);
  const task = requireTask(db, contribution.taskId);
  assertDomain(
    contribution.settlement === null,
    'DOUBLE_ALLOCATION',
    'Contribution ' + contribution.id + ' is already settled.',
    { contributionId: contribution.id },
  );
  assertContributionTransition(contribution.id, contribution.status, 'PENDING_ONCHAIN');
  assertTaskTransition(task.id, task.status, 'PENDING_ONCHAIN');

  const at = deps.now();
  const updatedContribution: Contribution = {
    ...contribution,
    status: 'PENDING_ONCHAIN',
    allocationError: null,
  };
  let next = replaceContribution(db, updatedContribution);
  next = replaceTask(next, { ...task, status: 'PENDING_ONCHAIN', updatedAt: at });
  next = appendAudit(
    next,
    {
      projectId: contribution.projectId,
      userId: null,
      eventType: 'OWNERSHIP_ALLOCATION_STARTED',
      entityType: 'contribution',
      entityId: contribution.id,
      metadata: { rewardBps: contribution.rewardBps },
    },
    deps,
  );
  return { db: next, contribution: updatedContribution };
}

// The only place where ownership actually moves from committed to allocated.
export function settleAllocation(
  db: AppDB,
  input: { contributionId: string; settlement: Settlement },
  deps: Deps = defaultDeps,
): { db: AppDB; contribution: Contribution } {
  const contribution = requireContribution(db, input.contributionId);
  const task = requireTask(db, contribution.taskId);
  const project = requireProject(db, contribution.projectId);
  const settlement = input.settlement;

  // Barrier 1: a settled contribution can never be settled again.
  assertDomain(
    contribution.settlement === null && !isSettled(contribution.status),
    'DOUBLE_ALLOCATION',
    'Contribution ' + contribution.id + ' has already been allocated.',
    { contributionId: contribution.id, status: contribution.status },
  );

  const target = settlement.kind === 'onchain' ? 'ONCHAIN' : 'DEMO_ALLOCATED';
  // Barrier 2: only a valid state transition may settle.
  assertContributionTransition(contribution.id, contribution.status, target);
  assertTaskTransition(task.id, task.status, target);

  const at = deps.now();
  const reward = contribution.rewardBps;
  assertValidBps(reward, 'rewardBps');

  // Barrier 3: checked arithmetic on the pool.
  const updatedProject: Project = {
    ...project,
    committedBps: checkedSubBps(project.committedBps, reward, 'committedBps'),
    allocatedBps: checkedAddBps(project.allocatedBps, reward, 'allocatedBps'),
    updatedAt: at,
  };
  assertPoolInvariants(updatedProject);

  const existingMember = db.members.find(
    (m) => m.projectId === project.id && m.userId === contribution.userId,
  );
  const members: ProjectMember[] = existingMember
    ? db.members.map((m) =>
        m.id === existingMember.id
          ? {
              ...m,
              ownershipBps: checkedAddBps(m.ownershipBps, reward, 'member.ownershipBps'),
              allocationCount: m.allocationCount + 1,
            }
          : m,
      )
    : [
        ...db.members,
        {
          id: deps.newId('mem'),
          projectId: project.id,
          userId: contribution.userId,
          role: 'CONTRIBUTOR' as const,
          ownershipBps: reward,
          allocationCount: 1,
          joinedAt: at,
        },
      ];

  const updatedContribution: Contribution = {
    ...contribution,
    status: target,
    settlement,
    allocationError: null,
  };

  let next: AppDB = { ...db, members };
  next = replaceProject(next, updatedProject);
  next = replaceContribution(next, updatedContribution);
  next = replaceTask(next, { ...task, status: target, updatedAt: at });

  // Barrier 4: the member ownership sum must still match the pool.
  assertMemberSumMatchesPool(
    updatedProject,
    next.members.filter((m) => m.projectId === project.id),
  );

  next = appendAudit(
    next,
    {
      projectId: project.id,
      userId: contribution.userId,
      eventType: 'OWNERSHIP_ALLOCATED',
      entityType: 'contribution',
      entityId: contribution.id,
      metadata: {
        amountBps: reward,
        mode: settlement.kind,
        pda: settlement.pda,
        allocatedBps: updatedProject.allocatedBps,
        committedBps: updatedProject.committedBps,
      },
      settlement,
    },
    deps,
  );
  return { db: next, contribution: updatedContribution };
}

export function failAllocation(
  db: AppDB,
  input: { contributionId: string; reason: string },
  deps: Deps = defaultDeps,
): { db: AppDB; contribution: Contribution } {
  const contribution = requireContribution(db, input.contributionId);
  const task = requireTask(db, contribution.taskId);
  assertContributionTransition(contribution.id, contribution.status, 'ONCHAIN_FAILED');
  assertTaskTransition(task.id, task.status, 'ONCHAIN_FAILED');

  const at = deps.now();
  const updatedContribution: Contribution = {
    ...contribution,
    status: 'ONCHAIN_FAILED',
    settlement: null,
    allocationError: input.reason,
  };
  let next = replaceContribution(db, updatedContribution);
  next = replaceTask(next, { ...task, status: 'ONCHAIN_FAILED', updatedAt: at });
  next = appendAudit(
    next,
    {
      projectId: contribution.projectId,
      userId: null,
      eventType: 'OWNERSHIP_ALLOCATION_FAILED',
      entityType: 'contribution',
      entityId: contribution.id,
      metadata: { reason: input.reason },
    },
    deps,
  );
  return { db: next, contribution: updatedContribution };
}

export function retryAllocation(
  db: AppDB,
  input: { contributionId: string },
  deps: Deps = defaultDeps,
): { db: AppDB; contribution: Contribution } {
  const contribution = requireContribution(db, input.contributionId);
  const task = requireTask(db, contribution.taskId);
  assertContributionTransition(contribution.id, contribution.status, 'PENDING_ONCHAIN');
  assertTaskTransition(task.id, task.status, 'PENDING_ONCHAIN');
  const at = deps.now();
  const updatedContribution: Contribution = {
    ...contribution,
    status: 'PENDING_ONCHAIN',
    allocationError: null,
  };
  let next = replaceContribution(db, updatedContribution);
  next = replaceTask(next, { ...task, status: 'PENDING_ONCHAIN', updatedAt: at });
  return { db: next, contribution: updatedContribution };
}

// ---------------------------------------------------------------- rejection

// Rejection is terminal for THIS attempt only. It never destroys the
// contribution record and never releases the task reservation, so a retry does
// not need to reserve ownership again.
export function rejectContribution(
  db: AppDB,
  input: { contributionId: string; actorUserId: string; reason: string },
  deps: Deps = defaultDeps,
): { db: AppDB; contribution: Contribution } {
  const contribution = requireContribution(db, input.contributionId);
  const task = requireTask(db, contribution.taskId);
  const project = requireProject(db, contribution.projectId);
  assertRequireAuthority(project, input.actorUserId);

  const reason = (input.reason || '').trim();
  assertDomain(
    reason.length >= MIN_REJECT_REASON,
    'REJECT_REASON_REQUIRED',
    'A rejection reason of at least ' + MIN_REJECT_REASON + ' characters is required.',
    { contributionId: contribution.id },
  );

  assertContributionTransition(contribution.id, contribution.status, 'REJECTED');
  assertTaskTransition(task.id, task.status, 'REJECTED');

  const at = deps.now();
  const updatedContribution: Contribution = {
    ...contribution,
    status: 'REJECTED',
    rejectReason: reason,
    rejectedBy: input.actorUserId,
    rejectedAt: at,
  };
  const updatedTask: Task = {
    ...task,
    status: 'REJECTED',
    assignedUserId: null,
    commitment: null,
    updatedAt: at,
  };

  let next = replaceContribution(db, updatedContribution);
  next = replaceTask(next, updatedTask);
  next = appendAudit(
    next,
    {
      projectId: project.id,
      userId: input.actorUserId,
      eventType: 'CONTRIBUTION_REJECTED',
      entityType: 'contribution',
      entityId: contribution.id,
      metadata: {
        attempt: contribution.attempt,
        rejectReason: reason,
        rejectedBy: input.actorUserId,
        rejectedAt: at,
        committedBps: project.committedBps,
      },
    },
    deps,
  );
  return { db: next, contribution: updatedContribution };
}
