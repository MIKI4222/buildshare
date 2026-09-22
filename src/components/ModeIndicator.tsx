import { Badge } from './ui/Badge';
import { useApp } from '../store/app-context';
import { liveAvailability } from '../providers';

export function ModeIndicator({ compact = false }: { compact?: boolean }) {
  const { mode } = useApp();
  const isDemo = mode === 'demo';
  return (
    <Badge tone={isDemo ? 'warning' : 'success'} size="sm" dot className={compact ? '' : 'px-2.5 py-1'}>
      {isDemo ? 'Demo Mode' : 'Live Mode'}
    </Badge>
  );
}

export function ModeSwitcher({ compact = false }: { compact?: boolean }) {
  const {
    mode,
    setMode,
    liveAvailable,
    liveReason,
    modeError,
  } = useApp();

  const target = mode === 'demo' ? 'live' : 'demo';
  const liveDisabled = target === 'live' && !liveAvailable;
  const label = target === 'live' ? 'Use Live Devnet' : 'Use Demo';
  const reason = liveDisabled
    ? liveReason || 'Live mode is not configured.'
    : modeError || (
      target === 'live'
        ? 'Switch to real Solana Devnet integration.'
        : 'Switch to local simulation without chain writes.'
    );

  return (
    <button
      type="button"
      disabled={liveDisabled}
      onClick={() => setMode(target)}
      aria-label={label}
      title={reason}
      className={[
        'rounded-lg border font-medium transition-colors focus-ring',
        compact ? 'h-7 px-2 text-xs' : 'h-8 px-3 text-sm',
        liveDisabled
          ? 'cursor-not-allowed border-ink-200 bg-ink-50 text-ink-400'
          : 'border-ink-300 bg-white text-ink-700 hover:bg-ink-50',
      ].join(' ')}
    >
      {label}
    </button>
  );
}

// In demo mode we never claim to be on a network: no transaction is ever sent.
export function NetworkIndicator() {
  const { mode } = useApp();
  if (mode === 'demo') {
    return (
      <Badge tone="warning" size="sm" dot>
        No chain (Demo)
      </Badge>
    );
  }
  const availability = liveAvailability();
  if (!availability.available) {
    return (
      <Badge tone="error" size="sm" dot>
        Live not configured
      </Badge>
    );
  }
  return (
    <Badge tone="info" size="sm" dot>
      {availability.network === 'mainnet-beta' ? 'Mainnet' : 'Devnet'}
    </Badge>
  );
}
