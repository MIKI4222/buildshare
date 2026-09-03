import { useParams, Link, NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import {
  ArrowLeft, Users, GitBranch, Award, Activity, Settings, FileText,
  GitPullRequest, Brain, CheckCircle, XCircle, TrendingUp, Layers,
  Clock, AlertCircle, ExternalLink,
} from 'lucide-react';
import { Card, CardBody, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { useApp } from '../store/app-context';
import { bpsToPercentString, BPS_TOTAL, poolBreakdown } from '../domain/bps';
import { OwnershipBar, OwnershipDonut, type OwnershipSegment } from '../components/OwnershipChart';
import { OnchainProjectPanel } from '../components/OnchainProjectPanel';
import { TaskStatusBadge, ContributionStatusBadge, AIRecommendationBadge } from '../components/StatusBadges';
import { CopyButton } from '../components/ui/CopyButton';
import { timeAgo } from './DashboardPage';
import { Modal } from '../components/ui/Modal';
import { Input, Textarea, Select } from '../components/ui/Input';
import { shortHash } from '../domain/evidence';
import { shortAddress } from '../lib/solana/wallet';
import { explorerTxUrl } from '../providers/solana/types';
import type { Difficulty } from '../domain/types';

const TAB_COLOR = 'text-ink-400';

export function ProjectDetailPage() {
  const { projectId } = useParams();
  const { getProject, getProjectMembers, getProjectTasks, getProjectContributions, getProjectActivity, getUser, mode } = useApp();
  const project = projectId ? getProject(projectId) : undefined;

  if (!project) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16">
        <EmptyState icon={<AlertCircle className="h-6 w-6" />} title="Project not found" description="This project may have been deleted." />
      </div>
    );
  }

  const members = getProjectMembers(project.id);
  const tasks = getProjectTasks(project.id);
  const contributions = getProjectContributions(project.id);
  const activity = getProjectActivity(project.id);
  const openTasks = tasks.filter((t) => t.status === 'OPEN').length;
  const completedTasks = tasks.filter((t) => t.status === 'ONCHAIN' || t.status === 'DEMO_ALLOCATED').length;

  const tabs = [
    { to: `/projects/${project.id}`, label: 'Overview', icon: Layers, end: true },
    { to: `/projects/${project.id}/tasks`, label: 'Tasks', icon: GitBranch },
    { to: `/projects/${project.id}/contributions`, label: 'Contributions', icon: GitPullRequest },
    { to: `/projects/${project.id}/members`, label: 'Members', icon: Users },
    { to: `/projects/${project.id}/ownership`, label: 'Ownership', icon: Award },
    { to: `/projects/${project.id}/activity`, label: 'Activity', icon: Activity },
    { to: `/projects/${project.id}/settings`, label: 'Settings', icon: Settings },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <Link to="/projects" className="flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900 mb-4">
        <ArrowLeft className="h-4 w-4" /> All Projects
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold text-ink-900">{project.name}</h1>
            <Badge tone="neutral" size="sm">{project.category}</Badge>
            {mode === 'demo' && <Badge tone="warning" size="sm" dot>Demo</Badge>}
          </div>
          <p className="text-sm text-ink-500 max-w-2xl">{project.description}</p>
          <div className="flex items-center gap-3 mt-3">
            <Badge tone={project.githubRepoName ? 'success' : 'neutral'} size="sm" dot>
              {project.githubRepoName ? `GitHub: ${project.githubRepoOwner}/${project.githubRepoName}` : 'GitHub not connected'}
            </Badge>
            <Badge tone={project.solanaProjectPda ? 'brand' : 'neutral'} size="sm" dot>
              {project.solanaProjectPda ? 'Solana initialized' : 'Solana not started'}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link to={`/projects/${project.id}/tasks/new`}>
            <Button variant="secondary" size="sm" leftIcon={<GitBranch className="h-4 w-4" />}>New Task</Button>
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-ink-200 mb-6">
        <nav className="flex items-center gap-1 overflow-x-auto -mb-px">
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                `inline-flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  isActive ? 'border-ink-900 text-ink-900' : `border-transparent ${TAB_COLOR} hover:text-ink-700`
                }`
              }
            >
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
            </NavLink>
          ))}
        </nav>
      </div>

      <Routes>
        <Route index element={<OverviewTab projectId={project.id} />} />
        <Route path="tasks" element={<TasksTab projectId={project.id} />} />
        <Route path="tasks/:taskId" element={<TasksTab projectId={project.id} />} />
        <Route path="contributions" element={<ContributionsTab projectId={project.id} />} />
        <Route path="contributions/:contributionId" element={<ContributionsTab projectId={project.id} />} />
        <Route path="members" element={<MembersTab projectId={project.id} />} />
        <Route path="ownership" element={<OwnershipTab projectId={project.id} />} />
        <Route path="activity" element={<ActivityTab projectId={project.id} />} />
        <Route path="settings" element={<SettingsTab projectId={project.id} />} />
      </Routes>
    </div>
  );
}

