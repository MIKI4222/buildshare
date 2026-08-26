import {
  Connection,
  PublicKey,
  clusterApiUrl,
  type Cluster,
} from '@solana/web3.js';
import type { SolanaProvider, SolanaAllocationResult, SolanaProjectAccount } from './types';
import { explorerTxUrl } from './types';

// LiveSolanaProvider — real Solana Devnet integration scaffold.
//
// This provider prepares real transactions using @solana/web3.js. The Anchor
// program (programs/buildshare/) defines the actual instructions; this provider
// would compose and send them once the program is deployed and the IDL is wired.
//
// In v0.1 we connect to Devnet and derive PDAs for real, but allocation requires
// the deployed program. The connection and PDA derivation are live; transaction
// submission is a documented next step.
export class LiveSolanaProvider implements SolanaProvider {
  readonly name = 'LiveSolanaProvider';
  readonly isDemo = false;
  readonly network: string;
  private connection: Connection;

  constructor(network: string = 'devnet') {
    this.network = network;
    const cluster = network as Cluster;
    const rpcUrl =
      import.meta.env.VITE_SOLANA_RPC_URL ||
      clusterApiUrl(cluster === 'mainnet-beta' ? 'mainnet-beta' : 'devnet');
    this.connection = new Connection(rpcUrl, 'confirmed');
  }

  getConnection(): Connection {
    return this.connection;
  }

  // Derive the Project PDA: seeds = ["project", founder, projectId].
  deriveProjectPda(founderWallet: string, projectId: string): PublicKey {
    const seeds = [
      Buffer.from('project'),
      new PublicKey(founderWallet).toBuffer(),
      Buffer.from(projectId),
    ];
    // Program ID would come from VITE_PROGRAM_ID / Anchor IDL.
    const programId = this.getProgramId();
    const [pda] = PublicKey.findProgramAddressSync(seeds, programId);
    return pda;
  }

  deriveTaskPda(projectPda: PublicKey, taskId: string): PublicKey {
    const seeds = [
      Buffer.from('task'),
      projectPda.toBuffer(),
      Buffer.from(taskId),
    ];
    const [pda] = PublicKey.findProgramAddressSync(seeds, this.getProgramId());
    return pda;
  }

  deriveMemberPda(projectPda: PublicKey, wallet: string): PublicKey {
    const seeds = [
      Buffer.from('member'),
      projectPda.toBuffer(),
      new PublicKey(wallet).toBuffer(),
    ];
    const [pda] = PublicKey.findProgramAddressSync(seeds, this.getProgramId());
    return pda;
  }

  deriveContributionPda(taskPda: PublicKey, contributor: string): PublicKey {
    const seeds = [
      Buffer.from('contribution'),
      taskPda.toBuffer(),
      new PublicKey(contributor).toBuffer(),
    ];
    const [pda] = PublicKey.findProgramAddressSync(seeds, this.getProgramId());
    return pda;
  }

  getProgramId(): PublicKey {
    const id = import.meta.env.VITE_PROGRAM_ID;
    if (!id) {
      // Default placeholder — replace with deployed program ID.
      return new PublicKey('11111111111111111111111111111111');
    }
    return new PublicKey(id);
  }

  async initializeProject(params: {
    founderWallet: string;
    projectId: string;
    founderBps: number;
    devPoolBps: number;
  }): Promise<SolanaAllocationResult> {
    const pda = this.deriveProjectPda(params.founderWallet, params.projectId);
    // Real implementation: compose initialize_project instruction via Anchor,
    // send with the founder's signed transaction. Returns the real signature.
    // This is the integration point — see docs/solana.md.
    return {
      signature: null,
      pda: pda.toBase58(),
      explorerUrl: null,
      demo: false,
    };
  }

  async allocateOwnership(params: {
    contributorWallet: string;
    projectId: string;
    taskId: string;
    rewardBps: number;
    evidenceHash: string;
  }): Promise<SolanaAllocationResult> {
    // Real implementation: compose allocate_ownership instruction, send with
    // the project authority's signed transaction, return the real signature.
    // See docs/solana.md for the instruction layout.
    const projectPda = this.deriveProjectPda(params.contributorWallet, params.projectId);
    const taskPda = this.deriveTaskPda(projectPda, params.taskId);
    const pda = this.deriveContributionPda(taskPda, params.contributorWallet);
    return {
      signature: null, // Requires deployed program + signed transaction.
      pda: pda.toBase58(),
      explorerUrl: null,
      demo: false,
    };
  }

  async getProjectAccount(_projectId: string): Promise<SolanaProjectAccount | null> {
    // Real implementation: fetch and deserialize the Project account via Borsh.
    return null;
  }
}

export { explorerTxUrl };
