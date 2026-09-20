// Founder-only browser path for update_task.
//
// The user supplies integer basis points directly: no floating-point ownership
// conversion is performed. Local state is recorded only after chain read-back.

import { useState, type MouseEvent } from 'react';
import { useApp } from '../store/app-context';
import { explorerTxUrl } from '../providers/solana/types';
import type { Project, Task } from '../domain/types';

type UpdateState =
  | { status: 'idle' }
  | { status: 'sending' }
  | { status: 'done'; signature: string }
  | { status: 'error'; message: string };

function messageOf(e: unknown): string {
  const m = (e as { message?: string }).message;
  return typeof m === 'string' && m.length > 0 ? m : String(e);
}

export function OnchainUpdateTaskButton(props: { project: Project; task: Task }) {
  const { mode, providers, updateTaskOnchain } = useApp();
  const [state, setState] = useState<UpdateState>({ status: 'idle' });
  const { project, task } = props;

  if (mode !== 'live') return null;
  if (project.solanaProjectPda === null || task.onchainTaskId === null) return null;

  const onUpdate = async (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();

    const rewardText = window.prompt(
      'New reward in basis points (integer, 1 bps = 0.01%):',
      String(task.rewardBps),
    );
    if (rewardText === null) return;
    const rewardBps = Number(rewardText.trim());
    if (!Number.isInteger(rewardBps) || rewardBps <= 0 || rewardBps > 10000) {
      setState({ status: 'error', message: 'Reward must be an integer from 1 to 10000 bps.' });
      return;
    }

    const criteria = window.prompt(
      'New acceptance criteria:',
      task.acceptanceCriteria,
    );
    if (criteria === null) return;
    if (!criteria.trim()) {
      setState({ status: 'error', message: 'Acceptance criteria cannot be empty.' });
      return;
    }

    setState({ status: 'sending' });
    try {
      const result = await updateTaskOnchain(task.id, {
        rewardBps,
        acceptanceCriteria: criteria.trim(),
      });
      setState({ status: 'done', signature: result.signature });
    } catch (err) {
      setState({ status: 'error', message: messageOf(err) });
    }
  };

  if (state.status === 'done') {
    return (
      <a
        className="font-mono text-xs text-success-600 hover:underline"
        href={explorerTxUrl(state.signature, providers.solana.network)}
        target="_blank"
        rel="noreferrer"
        onClick={(e) => e.stopPropagation()}
      >
        updated on chain
      </a>
    );
  }

  if (task.status !== 'OPEN') return null;

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={onUpdate}
        disabled={state.status === 'sending'}
        className="rounded-md border border-brand-600 px-2 py-1 text-xs font-semibold text-brand-600 hover:bg-brand-50 disabled:opacity-50"
      >
        {state.status === 'sending' ? 'Waiting for wallet...' : 'Update on chain'}
      </button>
      {state.status === 'error' ? (
        <span className="text-xs text-error-600">{state.message}</span>
      ) : null}
    </span>
  );
}
