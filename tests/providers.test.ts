import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { DemoSolanaProvider } from '../src/providers/solana/demo';
import { LiveSolanaProvider, readLiveConfig } from '../src/providers/solana/live';
import {
  DEMO_PDA_PREFIX,
  explorerTxUrl,
  FORBIDDEN_PROGRAM_IDS,
  isRealSignature,
  validateProgramId,
} from '../src/providers/solana/types';
import { getProviders, liveAvailability, resetProviderCache } from '../src/providers';
import { DomainError } from '../src/domain/errors';
import { SYSTEM_PROGRAM_ID, TEST_PROGRAM_ID, VALID_SIGNATURE_SHAPE, WALLETS } from './helpers';

const allocationInput = {
  projectId: 'prj_1',
  taskId: 'tsk_1',
  contributionId: 'ctr_1',
  contributorWallet: WALLETS.alice,
  rewardBps: 1000,
  evidenceHash: 'a'.repeat(64),
  attempt: 1,
};

function withEnv(vars: Record<string, string | undefined>, fn: () => void) {
  const saved: Record<string, string | undefined> = {};
  for (const key of Object.keys(vars)) {
    saved[key] = process.env[key];
    if (vars[key] === undefined) delete process.env[key];
    else process.env[key] = vars[key] as string;
  }
  try {
    fn();
  } finally {
    for (const key of Object.keys(saved)) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key] as string;
    }
    resetProviderCache();
  }
}

describe('signature validation (P0.2, P0.6)', () => {
  it('accepts a real base58 signature shape', () => {
    assert.equal(isRealSignature(VALID_SIGNATURE_SHAPE), true);
  });

  it('rejects a demo prefixed signature', () => {
    assert.equal(isRealSignature('demo_' + VALID_SIGNATURE_SHAPE), false);
  });

  it('rejects anything containing the word fake or mock', () => {
    assert.equal(isRealSignature('fake' + '5'.repeat(84)), false);
    assert.equal(isRealSignature('mock' + '5'.repeat(84)), false);
  });

  it('rejects a too short string', () => {
    assert.equal(isRealSignature('5'.repeat(40)), false);
  });

  it('rejects non string values', () => {
    assert.equal(isRealSignature(undefined), false);
    assert.equal(isRealSignature(null), false);
    assert.equal(isRealSignature(12345), false);
  });

  it('rejects base58 confusables (0, O, I, l)', () => {
    assert.equal(isRealSignature('0'.repeat(88)), false);
    assert.equal(isRealSignature('l'.repeat(88)), false);
  });

  it('builds an explorer URL only for a real signature', () => {
    const url = explorerTxUrl(VALID_SIGNATURE_SHAPE, 'devnet');
    assert.equal(url, 'https://explorer.solana.com/tx/' + VALID_SIGNATURE_SHAPE + '?cluster=devnet');
  });

  it('refuses to build an explorer URL for a fake signature', () => {
    assert.throws(
      () => explorerTxUrl('demo_123', 'devnet'),
      (e: unknown) => e instanceof DomainError && e.code === 'FAKE_SIGNATURE',
    );
  });
});

describe('PROGRAM_ID validation (P0.9, P0.5)', () => {
  it('rejects an empty program id', () => {
    assert.equal(validateProgramId('').ok, false);
  });

  it('rejects undefined', () => {
    assert.equal(validateProgramId(undefined).ok, false);
  });

  it('rejects a malformed base58 address', () => {
    assert.equal(validateProgramId('not-an-address!').ok, false);
  });

  it('rejects the System Program', () => {
    const check = validateProgramId(SYSTEM_PROGRAM_ID);
    assert.equal(check.ok, false);
    assert.match(String(check.reason), /System Program/);
  });

  it('lists the System Program as forbidden', () => {
    assert.ok(FORBIDDEN_PROGRAM_IDS.indexOf(SYSTEM_PROGRAM_ID) !== -1);
  });

  it('accepts a well formed program id', () => {
    assert.equal(validateProgramId(TEST_PROGRAM_ID).ok, true);
  });
});

describe('demo provider (P0.3, P0.4)', () => {
  it('reports demo mode', () => {
    assert.equal(new DemoSolanaProvider().mode, 'demo');
  });

  it('returns a result of kind demo', async () => {
    const result = await new DemoSolanaProvider().allocateOwnership(allocationInput);
    assert.equal(result.kind, 'demo');
  });

  it('never returns a signature or explorer URL', async () => {
    const result = await new DemoSolanaProvider().allocateOwnership(allocationInput);
    assert.equal('signature' in result, false);
    assert.equal('explorerUrl' in result, false);
  });

  it('labels the demo PDA explicitly', async () => {
    const result = await new DemoSolanaProvider().allocateOwnership(allocationInput);
    assert.ok(result.pda.startsWith(DEMO_PDA_PREFIX));
  });

  it('derives a deterministic demo PDA per attempt', async () => {
    const provider = new DemoSolanaProvider();
    const first = await provider.allocateOwnership(allocationInput);
    const same = await provider.allocateOwnership(allocationInput);
    const other = await provider.allocateOwnership({ ...allocationInput, attempt: 2 });
    assert.equal(first.pda, same.pda);
    assert.notEqual(first.pda, other.pda);
  });
});

