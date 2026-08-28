import { Badge } from './ui/Badge';
import type { AIRecommendation, ContributionStatus, LifecycleStatus, TaskStatus } from '../domain/types';

type Tone = 'neutral' | 'info' | 'warning' | 'success' | 'error' | 'brand';

// One vocabulary of statuses, one place that maps them to labels.
const LABELS: Record<LifecycleStatus, { tone: Tone; label: string }> = {
  OPEN: { tone: 'neutral', label: 'Open' },
  CLAIMED: { tone: 'info', label: 'Claimed' },
  SUBMITTED: { tone: 'warning', label: 'Submitted' },
  AI_REVIEW: { tone: 'info', label: 'AI Review' },
  PENDING_APPROVAL: { tone: 'warning', label: 'Pending Approval' },
  APPROVED: { tone: 'success', label: 'Approved' },
  REJECTED: { tone: 'error', label: 'Rejected' },
  PENDING_ONCHAIN: { tone: 'warning', label: 'Pending On-chain' },
  ONCHAIN: { tone: 'success', label: 'On-chain' },
  ONCHAIN_FAILED: { tone: 'error', label: 'On-chain Failed' },
  DEMO_ALLOCATED: { tone: 'brand', label: 'Demo Allocated' },
  EXPIRED: { tone: 'neutral', label: 'Expired' },
  BLOCKED: { tone: 'neutral', label: 'Blocked' },
};

export function StatusBadge({ status, size = 'md' }: { status: LifecycleStatus; size?: 'sm' | 'md' }) {
  const entry = LABELS[status] || { tone: 'neutral' as Tone, label: String(status) };
  return <Badge tone={entry.tone} size={size} dot>{entry.label}</Badge>;
}

export function TaskStatusBadge({ status, size = 'md' }: { status: TaskStatus; size?: 'sm' | 'md' }) {
  return <StatusBadge status={status} size={size} />;
}

export function ContributionStatusBadge({ status, size = 'md' }: { status: ContributionStatus; size?: 'sm' | 'md' }) {
  return <StatusBadge status={status} size={size} />;
}

export function statusLabel(status: LifecycleStatus): string {
  const entry = LABELS[status];
  return entry ? entry.label : String(status);
}

export function AIRecommendationBadge({ recommendation, size = 'md' }: { recommendation: AIRecommendation; size?: 'sm' | 'md' }) {
  const map: Record<AIRecommendation, { tone: Tone; label: string }> = {
    APPROVE: { tone: 'success', label: 'Approve' },
    REVIEW: { tone: 'warning', label: 'Review' },
    REJECT: { tone: 'error', label: 'Reject' },
  };
  const { tone, label } = map[recommendation];
  return <Badge tone={tone} size={size} dot>{label}</Badge>;
}
