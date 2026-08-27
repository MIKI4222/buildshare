import type {
  AIProvider,
  ContributionVerification,
  ContributionVerificationInput,
} from './types';
import { calculateOverallScore, scoreToRecommendation } from './types';

// DemoAIProvider — deterministic, no external API key required.
// Produces realistic-looking verification results derived from the input.
export class DemoAIProvider implements AIProvider {
  readonly name = 'DemoAIProvider';
  readonly promptVersion = 'buildshare-ai-v1';

  async verifyContribution(input: ContributionVerificationInput): Promise<ContributionVerification> {
    await delay(900 + Math.random() * 600);

    // Derive a pseudo-deterministic score from the input so it's stable per task.
    const seed = hashString(input.taskTitle + input.prTitle + input.commitSha);
    const base = 78 + (seed % 20); // 78–97

    const requirementsScore = clampScore(base + 2);
    const qualityScore = clampScore(base - 3);
    const testsScore = clampScore(base - 1 + (input.changedFiles.length > 3 ? 3 : 0));
    const securityScore = clampScore(base + 1);
    const score = calculateOverallScore(requirementsScore, qualityScore, testsScore, securityScore);
    const recommendation = scoreToRecommendation(score);

    return {
      score,
      requirementsScore,
      qualityScore,
      testsScore,
      securityScore,
      recommendation,
      reason: buildReason(input, recommendation, score),
      codeSummary: buildSummary(input),
    };
  }
}

function clampScore(n: number): number {
  return Math.max(0, Math.min(100, n));
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function buildReason(
  input: ContributionVerificationInput,
  rec: 'APPROVE' | 'REVIEW' | 'REJECT',
  score: number,
): string {
  const lines: string[] = [];
  lines.push(`Evaluated PR "${input.prTitle}" against task "${input.taskTitle}".`);
  lines.push(`${input.changedFiles.length} file(s) changed (+${input.additions}/-${input.deletions}).`);
  if (rec === 'APPROVE') {
    lines.push(`Acceptance criteria appear satisfied. Overall score ${score}/100 — recommending approval.`);
  } else if (rec === 'REVIEW') {
    lines.push(`Partial coverage of acceptance criteria. Overall score ${score}/100 — manual review advised.`);
  } else {
    lines.push(`Insufficient coverage of acceptance criteria. Overall score ${score}/100 — recommending rejection.`);
  }
  return lines.join(' ');
}

function buildSummary(input: ContributionVerificationInput): string {
  return `Contribution touches ${input.changedFiles.length} files ` +
    `(+${input.additions}/-${input.deletions}) on commit ${input.commitSha.slice(0, 7)}. ` +
    `Submitted against "${input.taskTitle}".`;
}
