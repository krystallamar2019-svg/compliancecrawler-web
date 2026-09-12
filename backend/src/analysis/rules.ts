import type { CrawledPage } from '../crawler/crawl.js';

export type FindingSeverity = 'Critical' | 'High' | 'Medium' | 'Low' | 'Informational';

export interface FindingDraft {
  category: string;
  ruleCode: string;
  severity: FindingSeverity;
  title: string;
  explanation: string;
  evidenceExcerpt: string | null;
  sourceLocation: string;
  recommendation: string;
  suggestedRevision: string | null;
  confidence: number;
  standardReference: string | null;
  deterministic: boolean;
}

const HUMAN_REVIEW = 'Human judgment is required; this screening result is not a legal determination.';

function excerptAround(text: string, pattern: RegExp) {
  const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
  const match = new RegExp(pattern.source, flags).exec(text);
  if (!match || match.index === undefined) return null;
  const start = Math.max(match.index - 120, 0);
  const end = Math.min(match.index + match[0].length + 160, text.length);
  return text.slice(start, end).trim();
}

function addCountFinding(
  findings: FindingDraft[],
  page: CrawledPage,
  count: number,
  options: Omit<FindingDraft, 'evidenceExcerpt' | 'sourceLocation'>,
) {
  if (count <= 0) return;
  findings.push({
    ...options,
    evidenceExcerpt: `${count} element${count === 1 ? '' : 's'} detected on the page.`,
    sourceLocation: page.url,
  });
}

