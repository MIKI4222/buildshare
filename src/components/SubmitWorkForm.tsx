// The only place a contribution is created from the browser.
//
// This is a purely local action: the domain builds the contribution and the
// merged pull request record, and nothing is sent on chain here. The chain
// only learns about the contribution at approval time, because the evidence
// hash includes the approver and the approval time (STOP-18).
//
// Six fields are typed by hand. Four of them (number, merge commit, repository
// and base branch) end up inside the evidence hash and therefore on chain, so
// they should describe a real pull request. The remaining pull request fields
// are placeholders: line counts are zeroes and the dates are "now". None of
// them reach the chain.

import { useState, type FormEvent } from 'react';
import { useApp } from '../store/app-context';
import type { Task } from '../domain/types';

function messageOf(e: unknown): string {
  const m = (e as { message?: string }).message;
  return typeof m === 'string' && m.length > 0 ? m : String(e);
}

const fieldStyle = 'w-full rounded border border-ink-200 px-2 py-1 text-sm';

export function SubmitWorkForm(props: { task: Task }) {
  const { submitWork } = useApp();
  const task = props.task;
  const [open, setOpen] = useState(false);
  const [prNumber, setPrNumber] = useState('');
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [sha, setSha] = useState('');
  const [repo, setRepo] = useState(task.repositoryFullName || '');
  const [base, setBase] = useState(task.baseBranch || 'main');
  const [error, setError] = useState<string | null>(null);

  if (task.status !== 'CLAIMED') return null;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const n = Number(prNumber);
    if (!Number.isInteger(n) || n <= 0) {
      setError('Pull request number must be a positive integer.');
      return;
    }
    if (sha.trim().length === 0) {
      setError('A merge commit SHA is required: it goes into the evidence hash.');
      return;
    }
    if (repo.trim().length === 0) {
      setError('A repository is required: it goes into the evidence hash.');
      return;
    }
    const now = new Date().toISOString();
    try {
      submitWork(task.id, {
        githubPrId: 'pr-' + String(n),
        githubPrNumber: n,
        repository: repo.trim(),
        authorGithubId: 'local-contributor',
        title: title.trim() || ('Work for ' + task.externalKey),
        description: '',
        url: url.trim(),
        baseBranch: base.trim(),
        headBranch: 'task/' + task.externalKey,
        additions: 0,
        deletions: 0,
        changedFiles: 0,
        mergeCommitSha: sha.trim(),
        openedAt: now,
        mergedAt: now,
      });
      setOpen(false);
    } catch (err) {
      setError(messageOf(err));
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded bg-ink-900 px-3 py-1.5 text-sm text-white"
      >
        Submit work
      </button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2 rounded border border-ink-200 p-3">
      <div className="text-sm font-medium">Submit work for {task.externalKey}</div>
      <input className={fieldStyle} value={prNumber} onChange={(e) => setPrNumber(e.target.value)} placeholder="Pull request number, e.g. 12" />
      <input className={fieldStyle} value={sha} onChange={(e) => setSha(e.target.value)} placeholder="Merge commit SHA" />
      <input className={fieldStyle} value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="owner/repository" />
      <input className={fieldStyle} value={base} onChange={(e) => setBase(e.target.value)} placeholder="Base branch" />
      <input className={fieldStyle} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (optional)" />
      <input className={fieldStyle} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Pull request URL (optional)" />
      <div className="text-xs text-ink-500">
        Number, merge commit, repository and base branch are hashed into the
        evidence and sent on chain at approval. Line counts and dates are
        placeholders and stay local.
      </div>
      {error === null ? null : <div className="text-xs text-red-600">{error}</div>}
      <div className="flex gap-2">
        <button type="submit" className="rounded bg-ink-900 px-3 py-1.5 text-sm text-white">Create contribution</button>
        <button type="button" onClick={() => setOpen(false)} className="rounded border border-ink-200 px-3 py-1.5 text-sm">Cancel</button>
      </div>
    </form>
  );
}
