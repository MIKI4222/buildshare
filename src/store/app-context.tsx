import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type {
  AppDB,
  AppMode,
  User,
  Project,
  ProjectMember,
  Task,
  Contribution,
  AuditLog,
  AuditEventType,
  ContributionStatus,
  TaskStatus,
  PullRequest,
} from '../domain/types';
import { createDemoDB } from '../data/demo-seed';
import { createProviders, type Providers } from '../providers';
import { ContributionService } from '../services/contribution';
import { canTransitionTask, canTransitionContribution } from '../domain/state-machine';
import { remainingDevPool, BPS_TOTAL } from '../domain/bps';
import { computeEvidenceHash, type ContributionEvidence } from '../domain/evidence';
import { parseTaskReference } from '../providers/github/types';

const STORAGE_KEY = 'buildshare-db-v1';
const MODE_KEY = 'buildshare-mode-v1';
const WALLET_KEY = 'buildshare-wallet-v1';

function loadDB(): AppDB {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as AppDB;
  } catch { /* ignore */ }
  return createDemoDB();
}

function loadMode(): AppMode {
  try {
    const m = localStorage.getItem(MODE_KEY);
    if (m === 'demo' || m === 'live') return m;
  } catch { /* ignore */ }
  return 'demo';
}

function loadWallet(): string | null {
  try {
    return localStorage.getItem(WALLET_KEY);
  } catch { return null; }
}

function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export interface CreateProjectInput {
  name: string;
  slug: string;
  description: string;
  founderBps: number;
  devPoolBps: number;
  category: string;
  githubRepo?: string;
}

export interface CreateTaskInput {
  projectId: string;
  title: string;
  description: string;
  acceptanceCriteria: string;
  rewardBps: number;
  difficulty: Task['difficulty'];
  deadline: string | null;
  githubIssueNumber: number | null;
}

export interface WalletState {
  address: string | null;
  connecting: boolean;
  error: string | null;
}

