import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import type { AuthenticatedRequest } from '../types/auth.js';

export const reportsRouter = Router();

reportsRouter.get('/', async (req, res, next) => {
  try {
    const { organizationId } = (req as AuthenticatedRequest).auth;
    const page = Math.max(Number(req.query.page) || 1, 1);
    const pageSize = Math.min(Math.max(Number(req.query.pageSize) || 20, 1), 100);
    const from = (page - 1) * pageSize;

    const { data, error, count } = await supabaseAdmin
      .from('reports')
      .select('id,scan_job_id,overall_score,compliance_score,clarity_score,accessibility_score,privacy_score,technical_score,alignment_score,summary,generated_at', { count: 'exact' })
      .eq('organization_id', organizationId)
      .order('generated_at', { ascending: false })
      .range(from, from + pageSize - 1);
    if (error) throw error;

    res.json({ reports: data ?? [], page, pageSize, total: count ?? 0 });
  } catch (error) {
    next(error);
  }
});

reportsRouter.get('/:id', async (req, res, next) => {
  try {
    const { organizationId } = (req as AuthenticatedRequest).auth;
    const { data: report, error: reportError } = await supabaseAdmin
      .from('reports')
      .select('id,scan_job_id,overall_score,compliance_score,clarity_score,accessibility_score,privacy_score,technical_score,alignment_score,summary,generated_at')
      .eq('id', req.params.id)
      .eq('organization_id', organizationId)
      .maybeSingle();
    if (reportError) throw reportError;
    if (!report) {
      res.status(404).json({ error: 'REPORT_NOT_FOUND' });
      return;
    }

    const { data: findings, error: findingsError } = await supabaseAdmin
      .from('findings')
      .select('id,scan_page_id,category,severity,title,plain_language_explanation,evidence_excerpt,source_location,recommendation,suggested_revision,confidence,standard_reference,created_at')
      .eq('scan_job_id', report.scan_job_id)
      .eq('org_id', organizationId)
      .order('created_at', { ascending: true });
    if (findingsError) throw findingsError;

    res.json({ report, findings: findings ?? [] });
  } catch (error) {
    next(error);
  }
});
