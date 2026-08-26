import { Badge } from './ui/Badge';
import { useApp } from '../store/app-context';

export function ModeIndicator({ compact = false }: { compact?: boolean }) {
  const { mode } = useApp();
  const isDemo = mode === 'demo';
  return (
    <Badge tone={isDemo ? 'warning' : 'success'} size="sm" dot className={compact ? '' : 'px-2.5 py-1'}>
      {isDemo ? 'Demo Mode' : 'Live Mode'}
    </Badge>
  );
}

export function NetworkIndicator() {
  const { mode } = useApp();
  const network = mode === 'demo' ? 'Devnet (Demo)' : 'Devnet';
  return (
    <Badge tone="info" size="sm" dot>
      {network}
    </Badge>
  );
}