export function analyzePage(page: CrawledPage): FindingDraft[] {
  const findings: FindingDraft[] = [];

  addCountFinding(findings, page, page.imagesMissingAlt, {
    category: 'Accessibility',
    ruleCode: 'A11Y_IMG_ALT_REVIEW',
    severity: 'Medium',
    title: 'Images without alt attributes need accessibility review',
    explanation: `Images without alt attributes can create an accessibility barrier when the image conveys content. Decorative images can use an empty alt attribute. ${HUMAN_REVIEW}`,
    recommendation: 'Review each flagged image. Add meaningful alt text when the image conveys information, or alt="" when it is purely decorative.',
    suggestedRevision: null,
    confidence: 0.98,
    standardReference: 'WCAG 2.2 — Text Alternatives',
    deterministic: true,
  });

  addCountFinding(findings, page, page.formControlsMissingLabels, {
    category: 'Accessibility',
    ruleCode: 'A11Y_FORM_LABEL_REVIEW',
    severity: 'High',
    title: 'Form controls may be missing accessible labels',
    explanation: `Form fields need an accessible name so people using assistive technology can understand what information is requested. ${HUMAN_REVIEW}`,
    recommendation: 'Associate each control with a visible label or an appropriate accessible-name technique and test the completed form with accessibility tooling.',
    suggestedRevision: null,
    confidence: 0.96,
    standardReference: 'WCAG 2.2 — Labels or Instructions / Name, Role, Value',
    deterministic: true,
  });

  addCountFinding(findings, page, page.buttonsMissingName + page.linksMissingName, {
    category: 'Accessibility',
    ruleCode: 'A11Y_CONTROL_NAME_REVIEW',
    severity: 'Medium',
    title: 'Interactive controls may be missing accessible names',
    explanation: `Links and buttons need an understandable accessible name. Empty controls can be difficult or impossible to identify with assistive technology. ${HUMAN_REVIEW}`,
    recommendation: 'Give each interactive control descriptive visible text or an appropriate accessible name.',
    suggestedRevision: null,
    confidence: 0.95,
    standardReference: 'WCAG 2.2 — Link Purpose / Name, Role, Value',
    deterministic: true,
  });

  if (!page.title) {
    findings.push({
      category: 'Technical',
      ruleCode: 'DOC_TITLE_MISSING',
      severity: 'Low',
      title: 'Page title is missing',
      explanation: `The document does not expose a page title. A descriptive title helps orientation, browser navigation, and search presentation. ${HUMAN_REVIEW}`,
      evidenceExcerpt: null,
      sourceLocation: page.url,
      recommendation: 'Add a concise, specific HTML <title> that identifies the page and brand.',
      suggestedRevision: null,
      confidence: 1,
      standardReference: 'WCAG 2.2 — Page Titled',
      deterministic: true,
    });
  }

  if (page.h1Count === 0 || page.h1Count > 1) {
    findings.push({
      category: 'Clarity',
      ruleCode: 'HEADING_STRUCTURE_REVIEW',
      severity: 'Low',
      title: page.h1Count === 0 ? 'No H1 heading detected' : 'Multiple H1 headings detected',
      explanation: `Heading structure affects page clarity and can affect navigation for assistive technology. The scanner detected ${page.h1Count} H1 headings. ${HUMAN_REVIEW}`,
      evidenceExcerpt: `${page.h1Count} H1 heading${page.h1Count === 1 ? '' : 's'} detected.`,
      sourceLocation: page.url,
      recommendation: 'Review the page heading hierarchy so the primary topic is clear and lower-level headings follow a meaningful structure.',
      suggestedRevision: null,
      confidence: 0.95,
      standardReference: null,
      deterministic: true,
    });
  }

  if (!page.metaDescription) {
    findings.push({
      category: 'Technical',
      ruleCode: 'META_DESCRIPTION_MISSING',
      severity: 'Informational',
      title: 'Meta description is missing',
      explanation: `No meta description was detected. This is primarily a search-presentation and messaging opportunity rather than a legal compliance finding. ${HUMAN_REVIEW}`,
      evidenceExcerpt: null,
      sourceLocation: page.url,
      recommendation: 'Consider adding a concise description that accurately summarizes the page without unsupported claims.',
      suggestedRevision: null,
      confidence: 1,
      standardReference: null,
      deterministic: true,
    });
  }

  if (page.formControlsMissingLabels > 0 && !page.hasPrivacyLink) {
    findings.push({
      category: 'Privacy',
      ruleCode: 'PRIVACY_NOTICE_VISIBILITY_REVIEW',
      severity: 'Medium',
      title: 'Data-collection area may need a visible privacy notice review',
      explanation: `The page contains form controls and the crawler did not detect a visible privacy link on the page. Whether a notice is legally required, and what it must contain, depends on the data collected and applicable law. ${HUMAN_REVIEW}`,
      evidenceExcerpt: 'Form controls detected; no visible link containing “privacy” was detected.',
      sourceLocation: page.url,
      recommendation: 'Confirm what data the form collects, where it goes, and whether an applicable privacy notice or consent disclosure is easy to find at the point of collection.',
      suggestedRevision: null,
      confidence: 0.72,
      standardReference: null,
      deterministic: true,
    });
  }

  const earningsPattern = /(?:earn|make|income|profit|revenue|replace\s+(?:your|my)\s+income|financial\s+freedom|six[ -]?figures?)[^.!?\n]{0,90}(?:\$\s?\d[\d,.]*|per\s+(?:day|week|month|year)|quit\s+(?:your|my)\s+job)/i;
  const earningsExcerpt = excerptAround(page.text, earningsPattern);
  if (earningsExcerpt) {
    findings.push({
      category: 'Earnings Claims',
      ruleCode: 'EARNINGS_CLAIM_HUMAN_REVIEW',
      severity: 'High',
      title: 'Potential earnings or lifestyle claim language detected',
      explanation: `The page contains language that may communicate an earnings or lifestyle result. BrandedAlign is flagging the language for substantiation and net-impression review, not declaring it unlawful. ${HUMAN_REVIEW}`,
      evidenceExcerpt: earningsExcerpt,
      sourceLocation: page.url,
      recommendation: 'Review the exact claim, the overall impression, the evidence supporting the claimed result, typicality, and any disclosures. Compare it with the current BrandedAlign earnings-claims deep dive and its official source.',
      suggestedRevision: null,
      confidence: 0.74,
      standardReference: 'BrandedAlign deep dive: earnings-lifestyle-claims',
      deterministic: true,
    });
  }

  const healthPattern = /(?:cure|treat|heal|reverse|prevent|eliminate|detox|clinically proven|doctor recommended|reduce(?:s|d)?\s+(?:pain|inflammation|anxiety|depression|blood pressure|blood sugar)|boost(?:s|ed)?\s+immunity)/i;
  const healthExcerpt = excerptAround(page.text, healthPattern);
  if (healthExcerpt) {
    findings.push({
      category: 'Health & Wellness Claims',
      ruleCode: 'HEALTH_CLAIM_HUMAN_REVIEW',
      severity: 'High',
      title: 'Potential health-benefit claim language detected',
      explanation: `The page contains language that may communicate a health or wellness benefit. BrandedAlign is flagging it for evidence and net-impression review, not deciding whether the claim is lawful or scientifically supported. ${HUMAN_REVIEW}`,
      evidenceExcerpt: healthExcerpt,
      sourceLocation: page.url,
      recommendation: 'Review the exact wording, implied message, evidence quality, product category, audience, and disclosures. Compare it with the current BrandedAlign health-and-wellness deep dive and its official source.',
      suggestedRevision: null,
      confidence: 0.76,
      standardReference: 'BrandedAlign deep dive: health-wellness-claims',
      deterministic: true,
    });
  }

  return findings;
}
