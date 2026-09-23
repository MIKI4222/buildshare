// The only place cancel_task is sent from the browser.
//
// cancel_task is founder-only and terminal on chain. The context updates the
// local task only after confirmation and read-back of CANCELLED.

import { useState, type MouseEvent } from 'react';
import { useApp } from '../store/app-context';
import { explorerTxUrl } from '../providers/solana/types';
import type { Project, Task } from '../domain/types';

type CancelState =
  | { status: 'idle' }
  | { status: 'sending' }
  | { status: 'done'; signature: string }
  | { status: 'error'; message: string };

function messageOf(e: unknown): string {
  const m = (e as { message?: string }).message;
  return typeof m === 'string' && m.length > 0 ? m : String(e);
}

export function OnchainCancelTaskButton(props: { project: Project; task: Task }) {
  const { mode, providers, cancelTaskOnchain } = useApp();
  const [cancel, setCancel] = useState<CancelState>({ status: 'idle' });
  const project = props.project;
  const task = props.task;

  if (mode !== 'live') return null;
  if (project.solanaProjectPda === null || task.onchainTaskId === null) return null;

  const onCancel = async (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const confirmed = window.confirm(
      'Cancel this task on chain? This is terminal for this task.',
    );
    if (!confirmed) return;

    setCancel({ status: 'sending' });
    try {
      const result = await cancelTaskOnchain(task.id);
      setCancel({ status: 'done', signature: result.signature });
    } catch (err) {
      setCancel({ status: 'error', message: messageOf(err) });
    }
  };

  // Keep the signature visible after app-context maps chain CANCELLED to the
  // client's terminal BLOCKED status.
  if (cancel.status === 'done') {
    return (
      <a
        className="font-mono text-xs text-success-600 hover:underline"
        href={explorerTxUrl(cancel.signature, providers.solana.network)}
        target="_blank"
        rel="noreferrer"
        onClick={(e) => e.stopPropagation()}
      >
        cancelled on chain
      </a>
    );
  }

  const cancellable =
    task.status === 'OPEN' ||
    task.status === 'EXPIRED' ||
    task.status === 'REJECTED';
  if (!cancellable) return null;

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={onCancel}
        disabled={cancel.status === 'sending'}
        className="rounded-md border border-error-500 px-2 py-0.5 text-xs font-semibold text-error-600 hover:bg-error-50 disabled:opacity-50"
      >
        {cancel.status === 'sending' ? 'Waiting for wallet...' : 'Cancel on chain'}
      </button>
      {cancel.status === 'error' ? (
        <span className="text-xs text-error-600">{cancel.message}</span>
      ) : null}
    </span>
  );
}
