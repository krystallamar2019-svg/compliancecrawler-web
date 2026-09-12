import { createHmac } from 'node:crypto';
import type { Request } from 'express';
import { config } from '../config.js';
import { supabaseAdmin } from './supabase.js';
import type { AuthenticatedRequest } from '../types/auth.js';

function hashIp(ip: string | undefined) {
  if (!ip || !config.REPORT_SIGNING_SECRET) return null;
  return createHmac('sha256', config.REPORT_SIGNING_SECRET).update(ip).digest('hex');
}

export async function writeAuditLog(
  req: Request,
  input: {
    organizationId?: string | null;
    action: string;
    targetType?: string | null;
    targetId?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  const auth = (req as AuthenticatedRequest).auth;
  const { error } = await supabaseAdmin.from('audit_logs').insert({
    organization_id: input.organizationId ?? auth.organizationId ?? null,
    actor_user_id: auth.userId,
    actor_type: auth.adminRoles?.length ? 'admin' : 'user',
    action: input.action,
    target_type: input.targetType ?? null,
    target_id: input.targetId ?? null,
    safe_metadata: input.metadata ?? {},
    ip_hash: hashIp(req.ip),
  });
  if (error) throw error;
}
