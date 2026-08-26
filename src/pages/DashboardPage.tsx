import { Link } from 'react-router-dom';
import {
  FolderKanban, Percent, GitPullRequest, CheckCircle, TrendingUp,
  ArrowRight, Brain, Award, GitBranch,
} from 'lucide-react';
import { Card, CardBody, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { useApp } from '../store/app-context';
import { bpsToPercentString } from '../domain/bps';
import { TaskStatusBadge, ContributionStatusBadge } from '../components/StatusBadges';

export function DashboardPage() {
  const { db, getUser, getProjectMembers } = useApp();

  const totalProjects = db.projects.length;
  const totalOwnershipBps = db.members.reduce((s, m) => s + m.ownershipBps, 0);
  const pendingContributions = db.contributions.filter((c) => c.status === 'PENDING_APPROVAL' || c.status === 'AI_REVIEW').length;
  const completedContributions = db.contributions.filter((c) => c.status === 'ONCHAIN').length;

  const stats = [
    { label: 'Total Projects', value: totalProjects.toString(), icon: FolderKanban, tone: 'brand' as const },
    { label: 'Total Ownership', value: bpsToPercentString(totalOwnershipBps), icon: Percent, tone: 'accent' as const },
    { label: 'Pending Contributions', value: pendingContributions.toString(), icon: GitPullRequest, tone: 'warning' as const },
    { label: 'Completed', value: completedContributions.toString(), icon: CheckCircle, tone: 'success' as const },
  ];

  const recentActivity = db.auditLogs.slice(0, 8);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Dashboard</h1>
          <p className="text-sm text-ink-500 mt-1">Overview of your projects and contributions.</p>
        </div>
        <Link to="/projects/new">
          <Button variant="secondary" size="md" leftIcon={<FolderKanban className="h-4 w-4" />}>New Project</Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardBody className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-ink-400 font-medium uppercase tracking-wide">{stat.label}</p>
                  <p className="text-2xl font-bold text-ink-900 mt-1">{stat.value}</p>
                </div>
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center bg-${stat.tone}-50`}>
                  <stat.icon className={`h-5 w-5 text-${stat.tone}-500`} />
                </div>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Projects */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-ink-900">Projects</h2>
            <Link to="/projects" className="text-sm text-brand-600 hover:text-brand-700 flex items-center gap-1">
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          {db.projects.length === 0 ? (
            <Card>
              <EmptyState
                icon={<FolderKanban className="h-6 w-6" />}
                title="No projects yet"
                description="Create your first project to start allocating ownership."
                action={<Link to="/projects/new"><Button variant="secondary">Create Project</Button></Link>}
              />
            </Card>
          ) : (
            <div className="space-y-4">
              {db.projects.map((project) => {
                const members = getProjectMembers(project.id);
                const tasks = db.tasks.filter((t) => t.projectId === project.id);
                const openTasks = tasks.filter((t) => t.status === 'OPEN').length;
                return (
                  <Link key={project.id} to={`/projects/${project.id}`}>
                    <Card hover className="p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-ink-900 truncate">{project.name}</h3>
                            <Badge tone="neutral" size="sm">{project.category}</Badge>
                          </div>
                          <p className="text-sm text-ink-500 line-clamp-2">{project.description}</p>
                          <div className="flex items-center gap-4 mt-3 text-xs text-ink-400">
                            <span className="flex items-center gap-1"><Award className="h-3.5 w-3.5" /> {bpsToPercentString(project.ownershipAllocated)} allocated</span>
                            <span className="flex items-center gap-1"><FolderKanban className="h-3.5 w-3.5" /> {members.length} members</span>
                            <span className="flex items-center gap-1"><GitBranch className="h-3.5 w-3.5" /> {openTasks} open tasks</span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          <Badge tone={project.githubRepoName ? 'success' : 'neutral'} size="sm" dot>
                            {project.githubRepoName ? 'GitHub' : 'No GitHub'}
                          </Badge>
                          <Badge tone={project.solanaProjectPda ? 'brand' : 'neutral'} size="sm" dot>
                            {project.solanaProjectPda ? 'Solana' : 'No Solana'}
                          </Badge>
                        </div>
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent activity */}
        <div>
          <h2 className="text-lg font-semibold text-ink-900 mb-4">Recent Activity</h2>
          <Card>
            <CardBody className="p-0">
              {recentActivity.length === 0 ? (
                <p className="text-sm text-ink-400 p-5 text-center">No activity yet.</p>
              ) : (
                <div className="divide-y divide-ink-100">
                  {recentActivity.map((log) => {
                    const user = log.userId ? getUser(log.userId) : null;
                    return (
                      <div key={log.id} className="px-5 py-3 flex items-start gap-3">
                        <div className="h-8 w-8 rounded-lg bg-ink-100 flex items-center justify-center shrink-0">
                          {activityIcon(log.eventType)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-ink-700">
                            {activityLabel(log.eventType, user?.githubUsername || 'System')}
                          </p>
                          <p className="text-xs text-ink-400 mt-0.5">{timeAgo(log.createdAt)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

function activityIcon(type: string) {
  const icons: Record<string, React.ReactNode> = {
    PROJECT_CREATED: <FolderKanban className="h-4 w-4 text-brand-500" />,
    TASK_CREATED: <GitBranch className="h-4 w-4 text-info-500" />,
    TASK_CLAIMED: <TrendingUp className="h-4 w-4 text-info-500" />,
    PR_LINKED: <GitPullRequest className="h-4 w-4 text-warning-500" />,
    PR_MERGED: <GitPullRequest className="h-4 w-4 text-accent-500" />,
    AI_VERIFIED: <Brain className="h-4 w-4 text-accent-500" />,
    CONTRIBUTION_APPROVED: <CheckCircle className="h-4 w-4 text-accent-500" />,
    OWNERSHIP_ALLOCATED: <Award className="h-4 w-4 text-brand-500" />,
    CONTRIBUTION_REJECTED: <GitPullRequest className="h-4 w-4 text-error-500" />,
  };
  return icons[type] || <CheckCircle className="h-4 w-4 text-ink-400" />;
}

function activityLabel(type: string, actor: string): string {
  const labels: Record<string, string> = {
    PROJECT_CREATED: `${actor} created project`,
    TASK_CREATED: `${actor} created task`,
    TASK_CLAIMED: `${actor} claimed a task`,
    PR_LINKED: `GitHub PR linked`,
    PR_MERGED: `PR merged on GitHub`,
    AI_VERIFIED: `AI verification completed`,
    CONTRIBUTION_APPROVED: `${actor} approved a contribution`,
    OWNERSHIP_ALLOCATED: `Ownership allocated`,
    CONTRIBUTION_REJECTED: `${actor} rejected a contribution`,
  };
  return labels[type] || type;
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mo = Math.floor(day / 30);
  return `${mo}mo ago`;
}
