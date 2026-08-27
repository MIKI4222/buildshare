// Evidence hash generation — deterministic SHA-256 of canonical evidence JSON.
// This hash is intended to be stored on-chain. Never stores private tokens or
// large diffs on-chain.

export interface ContributionEvidence {
  project: string;
  task: string;
  pullRequest: string;
  commit: string;
  repository: string;
  changedFiles: number;
  additions: number;
  deletions: number;
  tests: number;
}

export function canonicalEvidenceJSON(evidence: ContributionEvidence): string {
  // Keys in deterministic sorted order.
  const keys = Object.keys(evidence).sort() as (keyof ContributionEvidence)[];
  const pairs = keys.map((k) => `${JSON.stringify(k)}:${JSON.stringify(evidence[k])}`);
  return `{${pairs.join(',')}}`;
}

export async function computeEvidenceHash(evidence: ContributionEvidence): Promise<string> {
  const data = new TextEncoder().encode(canonicalEvidenceJSON(evidence));
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function shortHash(hash: string, prefix = 8, suffix = 6): string {
  if (hash.length <= prefix + suffix) return hash;
  return `${hash.slice(0, prefix)}...${hash.slice(-suffix)}`;
}
