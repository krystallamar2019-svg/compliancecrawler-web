import { createHash, randomBytes } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { requireAdmin, requireRecentAdminAuth } from '../middleware/admin.js';
import { supabaseAdmin } from '../lib/supabase.js';
import { writeAuditLog } from '../lib/audit.js';
import type { AuthenticatedRequest } from '../types/auth.js';

export const adminRouter = Router();

adminRouter.use(requireAdmin());

adminRouter.get('/me', (req, res) => {
  const auth = (req as AuthenticatedRequest).auth;
  res.json({
    userId: auth.userId,
    roles: auth.adminRoles ?? [],
    mfa: auth.aal === 'aal2',
  });
});

const manualVerifySchema = z.object({
  reason: z.string().trim().min(10).max(500),
});

adminRouter.post(
  '/sites/:id/manual-verify',
  requireAdmin(['Analyst', 'Security Administrator', 'Super Administrator']),
  requireRecentAdminAuth(),
  async (req, res, next) => {
    try {
      const parsed = manualVerifySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'MANUAL_REVIEW_REASON_REQUIRED' });
        return;
      }

      const { data: site, error: siteError } = await supabaseAdmin
        .from('sites')
        .select('id,org_id,normalized_host,is_active')
        .eq('id', req.params.id)
        .maybeSingle();
      if (siteError) throw siteError;
      if (!site || !site.is_active) {
        res.status(404).json({ error: 'SITE_NOT_FOUND' });
        return;
      }

      const verifiedAt = new Date().toISOString();
      const internalTokenHash = createHash('sha256')
        .update(`manual:${randomBytes(32).toString('hex')}`)
        .digest('hex');

      const { error: verificationError } = await supabaseAdmin.from('domain_verifications').insert({
        organization_id: site.org_id,
        site_id: site.id,
        method: 'manual_admin',
        token_hash: internalTokenHash,
        status: 'verified',
        expires_at: verifiedAt,
        verified_at: verifiedAt,
      });
      if (verificationError) throw verificationError;

      const { error: updateError } = await supabaseAdmin.from('sites').update({
        verification_status: 'verified',
        verification_method: 'manual_admin',
        verified_at: verifiedAt,
        verification_checked_at: verifiedAt,
        updated_at: verifiedAt,
      }).eq('id', site.id).eq('org_id', site.org_id);
      if (updateError) throw updateError;

      await writeAuditLog(req, {
        organizationId: site.org_id,
        action: 'site.manual_verification_approved',
        targetType: 'site',
        targetId: site.id,
        metadata: {
          host: site.normalized_host,
          reason: parsed.data.reason,
        },
      });

      res.json({ siteId: site.id, verified: true, verifiedAt });
    } catch (error) {
      next(error);
    }
  },
);
