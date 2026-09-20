import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  base58Encode,
  CONTRIBUTION_ACCOUNT_LEN,
  CONTRIBUTION_STATUS_NAMES,
  decodeContributionAccount,
} from '../src/lib/solana/decode';

function buildContribution(values: {
  status?: number;
  attempt?: number;
  approvedAt?: bigint;
  rejectedAt?: bigint;
  allocated?: number;
} = {}): Uint8Array {
  const data = new Uint8Array(CONTRIBUTION_ACCOUNT_LEN);
  const view = new DataView(data.buffer);
  data.set(new Uint8Array(32).fill(7), 8);
  data.set(new Uint8Array(32).fill(9), 40);
  data[72] = values.attempt === undefined ? 2 : values.attempt;
  data[73] = values.status === undefined ? 0 : values.status;
  data.fill(0xaa, 74, 106);
  data.fill(0xbb, 106, 138);
  data.fill(0xcc, 138, 170);
  view.setBigInt64(
    170,
    values.approvedAt === undefined ? 0n : values.approvedAt,
    true,
  );
  view.setBigInt64(
    178,
    values.rejectedAt === undefined ? 0n : values.rejectedAt,
    true,
  );
  data[186] = values.allocated === undefined ? 0 : values.allocated;
  data[187] = 254;
  return data;
}

test('decodeContributionAccount reads every frozen field', () => {
  const data = buildContribution({
    status: 2,
    attempt: 3,
    approvedAt: 17n,
    rejectedAt: 25n,
    allocated: 0,
  });
  const contribution = decodeContributionAccount(data);

  assert.equal(
    contribution.task,
    base58Encode(new Uint8Array(32).fill(7)),
  );
  assert.equal(
    contribution.contributor,
    base58Encode(new Uint8Array(32).fill(9)),
  );
  assert.equal(contribution.attempt, 3);
  assert.equal(contribution.status, 'REJECTED');
  assert.equal(contribution.statusCode, 2);
  assert.equal(contribution.commitmentHash, 'aa'.repeat(32));
  assert.equal(contribution.evidenceHash, 'bb'.repeat(32));
  assert.equal(contribution.rejectReasonHash, 'cc'.repeat(32));
  assert.equal(contribution.approvedAt, '17');
  assert.equal(contribution.rejectedAt, '25');
  assert.equal(contribution.allocated, false);
  assert.equal(contribution.bump, 254);
});

test('Contribution status order matches frozen Rust discriminants', () => {
  assert.deepEqual(Array.from(CONTRIBUTION_STATUS_NAMES), [
    'SUBMITTED',
    'APPROVED',
    'REJECTED',
    'SETTLED',
  ]);
});

test('decodeContributionAccount refuses wrong size and corrupt fields', () => {
  assert.throws(
    () => decodeContributionAccount(new Uint8Array(187)),
    /188 bytes/,
  );

  const badStatus = buildContribution({ status: 4 });
  assert.throws(
    () => decodeContributionAccount(badStatus),
    /ContributionStatus/,
  );

  const badBool = buildContribution({ allocated: 2 });
  assert.throws(
    () => decodeContributionAccount(badBool),
    /Contribution\.allocated/,
  );
});
