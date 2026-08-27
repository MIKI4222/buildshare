// GitHub Provider abstraction.

export interface GitHubRepo {
  id: string;
  owner: string;
  name: string;
  fullName: string;
  private: boolean;
  defaultBranch: string;
}

export interface GitHubPR {
  id: string;
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed';
  merged: boolean;
  mergedAt: string | null;
  headBranch: string;
  baseBranch: string;
  additions: number;
  deletions: number;
  changedFiles: number;
  authorGithubId: string;
  url: string;
}

export interface GitHubProvider {
  readonly name: string;
  getInstallationRepositories(): Promise<GitHubRepo[]>;
  getPullRequest(owner: string, repo: string, prNumber: number): Promise<GitHubPR | null>;
  validateWebhookSignature(payload: string, signature: string): Promise<boolean>;
}

// Parse task references from PR titles.
// Recognizes: [BUILD-001], BUILD-001, #BUILD-001
export function parseTaskReference(title: string): string | null {
  const patterns = [
    /\[([A-Z]+-\d+)\]/,
    /(?:^|\s)([A-Z]+-\d+)(?=\s|$|:)/,
    /#([A-Z]+-\d+)/,
  ];
  for (const p of patterns) {
    const m = title.match(p);
    if (m) return m[1];
  }
  return null;
}
