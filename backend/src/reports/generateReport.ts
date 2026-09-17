import type { FindingDraft, FindingSeverity } from '../analysis/rules.js';

export interface ReportScores {
  overallScore: number;
  complianceScore: number;
  clarityScore: number;
  accessibilityScore: number;
  privacyScore: number;
  technicalScore: number;
  alignmentScore: number | null;
  summary: string;
}

const penalty: Record<FindingSeverity, number> = {
  Critical: 35,
  High: 18,
  Medium: 8,
  Low: 3,
  Informational: 0,
};

function scoreFor(findings: FindingDraft[], categories: string[]) {
  const totalPenalty = findings
    .filter((finding) => categories.includes(finding.category))
    .reduce((sum, finding) => sum + penalty[finding.severity], 0);
  return Math.max(0, Math.min(100, 100 - totalPenalty));
}

export function generateReportScores(findings: FindingDraft[]): ReportScores {
  const complianceScore = scoreFor(findings, [
    'Earnings Claims',
    'Health & Wellness Claims',
    'Advertising & Disclosures',
    'Copyright & Content Use',
  ]);
  const accessibilityScore = scoreFor(findings, ['Accessibility']);
  const privacyScore = scoreFor(findings, ['Privacy']);
  const clarityScore = scoreFor(findings, ['Clarity']);
  const technicalScore = scoreFor(findings, ['Technical']);

  const overallScore = Math.round(
    (complianceScore + accessibilityScore + privacyScore + clarityScore + technicalScore) / 5,
  );

  const counts = findings.reduce<Record<FindingSeverity, number>>((acc, finding) => {
    acc[finding.severity] += 1;
    return acc;
  }, { Critical: 0, High: 0, Medium: 0, Low: 0, Informational: 0 });

  const summary = [
    `BrandedAlign screening score: ${overallScore}/100.`,
    `${counts.Critical} critical, ${counts.High} high, ${counts.Medium} medium, ${counts.Low} low, and ${counts.Informational} informational finding(s) were detected by the configured screening rules.`,
    'Scores reflect only the checks BrandedAlign actually ran and are prioritization aids, not a certification of legal compliance, accessibility conformance, privacy compliance, or brand alignment.',
    'Human judgment is required for compliance-sensitive findings.',
  ].join(' ');

  return {
    overallScore,
    complianceScore,
    clarityScore,
    accessibilityScore,
    privacyScore,
    technicalScore,
    alignmentScore: null,
    summary,
  };
}
