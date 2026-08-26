// AI Provider abstraction.
// The same interface is implemented by DemoAIProvider (no API key) and a future
// LiveAIProvider (calls a real model). The ContributionService only depends on
// this interface, never on a concrete provider.

export interface ContributionVerificationInput {
  taskTitle: string;
  taskDescription: string;
  acceptanceCriteria: string;
  prTitle: string;
  prDescription: string;
  changedFiles: string[];
  additions: number;
  deletions: number;
  commitSha: string;
}

export interface ContributionVerification {
  score: number;
  requirementsScore: number;
  qualityScore: number;
  testsScore: number;
  securityScore: number;
  recommendation: 'APPROVE' | 'REVIEW' | 'REJECT';
  reason: string;
  codeSummary: string;
}

export interface AIProvider {
  readonly name: string;
  readonly promptVersion: string;
  verifyContribution(input: ContributionVerificationInput): Promise<ContributionVerification>;
}

// Scoring weights — Requirements 40%, Quality 20%, Tests 20%, Security 20%.
export const SCORE_WEIGHTS = {
  requirements: 0.4,
  quality: 0.2,
  tests: 0.2,
  security: 0.2,
};

export function calculateOverallScore(
  requirements: number,
  quality: number,
  tests: number,
  security: number,
): number {
  return Math.round(
    requirements * SCORE_WEIGHTS.requirements +
    quality * SCORE_WEIGHTS.quality +
    tests * SCORE_WEIGHTS.tests +
    security * SCORE_WEIGHTS.security,
  );
}

export function scoreToRecommendation(score: number): 'APPROVE' | 'REVIEW' | 'REJECT' {
  if (score >= 90) return 'APPROVE';
  if (score >= 70) return 'REVIEW';
  return 'REJECT';
}
