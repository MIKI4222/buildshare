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
  // Sends initialize_project and records the confirmed PDA. Live mode only.
  publishProjectOnchain: (projectId: string) => Promise<{ pda: string; signature: string }>;
  publishTaskOnchain: (taskId: string) => Promise<{ pda: string; signature: string }>;
  // STOP-16: sends claim_task for a task already claimed locally and already
  // created on chain. Live mode only.
  claimTaskOnchain: (taskId: string) => Promise<{ pda: string; signature: string }>;
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

  // Publishes an existing local project on chain, then records the confirmed
  // fact. Deliberately a separate action from createProject: the local project
  // must exist before a PDA can be recorded against it, and a rejected wallet
  // prompt must not destroy what the user already filled in.
  const publishProjectOnchainFn = useCallback(
    async (projectId: string): Promise<{ pda: string; signature: string }> => {
      const project = domain.requireProject(db, projectId);
      if (providers.solana.mode !== 'live') {
        throw new Error('Switch to live mode to create this project on chain.');
      }
      if (project.founderWallet === DEMO_WALLET_ADDRESS) {
        throw new Error(
          'This project was created with the demo wallet, so it has no real founder to sign for it. Create it again with a connected wallet.',
        );
      }
      const result = await providers.solana.initializeProject({
        projectId: project.id,
        onchainProjectId: project.onchainProjectId,
        founderWallet: project.founderWallet,
        founderBps: project.founderBps,
        devPoolBps: project.devPoolBps,
      });
      if (result.kind !== 'onchain') {
        throw new Error('Live provider returned a non on-chain result');
      }
      // Only now, after a confirmed and verified account, is anything recorded.
      const next = domain.recordOnchainProject(db, projectId, {
        pda: result.pda,
        onchainProjectId: project.onchainProjectId,
      }).db;
      setDb(next);
      return { pda: result.pda, signature: result.signature };
    },
    [db, providers],
  );

  const publishTaskOnchainFn = useCallback(
    async (taskId: string): Promise<{ pda: string; signature: string }> => {
      const task = db.tasks.find((t) => t.id === taskId);
      if (!task) throw new Error('Task not found: ' + taskId);
      const project = db.projects.find((p) => p.id === task.projectId);
      if (!project) throw new Error('Project not found: ' + task.projectId);
      if (mode !== 'live') {
        throw new Error('Switch to live mode to create this task on chain.');
      }
      if (project.solanaProjectPda === null) {
        throw new Error('Create the project on chain first. A task cannot exist without it.');
      }
      if (project.founderWallet === DEMO_WALLET_ADDRESS) {
        throw new Error('This project records the demo wallet as its founder and cannot be published.');
      }
      if (task.onchainTaskId !== null) {
        throw new Error(
          'This task is already on chain with id ' + String(task.onchainTaskId) + '.',
        );
      }

      // STOP-8: the candidate is chosen here, once, and never incremented on
      // failure. The provider refuses an occupied PDA rather than trying again.
      const candidate = domain.nextOnchainTaskIdCandidate(db, project.id);
      const commitmentModule = await import('../domain/commitment');
      const repoRefModule = await import('../domain/repo-ref');
      const acceptanceCriteriaHash = await commitmentModule.hashAcceptanceCriteria(
        task.acceptanceCriteria,
      );
      const repoRefHash = await repoRefModule.hashRepoRef(
        task.repositoryFullName,
        task.baseBranch,
      );

      const result = await providers.solana.createTask({
        projectId: project.id,
        taskId: task.id,
        onchainProjectId: project.onchainProjectId,
        onchainTaskId: candidate,
        founderWallet: project.founderWallet,
        rewardBps: task.rewardBps,
        acceptanceCriteriaHash,
        repoRefHash,
      });
      if (result.kind !== 'onchain') {
        throw new Error('The provider did not return an on-chain result. Nothing was recorded.');
      }

      // Only now, after the chain confirmed and the account was read back.
      const next = domain.recordOnchainTask(db, task.id, { onchainTaskId: candidate });
      setDb(next.db);
      return { pda: result.pda, signature: result.signature };
    },
    [db, mode, providers],
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

  // STOP-16: the on-chain half of a claim. Nothing is recorded, because the
  // domain has no field for a claim signature yet. The signature goes back to
  // the caller and the chain stays the source of truth.
  const claimTaskOnchainFn = useCallback(
    async (taskId: string): Promise<{ pda: string; signature: string }> => {
      const task = db.tasks.find((t) => t.id === taskId);
      if (!task) throw new Error('Task not found: ' + taskId);
      const project = db.projects.find((p) => p.id === task.projectId);
      if (!project) throw new Error('Project not found: ' + task.projectId);
      if (mode !== 'live') {
        throw new Error('Switch to live mode to claim this task on chain.');
      }
      if (!walletAddress) {
        throw new Error('Connect a wallet before claiming a task on chain.');
      }
      if (project.solanaProjectPda === null) {
        throw new Error('This project does not exist on chain yet.');
      }
      if (task.onchainTaskId === null) {
        throw new Error('Create this task on chain before claiming it.');
      }
      if (task.status !== 'CLAIMED') {
        throw new Error('Claim the task locally first. Status is ' + task.status + '.');
      }
      const commitment = task.commitment;
      if (!commitment) {
        throw new Error('This task carries no commitment, so there is nothing to send.');
      }
      // The hash was built for exactly one wallet. Signing with another would
      // publish a commitment nobody can reproduce, so this refuses.
      if (commitment.contributorWallet !== walletAddress) {
        throw new Error(
          'The commitment was built for ' +
            commitment.contributorWallet +
            ' but the connected wallet is ' +
            walletAddress +
            '. Reopen the task and claim it again with this wallet.',
        );
      }

      const result = await providers.solana.claimTask({
        projectId: project.id,
        taskId: task.id,
        onchainProjectId: project.onchainProjectId,
        onchainTaskId: task.onchainTaskId,
        founderWallet: project.founderWallet,
        contributorWallet: commitment.contributorWallet,
        attempt: commitment.attempt,
        commitmentHash: commitment.commitmentHash,
      });
      if (result.kind !== 'onchain') {
        throw new Error('The provider did not return an on-chain result. Nothing changed.');
      }
      return { pda: result.pda, signature: result.signature };
    },
    [db, mode, providers, walletAddress],
  );

  const claimTaskFn = useCallback(
    async (taskId: string) => {
      if (mode === 'live' && !walletAddress) {
        throw new Error('Connect a wallet before claiming a task in Live mode.');
      }
      const result = await domain.claimTask(db, {
        taskId,
        userId: CURRENT_USER_ID,
        contributorWallet: walletAddress || undefined,
      });
      setDb(result.db);
    },
    [db, mode, walletAddress],
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
      // The allocation recipient comes from the task commitment, not from the
      // user record. The chain sets task.contributor from the claim signer and
      // then enforces contribution.contributor == task.contributor and
      // member.wallet == contribution.contributor, so any other source can only
      // produce a refused transaction. Refuse here instead, before a signature.
      const commitment = task.commitment;
      if (!commitment) {
        throw new Error(
          'This task carries no commitment, so there is no contributor to allocate ownership to.',
        );
      }

      const allocationInput = {
        projectId: project.id,
        taskId: task.id,
        contributionId: contribution.id,
        contributorWallet: commitment.contributorWallet,
        rewardBps: contribution.rewardBps,
        evidenceHash: contribution.evidenceHash || '',
        attempt: contribution.attempt,
        onchainProjectId: project.onchainProjectId,
        onchainTaskId: task.onchainTaskId,
        founderWallet: project.founderWallet,
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
    publishProjectOnchain: publishProjectOnchainFn,
    publishTaskOnchain: publishTaskOnchainFn,
    claimTaskOnchain: claimTaskOnchainFn,
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