export interface AppContextValue {
  db: AppDB;
  mode: AppMode;
  wallet: WalletState;
  providers: Providers;
  contributionService: ContributionService;
  // Mode
  setMode: (m: AppMode) => void;
  // Wallet
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  // Queries
  getProject: (id: string) => Project | undefined;
  getProjectBySlug: (slug: string) => Project | undefined;
  getProjectMembers: (projectId: string) => ProjectMember[];
  getProjectTasks: (projectId: string) => Task[];
  getProjectContributions: (projectId: string) => Contribution[];
  getProjectActivity: (projectId: string) => AuditLog[];
  getTask: (id: string) => Task | undefined;
  getContribution: (id: string) => Contribution | undefined;
  getPR: (id: string) => PullRequest | undefined;
  getUser: (id: string) => User | undefined;
  getUserByWallet: (wallet: string) => User | undefined;
  // Mutations
  createProject: (input: CreateProjectInput) => Project;
  createTask: (input: CreateTaskInput) => Task;
  claimTask: (taskId: string) => void;
  approveContribution: (contributionId: string) => Promise<void>;
  rejectContribution: (contributionId: string) => void;
  resetDemo: () => void;
  // Derived
  remainingPool: (projectId: string) => number;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<AppDB>(loadDB);
  const [mode, setModeState] = useState<AppMode>(loadMode);
  const [walletAddress, setWalletAddress] = useState<string | null>(loadWallet);
  const [connecting, setConnecting] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);

  const [providers] = useState<Providers>(() => createProviders(loadMode()));
  const [contributionService] = useState<ContributionService>(
    () => new ContributionService(providers.ai, providers.solana),
  );

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(db)); } catch { /* ignore */ }
  }, [db]);

  useEffect(() => {
    try { localStorage.setItem(MODE_KEY, mode); } catch { /* ignore */ }
  }, [mode]);

  useEffect(() => {
    try {
      if (walletAddress) localStorage.setItem(WALLET_KEY, walletAddress);
      else localStorage.removeItem(WALLET_KEY);
    } catch { /* ignore */ }
  }, [walletAddress]);

  const setMode = useCallback((m: AppMode) => setModeState(m), []);

  const connectWalletFn = useCallback(async () => {
    setConnecting(true);
    setWalletError(null);
    try {
      if (mode === 'demo') {
        // In demo mode, use a simulated wallet address.
        const demoAddr = 'DemoUser' + Math.random().toString(36).slice(2, 10).padEnd(40, '0');
        setWalletAddress(demoAddr);
      } else {
        const { connectWallet: connect } = await import('../lib/solana/wallet');
        const adapter = await connect();
        setWalletAddress(adapter.publicKey!.toBase58());
      }
    } catch (e) {
      setWalletError(e instanceof Error ? e.message : 'Failed to connect wallet');
    } finally {
      setConnecting(false);
    }
  }, [mode]);

  const disconnectWallet = useCallback(() => setWalletAddress(null), []);

  const getProject = useCallback((id: string) => db.projects.find((p) => p.id === id), [db.projects]);
  const getProjectBySlug = useCallback((slug: string) => db.projects.find((p) => p.slug === slug), [db.projects]);
  const getProjectMembers = useCallback((projectId: string) => db.members.filter((m) => m.projectId === projectId), [db.members]);
  const getProjectTasks = useCallback((projectId: string) => db.tasks.filter((t) => t.projectId === projectId), [db.tasks]);
  const getProjectContributions = useCallback((projectId: string) => db.contributions.filter((c) => c.projectId === projectId), [db.contributions]);
  const getProjectActivity = useCallback((projectId: string) => db.auditLogs.filter((a) => a.projectId === projectId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [db.auditLogs]);
  const getTask = useCallback((id: string) => db.tasks.find((t) => t.id === id), [db.tasks]);
  const getContribution = useCallback((id: string) => db.contributions.find((c) => c.id === id), [db.contributions]);
  const getPR = useCallback((id: string) => db.pullRequests.find((p) => p.id === id), [db.pullRequests]);
  const getUser = useCallback((id: string) => db.users.find((u) => u.id === id), [db.users]);
  const getUserByWallet = useCallback((wallet: string) => db.users.find((u) => u.walletAddress === wallet), [db.users]);

  const addAudit = useCallback((
    db: AppDB,
    projectId: string,
    userId: string | null,
    eventType: AuditEventType,
    entityType: string,
    entityId: string,
    metadata: Record<string, string | number | boolean | null> = {},
    solanaSignature: string | null = null,
  ): AppDB => {
    const log: AuditLog = {
      id: uid('aud'),
      projectId,
      userId,
      eventType,
      entityType,
      entityId,
      metadata,
      createdAt: new Date().toISOString(),
      solanaSignature,
    };
    return { ...db, auditLogs: [log, ...db.auditLogs] };
  }, []);

  const createProject = useCallback((input: CreateProjectInput): Project => {
    const projectId = uid('prj');
    const project: Project = {
      id: projectId,
      name: input.name,
      slug: input.slug || input.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      description: input.description,
      ownerUserId: 'usr_current', // current user
      solanaProjectPda: mode === 'demo' ? `DemoPDA_${uid('pda')}` : null,
      githubInstallationId: null,
      githubRepoOwner: input.githubRepo?.split('/')[0] || null,
      githubRepoName: input.githubRepo?.split('/')[1] || null,
      ownershipTotal: BPS_TOTAL,
      ownershipAllocated: input.founderBps,
      ownershipRemaining: input.devPoolBps,
      founderBps: input.founderBps,
      devPoolBps: input.devPoolBps,
      status: 'active',
      category: input.category,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const ownerMember: ProjectMember = {
      id: uid('mem'),
      projectId,
      userId: 'usr_current',
      role: 'OWNER',
      ownershipBps: input.founderBps,
      lockedBps: input.founderBps,
      unlockedBps: 0,
      joinedAt: new Date().toISOString(),
    };
    setDb((prev) => addAudit(
      { ...prev, projects: [...prev.projects, project], members: [...prev.members, ownerMember] },
      projectId, 'usr_current', 'PROJECT_CREATED', 'project', projectId,
      { founderBps: input.founderBps, devPoolBps: input.devPoolBps },
    ));
    return project;
  }, [mode, addAudit]);

  const createTask = useCallback((input: CreateTaskInput): Task => {
    const project = db.projects.find((p) => p.id === input.projectId);
    if (!project) throw new Error('Project not found');
    const tasks = db.tasks.filter((t) => t.projectId === input.projectId);
    const remaining = remainingDevPool(project.devPoolBps, tasks);
    if (input.rewardBps > remaining) {
      throw new Error(`Task reward exceeds remaining development pool (${remaining / 100}% remaining).`);
    }
    const taskNum = tasks.length + 1;
    const externalKey = `BUILD-${String(taskNum).padStart(3, '0')}`;
    const task: Task = {
      id: uid('tsk'),
      projectId: input.projectId,
      externalKey,
      title: input.title,
      description: input.description,
      acceptanceCriteria: input.acceptanceCriteria,
      rewardBps: input.rewardBps,
      status: 'OPEN',
      assignedUserId: null,
      githubIssueNumber: input.githubIssueNumber,
      deadline: input.deadline,
      difficulty: input.difficulty,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setDb((prev) => addAudit(
      { ...prev, tasks: [...prev.tasks, task] },
      input.projectId, 'usr_current', 'TASK_CREATED', 'task', task.id,
      { key: externalKey, rewardBps: input.rewardBps },
    ));
    return task;
  }, [db, addAudit]);

  const claimTask = useCallback((taskId: string) => {
    setDb((prev) => {
      const task = prev.tasks.find((t) => t.id === taskId);
      if (!task) return prev;
      if (task.status !== 'OPEN') return prev;
      if (!canTransitionTask('OPEN', 'CLAIMED')) return prev;
      const updated = { ...task, status: 'CLAIMED' as TaskStatus, assignedUserId: 'usr_current', updatedAt: new Date().toISOString() };
      const newDb = {
        ...prev,
        tasks: prev.tasks.map((t) => t.id === taskId ? updated : t),
      };
      return addAudit(newDb, task.projectId, 'usr_current', 'TASK_CLAIMED', 'task', taskId, { assignee: 'current' });
    });
  }, [addAudit]);

  const approveContribution = useCallback(async (contributionId: string) => {
    const contribution = db.contributions.find((c) => c.id === contributionId);
    if (!contribution) throw new Error('Contribution not found');
    if (contribution.status !== 'PENDING_APPROVAL') throw new Error('Contribution is not pending approval');

    const task = db.tasks.find((t) => t.id === contribution.taskId);
    if (!task) throw new Error('Task not found');
    const project = db.projects.find((p) => p.id === contribution.projectId);
    if (!project) throw new Error('Project not found');
    if (task.rewardBps <= 0) throw new Error('Task reward must be positive');
    if (project.ownershipRemaining < task.rewardBps) throw new Error('Insufficient ownership remaining');

    // Allocate on-chain (demo or live)
    const result = await contributionService.allocateOwnership({
      contributorWallet: db.users.find((u) => u.id === contribution.userId)?.walletAddress || '',
      projectId: contribution.projectId,
      taskId: contribution.taskId,
      rewardBps: task.rewardBps,
      evidenceHash: contribution.evidenceHash,
    });

    setDb((prev) => {
      const mem = prev.members.find((m) => m.projectId === contribution.projectId && m.userId === contribution.userId);
      const newMembers = mem
        ? prev.members.map((m) => m.id === mem.id ? { ...m, ownershipBps: m.ownershipBps + task.rewardBps, unlockedBps: m.unlockedBps + task.rewardBps } : m)
        : [...prev.members, {
            id: uid('mem'),
            projectId: contribution.projectId,
            userId: contribution.userId,
            role: 'CONTRIBUTOR' as const,
            ownershipBps: task.rewardBps,
            lockedBps: 0,
            unlockedBps: task.rewardBps,
            joinedAt: new Date().toISOString(),
          }];

      const newTasks = prev.tasks.map((t) => t.id === task.id ? { ...t, status: 'COMPLETED' as TaskStatus } : t);
      const newProject = {
        ...prev.projects.find((p) => p.id === contribution.projectId)!,
        ownershipAllocated: project.ownershipAllocated + task.rewardBps,
        ownershipRemaining: project.ownershipRemaining - task.rewardBps,
        updatedAt: new Date().toISOString(),
      };
      const newProjects = prev.projects.map((p) => p.id === newProject.id ? newProject : p);
      const newContrib = prev.contributions.map((c) => c.id === contributionId ? {
        ...c,
        status: 'ONCHAIN' as ContributionStatus,
        solanaSignature: result.signature,
      } : c);

      let newDb: AppDB = {
        ...prev,
        members: newMembers,
        tasks: newTasks,
        projects: newProjects,
        contributions: newContrib,
      };

      newDb = addAudit(newDb, contribution.projectId, 'usr_current', 'CONTRIBUTION_APPROVED', 'contribution', contributionId,
        { score: contribution.aiScore, recommendation: contribution.aiRecommendation });
      newDb = addAudit(newDb, contribution.projectId, 'usr_current', 'OWNERSHIP_ALLOCATED', 'contribution', contributionId,
        { amountBps: task.rewardBps, contributor: contribution.userId }, result.signature);

      return newDb;
    });
  }, [db, contributionService, addAudit]);

  const rejectContribution = useCallback((contributionId: string) => {
    setDb((prev) => {
      const contrib = prev.contributions.find((c) => c.id === contributionId);
      if (!contrib) return prev;
      const newContrib = prev.contributions.map((c) => c.id === contributionId ? { ...c, status: 'REJECTED' as ContributionStatus } : c);
      const newTasks = prev.tasks.map((t) => t.id === contrib.taskId ? { ...t, status: 'REJECTED' as TaskStatus } : t);
      let newDb: AppDB = { ...prev, contributions: newContrib, tasks: newTasks };
      return addAudit(newDb, contrib.projectId, 'usr_current', 'CONTRIBUTION_REJECTED', 'contribution', contributionId,
        { reason: 'Rejected by project owner' });
    });
  }, [addAudit]);

  const resetDemo = useCallback(() => {
    const fresh = createDemoDB();
    setDb(fresh);
  }, []);

  const remainingPool = useCallback((projectId: string) => {
    const project = db.projects.find((p) => p.id === projectId);
    if (!project) return 0;
    const tasks = db.tasks.filter((t) => t.projectId === projectId);
    return remainingDevPool(project.devPoolBps, tasks);
  }, [db]);

  const value: AppContextValue = {
    db, mode, wallet: { address: walletAddress, connecting, error: walletError },
    providers, contributionService,
    setMode,
    connectWallet: connectWalletFn, disconnectWallet,
    getProject, getProjectBySlug, getProjectMembers, getProjectTasks, getProjectContributions,
    getProjectActivity, getTask, getContribution, getPR, getUser, getUserByWallet,
    createProject, createTask, claimTask, approveContribution, rejectContribution, resetDemo,
    remainingPool,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
