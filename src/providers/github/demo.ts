import type { GitHubProvider, GitHubRepo, GitHubPR } from './types';

// DemoGitHubProvider — returns simulated GitHub data. No credentials required.
export class DemoGitHubProvider implements GitHubProvider {
  readonly name = 'DemoGitHubProvider';

  async getInstallationRepositories(): Promise<GitHubRepo[]> {
    await delay(500);
    return [
      {
        id: 'demo-repo-1',
        owner: 'buildshare-demo',
        name: 'ai-arbitration-escrow',
        fullName: 'buildshare-demo/ai-arbitration-escrow',
        private: false,
        defaultBranch: 'main',
      },
      {
        id: 'demo-repo-2',
        owner: 'buildshare-demo',
        name: 'solana-escrow-contract',
        fullName: 'buildshare-demo/solana-escrow-contract',
        private: false,
        defaultBranch: 'main',
      },
    ];
  }

  async getPullRequest(_owner: string, _repo: string, prNumber: number): Promise<GitHubPR | null> {
    await delay(600);
    return {
      id: `demo-pr-${prNumber}`,
      number: prNumber,
      title: `[BUILD-001] Implement Solana Escrow`,
      body: 'Implements the escrow program with init, deposit, and release instructions.',
      state: 'closed',
      merged: true,
      mergedAt: new Date(Date.now() - 86400000).toISOString(),
      headBranch: 'feature/escrow',
      baseBranch: 'main',
      additions: 342,
      deletions: 12,
      changedFiles: 5,
      authorGithubId: 'demo-alice',
      url: 'https://github.com/buildshare-demo/ai-arbitration-escrow/pull/17',
    };
  }

  async validateWebhookSignature(_payload: string, _signature: string): Promise<boolean> {
    // In demo mode we accept all; real provider validates HMAC-SHA256.
    return true;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
