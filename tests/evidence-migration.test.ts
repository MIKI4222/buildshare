import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { emptyDB } from '../src/data/demo-seed';
import type { Contribution } from '../src/domain/types';
import { migrateEvidenceSchemas } from '../src/store/evidence-migration';

function contribution(
  evidenceHash: string | null,
  schema: string | null | undefined,
): Contribution {
  const value = {
    id: 'ctr_1',
    projectId: 'prj_1',
    taskId: 'tsk_1',
    userId: 'usr_1',
    pullRequestId: 'pr_1',
    attempt: 1,
    rewardBps: 100,
    status: 'SUBMITTED' as const,
    commitmentHash: 'a'.repeat(64),
    evidenceHash,
    evidenceSchemaVersion: schema,
    aiScore: null,
    aiRecommendation: null,
    aiEvaluationHash: null,
    verificationReason: null,
    settlement: null,
    allocationError: null,
    rejectReason: null,
    rejectedBy: null,
    rejectedAt: null,
    createdAt: '2026-09-20T00:00:00.000Z',
    verifiedAt: null,
    approvedAt: null,
  };
  if (schema === undefined) {
    delete (value as Partial<Contribution>).evidenceSchemaVersion;
  }
  return value as Contribution;
}

describe('Evidence schema storage migration', () => {
  it('tags a pre-field non-null hash as the known historical Evidence v1', () => {
    const db = {
      ...emptyDB(),
      contributions: [contribution('b'.repeat(64), undefined)],
    };
    const migrated = migrateEvidenceSchemas(db);
    assert.equal(
      migrated.contributions[0].evidenceSchemaVersion,
      'buildshare-evidence-v1',
    );
    assert.equal(migrated.contributions[0].evidenceHash, 'b'.repeat(64));
  });

  it('keeps a pre-field unsealed contribution explicitly unversioned', () => {
    const db = {
      ...emptyDB(),
      contributions: [contribution(null, undefined)],
    };
    const migrated = migrateEvidenceSchemas(db);
    assert.equal(migrated.contributions[0].evidenceSchemaVersion, null);
  });

  it('preserves an explicitly versioned Evidence v2 record unchanged', () => {
    const original = contribution(
      'c'.repeat(64),
      'buildshare-submission-evidence-v2',
    );
    const db = { ...emptyDB(), contributions: [original] };
    const migrated = migrateEvidenceSchemas(db);
    assert.equal(migrated, db);
    assert.equal(migrated.contributions[0], original);
  });
});
