import { useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, AlertCircle } from 'lucide-react';
import { Card, CardBody, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input, Textarea, Select } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { useApp } from '../store/app-context';
import { bpsToPercentString } from '../domain/bps';
import type { Difficulty } from '../domain/types';

export function TaskNewPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { getProject, createTask, remainingPool, getProjectTasks } = useApp();
  const project = projectId ? getProject(projectId) : undefined;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [acceptanceCriteria, setAcceptanceCriteria] = useState('');
  const [rewardPct, setRewardPct] = useState(5);
  const [difficulty, setDifficulty] = useState<Difficulty>('intermediate');
  const [deadline, setDeadline] = useState('');
  const [githubIssueNumber, setGithubIssueNumber] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!project) {
    return <div className="max-w-3xl mx-auto px-4 py-16"><p className="text-sm text-ink-500">Project not found.</p></div>;
  }

  const rewardBps = Math.round(rewardPct * 100);
  const remaining = remainingPool(project.id);
  const tasks = getProjectTasks(project.id);
  const committedBps = tasks
    .filter((t) => ['OPEN', 'CLAIMED', 'SUBMITTED', 'AI_REVIEW', 'PENDING_APPROVAL', 'APPROVED', 'PENDING_ONCHAIN', 'ONCHAIN_FAILED', 'REJECTED', 'EXPIRED'].includes(t.status))
    .reduce((s, t) => s + t.rewardBps, 0);
  const overflows = rewardBps > remaining;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!title.trim()) { setError('Title is required.'); return; }
    if (overflows) { setError(`Reward exceeds remaining pool (${bpsToPercentString(remaining)} available).`); return; }
    try {
      const task = createTask({
        projectId: project.id,
        title: title.trim(),
        description: description.trim(),
        acceptanceCriteria: acceptanceCriteria.trim(),
        rewardBps,
        difficulty,
        deadline: deadline || null,
        githubIssueNumber: githubIssueNumber ? Number(githubIssueNumber) : null,
      });
      navigate(`/projects/${project.id}/tasks/${task.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create task');
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <Link to={`/projects/${project.id}/tasks`} className="flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900 mb-6">
        <ArrowLeft className="h-4 w-4" /> Back to Tasks
      </Link>

      <h1 className="text-2xl font-bold text-ink-900 mb-2">Create Task</h1>
      <p className="text-sm text-ink-500 mb-8">Define a development task with an ownership reward.</p>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Task Details</CardTitle>
            <CardDescription>What needs to be done and what the reward is.</CardDescription>
          </CardHeader>
          <CardBody className="space-y-4">
            <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Implement Solana Escrow" />
            <Textarea label="Description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the task..." rows={3} />
            <Textarea label="Acceptance Criteria" value={acceptanceCriteria} onChange={(e) => setAcceptanceCriteria(e.target.value)} placeholder="- Criteria 1&#10;- Criteria 2" rows={4} hint="One criterion per line." />
            <Select label="Difficulty" value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)}>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
              <option value="expert">Expert</option>
            </Select>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Deadline (optional)" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
              <Input label="GitHub Issue # (optional)" type="number" value={githubIssueNumber} onChange={(e) => setGithubIssueNumber(e.target.value)} placeholder="1" />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ownership Reward</CardTitle>
            <CardDescription>Reward allocated from the development pool on completion.</CardDescription>
          </CardHeader>
          <CardBody className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-ink-700 mb-1.5">Reward</label>
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={rewardPct}
                  onChange={(e) => setRewardPct(Number(e.target.value))}
                  className={`w-full rounded-lg border h-10 px-3 pr-8 text-sm focus-ring ${overflows ? 'border-error-400' : 'border-ink-300'}`}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 text-sm">%</span>
              </div>
              <p className="text-xs text-ink-400 mt-1 font-mono">{rewardBps} bps</p>
            </div>

            <div className="bg-ink-50 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-ink-500">Development Pool</span>
                <span className="font-mono text-ink-700">{bpsToPercentString(project.devPoolBps)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-ink-500">Committed to Tasks</span>
                <span className="font-mono text-ink-700">{bpsToPercentString(committedBps)}</span>
              </div>
              <div className="flex items-center justify-between text-sm pt-2 border-t border-ink-200">
                <span className="text-ink-700 font-medium">Remaining</span>
                <span className={`font-mono font-bold ${overflows ? 'text-error-600' : 'text-accent-600'}`}>{bpsToPercentString(remaining)}</span>
              </div>
            </div>

            {overflows && (
              <div className="flex items-center gap-2 text-sm text-error-600 bg-error-50 rounded-lg px-3 py-2">
                <AlertCircle className="h-4 w-4" />
                Reward exceeds remaining pool. Reduce the reward or complete other tasks first.
              </div>
            )}
          </CardBody>
        </Card>

        {error && (
          <div className="flex items-center gap-2 text-sm text-error-600 bg-error-50 rounded-lg px-4 py-3 border border-error-200">
            <AlertCircle className="h-4 w-4 shrink-0" /> {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-3">
          <Button variant="outline" type="button" onClick={() => navigate(`/projects/${project.id}/tasks`)}>Cancel</Button>
          <Button type="submit" variant="secondary" disabled={overflows || !title.trim()} rightIcon={<ArrowRight className="h-4 w-4" />}>Create Task</Button>
        </div>
      </form>
    </div>
  );
}
