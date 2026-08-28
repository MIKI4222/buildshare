// Deterministic hashing primitives.
// Canonical JSON: recursively sorted keys, undefined dropped. The same input
// must always produce the same 64-char lowercase hex SHA-256 digest, because
// these hashes are the values we intend to commit on-chain in P1.

export const HEX64 = /^[0-9a-f]{64}$/;

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

function getCrypto(): Crypto {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (!c || !c.subtle) {
    throw new Error('WebCrypto (crypto.subtle) is not available in this runtime.');
  }
  return c;
}

export function canonicalize(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): Json {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) return value.map((v) => sortValue(v));
  if (typeof value === 'object') {
    const src = value as Record<string, unknown>;
    const out: { [key: string]: Json } = {};
    for (const key of Object.keys(src).sort()) {
      if (src[key] === undefined) continue;
      out[key] = sortValue(src[key]);
    }
    return out;
  }
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'string') {
    return value;
  }
  return String(value);
}

export async function sha256Text(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await getCrypto().subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function sha256Canonical(value: unknown): Promise<string> {
  return sha256Text(canonicalize(value));
}

export function hashToBytes(hash: string): Uint8Array {
  if (!isHash(hash)) throw new Error('Not a 32-byte hex hash: ' + hash);
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i++) out[i] = parseInt(hash.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export function isHash(hash: unknown): boolean {
  return typeof hash === 'string' && HEX64.test(hash);
}

export function shortHash(hash: string, prefix = 8, suffix = 6): string {
  if (!hash) return '';
  if (hash.length <= prefix + suffix) return hash;
  return hash.slice(0, prefix) + '...' + hash.slice(-suffix);
}
