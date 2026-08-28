import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type {
  AppDB,
  AppMode,
  AuditLog,
  Contribution,
  Project,
  ProjectMember,
  PullRequest,
  Settlement,
  Task,
  User,
} from '../domain/types';
import { createDemoDB, emptyDB } from '../data/demo-seed';
import { getProviders, liveAvailability, resetProviderCache, type Providers } from '../providers';
import { ContributionService } from '../services/contribution';
import { poolBreakdown, type PoolBreakdown } from '../domain/bps';
import { isDomainError } from '../domain/errors';
import * as domain from '../domain/reducers';

const STORAGE_KEY = 'buildshare-db-v2';
const MODE_KEY = 'buildshare-mode-v1';
const WALLET_KEY = 'buildshare-wallet-v1';

// The demo user acting in the UI. In P2 this will come from a verified wallet
// session instead of a constant.
export const CURRENT_USER_ID = 'usr_founder';
export const DEMO_WALLET_ADDRESS = 'DemoWallet11111111111111111111111111111111';

function loadStoredDB(): AppDB | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as AppDB;
  } catch {
    /* ignore */
  }
  return null;
}

function loadMode(): AppMode {
  try {
    const m = localStorage.getItem(MODE_KEY);
    if (m === 'demo' || m === 'live') return m;
  } catch {
    /* ignore */
  }
  return 'demo';
}

function loadWallet(): string | null {
  try {
    return localStorage.getItem(WALLET_KEY);
  } catch {
    return null;
  }
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
  ready: boolean;
  mode: AppMode;
  modeError: string | null;
  liveAvailable: boolean;
  liveReason: string | null;
  wallet: WalletState;
  providers: Providers;
  contributionService: ContributionService;
  setMode: (m: AppMode) => void;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  getProject: (id: string) => Project | undefined;
  getProjectBySlug: (slug: string) => Project | undefined;
  getProjectMembers: (projectId: string) => ProjectMember[];
  getProjectTasks: (projectId: string) => Task[];
  getProjectContributions: (projectId: string) => Contribution[];
  getProjectActivity: (projectId: string) => AuditLog[];
  getTask: (id: string) => Task | undefined;
  getTaskContributions: (taskId: string) => Contribution[];
  getContribution: (id: string) => Contribution | undefined;
  getPR: (id: string) => PullRequest | undefined;
  getUser: (id: string) => User | undefined;
  getUserByWallet: (wallet: string) => User | undefined;
  createProject: (input: CreateProjectInput) => Project;
  createTask: (input: CreateTaskInput) => Task;
  claimTask: (taskId: string) => Promise<void>;
  approveContribution: (contributionId: string) => Promise<void>;
  rejectContribution: (contributionId: string, reason?: string) => void;
  expireClaims: () => void;
  resetDemo: () => void;
  // Ownership accounting. remainingBps is always derived, never stored.
  pool: (projectId: string) => PoolBreakdown | null;
  remainingPool: (projectId: string) => number;
}

const AppContext = createContext<AppContextValue | null>(null);

