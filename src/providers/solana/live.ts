// Live Solana provider.
//
// Rules encoded here:
//  - It refuses to exist without a valid PROGRAM_ID (no System Program).
//  - It never falls back to the demo provider.
//  - It NEVER invents a signature. A signature exists only when a wallet
//    signed a real transaction and the RPC confirmed it. With no wallet the
//    provider refuses with LIVE_MODE_UNAVAILABLE and sends nothing.

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
import {
  contributionSeeds,
  memberSeeds,
  projectSeeds,
  taskSeeds,
} from '../../lib/solana/pda';
import { decodeProjectAccount, type OnchainProjectAccount } from '../../lib/solana/decode';

export const DEFAULT_RPC: Record<SolanaNetwork, string> = {
  devnet: 'https://api.devnet.solana.com',
  'mainnet-beta': 'https://api.mainnet-beta.solana.com',
};

// Anchor derives an instruction discriminator as the first eight bytes of
// sha256 of 'global:<instruction name>'. The bytes are pinned here so that a
// rename cannot change the wire format silently, and
// tests/discriminator.test.ts proves these really are that hash.
export const ALLOCATE_OWNERSHIP_DISCRIMINATOR: number[] = [
  152, 131, 229, 179, 134, 177, 241, 221,
];
export const CREATE_MEMBER_DISCRIMINATOR: number[] = [49, 46, 45, 241, 122, 143, 136, 73];

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

  // True when an account already exists at this address on the configured
  // cluster. protected so that tests can prove the guard without a network
  // round trip; production always goes through the RPC.
  async deriveTaskPda(projectPda: string, onchainTaskId: number): Promise<string> {
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
    const project = new PublicKey(projectPda);
    const program = new PublicKey(this.programId);
    // Frozen seed tuple: b"task" + Project PDA + u64 little-endian task id,
    // 4 + 32 + 8 = 44 bytes. Verified against create_task.rs (seeds on the
    // init constraint) and against the IDL pda seeds for create_task.
    const [pda] = PublicKey.findProgramAddressSync(
      taskSeeds(project.toBuffer(), onchainTaskId),
      program,
    );
    return pda.toBase58();
  }

  // Guard for create_task. An occupied Task PDA means the local database and
  // the chain disagree about which ids are used. That is reported, never
  // worked around: no candidate + 1, no scan for a free id, no transaction.
  async ensureTaskPdaAvailable(projectPda: string, onchainTaskId: number): Promise<void> {
    const pda = await this.deriveTaskPda(projectPda, onchainTaskId);
    const exists = await this.accountExists(pda);
    if (exists) {
      throw domainError(
        'INVARIANT_VIOLATION',
        'onchain task PDA already exists for this task ID: ' + pda +
          ' (onchainTaskId ' + String(onchainTaskId) + ', project ' + projectPda +
          '). Local state is out of sync with the chain; no other id is tried.',
        { pda, onchainTaskId, projectPda, network: this.network },
      );
    }
  }

  protected async accountExists(address: string): Promise<boolean> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const web3 = (await this.web3()) as any;
    const connection = new web3.Connection(this.rpcUrl, 'confirmed');
    const info = await connection.getAccountInfo(new web3.PublicKey(address));
    return info !== null;
  }

  // Guard for initialize_project. If the PDA is taken we refuse and stop:
  // no other id is tried, no transaction is built, the local counter is not
  // touched. Silently choosing a different id would invent a project the
  // user never asked for.
  async ensureProjectPdaAvailable(
    onchainProjectId: number,
    founderWallet: string,
  ): Promise<void> {
    const pda = await this.deriveProjectPda(onchainProjectId, founderWallet);
    const exists = await this.accountExists(pda);
    if (exists) {
      throw domainError(
        'INVARIANT_VIOLATION',
        'onchain project PDA already exists for this project ID: ' + pda +
          ' (onchainProjectId ' + String(onchainProjectId) + ', founder ' + founderWallet + ').',
        { pda, onchainProjectId, founderWallet, network: this.network },
      );
    }
  }

  // Sends a real allocate_ownership transaction signed by the founder wallet.
  //
  // Guarantees, in order of checking:
  //  - a task with no on-chain id is refused, never given an invented id;
  //  - outside a browser there is no wallet, so nothing is sent;
  //  - a wallet that is not the founder is refused BEFORE sending, because
  //    the program would reject it and the fee would be spent for nothing;
  //  - Member is created in the same transaction only when it is absent. The
  //    program has no init_if_needed there on purpose: re-initialising an
  //    existing Member would erase ownership.
  async allocateOwnership(input: AllocateOwnershipInput): Promise<SolanaResult> {
    if (input.onchainTaskId === null) {
      throw domainError(
        'TASK_NOT_FOUND',
        'This task does not exist on chain yet, so ownership cannot be allocated. Nothing was sent.',
        { contributionId: input.contributionId, taskId: input.taskId },
      );
    }
    if (typeof window === 'undefined') {
      throw domainError(
        'LIVE_MODE_UNAVAILABLE',
        'On-chain allocation needs a browser wallet. No transaction was sent and no signature was produced.',
        { contributionId: input.contributionId, network: this.network },
      );
    }
    const walletModule = await import('../../lib/solana/wallet');
    const injected = walletModule.getWalletProvider();
    if (!injected || typeof injected.signTransaction !== 'function') {
      throw domainError(
        'LIVE_MODE_UNAVAILABLE',
        'No Solana wallet able to sign transactions was found. Install Phantom or Solflare, then retry.',
        { contributionId: input.contributionId, network: this.network },
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const web3 = (await this.web3()) as any;
    const PublicKey = web3.PublicKey;
    const connected = injected.publicKey
      ? injected.publicKey
      : (await injected.connect()).publicKey;
    const founderKey = new PublicKey(connected.toString());

    if (founderKey.toBase58() !== input.founderWallet) {
      throw domainError(
        'NOT_AUTHORIZED',
        'Only the founder wallet recorded in the Project account can allocate ownership. Connected: ' +
          founderKey.toBase58() + '. Expected: ' + input.founderWallet + '.',
        { contributionId: input.contributionId },
      );
    }

    const program = new PublicKey(this.programId);
    const contributor = new PublicKey(input.contributorWallet);
    const [projectPda] = PublicKey.findProgramAddressSync(
      projectSeeds(founderKey.toBuffer(), input.onchainProjectId),
      program,
    );
    const [taskPda] = PublicKey.findProgramAddressSync(
      taskSeeds(projectPda.toBuffer(), input.onchainTaskId),
      program,
    );
    const [contributionPda] = PublicKey.findProgramAddressSync(
      contributionSeeds(taskPda.toBuffer(), contributor.toBuffer(), input.attempt),
      program,
    );
    const [memberPda] = PublicKey.findProgramAddressSync(
      memberSeeds(projectPda.toBuffer(), contributor.toBuffer()),
      program,
    );

    const connection = new web3.Connection(this.rpcUrl, 'confirmed');
    const tx = new web3.Transaction();

    const memberInfo = await connection.getAccountInfo(memberPda);
    if (memberInfo === null) {
      tx.add(
        new web3.TransactionInstruction({
          programId: program,
          keys: [
            { pubkey: founderKey, isSigner: true, isWritable: true },
            { pubkey: projectPda, isSigner: false, isWritable: true },
            { pubkey: contributor, isSigner: false, isWritable: false },
            { pubkey: memberPda, isSigner: false, isWritable: true },
            { pubkey: web3.SystemProgram.programId, isSigner: false, isWritable: false },
          ],
          data: new Uint8Array(CREATE_MEMBER_DISCRIMINATOR),
        }),
      );
    }

    // founder is isWritable here because it pays the fee. Anchor enforces mut
    // only where it declares it, so a writable signer is accepted.
    tx.add(
      new web3.TransactionInstruction({
        programId: program,
        keys: [
          { pubkey: founderKey, isSigner: true, isWritable: true },
          { pubkey: projectPda, isSigner: false, isWritable: true },
          { pubkey: taskPda, isSigner: false, isWritable: true },
          { pubkey: contributionPda, isSigner: false, isWritable: true },
          { pubkey: memberPda, isSigner: false, isWritable: true },
        ],
        data: new Uint8Array(ALLOCATE_OWNERSHIP_DISCRIMINATOR),
      }),
    );

    const latest = await connection.getLatestBlockhash('confirmed');
    tx.feePayer = founderKey;
    tx.recentBlockhash = latest.blockhash;

    try {
      const signed = await injected.signTransaction(tx);
      const signature = await connection.sendRawTransaction(signed.serialize(), {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      });
      await connection.confirmTransaction(
        {
          signature,
          blockhash: latest.blockhash,
          lastValidBlockHeight: latest.lastValidBlockHeight,
        },
        'confirmed',
      );
      // buildOnchainResult refuses anything that is not a real base58 signature.
      return this.buildOnchainResult(contributionPda.toBase58(), signature);
    } catch (e: unknown) {
      const text = e instanceof Error ? e.message : String(e);
      // DoubleAllocation is error 6010 -> 0x176a in a program log.
      if (
        text.indexOf('DoubleAllocation') !== -1 ||
        text.indexOf('0x176a') !== -1 ||
        text.indexOf('0x176A') !== -1
      ) {
        throw domainError(
          'DOUBLE_ALLOCATION',
          'The program refused a second allocation for this contribution. Ownership was already settled on chain.',
          { contributionId: input.contributionId, contribution: contributionPda.toBase58() },
        );
      }
      throw e;
    }
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
