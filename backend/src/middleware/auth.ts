import type { NextFunction, Request, Response } from 'express';
import { createRemoteJWKSet, decodeProtectedHeader, jwtVerify } from 'jose';
import { config } from '../config.js';
import { supabaseAdmin } from '../lib/supabase.js';
import type { AuthenticatedRequest } from '../types/auth.js';

const jwks = createRemoteJWKSet(new URL(config.SUPABASE_JWKS_URL));

class AuthError extends Error {
  constructor(public readonly code: string, public readonly status = 401) {
    super(code);
  }
}

async function verifyToken(token: string): Promise<string> {
  const header = decodeProtectedHeader(token);

  // Legacy Supabase projects may still issue HS256 tokens. Those cannot be
  // verified from the public JWKS endpoint, so validate them with Auth itself.
  if (header.alg === 'HS256') {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data.user?.id) throw new AuthError('INVALID_ACCESS_TOKEN');
    return data.user.id;
  }

  const { payload } = await jwtVerify(token, jwks, {
    issuer: config.SUPABASE_ISSUER,
    audience: 'authenticated',
  });

  if (!payload.sub) throw new AuthError('INVALID_ACCESS_TOKEN');
  return payload.sub;
}

async function resolveOrganization(userId: string, requestedOrgHeader: string | undefined) {
  const { data, error } = await supabaseAdmin
    .from('organization_members')
    .select('org_id, role, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) throw new AuthError('ORG_LOOKUP_FAILED', 503);
  if (!data || data.length === 0) throw new AuthError('ORG_MEMBERSHIP_REQUIRED', 403);

  if (requestedOrgHeader) {
    const match = data.find((row) => row.org_id === requestedOrgHeader);
    if (!match) throw new AuthError('ORG_ACCESS_DENIED', 403);
    return match;
  }

  if (data.length > 1) {
    throw new AuthError('ORG_SELECTION_REQUIRED', 409);
  }

  return data[0]!;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const authorization = req.header('authorization');
    if (!authorization?.startsWith('Bearer ')) {
      throw new AuthError('AUTHORIZATION_REQUIRED');
    }

    const token = authorization.slice('Bearer '.length).trim();
    if (!token) throw new AuthError('AUTHORIZATION_REQUIRED');

    const userId = await verifyToken(token);
    const requestedOrg = req.header('x-brandedalign-org') ?? undefined;
    const membership = await resolveOrganization(userId, requestedOrg);

    (req as AuthenticatedRequest).auth = {
      userId,
      organizationId: membership.org_id,
      organizationRole: membership.role,
    };

    next();
  } catch (error) {
    if (error instanceof AuthError) {
      res.status(error.status).json({ error: error.code });
      return;
    }

    res.status(401).json({ error: 'INVALID_ACCESS_TOKEN' });
  }
}
