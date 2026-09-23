// Hash of the repository reference stored on chain by create_task and
// update_task (repo_ref_hash, [u8; 32]).
//
// This is deliberately NOT part of commitment.ts. The commitment answers "what
// did the contributor agree to deliver?" and is built at CLAIM time. This hash
// is written at task CREATION time, when no commitment exists yet, and the
// claim commitment already carries repositoryFullName and baseBranch as plain
// text. The two never validate each other and must not be confused.
//
// The on-chain program stores this value without interpreting it and never
// requires it to be non-zero. The only thing that matters is that every writer
// computes it the same way, forever. Hence the schema version.

import { sha256Text } from './hash';

export const REPO_REF_SCHEMA_VERSION = 'buildshare-repo-ref-v1';

// GitHub treats owner/repo case-insensitively, so two spellings of the same
// repository must not produce two different hashes.
export function normalizeRepoFullName(name: string): string {
  return name.trim().toLowerCase();
}

// Git refs ARE case-sensitive: main and Main are different branches.
export function normalizeBaseBranch(branch: string): string {
  return branch.trim();
}

export async function hashRepoRef(
  repositoryFullName: string,
  baseBranch: string,
): Promise<string> {
  const repo = normalizeRepoFullName(repositoryFullName);
  const branch = normalizeBaseBranch(baseBranch);
  if (repo.length === 0) {
    throw new Error('repositoryFullName is empty. Refusing to hash an empty repository reference.');
  }
  if (branch.length === 0) {
    throw new Error('baseBranch is empty. Refusing to hash an empty repository reference.');
  }
  return sha256Text(REPO_REF_SCHEMA_VERSION + '\n' + repo + '\n' + branch);
}