// ─── Overview Tab ──────────────────────────────────────────────
function OverviewTab({ projectId }: { projectId: string }) {
  const { getProject, getProjectMembers, getProjectTasks, getProjectActivity, getUser } = useApp();
  const project = getProject(projectId)!;
  const members = getProjectMembers(project.id);
  const tasks = getProjectTasks(project.id);
  const activity = getProjectActivity(project.id).slice(0, 6);
  const openTasks = tasks.filter((t) => t.status === 'OPEN').length;
  const completedTasks = tasks.filter((t) => t.status === 'ONCHAIN' || t.status === 'DEMO_ALLOCATED').length;
  const pendingContributions = project && getProjectMembers(project.id);

  const cards = [
    { label: 'Allocated', value: bpsToPercentString(poolBreakdown(project).allocatedBps), icon: Award, tone: 'brand' },
    { label: 'Remaining Pool', value: bpsToPercentString(poolBreakdown(project).remainingBps), icon: TrendingUp, tone: 'accent' },
    { label: 'Open Tasks', value: openTasks.toString(), icon: GitBranch, tone: 'info' },
    { label: 'Completed', value: completedTasks.toString(), icon: CheckCircle, tone: 'success' },
    { label: 'Team Members', value: members.length.toString(), icon: Users, tone: 'warning' },
    { label: 'GitHub Repo', value: project.githubRepoName || '—', icon: GitPullRequest, tone: 'neutral' },
  ];

  const segments: OwnershipSegment[] = members
    .filter((m) => m.ownershipBps > 0)
    .map((m, i) => {
      const user = getUser(m.userId);
      const colors = ['bg-brand-500', 'bg-accent-500', 'bg-info-500', 'bg-warning-500', 'bg-error-500'];
      return {
        label: user?.githubUsername || (m.role === 'OWNER' ? 'Founder' : 'Contributor'),
        bps: m.ownershipBps,
        color: colors[i % colors.length],
      };
    });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardBody className="p-4">
              <div className="flex items-center gap-3">
                <div className={`h-9 w-9 rounded-lg bg-${c.tone}-50 flex items-center justify-center shrink-0`}>
                  <c.icon className={`h-4 w-4 text-${c.tone}-500`} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-ink-400">{c.label}</p>
                  <p className="text-sm font-semibold text-ink-900 truncate">{c.value}</p>
                </div>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      <OnchainProjectPanel project={project} />

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Ownership Distribution</CardTitle></CardHeader>
          <CardBody>
            {segments.length > 0 ? (
              <OwnershipBar segments={segments} total={BPS_TOTAL} />
            ) : (
              <p className="text-sm text-ink-400 py-8 text-center">No ownership allocated yet. Approve a contribution to allocate.</p>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>Recent Activity</CardTitle></CardHeader>
          <CardBody className="p-0">
            <div className="divide-y divide-ink-100">
              {activity.length === 0 ? (
                <p className="text-sm text-ink-400 p-5 text-center">No activity yet.</p>
              ) : (
                activity.map((log) => (
                  <div key={log.id} className="px-5 py-3 flex items-center justify-between gap-2">
                    <span className="text-sm text-ink-700">{log.eventType.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())}</span>
                    <span className="text-xs text-ink-400">{timeAgo(log.createdAt)}</span>
                  </div>
                ))
              )}
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

// ─── Tasks Tab ─────────────────────────────────────────────────
function TasksTab({ projectId }: { projectId: string }) {
  const { getProject, getProjectTasks, getUser, claimTask, remainingPool } = useApp();
  const project = getProject(projectId)!;
  const tasks = getProjectTasks(project.id);
  const { taskId } = useParams<{ taskId?: string }>();
  const [filter, setFilter] = useState<string>('ALL');
  const [claimModal, setClaimModal] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'reward' | 'date' | 'status'>('date');

  if (taskId) return <TaskDetail projectId={projectId} taskId={taskId} />;

  const filtered = tasks.filter((t) => filter === 'ALL' || t.status === filter);
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'reward') return b.rewardBps - a.rewardBps;
    if (sortBy === 'status') return a.status.localeCompare(b.status);
    return b.createdAt.localeCompare(a.createdAt);
  });

  const remaining = remainingPool(project.id);

  return (
    <div className="space-y-6">
      {/* Pool summary */}
      <Card>
        <CardBody className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-ink-900">Development Pool</h3>
            <span className="text-sm font-mono text-ink-500">{bpsToPercentString(remaining)} remaining</span>
          </div>
          <div className="flex h-2 rounded-full overflow-hidden bg-ink-100">
            <div className="bg-accent-500" style={{ width: `${(project.devPoolBps - remaining) / project.devPoolBps * 100}%` }} />
          </div>
          <div className="flex items-center justify-between mt-2 text-xs text-ink-400">
            <span>Committed: {bpsToPercentString(project.devPoolBps - remaining)}</span>
            <span>Total Pool: {bpsToPercentString(project.devPoolBps)}</span>
          </div>
        </CardBody>
      </Card>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {['ALL', 'OPEN', 'CLAIMED', 'SUBMITTED', 'AI_REVIEW', 'PENDING_APPROVAL', 'APPROVED', 'ONCHAIN', 'DEMO_ALLOCATED', 'REJECTED', 'EXPIRED'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
              filter === f ? 'bg-ink-900 text-white' : 'bg-white border border-ink-200 text-ink-600 hover:bg-ink-50'
            }`}
          >
            {f === 'ALL' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}
          </button>
        ))}
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          className="ml-auto text-xs border border-ink-200 rounded-lg px-2 py-1 bg-white">
          <option value="date">Sort: Date</option>
          <option value="reward">Sort: Reward</option>
          <option value="status">Sort: Status</option>
        </select>
      </div>

      {/* Tasks */}
      {sorted.length === 0 ? (
        <Card><EmptyState icon={<GitBranch className="h-6 w-6" />} title="No tasks found" description="Create a task to start allocating ownership rewards." /></Card>
      ) : (
        <div className="space-y-3">
          {sorted.map((task) => {
            const assignee = task.assignedUserId ? getUser(task.assignedUserId) : null;
            return (
              <Link key={task.id} to={`/projects/${project.id}/tasks/${task.id}`}>
                <Card hover className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-ink-400">{task.externalKey}</span>
                        <h3 className="font-semibold text-ink-900 truncate">{task.title}</h3>
                      </div>
                      <p className="text-sm text-ink-500 line-clamp-1">{task.description}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-ink-400">
                        <Badge tone="brand" size="sm">{bpsToPercentString(task.rewardBps)} reward</Badge>
                        {assignee && <span>Assigned to {assignee.githubUsername}</span>}
                        <Badge tone="neutral" size="sm">{task.difficulty}</Badge>
                      </div>
                    </div>
                    <TaskStatusBadge status={task.status} />
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      {/* Claim modal */}
      {claimModal && (
        <Modal
          open
          onClose={() => setClaimModal(null)}
          title="Claim Task"
          description="You will be assigned to this task. Other developers won't be able to claim it."
          footer={
            <>
              <Button variant="outline" onClick={() => setClaimModal(null)}>Cancel</Button>
              <Button variant="secondary" onClick={() => { claimTask(claimModal); setClaimModal(null); }}>Confirm Claim</Button>
            </>
          }
        >
          <p className="text-sm text-ink-600">Are you sure you want to claim this task?</p>
        </Modal>
      )}
    </div>
  );
}

// ─── Task Detail ───────────────────────────────────────────────
function TaskDetail({ projectId, taskId }: { projectId: string; taskId: string }) {
  const { getTask, getProject, getUser, claimTask, getProjectContributions, getPR } = useApp();
  const task = getTask(taskId);
  const project = getProject(projectId)!;
  const navigate = useNavigate();
  const [claimModal, setClaimModal] = useState(false);
  const [claiming, setClaiming] = useState(false);

  if (!task) return <EmptyState icon={<AlertCircle className="h-6 w-6" />} title="Task not found" description="This task may have been deleted." />;

  const assignee = task.assignedUserId ? getUser(task.assignedUserId) : null;
  const contribution = getProjectContributions(projectId).find((c) => c.taskId === taskId);
  const pr = contribution && contribution.pullRequestId ? getPR(contribution.pullRequestId) : null;

  const handleClaim = () => {
    setClaiming(true);
    try {
      claimTask(taskId);
      setClaimModal(false);
    } finally {
      setClaiming(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link to={`/projects/${project.id}/tasks`} className="flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900">
        <ArrowLeft className="h-4 w-4" /> Back to Tasks
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Badge tone="neutral" size="sm" className="font-mono">{task.externalKey}</Badge>
            <TaskStatusBadge status={task.status} />
            <Badge tone="brand" size="sm">{bpsToPercentString(task.rewardBps)} reward</Badge>
          </div>
          <h1 className="text-xl font-bold text-ink-900">{task.title}</h1>
        </div>
        {task.status === 'OPEN' && (
          <Button variant="secondary" onClick={() => setClaimModal(true)} leftIcon={<GitBranch className="h-4 w-4" />}>Claim Task</Button>
        )}
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader><CardTitle>Description</CardTitle></CardHeader>
            <CardBody><p className="text-sm text-ink-700 whitespace-pre-wrap">{task.description}</p></CardBody>
          </Card>

          <Card>
            <CardHeader><CardTitle>Acceptance Criteria</CardTitle></CardHeader>
            <CardBody>
              <p className="text-sm text-ink-700 whitespace-pre-wrap">{task.acceptanceCriteria}</p>
            </CardBody>
          </Card>

          {/* GitHub info */}
          {pr && (
            <Card>
              <CardHeader><CardTitle>GitHub Pull Request</CardTitle></CardHeader>
              <CardBody className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <GitPullRequest className="h-4 w-4 text-ink-400" />
                    <span className="text-sm font-medium text-ink-900">#{pr.githubPrNumber}</span>
                    <span className="text-sm text-ink-600">{pr.title}</span>
                  </div>
                  {pr.merged ? <Badge tone="success" size="sm" dot>Merged</Badge> : <Badge tone="neutral" size="sm">{pr.state}</Badge>}
                </div>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div><span className="text-ink-400">Additions</span><p className="font-mono text-accent-600">+{pr.additions}</p></div>
                  <div><span className="text-ink-400">Deletions</span><p className="font-mono text-error-600">-{pr.deletions}</p></div>
                  <div><span className="text-ink-400">Changed files</span><p className="font-mono text-ink-700">{pr.changedFiles}</p></div>
                </div>
                <a href={pr.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-brand-600 hover:text-brand-700">
                  View on GitHub <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </CardBody>
            </Card>
          )}

          {/* Contribution link */}
          {contribution && (
            <Card>
              <CardHeader><CardTitle>Contribution</CardTitle></CardHeader>
              <CardBody>
                <Link to={`/projects/${project.id}/contributions/${contribution.id}`}>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-ink-50 hover:bg-ink-100 transition-colors">
                    <div className="flex items-center gap-3">
                      <Brain className="h-5 w-5 text-accent-500" />
                      <div>
                        <p className="text-sm font-medium text-ink-900">AI Score: {contribution.aiScore}/100</p>
                        <p className="text-xs text-ink-400">{contribution.verificationReason?.slice(0, 60)}...</p>
                      </div>
                    </div>
                    <ContributionStatusBadge status={contribution.status} />
                  </div>
                </Link>
              </CardBody>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card>
            <CardBody className="p-4 space-y-3">
              <div>
                <p className="text-xs text-ink-400 mb-1">Reward</p>
                <p className="text-lg font-bold text-ink-900">{bpsToPercentString(task.rewardBps)}</p>
                <p className="text-xs font-mono text-ink-400">{task.rewardBps} bps</p>
              </div>
              <div>
                <p className="text-xs text-ink-400 mb-1">Difficulty</p>
                <Badge tone="neutral" size="sm">{task.difficulty}</Badge>
              </div>
              <div>
                <p className="text-xs text-ink-400 mb-1">Assignee</p>
                <p className="text-sm text-ink-700">{assignee?.githubUsername || 'Unassigned'}</p>
              </div>
              {task.deadline && (
                <div>
                  <p className="text-xs text-ink-400 mb-1">Deadline</p>
                  <p className="text-sm text-ink-700 flex items-center gap-1"><Clock className="h-3 w-3" /> {new Date(task.deadline).toLocaleDateString()}</p>
                </div>
              )}
              {task.githubIssueNumber && (
                <div>
                  <p className="text-xs text-ink-400 mb-1">GitHub Issue</p>
                  <p className="text-sm text-ink-700">#{task.githubIssueNumber}</p>
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      <Modal
        open={claimModal}
        onClose={() => setClaimModal(false)}
        title="Claim Task"
        description="You will be assigned to this task. Other developers won't be able to claim it."
        footer={
          <>
            <Button variant="outline" onClick={() => setClaimModal(false)}>Cancel</Button>
            <Button variant="secondary" loading={claiming} onClick={handleClaim}>Confirm Claim</Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-ink-600">You are about to claim:</p>
          <div className="p-3 rounded-lg bg-ink-50">
            <p className="text-sm font-medium text-ink-900">{task.externalKey}: {task.title}</p>
            <p className="text-xs text-ink-500 mt-1">Reward: {bpsToPercentString(task.rewardBps)}</p>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─── Contributions Tab ─────────────────────────────────────────
function ContributionsTab({ projectId }: { projectId: string }) {
  const { getProject, getProjectContributions, getUser, getTask, getPR, getContribution } = useApp();
  const project = getProject(projectId)!;
  const contributions = getProjectContributions(project.id);
  const { contributionId } = useParams<{ contributionId?: string }>();

  if (contributionId) {
    const contrib = getContribution(contributionId);
    if (contrib) return <ContributionDetail projectId={projectId} contributionId={contributionId} />;
  }

  return (
    <div className="space-y-4">
      {contributions.length === 0 ? (
        <Card><EmptyState icon={<GitPullRequest className="h-6 w-6" />} title="No contributions yet" description="When a pull request is merged, a contribution will appear here." /></Card>
      ) : (
        contributions.map((contrib) => {
          const user = getUser(contrib.userId);
          const task = getTask(contrib.taskId);
          const pr = contrib.pullRequestId ? getPR(contrib.pullRequestId) : undefined;
          return (
            <Link key={contrib.id} to={`/projects/${project.id}/contributions/${contrib.id}`}>
              <Card hover className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-ink-900">{task?.externalKey}: {task?.title}</h3>
                    </div>
                    <p className="text-sm text-ink-500">By {user?.githubUsername || 'Unknown'} · PR #{pr?.githubPrNumber}</p>
                    <div className="flex items-center gap-2 mt-2">
                      {contrib.aiScore !== null && (
                        <Badge tone="success" size="sm">AI Score: {contrib.aiScore}/100</Badge>
                      )}
                      {contrib.aiRecommendation && <AIRecommendationBadge recommendation={contrib.aiRecommendation} size="sm" />}
                      <Badge tone="brand" size="sm">{bpsToPercentString(contrib.rewardBps)}</Badge>
                    </div>
                  </div>
                  <ContributionStatusBadge status={contrib.status} />
                </div>
              </Card>
            </Link>
          );
        })
      )}
    </div>
  );
}

// ─── Contribution Detail ───────────────────────────────────────
function ContributionDetail({ projectId, contributionId }: { projectId: string; contributionId: string }) {
  const { getContribution, getTask, getUser, getPR, approveContribution, rejectContribution, mode, db } = useApp();
  const contrib = getContribution(contributionId);
  const navigate = useNavigate();
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showApproveModal, setShowApproveModal] = useState(false);

  if (!contrib) return <EmptyState icon={<AlertCircle className="h-6 w-6" />} title="Contribution not found" description="This contribution may have been deleted." />;

  const task = getTask(contrib.taskId);
  const user = getUser(contrib.userId);
  const pr = contrib.pullRequestId ? getPR(contrib.pullRequestId) : undefined;
  const evaluation = db.evaluations.find((e) => e.contributionId === contrib.id);
  const canApprove = contrib.status === 'PENDING_APPROVAL';
  const settlement = contrib.settlement;

  const handleApprove = async () => {
    setApproving(true);
    setError(null);
    try {
      await approveContribution(contributionId);
      setShowApproveModal(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to approve');
    } finally {
      setApproving(false);
    }
  };

  const handleReject = () => {
    setRejecting(true);
    try { rejectContribution(contributionId); } finally { setRejecting(false); }
  };

  const scores = evaluation
    ? [
        { label: 'Requirements', score: evaluation.requirementScore },
        { label: 'Code Quality', score: evaluation.qualityScore },
        { label: 'Tests', score: evaluation.testScore },
        { label: 'Security', score: evaluation.securityScore },
      ]
    : [];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link to={`/projects/${projectId}/contributions`} className="flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900">
        <ArrowLeft className="h-4 w-4" /> Back to Contributions
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <ContributionStatusBadge status={contrib.status} />
            {contrib.aiRecommendation && <AIRecommendationBadge recommendation={contrib.aiRecommendation} />}
          </div>
          <h1 className="text-xl font-bold text-ink-900">{task?.externalKey}: {task?.title}</h1>
          <p className="text-sm text-ink-500 mt-1">By {user?.githubUsername || 'Unknown'}</p>
        </div>
        <Badge tone="brand" size="md">{bpsToPercentString(contrib.rewardBps)} reward</Badge>
      </div>

      {/* AI Verification */}
      {evaluation && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>AI Verification</CardTitle>
              <div className="flex items-center gap-2">
                <span className="text-xs text-ink-400 font-mono">{evaluation.promptVersion}</span>
                <Badge tone="neutral" size="sm">{evaluation.model}</Badge>
              </div>
            </div>
          </CardHeader>
          <CardBody className="space-y-5">
            {/* Overall score */}
            <div className="flex items-center gap-6">
              <div className="relative h-24 w-24 shrink-0">
                <svg viewBox="0 0 96 96" className="-rotate-90">
                  <circle cx="48" cy="48" r="40" fill="none" stroke="#e2e8f0" strokeWidth="8" />
                  <circle cx="48" cy="48" r="40" fill="none" stroke="#10b981" strokeWidth="8"
                    strokeDasharray={`${2 * Math.PI * 40 * (evaluation.overallScore / 100)} ${2 * Math.PI * 40}`} strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold text-ink-900">{evaluation.overallScore}</span>
                  <span className="text-[10px] text-ink-400">/100</span>
                </div>
              </div>
              <div className="flex-1 space-y-2">
                {scores.map((s) => (
                  <div key={s.label}>
                    <div className="flex items-center justify-between text-xs mb-0.5">
                      <span className="text-ink-600">{s.label}</span>
                      <span className="font-mono text-ink-700">{s.score}/100</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-ink-100 overflow-hidden">
                      <div className="h-full rounded-full bg-accent-500 transition-all duration-500" style={{ width: `${s.score}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs text-ink-400 mb-1">Recommendation</p>
              <AIRecommendationBadge recommendation={evaluation.recommendation} size="md" />
            </div>

            <div>
              <p className="text-xs text-ink-400 mb-1">Reason</p>
              <p className="text-sm text-ink-700">{contrib.verificationReason}</p>
            </div>

            <div>
              <p className="text-xs text-ink-400 mb-1">Code Summary</p>
              <p className="text-sm text-ink-700">{evaluation.codeSummary}</p>
            </div>

            <div className="flex items-center justify-between text-xs text-ink-400 pt-2 border-t border-ink-100">
              <span>Verified: {new Date(contrib.verifiedAt || contrib.createdAt).toLocaleString()}</span>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Evidence */}
      <Card>
        <CardHeader><CardTitle>Evidence</CardTitle></CardHeader>
        <CardBody className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-ink-400 mb-1">Pull Request</p>
              <p className="text-ink-700">#{pr?.githubPrNumber}: {pr?.title}</p>
            </div>
            <div>
              <p className="text-xs text-ink-400 mb-1">Repository</p>
              <p className="text-ink-700">{pr?.repository}</p>
            </div>
            <div>
              <p className="text-xs text-ink-400 mb-1">Evidence Hash</p>
              <div className="flex items-center gap-2">
                <span className="text-ink-700 font-mono text-xs">{contrib.evidenceHash ? shortHash(contrib.evidenceHash) : 'Not sealed yet'}</span>
                <CopyButton text={contrib.evidenceHash || ''} />
              </div>
            </div>
            <div>
              <p className="text-xs text-ink-400 mb-1">Commit</p>
              <p className="text-ink-700 font-mono text-xs">a1b2c3d4e5f6</p>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* On-chain result */}
      {settlement && (
        <Card className="border-accent-200">
          <CardHeader><CardTitle>Ownership Allocation</CardTitle></CardHeader>
          <CardBody className="space-y-3">
            {settlement.kind === 'demo' ? (
              <div className="flex items-center gap-2 text-sm text-warning-700 bg-warning-50 rounded-lg px-3 py-2">
                <AlertCircle className="h-4 w-4" />
                Demo ownership allocation. No transaction was sent to Solana, so there is no signature.
              </div>
            ) : (
              <div className="space-y-2">
                <div>
                  <p className="text-xs text-ink-400 mb-1">Transaction Signature</p>
                  <div className="flex items-center gap-2">
                    <span className="text-ink-700 font-mono text-xs">{shortHash(settlement.signature, 10, 8)}</span>
                    <CopyButton text={settlement.signature} />
                  </div>
                </div>
                <a href={explorerTxUrl(settlement.signature, settlement.network)} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-brand-600 hover:text-brand-700">
                  View on Solana Explorer <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {/* Actions */}
      {canApprove && (
        <Card className="border-warning-200 bg-warning-50/30">
          <CardBody className="flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-warning-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-ink-900">Contribution requires approval</p>
                <p className="text-xs text-ink-500 mt-0.5">AI recommendation is advisory. Final approval is performed by authorized project authority.</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="danger" size="sm" loading={rejecting} onClick={handleReject} leftIcon={<XCircle className="h-4 w-4" />}>Reject</Button>
              <Button variant="success" size="sm" onClick={() => setShowApproveModal(true)} leftIcon={<CheckCircle className="h-4 w-4" />}>Approve</Button>
            </div>
          </CardBody>
        </Card>
      )}

      {error && (
        <div className="flex items-center gap-2 text-sm text-error-600 bg-error-50 rounded-lg px-4 py-3 border border-error-200">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      )}

      {/* Approve modal */}
      <Modal
        open={showApproveModal}
        onClose={() => setShowApproveModal(false)}
        title="Approve Contribution"
        description="This will allocate ownership to the contributor."
        footer={
          <>
            <Button variant="outline" onClick={() => setShowApproveModal(false)}>Cancel</Button>
            <Button variant="success" loading={approving} onClick={handleApprove}>Approve & Allocate</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between"><span className="text-ink-400">Developer</span><span className="text-ink-900 font-medium">{user?.githubUsername}</span></div>
            <div className="flex items-center justify-between"><span className="text-ink-400">Task</span><span className="text-ink-900 font-medium">{task?.title}</span></div>
            <div className="flex items-center justify-between"><span className="text-ink-400">Reward</span><span className="text-ink-900 font-medium">{bpsToPercentString(contrib.rewardBps)}</span></div>
            <div className="flex items-center justify-between"><span className="text-ink-400">AI Score</span><span className="text-ink-900 font-medium">{contrib.aiScore}/100</span></div>
            <div className="flex items-center justify-between"><span className="text-ink-400">Evidence Hash</span><span className="text-ink-900 font-mono text-xs">{contrib.evidenceHash ? shortHash(contrib.evidenceHash) : '-'}</span></div>
          </div>
          <div className="flex items-start gap-2 text-xs text-warning-700 bg-warning-50 rounded-lg px-3 py-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            {mode === 'demo'
              ? 'Demo Mode: ownership allocation will be simulated. No real blockchain transaction will occur.'
              : 'This will submit a real Solana Devnet transaction to allocate ownership on-chain.'}
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─── Members Tab ───────────────────────────────────────────────
function MembersTab({ projectId }: { projectId: string }) {
  const { getProject, getProjectMembers, getUser, db } = useApp();
  const project = getProject(projectId)!;
  const members = getProjectMembers(project.id);

  return (
    <Card>
      <CardBody className="p-0">
        {members.length === 0 ? (
          <EmptyState icon={<Users className="h-6 w-6" />} title="No members" description="Members appear when they claim tasks or receive ownership." />
        ) : (
          <div className="divide-y divide-ink-100">
            {members.map((m) => {
              const user = getUser(m.userId);
              const contribs = db.contributions.filter((c) => c.userId === m.userId && c.projectId === project.id);
              const completedTasks = db.tasks.filter((t) => t.assignedUserId === m.userId && t.projectId === project.id && (t.status === 'ONCHAIN' || t.status === 'DEMO_ALLOCATED'));
              return (
                <div key={m.id} className="px-5 py-4 flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-ink-200 flex items-center justify-center text-ink-600 font-medium text-sm shrink-0">
                    {(user?.githubUsername || '?')[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-ink-900">{user?.githubUsername || 'Unknown'}</p>
                      <Badge tone={m.role === 'OWNER' ? 'brand' : 'neutral'} size="sm">{m.role}</Badge>
                    </div>
                    <p className="text-xs text-ink-400 font-mono">{user?.walletAddress.slice(0, 12)}...</p>
                  </div>
                  <div className="flex items-center gap-6 text-sm">
                    <div className="text-center">
                      <p className="text-ink-900 font-semibold">{bpsToPercentString(m.ownershipBps)}</p>
                      <p className="text-xs text-ink-400">Ownership</p>
                    </div>
                    <div className="text-center">
                      <p className="text-ink-900 font-semibold">{contribs.length}</p>
                      <p className="text-xs text-ink-400">Contributions</p>
                    </div>
                    <div className="text-center">
                      <p className="text-ink-900 font-semibold">{completedTasks.length}</p>
                      <p className="text-xs text-ink-400">Completed</p>
                    </div>
                    <div className="text-center">
                      <p className="text-ink-400 font-semibold text-xs">v0.2</p>
                      <p className="text-xs text-ink-400">BuildScore</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

// ─── Ownership Tab ─────────────────────────────────────────────
function OwnershipTab({ projectId }: { projectId: string }) {
  const { getProject, getProjectMembers, getUser, db } = useApp();
  const project = getProject(projectId)!;
  const members = getProjectMembers(project.id);

  const segments: OwnershipSegment[] = members
    .filter((m) => m.ownershipBps > 0)
    .map((m, i) => {
      const user = getUser(m.userId);
      const colors = ['#0891b2', '#10b981', '#3b82f6', '#f59e0b', '#ef4444'];
      return {
        label: user?.githubUsername || (m.role === 'OWNER' ? 'Founder' : 'Contributor'),
        bps: m.ownershipBps,
        color: colors[i % colors.length],
      };
    });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Total Ownership</CardTitle></CardHeader>
        <CardBody>
          <div className="flex items-center justify-between mb-4">
            <span className="text-2xl font-bold text-ink-900">{poolBreakdown(project).totalOwnedBps} / {BPS_TOTAL} BPS</span>
            <span className="text-sm text-ink-400">{bpsToPercentString(poolBreakdown(project).allocatedBps)} allocated to contributors</span>
          </div>
          <OwnershipDonut segments={segments} total={BPS_TOTAL} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>Ownership Table</CardTitle></CardHeader>
        <CardBody className="p-0">
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-200 text-xs text-ink-400 uppercase tracking-wide">
                  <th className="text-left px-5 py-3 font-medium">Contributor</th>
                  <th className="text-left px-5 py-3 font-medium">Wallet</th>
                  <th className="text-right px-5 py-3 font-medium">Ownership</th>
                  <th className="text-right px-5 py-3 font-medium">Allocations</th>
                  <th className="text-right px-5 py-3 font-medium">Contributions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {members.map((m) => {
                  const user = getUser(m.userId);
                  const contribs = db.contributions.filter((c) => c.userId === m.userId && c.projectId === project.id);
                  return (
                    <tr key={m.id} className="hover:bg-ink-50/50">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-ink-900">{user?.githubUsername || 'Unknown'}</span>
                          {m.role === 'OWNER' && <Badge tone="brand" size="sm">Owner</Badge>}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs text-ink-500">{shortAddress(user?.walletAddress || '')}</span>
                          <CopyButton text={user?.walletAddress || ''} />
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-ink-700">{bpsToPercentString(m.ownershipBps)}</td>
                      <td className="px-5 py-3 text-right font-mono text-ink-700">{m.allocationCount}</td>
                      <td className="px-5 py-3 text-right text-ink-700">{contribs.length}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* Mobile cards */}
          <div className="md:hidden divide-y divide-ink-100">
            {members.map((m) => {
              const user = getUser(m.userId);
              const contribs = db.contributions.filter((c) => c.userId === m.userId && c.projectId === project.id);
              return (
                <div key={m.id} className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-ink-900">{user?.githubUsername || 'Unknown'}</span>
                    {m.role === 'OWNER' && <Badge tone="brand" size="sm">Owner</Badge>}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-xs text-ink-500">{shortAddress(user?.walletAddress || '')}</span>
                    <CopyButton text={user?.walletAddress || ''} />
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div><span className="text-ink-400">Ownership</span><p className="font-mono text-ink-700">{bpsToPercentString(m.ownershipBps)}</p></div>
                    <div><span className="text-ink-400">Allocations</span><p className="font-mono text-ink-700">{m.allocationCount}</p></div>
                    <div><span className="text-ink-400">Contribs</span><p className="text-ink-700">{contribs.length}</p></div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

// ─── Activity Tab ──────────────────────────────────────────────
function ActivityTab({ projectId }: { projectId: string }) {
  const { getProjectActivity, getUser } = useApp();
  const activity = getProjectActivity(projectId);

  return (
    <Card>
      <CardBody className="p-0">
        {activity.length === 0 ? (
          <EmptyState icon={<Activity className="h-6 w-6" />} title="No activity" description="Project events will appear here." />
        ) : (
          <div className="divide-y divide-ink-100">
            {activity.map((log) => {
              const user = log.userId ? getUser(log.userId) : null;
              return (
                <div key={log.id} className="px-5 py-4 flex items-start gap-4">
                  <div className="h-9 w-9 rounded-lg bg-ink-100 flex items-center justify-center shrink-0">
                    {activityIcon(log.eventType)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-ink-700">
                      <span className="font-medium text-ink-900">{user?.githubUsername || 'System'}</span>{' '}
                      {log.eventType.replace(/_/g, ' ').toLowerCase()}
                    </p>
                    {Object.keys(log.metadata).length > 0 && (
                      <p className="text-xs text-ink-400 mt-0.5 font-mono">
                        {Object.entries(log.metadata).map(([k, v]) => `${k}: ${v}`).join(', ')}
                      </p>
                    )}
                    <p className="text-xs text-ink-400 mt-0.5">{new Date(log.createdAt).toLocaleString()}</p>
                  </div>
                  {log.signature && (
                    <a href={explorerTxUrl(log.signature, log.network || 'devnet')} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 shrink-0">
                      TX <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

// ─── Settings Tab ──────────────────────────────────────────────
function SettingsTab({ projectId }: { projectId: string }) {
  const { getProject, providers, mode } = useApp();
  const project = getProject(projectId)!;
  const [showConnectRepo, setShowConnectRepo] = useState(false);
  const [repos, setRepos] = useState<{ id: string; fullName: string }[]>([]);
  const [loading, setLoading] = useState(false);

  const loadRepos = async () => {
    setLoading(true);
    try {
      const r = await providers.github.getInstallationRepositories();
      setRepos(r.map((x) => ({ id: x.id, fullName: x.fullName })));
      setShowConnectRepo(true);
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>GitHub Connection</CardTitle></CardHeader>
        <CardBody className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-ink-700">{project.githubRepoName ? `${project.githubRepoOwner}/${project.githubRepoName}` : 'No repository connected'}</p>
              <p className="text-xs text-ink-400 mt-0.5">{project.githubRepoName ? 'Connected and receiving webhooks' : 'Connect a repository to enable PR linking'}</p>
            </div>
            <Badge tone={project.githubRepoName ? 'success' : 'neutral'} size="sm" dot>{project.githubRepoName ? 'Connected' : 'Disconnected'}</Badge>
          </div>
          <Button variant="outline" size="sm" onClick={loadRepos} loading={loading}>Connect Repository</Button>
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>Solana</CardTitle></CardHeader>
        <CardBody className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-ink-700 font-mono">{project.solanaProjectPda || 'Not initialized'}</p>
              <p className="text-xs text-ink-400 mt-0.5">Project PDA on Solana Devnet</p>
            </div>
            <Badge tone={project.solanaProjectPda ? 'brand' : 'neutral'} size="sm" dot>{project.solanaProjectPda ? 'Initialized' : 'Not started'}</Badge>
          </div>
          {project.solanaProjectPda && <CopyButton text={project.solanaProjectPda} />}
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>Application Mode</CardTitle></CardHeader>
        <CardBody>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-ink-700">{mode === 'demo' ? 'Demo Mode' : 'Live Mode'}</p>
              <p className="text-xs text-ink-400 mt-0.5">{mode === 'demo' ? 'Simulated data — no real blockchain transactions' : 'Real Solana Devnet integration'}</p>
            </div>
            <Badge tone={mode === 'demo' ? 'warning' : 'success'} size="sm" dot>{mode === 'demo' ? 'Demo' : 'Live'}</Badge>
          </div>
        </CardBody>
      </Card>

      {showConnectRepo && (
        <Modal open onClose={() => setShowConnectRepo(false)} title="Connect Repository" description="Select a repository from your GitHub App installation.">
          <div className="space-y-2">
            {repos.map((r) => (
              <div key={r.id} className="flex items-center justify-between p-3 rounded-lg border border-ink-200 hover:bg-ink-50 cursor-pointer">
                <span className="text-sm font-mono text-ink-700">{r.fullName}</span>
                <Button size="sm" variant="secondary">Connect</Button>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}

function activityIcon(type: string) {
  const icons: Record<string, React.ReactNode> = {
    PROJECT_CREATED: <Layers className="h-4 w-4 text-brand-500" />,
    TASK_CREATED: <GitBranch className="h-4 w-4 text-info-500" />,
    TASK_CLAIMED: <TrendingUp className="h-4 w-4 text-info-500" />,
    PR_LINKED: <GitPullRequest className="h-4 w-4 text-warning-500" />,
    PR_MERGED: <GitPullRequest className="h-4 w-4 text-accent-500" />,
    AI_VERIFIED: <Brain className="h-4 w-4 text-accent-500" />,
    CONTRIBUTION_APPROVED: <CheckCircle className="h-4 w-4 text-accent-500" />,
    OWNERSHIP_ALLOCATED: <Award className="h-4 w-4 text-brand-500" />,
    CONTRIBUTION_REJECTED: <XCircle className="h-4 w-4 text-error-500" />,
  };
  return icons[type] || <Activity className="h-4 w-4 text-ink-400" />;
}
