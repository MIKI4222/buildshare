// Core domain types for BuildShare.
// All ownership values use basis points (bps): 10000 = 100%.

export type AppMode = 'demo' | 'live';

export type Network = 'devnet' | 'mainnet-beta';

export type SolanaStatus = 'not_started' | 'initialized' | 'live';
export type GitHubStatus = 'disconnected' | 'connected';

export type ProjectStatus = 'active' | 'paused' | 'archived';

export type TaskStatus =
  | 'OPEN'
  | 'CLAIMED'
  | 'SUBMITTED'
  | 'VERIFYING'
  | 'APPROVED'
  | 'REJECTED'
  | 'COMPLETED';

export type ContributionStatus =
  | 'PENDING'
  | 'AI_REVIEW'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'ONCHAIN'
  | 'FAILED';

export type MemberRole = 'OWNER' | 'CONTRIBUTOR';

export type Difficulty = 'beginner' | 'intermediate' | 'advanced' | 'expert';

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
  ownershipBps: number;
  lockedBps: number;
  unlockedBps: number;
  joinedAt: string;
}

export interface Task {
  id: string;
  projectId: string;
  externalKey: string; // e.g. BUILD-001
  title: string;
  description: string;
  acceptanceCriteria: string;
  rewardBps: number;
  status: TaskStatus;
  assignedUserId: string | null;
  githubIssueNumber: number | null;
  deadline: string | null;
  difficulty: Difficulty;
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
  recommendation: 'APPROVE' | 'REVIEW' | 'REJECT';
  rawResponse: string;
  createdAt: string;
}

export interface Contribution {
  id: string;
  projectId: string;
  taskId: string;
  userId: string;
  pullRequestId: string;
  rewardBps: number;
  status: ContributionStatus;
  evidenceHash: string;
  aiScore: number | null;
  aiRecommendation: 'APPROVE' | 'REVIEW' | 'REJECT' | null;
  verificationReason: string | null;
  solanaSignature: string | null;
  createdAt: string;
  verifiedAt: string | null;
}

export interface Project {
  id: string;
  name: string;
  slug: string;
  description: string;
  ownerUserId: string;
  solanaProjectPda: string | null;
  githubInstallationId: string | null;
  githubRepoOwner: string | null;
  githubRepoName: string | null;
  ownershipTotal: number; // 10000
  ownershipAllocated: number;
  ownershipRemaining: number;
  founderBps: number;
  devPoolBps: number;
  status: ProjectStatus;
  category: string;
  createdAt: string;
  updatedAt: string;
}

export type AuditEventType =
  | 'PROJECT_CREATED'
  | 'TASK_CREATED'
  | 'TASK_CLAIMED'
  | 'PR_LINKED'
  | 'PR_MERGED'
  | 'AI_VERIFIED'
  | 'CONTRIBUTION_APPROVED'
  | 'CONTRIBUTION_REJECTED'
  | 'OWNERSHIP_ALLOCATED';

export interface AuditLog {
  id: string;
  projectId: string;
  userId: string | null;
  eventType: AuditEventType;
  entityType: string;
  entityId: string;
  metadata: Record<string, string | number | boolean | null>;
  createdAt: string;
  solanaSignature: string | null;
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