describe('live provider (P0.8, P0.9)', () => {
  it('refuses to construct without a program id', () => {
    assert.throws(
      () => new LiveSolanaProvider({ network: 'devnet', rpcUrl: '', programId: '' }),
      (e: unknown) => e instanceof DomainError && e.code === 'LIVE_MODE_UNAVAILABLE',
    );
  });

  it('refuses the System Program as its program id', () => {
    assert.throws(
      () => new LiveSolanaProvider({ network: 'devnet', rpcUrl: '', programId: SYSTEM_PROGRAM_ID }),
      (e: unknown) => e instanceof DomainError && e.code === 'LIVE_MODE_UNAVAILABLE',
    );
  });

  it('constructs with a valid program id and defaults the RPC url', () => {
    const provider = new LiveSolanaProvider({ network: 'devnet', rpcUrl: '', programId: TEST_PROGRAM_ID });
    assert.equal(provider.mode, 'live');
    assert.equal(provider.network, 'devnet');
    assert.equal(provider.rpcUrl, 'https://api.devnet.solana.com');
  });

  it('never invents a signature: allocation fails with NOT_IMPLEMENTED until P1', async () => {
    const provider = new LiveSolanaProvider({ network: 'devnet', rpcUrl: '', programId: TEST_PROGRAM_ID });
    await assert.rejects(
      () => provider.allocateOwnership(allocationInput),
      (e: unknown) => e instanceof DomainError && e.code === 'NOT_IMPLEMENTED',
    );
  });

  it('refuses to wrap a fake signature into an on-chain result', () => {
    const provider = new LiveSolanaProvider({ network: 'devnet', rpcUrl: '', programId: TEST_PROGRAM_ID });
    assert.throws(
      () => provider.buildOnchainResult('SomePda', 'demo_signature'),
      (e: unknown) => e instanceof DomainError && e.code === 'FAKE_SIGNATURE',
    );
  });

  it('wraps a real signature with a matching explorer URL', () => {
    const provider = new LiveSolanaProvider({ network: 'devnet', rpcUrl: '', programId: TEST_PROGRAM_ID });
    const result = provider.buildOnchainResult('SomePda', VALID_SIGNATURE_SHAPE);
    assert.equal(result.kind, 'onchain');
    if (result.kind === 'onchain') {
      assert.equal(result.signature, VALID_SIGNATURE_SHAPE);
      assert.ok(result.explorerUrl.indexOf(VALID_SIGNATURE_SHAPE) !== -1);
    }
  });

  it('reads live config as unavailable when PROGRAM_ID is missing', () => {
    withEnv({ VITE_PROGRAM_ID: undefined }, () => {
      const config = readLiveConfig();
      assert.equal(config.ok, false);
      assert.equal(config.config, null);
    });
  });

  it('reads live config as unavailable for the System Program', () => {
    withEnv({ VITE_PROGRAM_ID: SYSTEM_PROGRAM_ID }, () => {
      assert.equal(readLiveConfig().ok, false);
    });
  });

  it('reads a valid live config from the environment', () => {
    withEnv({ VITE_PROGRAM_ID: TEST_PROGRAM_ID, VITE_SOLANA_NETWORK: 'devnet' }, () => {
      const config = readLiveConfig();
      assert.equal(config.ok, true);
      assert.equal(config.config ? config.config.programId : null, TEST_PROGRAM_ID);
    });
  });
});

describe('provider switching (P0.1, P0.7, P0.8)', () => {
  it('returns a demo solana provider in demo mode', () => {
    resetProviderCache();
    assert.equal(getProviders('demo').solana.mode, 'demo');
  });

  it('returns a distinct provider object per mode', () => {
    withEnv({ VITE_PROGRAM_ID: TEST_PROGRAM_ID }, () => {
      resetProviderCache();
      const demo = getProviders('demo');
      const live = getProviders('live');
      assert.notEqual(demo.solana, live.solana);
      assert.equal(live.solana.mode, 'live');
    });
  });

  it('never falls back to demo when live is not configured', () => {
    withEnv({ VITE_PROGRAM_ID: undefined }, () => {
      resetProviderCache();
      assert.throws(
        () => getProviders('live'),
        (e: unknown) => e instanceof DomainError && e.code === 'LIVE_MODE_UNAVAILABLE',
      );
    });
  });

  it('reports live availability honestly when unconfigured', () => {
    withEnv({ VITE_PROGRAM_ID: undefined }, () => {
      const availability = liveAvailability();
      assert.equal(availability.available, false);
      assert.ok(availability.reason);
    });
  });

  it('reports live availability when configured', () => {
    withEnv({ VITE_PROGRAM_ID: TEST_PROGRAM_ID }, () => {
      const availability = liveAvailability();
      assert.equal(availability.available, true);
      assert.equal(availability.programId, TEST_PROGRAM_ID);
    });
  });

  it('rebuilds providers after the cache is reset', () => {
    resetProviderCache();
    const first = getProviders('demo');
    resetProviderCache();
    const second = getProviders('demo');
    assert.notEqual(first, second);
  });
});
