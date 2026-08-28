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
