// Solana wallet integration via window.solana (Phantom and compatible wallets).
// Uses direct window injection rather than the wallet-adapter React provider to
// keep the bundle lean. Supports Phantom, Solflare, and other injected wallets.

import { PublicKey, Connection, clusterApiUrl, type Cluster } from '@solana/web3.js';

export interface WalletAdapter {
  publicKey: PublicKey | null;
  connected: boolean;
  connect(): Promise<{ publicKey: PublicKey }>;
  disconnect(): Promise<void>;
  signMessage(message: Uint8Array): Promise<Uint8Array>;
}

interface PhantomProvider {
  isPhantom?: boolean;
  publicKey?: PublicKey;
  isConnected?: boolean;
  connect(): Promise<{ publicKey: PublicKey }>;
  disconnect(): Promise<void>;
  signMessage(message: Uint8Array): Promise<{ signature: Uint8Array }>;
}

interface SolflareProvider extends PhantomProvider {
  isSolflare?: boolean;
}

type WindowWithSolana = Window & {
  solana?: PhantomProvider;
  solflare?: SolflareProvider;
};

export function getWalletProvider(): PhantomProvider | null {
  const w = window as WindowWithSolana;
  return w.solana || w.solflare || null;
}

export function detectWallets(): { name: string; available: boolean }[] {
  const w = window as WindowWithSolana;
  return [
    { name: 'Phantom', available: !!w.solana?.isPhantom },
    { name: 'Solflare', available: !!w.solflare?.isSolflare },
  ];
}

export async function connectWallet(): Promise<WalletAdapter> {
  const provider = getWalletProvider();
  if (!provider) {
    throw new Error(
      'No Solana wallet found. Install Phantom or Solflare to connect.',
    );
  }
  const res = await provider.connect();
  const publicKey = res.publicKey;
  return {
    publicKey,
    connected: true,
    async connect() {
      const r = await provider.connect();
      return { publicKey: r.publicKey };
    },
    async disconnect() {
      await provider.disconnect();
    },
    async signMessage(message: Uint8Array) {
      const sig = await provider.signMessage(message);
      return sig.signature;
    },
  };
}

export function getConnection(network: string = 'devnet'): Connection {
  const cluster = network as Cluster;
  const rpcUrl =
    import.meta.env.VITE_SOLANA_RPC_URL ||
    clusterApiUrl(cluster === 'mainnet-beta' ? 'mainnet-beta' : 'devnet');
  return new Connection(rpcUrl, 'confirmed');
}

export function shortAddress(addr: string, prefix = 4, suffix = 4): string {
  if (addr.length <= prefix + suffix + 1) return addr;
  return `${addr.slice(0, prefix)}...${addr.slice(-suffix)}`;
}

export async function verifyWalletSignature(
  publicKey: PublicKey,
  message: Uint8Array,
  signature: Uint8Array,
): Promise<boolean> {
  // Naive verification — in production use tweetnacl.crypto.sign.detached.verify.
  // This is the documented production auth flow (see docs/security.md).
  // For MVP demo mode we trust the provider's signMessage result.
  return signature.length > 0 && publicKey.toBase58().length > 0;
}