function errorMessage(e: unknown): string {
  if (isDomainError(e)) return e.message;
  return e instanceof Error ? e.message : String(e);
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<AppDB>(() => loadStoredDB() || emptyDB());
  const [ready, setReady] = useState<boolean>(() => loadStoredDB() !== null);
  const [mode, setModeState] = useState<AppMode>(loadMode);
  const [modeError, setModeError] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(loadWallet);
  const [connecting, setConnecting] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);

  // The demo seed is built by the real reducers, which need async hashing.
  useEffect(() => {
    if (ready) return;
    let cancelled = false;
    createDemoDB().then((seeded) => {
      if (!cancelled) {
        setDb(seeded);
        setReady(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [ready]);

  const availability = useMemo(() => liveAvailability(), []);

  // Providers are rebuilt whenever the mode changes: switching mode really
  // switches the implementation. Live mode never falls back to demo.
  const providers = useMemo<Providers>(() => {
    try {
      const p = getProviders(mode);
      return p;
    } catch (e) {
      // Live mode is unavailable. We do NOT silently return demo providers:
      // the mode is reverted and the error surfaced to the UI.
      setModeError(errorMessage(e));
      setModeState('demo');
      return getProviders('demo');
    }
  }, [mode]);

  const contributionService = useMemo(
    () => new ContributionService(providers.ai, providers.solana),
    [providers],
  );

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    } catch {
      /* ignore */
    }
  }, [db, ready]);

  useEffect(() => {
    try {
      localStorage.setItem(MODE_KEY, mode);
    } catch {
      /* ignore */
    }
  }, [mode]);

  useEffect(() => {
    try {
      if (walletAddress) localStorage.setItem(WALLET_KEY, walletAddress);
      else localStorage.removeItem(WALLET_KEY);
    } catch {
      /* ignore */
    }
  }, [walletAddress]);

  const setMode = useCallback((m: AppMode) => {
    setModeError(null);
    if (m === 'live') {
      const check = liveAvailability();
      if (!check.available) {
        // Explicit failure instead of a silent demo fallback.
        setModeError(check.reason || 'Live mode is not configured.');
        return;
      }
    }
    resetProviderCache();
    setModeState(m);
  }, []);

  const connectWalletFn = useCallback(async () => {
    setConnecting(true);
    setWalletError(null);
    try {
      if (mode === 'demo') {
        setWalletAddress(DEMO_WALLET_ADDRESS);
      } else {
        const { connectWallet: connect } = await import('../lib/solana/wallet');
        const adapter = await connect();
        if (!adapter.publicKey) throw new Error('Wallet did not expose a public key');
        setWalletAddress(adapter.publicKey.toBase58());
      }
    } catch (e) {
      setWalletError(errorMessage(e));
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
  const getProjectActivity = useCallback(
    (projectId: string) =>
      db.auditLogs
        .filter((a) => a.projectId === projectId)
        .slice()
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [db.auditLogs],
  );
  const getTask = useCallback((id: string) => db.tasks.find((t) => t.id === id), [db.tasks]);
  const getTaskContributions = useCallback(
    (taskId: string) =>
      db.contributions.filter((c) => c.taskId === taskId).slice().sort((a, b) => a.attempt - b.attempt),
    [db.contributions],
  );
  const getContribution = useCallback((id: string) => db.contributions.find((c) => c.id === id), [db.contributions]);
  const getPR = useCallback((id: string) => db.pullRequests.find((p) => p.id === id), [db.pullRequests]);
  const getUser = useCallback((id: string) => db.users.find((u) => u.id === id), [db.users]);
  const getUserByWallet = useCallback((wallet: string) => db.users.find((u) => u.walletAddress === wallet), [db.users]);

  const pool = useCallback(
    (projectId: string): PoolBreakdown | null => {
      const project = db.projects.find((p) => p.id === projectId);
      if (!project) return null;
      return poolBreakdown(project);
    },
    [db.projects],
  );

  const remainingPool = useCallback(
    (projectId: string): number => {
      const breakdown = pool(projectId);
      return breakdown ? breakdown.remainingBps : 0;
    },
    [pool],
  );

  const createProjectFn = useCallback(
    (input: CreateProjectInput): Project => {
      const result = domain.createProject(db, {
        name: input.name,
        slug: input.slug,
        description: input.description,
        ownerUserId: CURRENT_USER_ID,
        founderWallet: walletAddress || DEMO_WALLET_ADDRESS,
        founderBps: input.founderBps,
        devPoolBps: input.devPoolBps,
        category: input.category,
        githubRepo: input.githubRepo || null,
      });
      setDb(result.db);
      return result.project;
    },
    [db, walletAddress],
  );

  const createTaskFn = useCallback(
    (input: CreateTaskInput): Task => {
      // Pool validation lives in the domain, not in the form.
      const result = domain.createTask(db, {
        projectId: input.projectId,
        actorUserId: CURRENT_USER_ID,
        title: input.title,
        description: input.description,
        acceptanceCriteria: input.acceptanceCriteria,
        rewardBps: input.rewardBps,
        difficulty: input.difficulty,
        deadline: input.deadline,
        githubIssueNumber: input.githubIssueNumber,
      });
      setDb(result.db);
      return result.task;
    },
    [db],
  );

  const claimTaskFn = useCallback(
    async (taskId: string) => {
      const result = await domain.claimTask(db, { taskId, userId: CURRENT_USER_ID });
      setDb(result.db);
    },
    [db],
  );

  const approveContributionFn = useCallback(
    async (contributionId: string) => {
      // 1. Founder approval fixes the evidence hash.
      const approved = await domain.approveContribution(db, {
        contributionId,
        approverUserId: CURRENT_USER_ID,
      });
      let next = approved.db;
      const contribution = approved.contribution;
      const task = domain.requireTask(next, contribution.taskId);
      const project = domain.requireProject(next, contribution.projectId);
      const contributor = domain.requireUser(next, contribution.userId);

      const allocationInput = {
        projectId: project.id,
        taskId: task.id,
        contributionId: contribution.id,
        contributorWallet: contributor.walletAddress,
        rewardBps: contribution.rewardBps,
        evidenceHash: contribution.evidenceHash || '',
        attempt: contribution.attempt,
      };

      if (providers.solana.mode === 'demo') {
        // 2a. Demo: allocate locally. No signature exists, and the status is
        // DEMO_ALLOCATED, never ONCHAIN.
        const result = await providers.solana.allocateOwnership(allocationInput);
        const settlement: Settlement = {
          kind: 'demo',
          allocatedAt: new Date().toISOString(),
          pda: result.pda,
        };
        next = domain.settleAllocation(next, { contributionId, settlement }).db;
        setDb(next);
        return;
      }

      // 2b. Live: PENDING_ONCHAIN -> real transaction -> ONCHAIN, or
      // ONCHAIN_FAILED. No fake signature is ever produced.
      next = domain.beginAllocation(next, { contributionId }).db;
      setDb(next);
      try {
        const result = await providers.solana.allocateOwnership(allocationInput);
        if (result.kind !== 'onchain') {
          throw new Error('Live provider returned a non on-chain result');
        }
        const settlement: Settlement = {
          kind: 'onchain',
          allocatedAt: new Date().toISOString(),
          pda: result.pda,
          signature: result.signature,
          network: result.network,
        };
        next = domain.settleAllocation(next, { contributionId, settlement }).db;
        setDb(next);
      } catch (e) {
        next = domain.failAllocation(next, { contributionId, reason: errorMessage(e) }).db;
        setDb(next);
        throw e;
      }
    },
    [db, providers],
  );

  const rejectContributionFn = useCallback(
    (contributionId: string, reason?: string) => {
      const result = domain.rejectContribution(db, {
        contributionId,
        actorUserId: CURRENT_USER_ID,
        reason: reason || 'Rejected by the project founder: acceptance criteria not met.',
      });
      setDb(result.db);
    },
    [db],
  );

  const expireClaimsFn = useCallback(() => {
    const result = domain.expireClaims(db);
    if (result.expired.length > 0) setDb(result.db);
  }, [db]);

  const resetDemo = useCallback(() => {
    setReady(false);
    setDb(emptyDB());
  }, []);

  const value: AppContextValue = {
    db,
    ready,
    mode,
    modeError,
    liveAvailable: availability.available,
    liveReason: availability.reason,
    wallet: { address: walletAddress, connecting, error: walletError },
    providers,
    contributionService,
    setMode,
    connectWallet: connectWalletFn,
    disconnectWallet,
    getProject,
    getProjectBySlug,
    getProjectMembers,
    getProjectTasks,
    getProjectContributions,
    getProjectActivity,
    getTask,
    getTaskContributions,
    getContribution,
    getPR,
    getUser,
    getUserByWallet,
    createProject: createProjectFn,
    createTask: createTaskFn,
    claimTask: claimTaskFn,
    approveContribution: approveContributionFn,
    rejectContribution: rejectContributionFn,
    expireClaims: expireClaimsFn,
    resetDemo,
    pool,
    remainingPool,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
