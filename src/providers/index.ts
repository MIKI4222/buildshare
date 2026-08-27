import { DemoAIProvider } from './ai/demo';
import { DemoGitHubProvider } from './github/demo';
import { DemoSolanaProvider } from './solana/demo';
import { LiveSolanaProvider } from './solana/live';
import type { AIProvider } from './ai/types';
import type { GitHubProvider } from './github/types';
import type { SolanaProvider } from './solana/types';

export interface Providers {
  ai: AIProvider;
  github: GitHubProvider;
  solana: SolanaProvider;
}

export function createProviders(mode: 'demo' | 'live'): Providers {
  if (mode === 'live') {
    return {
      ai: new DemoAIProvider(), // Swap for LiveAIProvider when AI_API_KEY is set
      github: new DemoGitHubProvider(), // Swap for LiveGitHubProvider when GitHub creds are set
      solana: new LiveSolanaProvider(import.meta.env.VITE_SOLANA_NETWORK || 'devnet'),
    };
  }
  return {
    ai: new DemoAIProvider(),
    github: new DemoGitHubProvider(),
    solana: new DemoSolanaProvider(),
  };
}

export { DemoAIProvider, DemoGitHubProvider, DemoSolanaProvider, LiveSolanaProvider };
export type { AIProvider, ContributionVerification, ContributionVerificationInput } from './ai/types';
export type { GitHubProvider, GitHubRepo, GitHubPR } from './github/types';
export type { SolanaProvider, SolanaAllocationResult, SolanaProjectAccount } from './solana/types';
export { parseTaskReference } from './github/types';
export { calculateOverallScore, scoreToRecommendation, SCORE_WEIGHTS } from './ai/types';
export { explorerTxUrl, explorerAddrUrl } from './solana/types';
