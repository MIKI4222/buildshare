// Domain errors. Every P0 invariant violation throws a typed DomainError so
// that the UI can never silently continue with an invalid state.

export type DomainErrorCode =
  | 'PROJECT_NOT_FOUND'
  | 'TASK_NOT_FOUND'
  | 'CONTRIBUTION_NOT_FOUND'
  | 'USER_NOT_FOUND'
  | 'INVALID_SPLIT'
  | 'INVALID_BPS'
  | 'POOL_EXCEEDED'
  | 'INVALID_TRANSITION'
  | 'IMMUTABLE_AFTER_CLAIM'
  | 'NOT_CLAIMABLE'
  | 'CLAIM_EXPIRED'
  | 'NO_COMMITMENT'
  | 'DOUBLE_ALLOCATION'
  | 'REJECT_REASON_REQUIRED'
  | 'NOT_AUTHORIZED'
  | 'INVARIANT_VIOLATION'
  | 'LIVE_MODE_UNAVAILABLE'
  | 'NOT_IMPLEMENTED'
  | 'FAKE_SIGNATURE';

export class DomainError extends Error {
  readonly code: DomainErrorCode;
  readonly details: Record<string, unknown> | undefined;

  constructor(code: DomainErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.details = details;
  }
}

export function domainError(
  code: DomainErrorCode,
  message: string,
  details?: Record<string, unknown>,
): DomainError {
  return new DomainError(code, message, details);
}

export function isDomainError(e: unknown): e is DomainError {
  return e instanceof DomainError;
}

export function assertDomain(
  condition: unknown,
  code: DomainErrorCode,
  message: string,
  details?: Record<string, unknown>,
): asserts condition {
  if (!condition) throw new DomainError(code, message, details);
}
