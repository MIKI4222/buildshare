// The only place a task is created on chain from the browser.
//
// This button lives inside a react-router Link that wraps the whole task card,
// so every click must be stopped from navigating before anything is signed.

import { useState, type MouseEvent } from 'react';
import { useApp } from '../store/app-context';
import { explorerTxUrl } from '../providers/solana/types';
import type { Project, Task } from '../domain/types';

type PublishState =
  | { status: 'idle' }
  | { status: 'sending' }
  | { status: 'done'; signature: string }
  | { status: 'error'; message: string };

function messageOf(e: unknown): string {
  const m = (e as { message?: string }).message;
  return typeof m === 'string' && m.length > 0 ? m : String(e);
}

export function OnchainTaskButton(props: { project: Project; task: Task }) {
  const { mode, providers, publishTaskOnchain } = useApp();
  const [publish, setPublish] = useState<PublishState>({ status: 'idle' });
  const project = props.project;
  const task = props.task;

  // Demo mode never touches a chain, so it never offers to.
  if (mode !== 'live') return null;

  const onPublish = async (e: MouseEvent<HTMLButtonElement>) => {
    // The card is a link. Without this the click navigates away.
    e.preventDefault();
    e.stopPropagation();
    setPublish({ status: 'sending' });
    try {
      const result = await publishTaskOnchain(task.id);
      setPublish({ status: 'done', signature: result.signature });
    } catch (err) {
      setPublish({ status: 'error', message: messageOf(err) });
    }
  };

  if (publish.status === 'done') {
    return (
      <a
        className="font-mono text-xs text-success-600 hover:underline"
        href={explorerTxUrl(publish.signature, providers.solana.network)}
        target="_blank"
        rel="noreferrer"
        onClick={(e) => e.stopPropagation()}
      >
        created on chain
      </a>
    );
  }

  // Already recorded. The id came from a confirmed account read, never a guess.
  if (task.onchainTaskId !== null) {
    return (
      <span className="font-mono text-xs text-success-600">
        on chain #{task.onchainTaskId}
      </span>
    );
  }

  // A task cannot exist before its project. The project panel says so already,
  // so this stays quiet rather than repeating it on every row.
  if (project.solanaProjectPda === null) return null;

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={onPublish}
        disabled={publish.status === 'sending'}
        className="rounded-md border border-brand-600 px-2 py-0.5 text-xs font-semibold text-brand-600 hover:bg-brand-50 disabled:opacity-50"
      >
        {publish.status === 'sending' ? 'Waiting for wallet...' : 'Create on chain'}
      </button>
      {publish.status === 'error' ? (
        <span className="text-xs text-error-600">{publish.message}</span>
      ) : null}
    </span>
  );
}
