// Solana Provider abstraction.
// LiveSolanaProvider wraps @solana/web3.js + Anchor. DemoSolanaProvider simulates.

export interface SolanaProjectAccount {
  authority: string;
  projectId: string;
  ownershipTotal: number;
  ownershipAllocated: number;
  memberCount: number;
  taskCount: number;
}

export interface SolanaAllocationResult {
  signature: string | null;
  pda: string;
  explorerUrl: string | null;
  demo: boolean;
}

export interface SolanaProvider {
  readonly name: string;
  readonly isDemo: boolean;
  readonly network: string;
  initializeProject(params: {
    founderWallet: string;
    projectId: string;
    founderBps: number;
    devPoolBps: number;
  }): Promise<SolanaAllocationResult>;
  allocateOwnership(params: {
    contributorWallet: string;
    projectId: string;
    taskId: string;
    rewardBps: number;
    evidenceHash: string;
  }): Promise<SolanaAllocationResult>;
  getProjectAccount(projectId: string): Promise<SolanaProjectAccount | null>;
}

export const SOLANA_EXPLORER_BASE = 'https://explorer.solana.com';

export function explorerTxUrl(signature: string, network: string): string {
  const cluster = network === 'mainnet-beta' ? '' : `?cluster=${network}`;
  return `${SOLANA_EXPLORER_BASE}/tx/${signature}${cluster}`;
}

export function explorerAddrUrl(address: string, network: string): string {
  const cluster = network === 'mainnet-beta' ? '' : `?cluster=${network}`;
  return `${SOLANA_EXPLORER_BASE}/address/${address}${cluster}`;
}
