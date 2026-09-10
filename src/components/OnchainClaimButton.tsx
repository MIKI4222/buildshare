// The only place a task is claimed on chain from the browser.
//
// The local claim and the on-chain claim are two separate actions on purpose:
// the domain owns the commitment hash, the chain owns the attempt counter.
// This button never rehashes anything. It sends what the domain already built.
//
// Known limitation: the domain has no field for a claim signature, so nothing
// is persisted. After a reload the button comes back. A second press is safe:
// the provider reads the account, sees CLAIMED instead of OPEN, and refuses.

import { useState, type MouseEvent } from 'react';
import { useApp } from '../store/app-context';
import { explorerTxUrl } from '../providers/solana/types';
import type { Project, Task } from '../domain/types';

type ClaimState =
  | { status: 'idle' }
  | { status: 'sending' }
  | { status: 'done'; signature: string }
  | { status: 'error'; message: string };

function messageOf(e: unknown): string {
  const m = (e as { message?: string }).message;
  return typeof m === 'string' && m.length > 0 ? m : String(e);
}

export function OnchainClaimButton(props: { project: Project; task: Task }) {
  const { mode, providers, claimTaskOnchain } = useApp();
  const [claim, setClaim] = useState<ClaimState>({ status: 'idle' });
  const project = props.project;
  const task = props.task;

  if (mode !== 'live') return null;
  if (project.solanaProjectPda === null) return null;
  if (task.onchainTaskId === null) return null;
  if (task.status !== 'CLAIMED') return null;

  const onClaim = async (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setClaim({ status: 'sending' });
    try {
      const result = await claimTaskOnchain(task.id);
      setClaim({ status: 'done', signature: result.signature });
    } catch (err) {
      setClaim({ status: 'error', message: messageOf(err) });
    }
  };

  if (claim.status === 'done') {
    return (
      <a
        className="font-mono text-xs text-success-600 hover:underline"
        href={explorerTxUrl(claim.signature, providers.solana.network)}
        target="_blank"
        rel="noreferrer"
        onClick={(e) => e.stopPropagation()}
      >
        claimed on chain
      </a>
    );
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={onClaim}
        disabled={claim.status === 'sending'}
        className="rounded-md border border-brand-600 px-2 py-0.5 text-xs font-semibold text-brand-600 hover:bg-brand-50 disabled:opacity-50"
      >
        {claim.status === 'sending' ? 'Waiting for wallet...' : 'Claim on chain'}
      </button>
      {claim.status === 'error' ? (
        <span className="text-xs text-error-600">{claim.message}</span>
      ) : null}
    </span>
  );
}
