// Demo Solana provider.
//
// It performs NO network calls and returns a result whose type (kind: 'demo')
// has no signature and no explorerUrl field at all. There is therefore no code
// path in which a demo allocation can be presented as an on-chain transaction.

import type {
  AllocateOwnershipInput,
  SolanaNetwork,
  SolanaProvider,
  SolanaResult,
} from './types';
import { DEMO_PDA_PREFIX } from './types';
import type { InitializeProjectInput } from './types';
import { domainError } from '../../domain/errors';
import { sha256Text } from '../../domain/hash';

function demoPda(parts: string[]): Promise<string> {
  return sha256Text(parts.join('|')).then((hash) => DEMO_PDA_PREFIX + hash.slice(0, 32));
}

export class DemoSolanaProvider implements SolanaProvider {
  readonly mode = 'demo' as const;
  readonly network: SolanaNetwork;

  constructor(network: SolanaNetwork = 'devnet') {
    this.network = network;
  }

  async allocateOwnership(input: AllocateOwnershipInput): Promise<SolanaResult> {
    const pda = await demoPda([
      'contribution',
      input.taskId,
      input.contributorWallet,
      String(input.attempt),
    ]);
    // No signature. No explorer URL. Deliberately.
    return { kind: 'demo', pda, network: this.network };
  }

  // Demo mode never touches a cluster, so there is nothing to check and
  // nothing to refuse. Returning quietly is honest here: no claim about the
  // chain is made either way.
  // Demo mode has no chain, so a project cannot be created on one. Refusing
  // is the only honest answer: a demo 'project pda' here would later be
  // recorded as if the chain had confirmed it.
  async initializeProject(input: InitializeProjectInput): Promise<never> {
    throw domainError(
      'LIVE_MODE_UNAVAILABLE',
      'Demo mode cannot create a project on chain. Switch to live mode and connect a wallet.',
      { projectId: input.projectId, network: this.network },
    );
  }

  async createTask(
    input: import('./types').CreateTaskOnchainInput,
  ): Promise<never> {
    throw domainError(
      'LIVE_MODE_UNAVAILABLE',
      'Demo mode cannot create a task on chain. Switch to live mode and connect a wallet.',
      { taskId: input.taskId, projectId: input.projectId },
    );
  }

  async claimTask(
    input: import('./types').ClaimTaskOnchainInput,
  ): Promise<never> {
    throw domainError(
      'LIVE_MODE_UNAVAILABLE',
      'Demo mode cannot claim a task on chain. Switch to live mode and connect a wallet.',
      { taskId: input.taskId, projectId: input.projectId },
    );
  }

  async ensureProjectPdaAvailable(): Promise<void> {
    return;
  }

  async ensureTaskPdaAvailable(): Promise<void> {
    return;
  }

  async deriveProjectPda(onchainProjectId: number, founderWallet: string): Promise<string> {
    return demoPda(['project', founderWallet, String(onchainProjectId)]);
  }
}
