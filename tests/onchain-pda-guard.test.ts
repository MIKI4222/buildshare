// The initialize_project pre-flight guard.
//
// The point of these tests is not that an occupied PDA is refused - it is that
// it is refused EXACTLY ONCE, with no attempt at a second id. A silent retry
// with onchainProjectId + 1 would create a project nobody asked for.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { LiveSolanaProvider } from '../src/providers/solana/live';
import { DemoSolanaProvider } from '../src/providers/solana/demo';
import { DomainError } from '../src/domain/errors';
import { TEST_PROGRAM_ID, WALLETS } from './helpers';

// Real base58 wallet, so PublicKey can parse it. Devnet is never contacted:
// accountExists is overridden below.
const FOUNDER = '6gVmCQJcrHMCAiESGfYdwNCUkE4Qr92WkmygrqD256JH';

class StubbedLive extends LiveSolanaProvider {
  checked: string[] = [];
  constructor(private occupied: boolean) {
    super({ network: 'devnet', rpcUrl: 'http://127.0.0.1:1', programId: TEST_PROGRAM_ID });
  }
  protected async accountExists(address: string): Promise<boolean> {
    this.checked.push(address);
    return this.occupied;
  }
}

describe('ensureProjectPdaAvailable (live)', () => {
  it('allows building the transaction when the pda is free', async () => {
    const provider = new StubbedLive(false);
    await provider.ensureProjectPdaAvailable(1, FOUNDER);
    assert.equal(provider.checked.length, 1);
  });

  it('refuses when the pda is taken, and checks exactly one address', async () => {
    const provider = new StubbedLive(true);
    let caught: unknown = null;
    try {
      await provider.ensureProjectPdaAvailable(1, FOUNDER);
    } catch (e) {
      caught = e;
    }
    assert.ok(caught instanceof DomainError, 'expected a DomainError');
    assert.equal((caught as DomainError).code, 'INVARIANT_VIOLATION');
    assert.match((caught as DomainError).message, /already exists for this project ID/);
    // One address only: no loop, no id + 1, no second candidate.
    assert.equal(provider.checked.length, 1);
  });

  it('reports the id it refused, and that id is the one it was given', async () => {
    const provider = new StubbedLive(true);
    const expected = await provider.deriveProjectPda(4, FOUNDER);
    try {
      await provider.ensureProjectPdaAvailable(4, FOUNDER);
      assert.fail('expected a refusal');
    } catch (e) {
      const details = (e as DomainError).details as Record<string, unknown>;
      assert.equal(details.onchainProjectId, 4);
      assert.equal(details.pda, expected);
      assert.equal(details.founderWallet, FOUNDER);
    }
  });
});

describe('ensureProjectPdaAvailable (demo)', () => {
  it('resolves without touching any cluster', async () => {
    const provider = new DemoSolanaProvider();
    await provider.ensureProjectPdaAvailable(1, WALLETS.founder);
  });
});

// A real Project PDA from the first Devnet run, so PublicKey can parse it.
const PROJECT_PDA = 'E8UyjRSsDU37jfSXdFCj94iUn4Rriqm3uJ3ienbALffm';

describe('ensureTaskPdaAvailable (live, STOP-8)', () => {
  it('allows create_task when the task pda is free', async () => {
    const provider = new StubbedLive(false);
    await provider.ensureTaskPdaAvailable(PROJECT_PDA, 0);
    assert.equal(provider.checked.length, 1);
  });

  it('refuses an occupied task pda and checks exactly one address', async () => {
    const provider = new StubbedLive(true);
    let caught: unknown = null;
    try {
      await provider.ensureTaskPdaAvailable(PROJECT_PDA, 0);
    } catch (e) {
      caught = e;
    }
    assert.ok(caught instanceof DomainError, 'expected a DomainError');
    assert.equal((caught as DomainError).code, 'INVARIANT_VIOLATION');
    assert.match((caught as DomainError).message, /already exists for this task ID/);
    assert.match((caught as DomainError).message, /no other id is tried/);
    // The proof that there is no scan: candidate + 1 was never derived.
    assert.equal(provider.checked.length, 1);
  });

  it('checks the address that the frozen task seeds produce', async () => {
    const provider = new StubbedLive(false);
    const expected = await provider.deriveTaskPda(PROJECT_PDA, 3);
    await provider.ensureTaskPdaAvailable(PROJECT_PDA, 3);
    assert.equal(provider.checked[0], expected);
  });

  it('derives a different address for a different id', async () => {
    const provider = new StubbedLive(false);
    const a = await provider.deriveTaskPda(PROJECT_PDA, 0);
    const b = await provider.deriveTaskPda(PROJECT_PDA, 1);
    assert.notEqual(a, b);
  });
});

describe('ensureTaskPdaAvailable (demo, STOP-8)', () => {
  it('resolves without touching any cluster', async () => {
    const provider = new DemoSolanaProvider();
    await provider.ensureTaskPdaAvailable('anything', 0);
  });
});

describe('initializeProject refusals (STOP-9)', () => {
  const input = {
    projectId: 'prj_1',
    onchainProjectId: 1,
    founderWallet: FOUNDER,
    founderBps: 4_000,
    devPoolBps: 6_000,
  };

  it('the live provider refuses outside a browser and sends nothing', async () => {
    const provider = new StubbedLive(false);
    let caught: unknown = null;
    try {
      await provider.initializeProject(input);
    } catch (e) {
      caught = e;
    }
    assert.ok(caught instanceof DomainError, 'expected a DomainError');
    assert.equal((caught as DomainError).code, 'LIVE_MODE_UNAVAILABLE');
    // No account was read, so nothing was attempted against a cluster.
    assert.equal(provider.checked.length, 0);
  });

  it('the demo provider refuses instead of faking a project', async () => {
    const provider = new DemoSolanaProvider();
    let caught: unknown = null;
    try {
      await provider.initializeProject(input);
    } catch (e) {
      caught = e;
    }
    assert.ok(caught instanceof DomainError, 'expected a DomainError');
    assert.equal((caught as DomainError).code, 'LIVE_MODE_UNAVAILABLE');
  });
});
