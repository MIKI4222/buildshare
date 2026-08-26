import { Badge } from './ui/Badge';
import type { TaskStatus, ContributionStatus } from '../domain/types';

export function TaskStatusBadge({ status, size = 'md' }: { status: TaskStatus; size?: 'sm' | 'md' }) {
  const map: Record<TaskStatus, { tone: 'neutral' | 'info' | 'warning' | 'success' | 'error' | 'brand'; label: string }> = {
    OPEN: { tone: 'neutral', label: 'Open' },
    CLAIMED: { tone: 'info', label: 'Claimed' },
    SUBMITTED: { tone: 'warning', label: 'Submitted' },
    VERIFYING: { tone: 'warning', label: 'Verifying' },
    APPROVED: { tone: 'success', label: 'Approved' },
    REJECTED: { tone: 'error', label: 'Rejected' },
    COMPLETED: { tone: 'success', label: 'Completed' },
  };
  const { tone, label } = map[status];
  return <Badge tone={tone} size={size} dot>{label}</Badge>;
}

export function ContributionStatusBadge({ status, size = 'md' }: { status: ContributionStatus; size?: 'sm' | 'md' }) {
  const map: Record<ContributionStatus, { tone: 'neutral' | 'info' | 'warning' | 'success' | 'error' | 'brand'; label: string }> = {
    PENDING: { tone: 'neutral', label: 'Pending' },
    AI_REVIEW: { tone: 'info', label: 'AI Review' },
    PENDING_APPROVAL: { tone: 'warning', label: 'Pending Approval' },
    APPROVED: { tone: 'success', label: 'Approved' },
    REJECTED: { tone: 'error', label: 'Rejected' },
    ONCHAIN: { tone: 'success', label: 'On-chain' },
    FAILED: { tone: 'error', label: 'Failed' },
  };
  const { tone, label } = map[status];
  return <Badge tone={tone} size={size} dot>{label}</Badge>;
}

export function AIRecommendationBadge({ recommendation, size = 'md' }: { recommendation: 'APPROVE' | 'REVIEW' | 'REJECT'; size?: 'sm' | 'md' }) {
  const map = {
    APPROVE: { tone: 'success' as const, label: 'Approve' },
    REVIEW: { tone: 'warning' as const, label: 'Review' },
    REJECT: { tone: 'error' as const, label: 'Reject' },
  };
  const { tone, label } = map[recommendation];
  return <Badge tone={tone} size={size} dot>{label}</Badge>;
}
