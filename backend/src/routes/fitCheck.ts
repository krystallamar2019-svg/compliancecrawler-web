import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { analyzePage } from '../analysis/rules.js';
import { crawlPublicSite } from '../crawler/index.js';
import { supabaseAdmin } from '../lib/supabase.js';
import { generateReportScores } from '../reports/generateReport.js';
import { UnsafeUrlError } from '../security/urlSafety.js';

export const fitCheckRouter = Router();

const schema = z.object({
  url: z.string().min(1).max(2_048),
});

function recommendationFor(score: number) {
  if (score >= 90) return 'No major automated screening concerns were found on this page. Human review is still required before relying on the result.';
  if (score >= 75) return 'A few items deserve review before publishing. Use the findings as a starting point, not a legal determination.';
  return 'Several items deserve closer review before publishing. Consider a fuller review and qualified professional advice where the stakes are high.';
}

fitCheckRouter.post('/', async (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'INVALID_FIT_CHECK_REQUEST' });
    return;
  }

  try {
    const pages = await crawlPublicSite(parsed.data.url, 1);
    const page = pages[0];
    if (!page) {
      res.status(422).json({ error: 'FIT_CHECK_UNAVAILABLE' });
      return;
    }

    const findings = analyzePage(page);
    const scores = generateReportScores(findings);
    const recommendation = recommendationFor(scores.overallScore);

    await supabaseAdmin.from('fit_check_results').insert({
      anonymous_session_id: randomUUID(),
      score: scores.overallScore,
      recommendation,
      consent_level: 'anonymous_no_account',
    }).then(({ error }) => {
      if (error) throw error;
    });

    res.json({
      score: scores.overallScore,
      pages_scanned: 1,
      findings: findings.slice(0, 5).map((finding) => ({
        title: finding.title,
        category: finding.category,
        severity: finding.severity,
      })),
      recommendation,
      human_judgment_required: true,
      disclaimer: 'Automated educational screening only. This is not legal advice or a guarantee of compliance.',
    });
  } catch (error) {
    if (error instanceof UnsafeUrlError) {
      res.status(400).json({ error: 'UNSAFE_OR_UNSUPPORTED_URL' });
      return;
    }
    res.status(422).json({ error: 'FIT_CHECK_UNAVAILABLE' });
  }
});
