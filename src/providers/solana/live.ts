// Live Solana provider.
//
// Rules encoded here:
//  - It refuses to exist without a valid PROGRAM_ID (no System Program).
//  - It never falls back to the demo provider.
//  - It NEVER invents a signature. Until the Anchor program of P1 is deployed,
//    allocateOwnership throws NOT_IMPLEMENTED. A missing feature is reported as
//    a missing feature, not simulated.

import { domainError } from '../../domain/errors';
import type {
  AllocateOwnershipInput,
  SolanaNetwork,
  SolanaProvider,
  SolanaResult,
} from './types';
import {
  assertProgramId,
  explorerAddressUrl,
  explorerTxUrl,
  isRealSignature,
  validateProgramId,
} from './types';
import { projectSeeds } from '../../lib/solana/pda';
import { decodeProjectAccount, type OnchainProjectAccount } from '../../lib/solana/decode';

export const DEFAULT_RPC: Record<SolanaNetwork, string> = {
  devnet: 'https://api.devnet.solana.com',
  'mainnet-beta': 'https://api.mainnet-beta.solana.com',
};

export interface LiveSolanaConfig {
  network: SolanaNetwork;
  rpcUrl: string;
  programId: string;
}

// Reads Vite env in the browser and process.env in tests / node. Only public
// VITE_ variables are ever read on the frontend: no secrets.
export function env(key: string): string | undefined {
  try {
    const meta = import.meta as unknown as { env?: Record<string, string | undefined> };
    if (meta && meta.env && meta.env[key] !== undefined) return meta.env[key];
  } catch {
    // import.meta is unavailable in some runtimes; fall through.
  }
  const g = globalThis as unknown as { process?: { env?: Record<string, string | undefined> } };
  const penv = g.process ? g.process.env : undefined;
  if (penv && penv[key] !== undefined) return penv[key];
  return undefined;
}

export interface LiveConfigResult {
  ok: boolean;
  reason: string | null;
  config: LiveSolanaConfig | null;
}

export function readLiveConfig(): LiveConfigResult {
  const rawNetwork = (env('VITE_SOLANA_NETWORK') || 'devnet').trim();
  const network: SolanaNetwork = rawNetwork === 'mainnet-beta' ? 'mainnet-beta' : 'devnet';
  const programId = (env('VITE_PROGRAM_ID') || '').trim();
  const check = validateProgramId(programId);
  if (!check.ok) {
    return { ok: false, reason: check.reason, config: null };
  }
  return {
    ok: true,
    reason: null,
    config: {
      network,
      rpcUrl: (env('VITE_SOLANA_RPC_URL') || DEFAULT_RPC[network]).trim(),
      programId,
    },
  };
}

export interface OnchainProjectState extends OnchainProjectAccount {
  pda: string;
  network: SolanaNetwork;
  programId: string;
  explorerUrl: string;
  fetchedAt: string;
}

export class LiveSolanaProvider implements SolanaProvider {
  readonly mode = 'live' as const;
  readonly network: SolanaNetwork;
  readonly rpcUrl: string;
  readonly programId: string;

  constructor(config: LiveSolanaConfig) {
    if (!config) {
      throw domainError(
        'LIVE_MODE_UNAVAILABLE',
        'Live mode requires an explicit configuration.',
        {},
      );
    }
    // Throws LIVE_MODE_UNAVAILABLE for a missing, malformed or System Program id.
    this.programId = assertProgramId(config.programId);
    this.network = config.network;
    this.rpcUrl = config.rpcUrl || DEFAULT_RPC[config.network];
  }

  static fromEnv(): LiveSolanaProvider {
    const result = readLiveConfig();
    if (!result.ok || !result.config) {
      throw domainError(
        'LIVE_MODE_UNAVAILABLE',
        result.reason || 'Live mode is not configured.',
        {},
      );
    }
    return new LiveSolanaProvider(result.config);
  }

  // Loaded lazily so that the demo path never needs @solana/web3.js.
  private async web3(): Promise<unknown> {
    return import('@solana/web3.js');
  }

  async deriveProjectPda(onchainProjectId: number, founderWallet: string): Promise<string> {
    const web3 = (await this.web3()) as {
      PublicKey: new (value: string) => unknown;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      [key: string]: any;
    };
    const PublicKey = web3.PublicKey as unknown as {
      new (value: string): { toBuffer(): Uint8Array; toBase58(): string };
      findProgramAddressSync(
        seeds: Uint8Array[],
        programId: unknown,
      ): [{ toBase58(): string }, number];
    };
    const founder = new PublicKey(founderWallet);
    const program = new PublicKey(this.programId);
    // Frozen seed tuple: b"project" + founder + u64 little-endian project id,
    // 7 + 32 + 8 = 47 bytes (DESIGN FREEZE v1.2 §0.2, §8). Never UTF-8 text.
    const [pda] = PublicKey.findProgramAddressSync(
      projectSeeds(founder.toBuffer(), onchainProjectId),
      program,
    );
    return pda.toBase58();
  }

  async allocateOwnership(input: AllocateOwnershipInput): Promise<SolanaResult> {
    // P1 will replace this with a real approve_and_allocate instruction.
    // Until the program is deployed there is no honest way to produce a
    // signature, so we fail loudly instead of faking one.
    throw domainError(
      'NOT_IMPLEMENTED',
      'Live on-chain allocation requires the BuildShare Anchor program (P1). ' +
        'No transaction was sent and no signature was produced.',
      {
        contributionId: input.contributionId,
        programId: this.programId,
        network: this.network,
      },
    );
  }

  // READ-ONLY. Fetches a Project account straight from the RPC and decodes the
  // frozen layout. It sends nothing and signs nothing, so it is available even
  // though allocateOwnership is not. Returns null when the account does not
  // exist yet; throws when the account exists but is not ours.
  async fetchProjectState(projectPda: string): Promise<OnchainProjectState | null> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const web3 = (await this.web3()) as any;
    const connection = new web3.Connection(this.rpcUrl, 'confirmed');
    const info = await connection.getAccountInfo(new web3.PublicKey(projectPda));
    if (!info) return null;
    const owner = info.owner.toBase58();
    if (owner !== this.programId) {
      throw new Error(
        'Account ' + projectPda + ' is owned by ' + owner +
          ', not by the BuildShare program ' + this.programId + '.',
      );
    }
    const account = decodeProjectAccount(new Uint8Array(info.data));
    return {
      ...account,
      pda: projectPda,
      network: this.network,
      programId: this.programId,
      explorerUrl: explorerAddressUrl(projectPda, this.network),
      fetchedAt: new Date().toISOString(),
    };
  }

  // Used once P1 lands: turn a confirmed signature into a settlement.
  buildOnchainResult(pda: string, signature: string): SolanaResult {
    if (!isRealSignature(signature)) {
      throw domainError('FAKE_SIGNATURE', 'Refusing a value that is not a real signature.', {
        signature,
      });
    }
    return {
      kind: 'onchain',
      pda,
      network: this.network,
      signature,
      explorerUrl: explorerTxUrl(signature, this.network),
    };
  }
}
