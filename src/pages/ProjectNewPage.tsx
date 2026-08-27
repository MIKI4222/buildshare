import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, AlertCircle } from 'lucide-react';
import { Card, CardBody, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input, Textarea, Select } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { useApp } from '../store/app-context';
import { bpsToPercentString, validateSplit, BPS_TOTAL } from '../domain/bps';
import { OwnershipBar } from '../components/OwnershipChart';

const CATEGORIES = ['AI', 'DeFi', 'Infrastructure', 'DAO', 'Developer Tools', 'Other'];

export function ProjectNewPage() {
  const navigate = useNavigate();
  const { createProject, mode } = useApp();

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [founderPct, setFounderPct] = useState(40);
  const [devPoolPct, setDevPoolPct] = useState(60);
  const [category, setCategory] = useState('DeFi');
  const [githubRepo, setGithubRepo] = useState('');
  const [error, setError] = useState<string | null>(null);

  const founderBps = Math.round(founderPct * 100);
  const devPoolBps = Math.round(devPoolPct * 100);
  const splitValid = validateSplit(founderBps, devPoolBps);

  const slugified = useMemo(() => {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }, [name]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) { setError('Project name is required.'); return; }
    if (!splitValid) { setError('Founder + Development Pool must equal 100%.'); return; }
    try {
      const project = createProject({
        name: name.trim(),
        slug: slug || slugified,
        description: description.trim(),
        founderBps,
        devPoolBps,
        category,
        githubRepo: githubRepo.trim() || undefined,
      });
      navigate(`/projects/${project.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create project');
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900 mb-6">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <h1 className="text-2xl font-bold text-ink-900 mb-2">Create Project</h1>
      <p className="text-sm text-ink-500 mb-8">Define your project and ownership distribution.</p>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Project Details</CardTitle>
            <CardDescription>Basic information about your project.</CardDescription>
          </CardHeader>
          <CardBody className="space-y-4">
            <Input label="Project Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="AI Arbitration Escrow" />
            <Input label="Project Slug" value={slug || slugified} onChange={(e) => setSlug(e.target.value)} placeholder="ai-arbitration-escrow" hint="Used in URLs. Auto-generated from name." />
            <Textarea label="Project Description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe what your project does..." rows={3} />
            <Select label="Category" value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
            <Input label="GitHub Repository (optional)" value={githubRepo} onChange={(e) => setGithubRepo(e.target.value)} placeholder="owner/repo-name" />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ownership Distribution</CardTitle>
            <CardDescription>Split between founder and development pool. Must total 100%.</CardDescription>
          </CardHeader>
          <CardBody className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-ink-700 mb-1.5">Founder Ownership</label>
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={founderPct}
                    onChange={(e) => { const v = Number(e.target.value); setFounderPct(v); setDevPoolPct(100 - v); }}
                    className="w-full rounded-lg border border-ink-300 h-10 px-3 pr-8 text-sm focus-ring"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 text-sm">%</span>
                </div>
                <p className="text-xs text-ink-400 mt-1 font-mono">{founderBps} bps</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-700 mb-1.5">Development Pool</label>
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={devPoolPct}
                    onChange={(e) => { const v = Number(e.target.value); setDevPoolPct(v); setFounderPct(100 - v); }}
                    className="w-full rounded-lg border border-ink-300 h-10 px-3 pr-8 text-sm focus-ring"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 text-sm">%</span>
                </div>
                <p className="text-xs text-ink-400 mt-1 font-mono">{devPoolBps} bps</p>
              </div>
            </div>

            {!splitValid && (
              <div className="flex items-center gap-2 text-sm text-error-600 bg-error-50 rounded-lg px-3 py-2">
                <AlertCircle className="h-4 w-4" />
                Founder + Development Pool must equal 100%. Currently {founderPct + devPoolPct}%.
              </div>
            )}

            {/* Ownership preview */}
            <div className="bg-ink-50 rounded-xl p-4">
              <p className="text-xs font-medium text-ink-500 uppercase tracking-wide mb-3">Ownership Preview</p>
              <OwnershipBar
                segments={[
                  { label: 'Founder', bps: founderBps, color: 'bg-brand-500' },
                ]}
                total={BPS_TOTAL}
              />
              <div className="mt-2 pt-2 border-t border-ink-200 flex items-center justify-between text-xs text-ink-400">
                <span>Total</span>
                <span className="font-mono">{bpsToPercentString(founderBps + devPoolBps)} of 100%</span>
              </div>
            </div>
          </CardBody>
        </Card>

        {mode === 'demo' && (
          <div className="flex items-center gap-2 text-sm text-warning-700 bg-warning-50 rounded-lg px-4 py-3 border border-warning-200">
            <AlertCircle className="h-4 w-4 shrink-0" />
            Running in Demo Mode. The project will be created with a simulated Solana PDA — no real on-chain transaction will occur.
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-sm text-error-600 bg-error-50 rounded-lg px-4 py-3 border border-error-200">
            <AlertCircle className="h-4 w-4 shrink-0" /> {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-3">
          <Button variant="outline" type="button" onClick={() => navigate('/dashboard')}>Cancel</Button>
          <Button type="submit" variant="secondary" disabled={!splitValid || !name.trim()} rightIcon={<ArrowRight className="h-4 w-4" />}>
            Create Project
          </Button>
        </div>
      </form>
    </div>
  );
}
