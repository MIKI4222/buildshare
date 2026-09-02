// Core domain types for BuildShare.
// All ownership values use basis points (bps): 10000 = 100%. Never floating point.

export type AppMode = 'demo' | 'live';

export type Network = 'devnet' | 'mainnet-beta';

export type SolanaStatus = 'not_started' | 'initialized' | 'live';
export type GitHubStatus = 'disconnected' | 'connected';

export type ProjectStatus = 'active' | 'paused' | 'archived';

// One shared status vocabulary, two separate transition tables
// (see state-machine.ts). Task state and Contribution-attempt state are never
// mixed: a Task can be re-claimed after a rejection, a Contribution attempt
// cannot.
export type LifecycleStatus =
  | 'OPEN'
  | 'CLAIMED'
  | 'SUBMITTED'
  | 'AI_REVIEW'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'PENDING_ONCHAIN'
  | 'ONCHAIN'
  | 'ONCHAIN_FAILED'
  | 'DEMO_ALLOCATED'
  | 'EXPIRED'
  | 'BLOCKED';

export type TaskStatus = LifecycleStatus;
export type ContributionStatus = LifecycleStatus;

export type MemberRole = 'OWNER' | 'CONTRIBUTOR';

export type Difficulty = 'beginner' | 'intermediate' | 'advanced' | 'expert';

export type AIRecommendation = 'APPROVE' | 'REVIEW' | 'REJECT';

export interface User {
  id: string;
  walletAddress: string;
  githubUsername: string | null;
  githubUserId: string | null;
  avatarUrl: string | null;
  createdAt: string;
}

export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  role: MemberRole;
  // Ownership actually allocated to this member. Allocation is final and
  // non-transferable in v0.1, so there is no locked/unlocked split.
  ownershipBps: number;
  allocationCount: number;
  joinedAt: string;
}

// The immutable commitment created at CLAIMED time. Nothing in here may change
// while the task is claimed: it is what the contributor agreed to deliver.
export interface TaskCommitment {
  attempt: number;
  contributorUserId: string;
  contributorWallet: string;
  claimedAt: string;
  claimExpiresAt: string;
  rewardBps: number;
  acceptanceCriteria: string;
  repositoryFullName: string;
  baseBranch: string;
  acceptanceCriteriaHash: string;
  commitmentHash: string;
}

export interface Task {
  id: string;
  projectId: string;
  // On-chain u64 task id. Null until the task exists on chain; on chain the id
  // comes from project.task_count, which is monotonic and starts at 0.
  onchainTaskId: number | null;
  externalKey: string; // e.g. BUILD-001
  title: string;
  description: string;
  acceptanceCriteria: string;
  rewardBps: number;
  status: TaskStatus;
  assignedUserId: string | null;
  githubIssueNumber: number | null;
  repositoryFullName: string;
  baseBranch: string;
  deadline: string | null;
  difficulty: Difficulty;
  // Number of claim attempts made so far. Each attempt gets its own
  // Contribution + evidence + audit trail.
  attempt: number;
  commitment: TaskCommitment | null;
  createdAt: string;
  updatedAt: string;
}

export interface PullRequest {
  id: string;
  projectId: string;
  taskId: string | null;
  githubPrId: string;
  githubPrNumber: number;
  repository: string;
  authorGithubId: string;
  title: string;
  description: string;
  url: string;
  baseBranch: string;
  headBranch: string;
  state: 'open' | 'closed';
  merged: boolean;
  additions: number;
  deletions: number;
  changedFiles: number;
  mergeCommitSha: string | null;
  openedAt: string;
  mergedAt: string | null;
}

export interface AIEvaluation {
  id: string;
  contributionId: string;
  model: string;
  promptVersion: string;
  taskRequirements: string;
  codeSummary: string;
  qualityScore: number;
  requirementScore: number;
  testScore: number;
  securityScore: number;
  overallScore: number;
  recommendation: AIRecommendation;
  rawResponse: string;
  // Null until the evaluation hash is sealed (it is only required on-chain).
  evaluationHash: string | null;
  createdAt: string;
}

// Settlement is a discriminated union. A demo settlement structurally cannot
// carry a transaction signature, so no demo allocation can ever be rendered as
// an on-chain transaction.
export type Settlement =
  | { kind: 'demo'; allocatedAt: string; pda: string }
  | {
      kind: 'onchain';
      allocatedAt: string;
      pda: string;
      signature: string;
      network: Network;
    };

export interface Contribution {
  id: string;
  projectId: string;
  taskId: string;
  userId: string;
  pullRequestId: string | null;
  // Which claim attempt of the task this contribution belongs to.
  attempt: number;
  rewardBps: number;
  status: ContributionStatus;
  commitmentHash: string;
  evidenceHash: string | null;
  aiScore: number | null;
  aiRecommendation: AIRecommendation | null;
  aiEvaluationHash: string | null;
  verificationReason: string | null;
  settlement: Settlement | null;
  allocationError: string | null;
  rejectReason: string | null;
  rejectedBy: string | null;
  rejectedAt: string | null;
  createdAt: string;
  verifiedAt: string | null;
  approvedAt: string | null;
}

export interface Project {
  id: string;
  // On-chain u64 identifier, founder-scoped. Frozen: it is the third Project
  // PDA seed, encoded as 8 bytes little-endian (DESIGN FREEZE v1.2 §0.2, §8).
  onchainProjectId: number;
  name: string;
  slug: string;
  description: string;
  ownerUserId: string;
  founderWallet: string;
  solanaProjectPda: string | null;
  githubInstallationId: string | null;
  githubRepoOwner: string | null;
  githubRepoName: string | null;
  ownershipTotal: number; // always BPS_TOTAL (10000)
  founderBps: number;
  devPoolBps: number;
  // Reserved by existing tasks but not yet allocated. The reservation belongs to
  // the TASK, not to a contribution attempt: a retry never reserves twice.
  committedBps: number;
  // Actually allocated to members through settled contributions.
  allocatedBps: number;
  // NOTE: there is deliberately no stored `remainingBps`. It is always computed
  // as devPoolBps - committedBps - allocatedBps (see bps.ts / poolBreakdown).
  status: ProjectStatus;
  category: string;
  createdAt: string;
  updatedAt: string;
}

export type AuditEventType =
  | 'PROJECT_CREATED'
  | 'TASK_CREATED'
  | 'TASK_UPDATED'
  | 'TASK_CLAIMED'
  | 'TASK_CLAIM_EXPIRED'
  | 'TASK_CANCELLED'
  | 'PR_LINKED'
  | 'PR_MERGED'
  | 'CONTRIBUTION_SUBMITTED'
  | 'AI_VERIFIED'
  | 'CONTRIBUTION_APPROVED'
  | 'CONTRIBUTION_REJECTED'
  | 'OWNERSHIP_ALLOCATION_STARTED'
  | 'OWNERSHIP_ALLOCATED'
  | 'OWNERSHIP_ALLOCATION_FAILED';

export interface AuditLog {
  id: string;
  projectId: string;
  userId: string | null;
  eventType: AuditEventType;
  entityType: string;
  entityId: string;
  metadata: Record<string, string | number | boolean | null>;
  createdAt: string;
  // Only ever set for real on-chain transactions.
  signature: string | null;
  network: Network | null;
}

export interface AppDB {
  users: User[];
  projects: Project[];
  members: ProjectMember[];
  tasks: Task[];
  pullRequests: PullRequest[];
  contributions: Contribution[];
  evaluations: AIEvaluation[];
  auditLogs: AuditLog[];
}
