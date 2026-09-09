// Solana provider contract.
//
// The result is a discriminated union so that it is STRUCTURALLY impossible for
// a demo allocation to carry a transaction signature or an explorer URL.

import { domainError } from '../../domain/errors';

// Re-export ONLY (DESIGN FREEZE v1.2 §9). The implementation lives in
// src/lib/solana/pda.ts and remains the single source of truth for seed bytes.
export { u64le } from '../../lib/solana/pda';

export type SolanaNetwork = 'devnet' | 'mainnet-beta';

export const SOLANA_EXPLORER_BASE = 'https://explorer.solana.com';
export const DEMO_PDA_PREFIX = 'DEMO:';

// A base58 Solana address (32 bytes -> 32..44 chars).
export const BASE58_ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
// A base58 Solana transaction signature (64 bytes -> 86..88 chars).
export const REAL_SIGNATURE = /^[1-9A-HJ-NP-Za-km-z]{86,88}$/;

// The System Program can never be the BuildShare program.
export const FORBIDDEN_PROGRAM_IDS = ['11111111111111111111111111111111'];

export type SolanaResult =
  | { kind: 'demo'; pda: string; network: SolanaNetwork }
  | {
      kind: 'onchain';
      pda: string;
      network: SolanaNetwork;
      signature: string;
      explorerUrl: string;
    };

// Everything initialize_project needs. The ids are NOT computed here: they
// come from the local project record (founder-scoped counter, STOP-7).
export interface InitializeProjectInput {
  projectId: string;
  onchainProjectId: number;
  founderWallet: string;
  founderBps: number;
  devPoolBps: number;
}

export interface AllocateOwnershipInput {
  projectId: string;
  taskId: string;
  contributionId: string;
  contributorWallet: string;
  rewardBps: number;
  evidenceHash: string;
  attempt: number;
  // On-chain identifiers, needed only by the live provider to derive the
  // frozen PDAs. The demo provider ignores them. onchainTaskId is nullable
  // because a task exists locally before it exists on chain, and the live
  // provider must refuse rather than invent an id.
  onchainProjectId: number;
  onchainTaskId: number | null;
  founderWallet: string;
}

export interface CreateTaskOnchainInput {
  projectId: string;
  taskId: string;
  onchainProjectId: number;
  // Chosen by the caller before the call, never by the chain and never by the
  // provider. See STOP-8: an occupied PDA is a refusal, not a retry.
  onchainTaskId: number;
  founderWallet: string;
  rewardBps: number;
  // Hex, computed in the domain layer. The provider converts, never computes.
  acceptanceCriteriaHash: string;
  repoRefHash: string;
}

export interface SolanaProvider {
  readonly mode: 'demo' | 'live';
  readonly network: SolanaNetwork;
  allocateOwnership(input: AllocateOwnershipInput): Promise<SolanaResult>;
  deriveProjectPda(onchainProjectId: number, founderWallet: string): Promise<string>;
  // Guard that must run before initialize_project. It refuses when the
  // Project PDA is already taken and never tries another id. The demo
  // provider performs no chain access at all.
  ensureProjectPdaAvailable(onchainProjectId: number, founderWallet: string): Promise<void>;
  // Same guard for create_task. An occupied Task PDA is a refusal, never a
  // prompt to try another id.
  ensureTaskPdaAvailable(projectPda: string, onchainTaskId: number): Promise<void>;
  // Creates the Project account on chain. Only the live provider can do this;
  // the demo provider refuses instead of inventing a signature.
  initializeProject(input: InitializeProjectInput): Promise<SolanaResult>;
  // Creates the Task account on chain. Only the live provider can do this;
  // the demo provider refuses instead of inventing a signature.
  createTask(input: CreateTaskOnchainInput): Promise<SolanaResult>;
}

// A signature is real only if it looks like a real base58 signature AND does
// not contain any demo marker. Anything else is refused outright.
export function isRealSignature(signature: unknown): boolean {
  if (typeof signature !== 'string') return false;
  const lower = signature.toLowerCase();
  if (
    lower.indexOf('demo') !== -1 ||
    lower.indexOf('fake') !== -1 ||
    lower.indexOf('mock') !== -1 ||
    lower.indexOf('test') !== -1
  ) {
    return false;
  }
  return REAL_SIGNATURE.test(signature);
}

export function isValidAddress(address: unknown): boolean {
  return typeof address === 'string' && BASE58_ADDRESS.test(address);
}

// Never builds a URL for anything that is not a real signature.
export function explorerTxUrl(signature: string, network: SolanaNetwork): string {
  if (!isRealSignature(signature)) {
    throw domainError(
      'FAKE_SIGNATURE',
      'Refusing to build an explorer URL for a value that is not a real transaction signature.',
      { signature },
    );
  }
  const cluster = network === 'mainnet-beta' ? '' : '?cluster=' + network;
  return SOLANA_EXPLORER_BASE + '/tx/' + signature + cluster;
}

export function explorerAddressUrl(address: string, network: SolanaNetwork): string {
  const cluster = network === 'mainnet-beta' ? '' : '?cluster=' + network;
  return SOLANA_EXPLORER_BASE + '/address/' + address + cluster;
}

export interface ProgramIdCheck {
  ok: boolean;
  reason: string | null;
}

export function validateProgramId(programId: unknown): ProgramIdCheck {
  if (typeof programId !== 'string' || programId.trim().length === 0) {
    return { ok: false, reason: 'PROGRAM_ID is not configured.' };
  }
  const value = programId.trim();
  if (!BASE58_ADDRESS.test(value)) {
    return { ok: false, reason: 'PROGRAM_ID is not a valid base58 Solana address.' };
  }
  if (FORBIDDEN_PROGRAM_IDS.indexOf(value) !== -1) {
    return {
      ok: false,
      reason: 'PROGRAM_ID must not be the System Program (' + value + ').',
    };
  }
  return { ok: true, reason: null };
}

export function assertProgramId(programId: unknown): string {
  const check = validateProgramId(programId);
  if (!check.ok) {
    throw domainError('LIVE_MODE_UNAVAILABLE', check.reason || 'Invalid PROGRAM_ID.', {
      programId: typeof programId === 'string' ? programId : null,
    });
  }
  return (programId as string).trim();
}
