// ContributionService - orchestrates verification and allocation through
// provider interfaces. It never mutates state itself: the domain reducers own
// all state changes, this service only talks to the outside world.

import { computeAIEvaluationHash } from '../domain/evidence';
import type { AIRecommendation } from '../domain/types';
import type { AIProvider, ContributionVerificationInput } from '../providers/ai/types';
import { calculateOverallScore, scoreToRecommendation } from '../providers/ai/types';
import type {
  AllocateOwnershipInput,
  SolanaProvider,
  SolanaResult,
} from '../providers/solana/types';

export interface VerifyResult {
  model: string;
  promptVersion: string;
  overallScore: number;
  requirementScore: number;
  qualityScore: number;
  testScore: number;
  securityScore: number;
  recommendation: AIRecommendation;
  reason: string;
  codeSummary: string;
  rawResponse: string;
  evaluationHash: string;
}

export class ContributionService {
  constructor(
    private ai: AIProvider,
    private solana: SolanaProvider,
  ) {}

  get solanaMode(): 'demo' | 'live' {
    return this.solana.mode;
  }

  async verify(input: ContributionVerificationInput): Promise<VerifyResult> {
    const result = await this.ai.verifyContribution(input);
    const rawResponse = JSON.stringify(result);
    const evaluationHash = await computeAIEvaluationHash({
      model: this.ai.name,
      promptVersion: this.ai.promptVersion,
      overallScore: result.score,
      recommendation: result.recommendation,
      rawResponse,
    });
    return {
      model: this.ai.name,
      promptVersion: this.ai.promptVersion,
      overallScore: result.score,
      requirementScore: result.requirementsScore,
      qualityScore: result.qualityScore,
      testScore: result.testsScore,
      securityScore: result.securityScore,
      recommendation: result.recommendation,
      reason: result.reason,
      codeSummary: result.codeSummary,
      rawResponse,
      evaluationHash,
    };
  }

  calculateScore(requirements: number, quality: number, tests: number, security: number): number {
    return calculateOverallScore(requirements, quality, tests, security);
  }

  recommendation(score: number): AIRecommendation {
    return scoreToRecommendation(score);
  }

  // Returns a discriminated SolanaResult. A demo result cannot carry a
  // signature; a live result only exists if a real transaction happened.
  async allocateOwnership(input: AllocateOwnershipInput): Promise<SolanaResult> {
    return this.solana.allocateOwnership(input);
  }
}
