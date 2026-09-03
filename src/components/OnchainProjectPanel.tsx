// On-chain state panel.
//
// Reads the Project account from Solana and shows it next to the local state.
// It is deliberately read-only: no wallet, no signature, no transaction. In
// demo mode it says so instead of pretending a chain exists, and when the RPC
// fails it shows the failure rather than an empty card.

import { useEffect, useState } from 'react';
import { Card, CardBody, CardHeader, CardTitle } from './ui/Card';
import { Badge } from './ui/Badge';
import { useApp } from '../store/app-context';
import { LiveSolanaProvider, type OnchainProjectState } from '../providers/solana/live';
import { projectInvariantsHold } from '../lib/solana/decode';
import { bpsToPercentString } from '../domain/bps';
import type { Project } from '../domain/types';

type LoadState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'missing'; pda: string }
  | { status: 'error'; message: string }
  | { status: 'loaded'; state: OnchainProjectState };

function Row(props: { label: string; local?: string; chain: string; mismatch?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-xs text-ink-400">{props.label}</span>
      <span className="flex items-center gap-2">
        {props.local !== undefined ? (
          <span className={props.mismatch ? 'text-xs text-warning-600' : 'text-xs text-ink-400'}>
            local {props.local}
          </span>
        ) : null}
        <span className="text-sm font-semibold text-ink-900">{props.chain}</span>
      </span>
    </div>
  );
}

export function OnchainProjectPanel({ project }: { project: Project }) {
  const { mode, providers } = useApp();
  const [load, setLoad] = useState<LoadState>({ status: 'idle' });

  useEffect(() => {
    if (mode !== 'live' || providers.solana.mode !== 'live') {
      setLoad({ status: 'idle' });
      return;
    }
    let cancelled = false;
    const live = providers.solana as unknown as LiveSolanaProvider;
    setLoad({ status: 'loading' });
    (async () => {
      try {
        const pda =
          project.solanaProjectPda ||
          (await live.deriveProjectPda(project.onchainProjectId, project.founderWallet));
        const state = await live.fetchProjectState(pda);
        if (cancelled) return;
        setLoad(state ? { status: 'loaded', state } : { status: 'missing', pda });
      } catch (e: unknown) {
        if (cancelled) return;
        const message = e instanceof Error ? e.message : 'Unknown RPC failure.';
        setLoad({ status: 'error', message });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, providers, project.onchainProjectId, project.founderWallet, project.solanaProjectPda]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>On-chain State</CardTitle>
          {load.status === 'loaded' ? (
            <Badge tone="info" size="sm" dot>
              {load.state.network === 'mainnet-beta' ? 'Mainnet' : 'Devnet'}
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardBody>
        {mode !== 'live' ? (
          <p className="text-sm text-ink-400 py-6 text-center">
            Demo mode. Nothing is read from a chain and nothing is written to one.
          </p>
        ) : null}

        {load.status === 'loading' ? (
          <p className="text-sm text-ink-400 py-6 text-center">Reading the Project account...</p>
        ) : null}

        {load.status === 'missing' ? (
          <p className="text-sm text-ink-400 py-6 text-center">
            No account at {load.pda}. This project has not been created on chain yet.
          </p>
        ) : null}

        {load.status === 'error' ? (
          <p className="text-sm text-error-600 py-6 text-center">{load.message}</p>
        ) : null}

        {load.status === 'loaded' ? (
          <div className="divide-y divide-ink-100">
            <Row
              label="Founder share"
              local={bpsToPercentString(project.founderBps)}
              chain={bpsToPercentString(load.state.founderBps)}
              mismatch={project.founderBps !== load.state.founderBps}
            />
            <Row
              label="Contributor pool"
              local={bpsToPercentString(project.devPoolBps)}
              chain={bpsToPercentString(load.state.devPoolBps)}
              mismatch={project.devPoolBps !== load.state.devPoolBps}
            />
            <Row
              label="Committed"
              local={bpsToPercentString(project.committedBps)}
              chain={bpsToPercentString(load.state.committedBps)}
              mismatch={project.committedBps !== load.state.committedBps}
            />
            <Row
              label="Allocated"
              local={bpsToPercentString(project.allocatedBps)}
              chain={bpsToPercentString(load.state.allocatedBps)}
              mismatch={project.allocatedBps !== load.state.allocatedBps}
            />
            <Row label="Remaining pool" chain={bpsToPercentString(load.state.remainingBps)} />
            <Row label="Tasks on chain" chain={load.state.taskCount} />
            <Row label="Members on chain" chain={String(load.state.memberCount)} />

            <div className="pt-3 space-y-2">
              {projectInvariantsHold(load.state) ? (
                <p className="text-xs text-success-600">
                  Invariants hold on chain: founder + pool = 100%, committed + allocated within the pool.
                </p>
              ) : (
                <p className="text-xs text-error-600">
                  The on-chain account violates a basis-point invariant. Do not trust this project.
                </p>
              )}
              <a
                className="text-xs text-brand-600 hover:underline break-all"
                href={load.state.explorerUrl}
                target="_blank"
                rel="noreferrer"
              >
                {load.state.pda}
              </a>
              <p className="text-xs text-ink-400">
                Read directly from the RPC. This panel never signs or sends a transaction.
              </p>
            </div>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}
