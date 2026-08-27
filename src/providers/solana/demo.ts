import type { SolanaProvider, SolanaAllocationResult, SolanaProjectAccount } from './types';
import { explorerTxUrl } from './types';

// DemoSolanaProvider — simulates on-chain allocation.
// NEVER claims a real blockchain transaction occurred. Returns demo signatures
// clearly marked as simulated.
export class DemoSolanaProvider implements SolanaProvider {
  readonly name = 'DemoSolanaProvider';
  readonly isDemo = true;
  readonly network = 'devnet';

  async initializeProject(params: {
    founderWallet: string;
    projectId: string;
    founderBps: number;
    devPoolBps: number;
  }): Promise<SolanaAllocationResult> {
    await delay(800);
    const pda = deriveDemoPda(['project', params.founderWallet, params.projectId]);
    return {
      signature: null,
      pda,
      explorerUrl: null,
      demo: true,
    };
  }

  async allocateOwnership(params: {
    contributorWallet: string;
    projectId: string;
    taskId: string;
    rewardBps: number;
    evidenceHash: string;
  }): Promise<SolanaAllocationResult> {
    await delay(1000);
    const pda = deriveDemoPda(['contribution', params.projectId, params.taskId, params.contributorWallet]);
    // Demo signature — clearly not a real on-chain transaction.
    const signature = `demo_${randomHash(64)}`;
    return {
      signature,
      pda,
      explorerUrl: null, // Do NOT fabricate explorer links for demo signatures.
      demo: true,
    };
  }

  async getProjectAccount(_projectId: string): Promise<SolanaProjectAccount | null> {
    return null;
  }
}

function deriveDemoPda(seeds: string[]): string {
  return `DemoPDA_${hashSeeds(seeds).slice(0, 32)}`;
}

function hashSeeds(seeds: string[]): string {
  let h = 0;
  const s = seeds.join('|');
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  const hex = Math.abs(h).toString(16);
  // Pad to 44 chars for PDA-like appearance
  return (hex + '0'.repeat(44)).slice(0, 44);
}

function randomHash(len: number): string {
  const chars = '0123456789abcdef';
  let out = '';
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * 16)];
  return out;
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// Suppress unused import warning in some bundlers
void explorerTxUrl;
