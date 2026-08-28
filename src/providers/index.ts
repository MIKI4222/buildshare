// Provider registry and mode switching.
//
// P0 rules:
//  - Demo and Live are separate objects; switching mode really rebuilds them.
//  - Live mode NEVER silently falls back to the demo provider. If live mode is
//    not configured, getProviders('live') throws LIVE_MODE_UNAVAILABLE and the
//    UI must show the error.

import type { AppMode } from '../domain/types';
import { DemoAIProvider } from './ai/demo';
import type { AIProvider } from './ai/types';
import { DemoGitHubProvider } from './github/demo';
import type { GitHubProvider } from './github/types';
import { DemoSolanaProvider } from './solana/demo';
import { LiveSolanaProvider, readLiveConfig } from './solana/live';
import type { SolanaProvider } from './solana/types';

export interface Providers {
  mode: AppMode;
  solana: SolanaProvider;
  github: GitHubProvider;
  ai: AIProvider;
}

export interface LiveAvailability {
  available: boolean;
  reason: string | null;
  network: string | null;
  programId: string | null;
}

export function liveAvailability(): LiveAvailability {
  const result = readLiveConfig();
  if (!result.ok || !result.config) {
    return { available: false, reason: result.reason, network: null, programId: null };
  }
  return {
    available: true,
    reason: null,
    network: result.config.network,
    programId: result.config.programId,
  };
}

function buildProviders(mode: AppMode): Providers {
  if (mode === 'live') {
    // Throws if PROGRAM_ID is missing / malformed / the System Program.
    const solana = LiveSolanaProvider.fromEnv();
    return {
      mode,
      solana,
      github: new DemoGitHubProvider(),
      ai: new DemoAIProvider(),
    };
  }
  return {
    mode,
    solana: new DemoSolanaProvider(),
    github: new DemoGitHubProvider(),
    ai: new DemoAIProvider(),
  };
}

const cache = new Map<AppMode, Providers>();

export function getProviders(mode: AppMode): Providers {
  const cached = cache.get(mode);
  if (cached) return cached;
  const providers = buildProviders(mode);
  cache.set(mode, providers);
  return providers;
}

export function resetProviderCache(): void {
  cache.clear();
}

// Kept for backwards compatibility with existing call sites.
export function createProviders(mode: AppMode): Providers {
  return getProviders(mode);
}

// Explorer helpers re-exported for UI call sites. explorerTxUrl throws for any
// value that is not a real base58 transaction signature.
export { explorerTxUrl, explorerAddressUrl, isRealSignature } from './solana/types';
export { explorerAddressUrl as explorerAddrUrl } from './solana/types';
