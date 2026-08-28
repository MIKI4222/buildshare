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

  async deriveProjectPda(projectId: string, founderWallet: string): Promise<string> {
    return demoPda(['project', founderWallet, projectId]);
  }
}
