import assert from 'node:assert/strict';
import test from 'node:test';
import type { FindingDraft } from '../analysis/rules.js';
import { generateReportScores } from '../reports/generateReport.js';

function finding(category: string, severity: FindingDraft['severity']): FindingDraft {
  return {
    category,
    severity,
    ruleCode: 'TEST_RULE',
    title: 'Test finding',
    explanation: 'Human judgment is required.',
    evidenceExcerpt: null,
    sourceLocation: 'https://example.com/',
    recommendation: 'Review it.',
    suggestedRevision: null,
    confidence: 1,
    standardReference: null,
    deterministic: true,
  };
}

test('scores only the categories actually checked', () => {
  const report = generateReportScores([
    finding('Accessibility', 'High'),
    finding('Privacy', 'Medium'),
    finding('Earnings Claims', 'High'),
    finding('Technical', 'Informational'),
  ]);

  assert.equal(report.accessibilityScore, 82);
  assert.equal(report.privacyScore, 92);
  assert.equal(report.complianceScore, 82);
  assert.equal(report.technicalScore, 100);
  assert.equal(report.alignmentScore, null);
  assert.match(report.summary, /not a certification of legal compliance/i);
  assert.match(report.summary, /Human judgment is required/i);
});

test('never manufactures an alignment score when no brand-alignment engine ran', () => {
  const report = generateReportScores([]);
  assert.equal(report.alignmentScore, null);
  assert.equal(report.overallScore, 100);
  assert.match(report.summary, /checks BrandedAlign actually ran/i);
});
