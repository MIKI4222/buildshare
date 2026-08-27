// ContributionService — orchestrates the contribution lifecycle.
// Depends on provider interfaces, not concrete implementations.

import type { AIProvider, ContributionVerificationInput } from '../providers/ai/types';
import type { SolanaProvider } from '../providers/solana/types';
import { calculateOverallScore, scoreToRecommendation } from '../providers/ai/types';
import { computeEvidenceHash, type ContributionEvidence } from '../domain/evidence';

export interface VerifyResult {
  score: number;
  requirementsScore: number;
  qualityScore: number;
  testsScore: number;
  securityScore: number;
  recommendation: 'APPROVE' | 'REVIEW' | 'REJECT';
  reason: string;
  codeSummary: string;
  evidenceHash: string;
}

export class ContributionService {
  constructor(
    private ai: AIProvider,
    private solana: SolanaProvider,
  ) {}

  async verify(input: ContributionVerificationInput, evidence: ContributionEvidence): Promise<VerifyResult> {
    const result = await this.ai.verifyContribution(input);
    const evidenceHash = await computeEvidenceHash(evidence);
    return {
      score: result.score,
      requirementsScore: result.requirementsScore,
      qualityScore: result.qualityScore,
      testsScore: result.testsScore,
      securityScore: result.securityScore,
      recommendation: result.recommendation,
      reason: result.reason,
      codeSummary: result.codeSummary,
      evidenceHash,
    };
  }

  calculateScore(
    requirements: number,
    quality: number,
    tests: number,
    security: number,
  ): number {
    return calculateOverallScore(requirements, quality, tests, security);
  }

  recommendation(score: number): 'APPROVE' | 'REVIEW' | 'REJECT' {
    return scoreToRecommendation(score);
  }

  async allocateOwnership(params: {
    contributorWallet: string;
    projectId: string;
    taskId: string;
    rewardBps: number;
    evidenceHash: string;
  }) {
    return this.solana.allocateOwnership(params);
  }
}
