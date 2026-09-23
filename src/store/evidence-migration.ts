// Dated migration for the pre-Evidence-v2 localStorage baseline.
//
// Before commit 41b6cf6, Contribution had no evidenceSchemaVersion field.
// Every non-null evidence hash produced by that code was buildshare-evidence-v1
// because the only writer was approveContribution. This migration records that
// known historical fact; later code must never infer a schema from a hash.

import type { AppDB, Contribution } from '../domain/types';

const LEGACY_SCHEMA = 'buildshare-evidence-v1';

export function migrateEvidenceSchemas(db: AppDB): AppDB {
  let changed = false;
  const contributions = db.contributions.map((contribution) => {
    if (
      Object.prototype.hasOwnProperty.call(
        contribution,
        'evidenceSchemaVersion',
      )
    ) {
      return contribution;
    }
    changed = true;
    return {
      ...contribution,
      evidenceSchemaVersion:
        contribution.evidenceHash === null ? null : LEGACY_SCHEMA,
    } satisfies Contribution;
  });
  return changed ? { ...db, contributions } : db;
}
