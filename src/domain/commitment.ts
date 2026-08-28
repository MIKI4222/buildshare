// The immutable commitment created when a task is CLAIMED.
//
// commitmentHash answers: "what exactly did the contributor agree to deliver?"
// It is computed at CLAIM time and never recomputed. evidenceHash (evidence.ts)
// answers: "what was actually delivered and approved?" and is computed at
// approval time. Two hashes, two different questions.

import { sha256Canonical, sha256Text } from './hash';

export const COMMITMENT_SCHEMA_VERSION = 'buildshare-commitment-v1';
export const DEFAULT_CLAIM_WINDOW_DAYS = 7;

export interface CommitmentInput {
  projectId: string;
  taskId: string;
  taskExternalKey: string;
  acceptanceCriteria: string;
  rewardBps: number;
  repositoryFullName: string;
  baseBranch: string;
  contributorWallet: string;
  attempt: number;
}

export interface CommitmentHashes {
  acceptanceCriteriaHash: string;
  commitmentHash: string;
}

// Whitespace-insensitive but content-sensitive normalization, so that a purely
// cosmetic reformat does not change the hash while any wording change does.
export function normalizeAcceptanceCriteria(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim().replace(/[ \t]+/g, ' '))
    .filter((line) => line.length > 0)
    .join('\n');
}

export async function hashAcceptanceCriteria(text: string): Promise<string> {
  return sha256Text(COMMITMENT_SCHEMA_VERSION + '\n' + normalizeAcceptanceCriteria(text));
}

export async function computeCommitmentHashes(
  input: CommitmentInput,
): Promise<CommitmentHashes> {
  const acceptanceCriteriaHash = await hashAcceptanceCriteria(input.acceptanceCriteria);
  const commitmentHash = await sha256Canonical({
    schemaVersion: COMMITMENT_SCHEMA_VERSION,
    projectId: input.projectId,
    taskId: input.taskId,
    taskExternalKey: input.taskExternalKey,
    acceptanceCriteriaHash,
    rewardBps: input.rewardBps,
    repositoryFullName: input.repositoryFullName,
    baseBranch: input.baseBranch,
    contributorWallet: input.contributorWallet,
    attempt: input.attempt,
  });
  return { acceptanceCriteriaHash, commitmentHash };
}

export function claimExpiryFrom(
  claimedAtIso: string,
  days: number = DEFAULT_CLAIM_WINDOW_DAYS,
): string {
  const ms = Date.parse(claimedAtIso);
  if (Number.isNaN(ms)) throw new Error('Invalid claimedAt: ' + claimedAtIso);
  return new Date(ms + days * 24 * 60 * 60 * 1000).toISOString();
}

export function isClaimExpired(
  commitment: { claimExpiresAt: string } | null,
  nowIso: string,
): boolean {
  if (!commitment) return false;
  return Date.parse(nowIso) > Date.parse(commitment.claimExpiresAt);
}
