// Evidence v1 — the canonical record of what was actually delivered and
// approved. Its SHA-256 is what we intend to commit on-chain in P1.
//
// Never put on-chain: GitHub tokens, PR diffs, source code, large JSON, private
// data. Only the 32-byte hash of this canonical object.

import { sha256Canonical, shortHash } from './hash';

export const EVIDENCE_SCHEMA_VERSION = 'buildshare-evidence-v1';

export interface EvidenceInput {
  projectId: string;
  taskId: string;
  taskExternalKey: string;
  acceptanceCriteriaHash: string;
  rewardBps: number;
  repositoryFullName: string;
  baseBranch: string;
  prNumber: number;
  mergeCommitSha: string;
  contributorGithubId: string | null;
  contributorWallet: string;
  aiEvaluationHash: string | null;
  approvedByWallet: string;
  approvedAt: string;
}

export interface EvidenceV1 extends EvidenceInput {
  schemaVersion: string;
}

export function buildEvidenceV1(input: EvidenceInput): EvidenceV1 {
  return {
    schemaVersion: EVIDENCE_SCHEMA_VERSION,
    projectId: input.projectId,
    taskId: input.taskId,
    taskExternalKey: input.taskExternalKey,
    acceptanceCriteriaHash: input.acceptanceCriteriaHash,
    rewardBps: input.rewardBps,
    repositoryFullName: input.repositoryFullName,
    baseBranch: input.baseBranch,
    prNumber: input.prNumber,
    mergeCommitSha: input.mergeCommitSha,
    contributorGithubId: input.contributorGithubId,
    contributorWallet: input.contributorWallet,
    aiEvaluationHash: input.aiEvaluationHash,
    approvedByWallet: input.approvedByWallet,
    approvedAt: input.approvedAt,
  };
}

export function canonicalEvidenceJSON(input: EvidenceInput): string {
  const evidence = buildEvidenceV1(input);
  const keys = Object.keys(evidence).sort();
  const pairs = keys.map(
    (k) => JSON.stringify(k) + ':' + JSON.stringify((evidence as unknown as Record<string, unknown>)[k]),
  );
  return '{' + pairs.join(',') + '}';
}

export async function computeEvidenceHash(input: EvidenceInput): Promise<string> {
  return sha256Canonical(buildEvidenceV1(input));
}


// Evidence v1 above is historical and byte-stable. Do not add, remove or
// reinterpret any of its fields.
//
// Submission Evidence v2 is a separate schema fixed before AI review and
// before a founder decision. The deployed program treats its hash as opaque
// non-zero bytes, so this does not alter the frozen account or instruction.
export const SUBMISSION_EVIDENCE_SCHEMA_VERSION =
  'buildshare-submission-evidence-v2';

export interface SubmissionEvidenceInput {
  projectId: string;
  taskId: string;
  taskExternalKey: string;
  attempt: number;
  commitmentHash: string;
  acceptanceCriteriaHash: string;
  rewardBps: number;
  repositoryFullName: string;
  baseBranch: string;
  prNumber: number;
  mergeCommitSha: string;
  contributorGithubId: string | null;
  contributorWallet: string;
}

export interface SubmissionEvidenceV2 extends SubmissionEvidenceInput {
  schemaVersion: typeof SUBMISSION_EVIDENCE_SCHEMA_VERSION;
}

export function buildSubmissionEvidenceV2(
  input: SubmissionEvidenceInput,
): SubmissionEvidenceV2 {
  return {
    schemaVersion: SUBMISSION_EVIDENCE_SCHEMA_VERSION,
    projectId: input.projectId,
    taskId: input.taskId,
    taskExternalKey: input.taskExternalKey,
    attempt: input.attempt,
    commitmentHash: input.commitmentHash,
    acceptanceCriteriaHash: input.acceptanceCriteriaHash,
    rewardBps: input.rewardBps,
    repositoryFullName: input.repositoryFullName,
    baseBranch: input.baseBranch,
    prNumber: input.prNumber,
    mergeCommitSha: input.mergeCommitSha,
    contributorGithubId: input.contributorGithubId,
    contributorWallet: input.contributorWallet,
  };
}

export function canonicalSubmissionEvidenceJSON(
  input: SubmissionEvidenceInput,
): string {
  const evidence = buildSubmissionEvidenceV2(input);
  const keys = Object.keys(evidence).sort();
  const record = evidence as unknown as Record<string, unknown>;
  return '{' + keys.map(
    (key) => JSON.stringify(key) + ':' + JSON.stringify(record[key]),
  ).join(',') + '}';
}

export async function computeSubmissionEvidenceHash(
  input: SubmissionEvidenceInput,
): Promise<string> {
  return sha256Canonical(buildSubmissionEvidenceV2(input));
}

// The reason hash is a separate decision attestation. Solana supplies the
// founder signature and rejected_at; client time is deliberately excluded.
export const REJECT_REASON_SCHEMA_VERSION = 'buildshare-reject-reason-v1';

export interface RejectReasonInput {
  projectId: string;
  taskId: string;
  contributionId: string;
  attempt: number;
  reason: string;
  rejectedByWallet: string;
}

export interface RejectReasonV1 extends RejectReasonInput {
  schemaVersion: typeof REJECT_REASON_SCHEMA_VERSION;
}

export function buildRejectReasonV1(input: RejectReasonInput): RejectReasonV1 {
  return {
    schemaVersion: REJECT_REASON_SCHEMA_VERSION,
    projectId: input.projectId,
    taskId: input.taskId,
    contributionId: input.contributionId,
    attempt: input.attempt,
    reason: input.reason.trim(),
    rejectedByWallet: input.rejectedByWallet,
  };
}

export async function computeRejectReasonHash(
  input: RejectReasonInput,
): Promise<string> {
  return sha256Canonical(buildRejectReasonV1(input));
}

// The AI evaluation is hashed separately; only its hash enters the evidence.
// The raw model output never goes on-chain.
export async function computeAIEvaluationHash(evaluation: {
  model: string;
  promptVersion: string;
  overallScore: number;
  recommendation: string;
  rawResponse: string;
}): Promise<string> {
  return sha256Canonical({
    model: evaluation.model,
    promptVersion: evaluation.promptVersion,
    overallScore: evaluation.overallScore,
    recommendation: evaluation.recommendation,
    rawResponse: evaluation.rawResponse,
  });
}

export { shortHash };
