import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzePage } from '../analysis/rules.js';
import type { CrawledPage } from '../crawler/crawl.js';

function page(text: string): CrawledPage {
  return {
    url: 'https://example.com/',
    title: 'Example',
    httpStatus: 200,
    contentHash: 'hash',
    text,
    metaDescription: 'Example description',
    h1Count: 1,
    imagesMissingAlt: 0,
    formControlsMissingLabels: 0,
    buttonsMissingName: 0,
    linksMissingName: 0,
    hasPrivacyLink: true,
    hasTermsLink: true,
    links: [],
  };
}

test('flags potential earnings language without declaring illegality', () => {
  const findings = analyzePage(page('Learn how I earn $5,000 per month with this system.'));
  const result = findings.find((finding) => finding.ruleCode === 'EARNINGS_CLAIM_HUMAN_REVIEW');
  assert.ok(result);
  assert.match(result.explanation, /not declaring it unlawful/i);
  assert.match(result.explanation, /Human judgment is required/i);
});

test('flags potential health language without claiming scientific or legal certainty', () => {
  const findings = analyzePage(page('This formula can reduce inflammation fast.'));
  const result = findings.find((finding) => finding.ruleCode === 'HEALTH_CLAIM_HUMAN_REVIEW');
  assert.ok(result);
  assert.match(result.explanation, /not deciding whether the claim is lawful or scientifically supported/i);
});
