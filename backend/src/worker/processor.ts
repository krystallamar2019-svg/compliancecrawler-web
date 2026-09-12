import type { Job } from 'bullmq';
import { analyzePage, type FindingDraft } from '../analysis/rules.js';
import { crawlPublicSite } from '../crawler/index.js';
import { supabaseAdmin } from '../lib/supabase.js';
import { generateReportScores } from '../reports/generateReport.js';
import { enqueueCapHubEvent } from '../queue/caphubQueue.js';
import type { ScanQueuePayload } from '../queue/scanQueue.js';

function safeWorkerError(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  const allowed = new Set([
    'INVALID_URL',
    'UNSUPPORTED_URL_SCHEME',
    'URL_CREDENTIALS_NOT_ALLOWED',
    'HOST_REQUIRED',
    'LOCALHOST_BLOCKED',
    'NON_STANDARD_PORT_BLOCKED',
    'INVALID_RESOLVED_IP',
    'NON_PUBLIC_IP_BLOCKED',
    'DNS_RESOLUTION_FAILED',
    'DNS_RESOLUTION_EMPTY',
    'DNS_REBINDING_DETECTED',
    'PAGE_TOTAL_TIMEOUT',
    'NO_HTTP_RESPONSE',
    'UNSUPPORTED_CONTENT_TYPE',
    'DOCUMENT_TOO_LARGE',
  ]);
  return allowed.has(message) ? message : 'SCAN_PROCESSING_FAILED';
}

async function setStatus(scanId: string, organizationId: string, status: string, extra: Record<string, unknown> = {}) {
  const terminal = status === 'Completed' || status === 'Failed' || status === 'Canceled';
  const { error } = await supabaseAdmin
    .from('scan_jobs')
    .update({
      status,
      ...(terminal ? { lease_expires_at: null } : {}),
      ...extra,
    })
    .eq('id', scanId)
    .eq('organization_id', organizationId);
  if (error) throw error;
}

export async function processScanPayload(payload: ScanQueuePayload) {
  const { scanId, organizationId } = payload;

  const { data: scan, error: scanError } = await supabaseAdmin
    .from('scan_jobs')
    .select('id,organization_id,site_id,review_type,status,normalized_target,page_limit')
    .eq('id', scanId)
    .eq('organization_id', organizationId)
    .single();
  if (scanError) throw scanError;

  await setStatus(scanId, organizationId, 'Running', {
    started_at: new Date().toISOString(),
    failed_at: null,
    safe_error_code: null,
  });

  void enqueueCapHubEvent({
    eventId: `scan-${scanId}-started`,
    eventType: 'scan.started',
    supabase_org_id: organizationId,
    scanId,
    scanStatus: 'Running',
  }).catch(() => undefined);

  await supabaseAdmin.from('findings').delete().eq('scan_job_id', scanId).eq('org_id', organizationId);
  await supabaseAdmin.from('reports').delete().eq('scan_job_id', scanId).eq('organization_id', organizationId);
  await supabaseAdmin.from('scan_pages').delete().eq('scan_job_id', scanId).eq('organization_id', organizationId);

  try {
    const pages = await crawlPublicSite(scan.normalized_target, scan.page_limit);
    if (pages.length === 0) throw new Error('NO_HTTP_RESPONSE');

    await setStatus(scanId, organizationId, 'Processing findings');
    const allFindings: FindingDraft[] = [];

    for (const page of pages) {
      const { data: pageRow, error: pageError } = await supabaseAdmin
        .from('scan_pages')
        .insert({
          organization_id: organizationId,
          scan_job_id: scanId,
          normalized_url: page.url,
          page_title: page.title,
          http_status: page.httpStatus,
          content_hash: page.contentHash,
          scan_status: 'completed',
        })
        .select('id')
        .single();
      if (pageError) throw pageError;

      const findings = analyzePage(page);
      allFindings.push(...findings);

      if (findings.length > 0) {
        const { error: findingError } = await supabaseAdmin.from('findings').insert(
          findings.map((finding) => ({
            org_id: organizationId,
            scan_job_id: scanId,
            scan_page_id: pageRow.id,
            category: finding.category,
            rule_code: finding.ruleCode,
            severity: finding.severity,
            title: finding.title,
            description: finding.explanation,
            plain_language_explanation: finding.explanation,
            evidence: {
              excerpt: finding.evidenceExcerpt,
              sourceLocation: finding.sourceLocation,
              confidence: finding.confidence,
              humanJudgmentRequired: true,
            },
            evidence_excerpt: finding.evidenceExcerpt,
            source_location: finding.sourceLocation,
            standard_reference: finding.standardReference,
            remediation: finding.recommendation,
            recommendation: finding.recommendation,
            suggested_revision: finding.suggestedRevision,
            confidence: finding.confidence,
            deterministic: finding.deterministic,
            autofix_available: false,
          })),
        );
        if (findingError) throw findingError;
      }
    }

    await setStatus(scanId, organizationId, 'Generating report');
    const scores = generateReportScores(allFindings);

    const { data: report, error: reportError } = await supabaseAdmin.from('reports').insert({
      organization_id: organizationId,
      scan_job_id: scanId,
      overall_score: scores.overallScore,
      compliance_score: scores.complianceScore,
      clarity_score: scores.clarityScore,
      accessibility_score: scores.accessibilityScore,
      privacy_score: scores.privacyScore,
      technical_score: scores.technicalScore,
      alignment_score: scores.alignmentScore,
      summary: scores.summary,
    }).select('id').single();
    if (reportError) throw reportError;

    const now = new Date().toISOString();
    await setStatus(scanId, organizationId, 'Completed', { completed_at: now });

    const { error: ledgerError } = await supabaseAdmin
      .from('usage_ledger')
      .update({ status: 'consumed', units_consumed: 1, updated_at: now })
      .eq('scan_job_id', scanId)
      .eq('organization_id', organizationId);
    if (ledgerError) throw ledgerError;

    if (scan.site_id) {
      await supabaseAdmin.from('sites').update({
        current_score: scores.overallScore,
        accessibility_score: scores.accessibilityScore,
        privacy_score: scores.privacyScore,
        last_scan_at: now,
        updated_at: now,
      }).eq('id', scan.site_id).eq('org_id', organizationId);
    }

    const critical = allFindings.filter((finding) => finding.severity === 'Critical').length;
    const high = allFindings.filter((finding) => finding.severity === 'High').length;
    void enqueueCapHubEvent({
      eventId: `scan-${scanId}-completed`,
      eventType: 'scan.completed',
      supabase_org_id: organizationId,
      scanId,
      scanStatus: 'Completed',
      scoreSummary: { overall: scores.overallScore, high, critical },
      reportReadyPath: `/reports/${report.id}`,
    }).catch(() => undefined);

    return {
      scanId,
      pagesScanned: pages.length,
      findings: allFindings.length,
      overallScore: scores.overallScore,
    };
  } catch (error) {
    await setStatus(scanId, organizationId, 'Failed', {
      failed_at: new Date().toISOString(),
      safe_error_code: safeWorkerError(error),
    }).catch(() => undefined);
    throw error;
  }
}

export async function processScan(job: Job<ScanQueuePayload>) {
  return processScanPayload(job.data);
}
