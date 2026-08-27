import { Link } from 'react-router-dom';
import {
  ArrowRight, Github, Brain, ShieldCheck, History, GitPullRequest,
  Layers, Wallet, Check, ChevronRight, Sparkles,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { ModeIndicator } from '../components/ModeIndicator';
import { useApp } from '../store/app-context';
import { bpsToPercentString } from '../domain/bps';

export function LandingPage() {
  const { db, mode } = useApp();
  const demoProject = db.projects[0];

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden bg-ink-950 text-white">
        <div className="absolute inset-0 grid-bg-dark opacity-60" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-ink-950" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-brand-500/20 rounded-full blur-3xl" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-20 pb-28 text-center">
          <div className="inline-flex items-center gap-2 mb-6">
            <Badge tone="brand" size="md" dot>Solana Devnet</Badge>
            <ModeIndicator compact />
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight">
            Build together.
            <br />
            <span className="bg-gradient-to-r from-brand-400 to-accent-400 bg-clip-text text-transparent">Own together.</span>
          </h1>
          <p className="mt-6 text-lg text-ink-300 max-w-2xl mx-auto">
            Turn verified developer contributions into programmable project ownership.
            GitHub proves what you built — BuildShare proves what you own.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to="/projects/new">
              <Button size="lg" variant="secondary" rightIcon={<ArrowRight className="h-4 w-4" />}>
                Create Project
              </Button>
            </Link>
            <Link to="/dashboard">
              <Button size="lg" variant="outline" className="border-ink-700 bg-ink-900 text-white hover:bg-ink-800 hover:border-ink-600">
                Explore Demo
              </Button>
            </Link>
          </div>

          {/* Flow diagram */}
          <div className="mt-16 flex flex-wrap items-center justify-center gap-2 sm:gap-4 text-sm">
            {['GitHub', 'Contribution', 'AI Verification', 'On-chain Proof', 'Ownership'].map((step, i, arr) => (
              <div key={step} className="flex items-center gap-2 sm:gap-4">
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 backdrop-blur-sm">
                  <span className="text-ink-200">{step}</span>
                </div>
                {i < arr.length - 1 && <ChevronRight className="h-4 w-4 text-ink-600" />}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Product Preview */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 -mt-16 relative z-10">
        <Card className="overflow-hidden shadow-xl">
          <div className="grid md:grid-cols-2">
            {/* Left: ownership dashboard preview */}
            <div className="p-6 border-b md:border-b-0 md:border-r border-ink-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-ink-900">{demoProject.name}</h3>
                <Badge tone="success" size="sm" dot>Active</Badge>
              </div>
              <p className="text-sm text-ink-500 mb-5">{demoProject.description.slice(0, 100)}...</p>
              <div className="space-y-3">
                <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
                  <div className="bg-brand-500" style={{ width: '40%' }} />
                  <div className="bg-accent-500" style={{ width: '10%' }} />
                  <div className="bg-info-500" style={{ width: '5%' }} />
                  <div className="bg-ink-200" style={{ width: '45%' }} />
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-brand-500" /><span className="text-ink-700">Founder</span><span className="text-ink-400 ml-auto font-mono">40%</span></div>
                  <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-accent-500" /><span className="text-ink-700">Alice</span><span className="text-ink-400 ml-auto font-mono">10%</span></div>
                  <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-info-500" /><span className="text-ink-700">Bob</span><span className="text-ink-400 ml-auto font-mono">5%</span></div>
                  <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-ink-200" /><span className="text-ink-700">Dev Pool</span><span className="text-ink-400 ml-auto font-mono">45%</span></div>
                </div>
              </div>
            </div>
            {/* Right: AI verification preview */}
            <div className="p-6 bg-ink-50/50">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-8 w-8 rounded-lg bg-accent-100 flex items-center justify-center">
                  <Brain className="h-4 w-4 text-accent-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-ink-900 text-sm">AI Verification</h3>
                  <p className="text-xs text-ink-400">buildshare-ai-v1</p>
                </div>
              </div>
              <div className="flex items-center gap-4 mb-4">
                <div className="relative h-20 w-20">
                  <svg viewBox="0 0 80 80" className="-rotate-90">
                    <circle cx="40" cy="40" r="32" fill="none" stroke="#e2e8f0" strokeWidth="8" />
                    <circle cx="40" cy="40" r="32" fill="none" stroke="#10b981" strokeWidth="8"
                      strokeDasharray={`${2 * Math.PI * 32 * 0.94} ${2 * Math.PI * 32}`} strokeLinecap="round" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xl font-bold text-ink-900">94</span>
                  </div>
                </div>
                <div className="flex-1 space-y-1.5">
                  {[['Requirements', 96], ['Code Quality', 91], ['Tests', 95], ['Security', 90]].map(([label, score]) => (
                    <div key={label as string} className="flex items-center justify-between text-xs">
                      <span className="text-ink-500">{label}</span>
                      <span className="font-mono text-ink-700">{score}/100</span>
                    </div>
                  ))}
                </div>
              </div>
              <Badge tone="success" size="md" dot>APPROVE</Badge>
            </div>
          </div>
        </Card>
      </section>

      {/* How it works */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-24">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold text-ink-900">How it works</h2>
          <p className="text-ink-500 mt-2">From code to ownership in six steps.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { icon: Layers, title: 'Create a project', desc: 'Define ownership split between founder and development pool.' },
            { icon: Github, title: 'Define tasks & rewards', desc: 'Create development tasks with predefined ownership rewards in basis points.' },
            { icon: Wallet, title: 'Connect GitHub', desc: 'Link your repository. BuildShare watches for pull requests.' },
            { icon: GitPullRequest, title: 'Build & submit PRs', desc: 'Developers claim tasks, implement features, and submit pull requests.' },
            { icon: Brain, title: 'Verify contribution', desc: 'AI evaluates whether the work satisfies the task acceptance criteria.' },
            { icon: ShieldCheck, title: 'Allocate ownership', desc: 'Approved contributions trigger on-chain ownership allocation on Solana.' },
          ].map((step, i) => (
            <Card key={i} hover className="p-6">
              <div className="flex items-start gap-4">
                <div className="h-10 w-10 rounded-xl bg-ink-900 flex items-center justify-center shrink-0">
                  <step.icon className="h-5 w-5 text-brand-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono text-ink-400">Step {i + 1}</span>
                  </div>
                  <h3 className="font-semibold text-ink-900">{step.title}</h3>
                  <p className="text-sm text-ink-500 mt-1">{step.desc}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="bg-white border-y border-ink-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-24">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-ink-900">Built for credible ownership</h2>
            <p className="text-ink-500 mt-2">Every claim is backed by evidence.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: GitPullRequest, title: 'Contribution-based ownership', desc: 'Developers earn ownership through verified work — not promises or spreadsheets.' },
              { icon: Github, title: 'GitHub integration', desc: 'Connect real development activity to project tasks via PR linking and webhooks.' },
              { icon: Brain, title: 'AI verification', desc: 'AI evaluates whether submitted work satisfies the task requirements. Advisory only — humans approve.' },
              { icon: ShieldCheck, title: 'On-chain proof', desc: 'Ownership allocation is recorded on Solana Devnet. Evidence hashes are stored on-chain.' },
              { icon: History, title: 'Transparent history', desc: 'Every important project event is auditable. Blockchain events link to Solana Explorer.' },
              { icon: Sparkles, title: 'Demo Mode', desc: 'The entire flow works without API keys. Clearly labelled — never fakes on-chain transactions.' },
            ].map((f, i) => (
              <div key={i} className="p-6 rounded-xl border border-ink-200 hover:border-ink-300 transition-colors">
                <f.icon className="h-6 w-6 text-brand-500 mb-3" />
                <h3 className="font-semibold text-ink-900">{f.title}</h3>
                <p className="text-sm text-ink-500 mt-1">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Roadmap */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-24">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold text-ink-900">Roadmap</h2>
          <p className="text-ink-500 mt-2">What's here now and what's coming.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          <Card className="p-6 border-accent-200">
            <div className="flex items-center gap-2 mb-4">
              <Badge tone="success" dot>v0.1 — Current</Badge>
            </div>
            <ul className="space-y-2 text-sm">
              {['Contribution-based ownership', 'GitHub integration', 'AI verification', 'Solana Devnet', 'Ownership dashboard'].map((x) => (
                <li key={x} className="flex items-center gap-2 text-ink-700">
                  <Check className="h-4 w-4 text-accent-500" /> {x}
                </li>
              ))}
            </ul>
          </Card>
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Badge tone="info" dot>v0.2 — Coming Soon</Badge>
            </div>
            <ul className="space-y-2 text-sm">
              {['DAO governance', 'Multisig approval', 'Vesting schedules', 'Dispute resolution'].map((x) => (
                <li key={x} className="flex items-center gap-2 text-ink-400">
                  <span className="h-4 w-4 rounded border border-ink-300" /> {x}
                </li>
              ))}
            </ul>
          </Card>
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Badge tone="neutral" dot>v0.3 — v1.0</Badge>
            </div>
            <ul className="space-y-2 text-sm">
              {['Developer reputation (BuildScore)', 'Contributor profiles', 'Task marketplace', 'Multi-chain + SDK'].map((x) => (
                <li key={x} className="flex items-center gap-2 text-ink-400">
                  <span className="h-4 w-4 rounded border border-ink-300" /> {x}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-ink-950 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-20 text-center">
          <h2 className="text-3xl font-bold">Ready to build and own?</h2>
          <p className="text-ink-300 mt-3 max-w-xl mx-auto">
            {mode === 'demo'
              ? 'Explore the demo project or create your own. No wallet or API keys required in Demo Mode.'
              : 'Connect your Solana wallet and start building on Devnet.'}
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to="/projects/new">
              <Button size="lg" variant="secondary" rightIcon={<ArrowRight className="h-4 w-4" />}>
                Create Project
              </Button>
            </Link>
            <Link to="/explore">
              <Button size="lg" variant="outline" className="border-ink-700 bg-ink-900 text-white hover:bg-ink-800 hover:border-ink-600">
                Explore Projects
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
