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
