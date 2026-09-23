// The only place expire_claim is sent from the browser.
//
// Permissionless on chain: any wallet may close a stale claim. The
// reservation in project.committed_bps is NOT released here, by design:
// only cancel_task releases it.
//
// Known limitation: the domain has no field for this signature, so nothing
// is persisted. After a reload the button comes back. A second press is
// safe: the provider reads the account, sees EXPIRED, and refuses.

import { useState, type MouseEvent } from 'react';
import { useApp } from '../store/app-context';
import { explorerTxUrl } from '../providers/solana/types';
import type { Project, Task } from '../domain/types';

type ExpireState =
  | { status: 'idle' }
  | { status: 'sending' }
  | { status: 'done'; signature: string }
  | { status: 'error'; message: string };

function messageOf(e: unknown): string {
  const m = (e as { message?: string }).message;
  return typeof m === 'string' && m.length > 0 ? m : String(e);
}

export function OnchainExpireClaimButton(props: { project: Project; task: Task }) {
  const { mode, providers, expireClaimOnchain } = useApp();
  const [claim, setClaim] = useState<ExpireState>({ status: 'idle' });
  const project = props.project;
  const task = props.task;

  if (mode !== 'live') return null;
  if (project.solanaProjectPda === null) return null;
  if (task.onchainTaskId === null) return null;
  if (task.status === 'OPEN') return null;

  const onExpire = async (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setClaim({ status: 'sending' });
    try {
      const result = await expireClaimOnchain(task.id);
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
        claim expired on chain
      </a>
    );
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={onExpire}
        disabled={claim.status === 'sending'}
        className="rounded-md border border-brand-600 px-2 py-0.5 text-xs font-semibold text-brand-600 hover:bg-brand-50 disabled:opacity-50"
      >
        {claim.status === 'sending' ? 'Waiting for wallet...' : 'Expire claim on chain'}
      </button>
      {claim.status === 'error' ? (
        <span className="text-xs text-error-600">{claim.message}</span>
      ) : null}
    </span>
  );
}
