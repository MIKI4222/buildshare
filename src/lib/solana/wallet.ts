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
  const meta = import.meta as unknown as { env?: Record<string, string | undefined> };
  const rpcUrl =
    (meta.env ? meta.env.VITE_SOLANA_RPC_URL : undefined) ||
    clusterApiUrl(cluster === 'mainnet-beta' ? 'mainnet-beta' : 'devnet');
  return new Connection(rpcUrl, 'confirmed');
}

export function shortAddress(addr: string, prefix = 4, suffix = 4): string {
  if (addr.length <= prefix + suffix + 1) return addr;
  return `${addr.slice(0, prefix)}...${addr.slice(-suffix)}`;
}

// Copies bytes into a standalone ArrayBuffer so WebCrypto always receives a
// plain BufferSource (a Uint8Array can be backed by a SharedArrayBuffer).
function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const out = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(out).set(bytes);
  return out;
}

// Real Ed25519 verification.
//
// P0 security fix: the previous implementation returned true whenever
// signature.length > 0, which accepted ANY byte string as a valid signature.
// A wallet address is an Ed25519 public key, so we verify the signature
// against it with WebCrypto and refuse anything that is not verifiable.
export async function verifyWalletSignature(
  publicKey: PublicKey,
  message: Uint8Array,
  signature: Uint8Array,
): Promise<boolean> {
  // An Ed25519 signature is exactly 64 bytes.
  if (!(signature instanceof Uint8Array) || signature.length !== 64) return false;
  if (!(message instanceof Uint8Array) || message.length === 0) return false;

  const raw = publicKey.toBytes();
  if (raw.length !== 32) return false;

  const subtle = globalThis.crypto && globalThis.crypto.subtle;
  if (!subtle) {
    // Without WebCrypto we cannot verify, so we must NOT claim the signature
    // is valid. Failing closed is the only safe option.
    return false;
  }

  try {
    const key = await subtle.importKey('raw', toArrayBuffer(raw), { name: 'Ed25519' }, false, [
      'verify',
    ]);
    return await subtle.verify(
      { name: 'Ed25519' },
      key,
      toArrayBuffer(signature),
      toArrayBuffer(message),
    );
  } catch {
    return false;
  }
}
