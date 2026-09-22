import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('mode switch is visible, resets wallet state, and supports Vercel SPA routes', () => {
  const indicator = readFileSync(
    'src/components/ModeIndicator.tsx',
    'utf8',
  );
  const layout = readFileSync(
    'src/components/Layout.tsx',
    'utf8',
  );
  const context = readFileSync(
    'src/store/app-context.tsx',
    'utf8',
  );
  const vercel = JSON.parse(
    readFileSync('vercel.json', 'utf8'),
  ) as {
    buildCommand?: string;
    outputDirectory?: string;
    rewrites?: Array<{
      source?: string;
      destination?: string;
    }>;
  };

  assert.match(
    indicator,
    /export function ModeSwitcher/,
  );
  assert.match(
    indicator,
    /setMode\(target\)/,
  );
  assert.match(
    indicator,
    /Use Live Devnet/,
  );
  assert.match(
    layout,
    /<ModeSwitcher compact \/>/,
  );
  assert.match(
    context,
    /setWalletAddress\(null\)/,
  );
  assert.match(
    context,
    /setWalletError\(null\)/,
  );
  assert.match(
    context,
    /\}, \[mode\]\);/,
  );

  assert.equal(
    vercel.buildCommand,
    'npm run build',
  );
  assert.equal(
    vercel.outputDirectory,
    'dist',
  );
  assert.deepEqual(
    vercel.rewrites,
    [
      {
        source: '/(.*)',
        destination: '/index.html',
      },
    ],
  );
});
