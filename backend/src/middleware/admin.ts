import type { NextFunction, Request, Response } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import type { AdminRole, AuthenticatedRequest } from '../types/auth.js';

const ADMIN_ROLES: AdminRole[] = [
  'Support',
  'Analyst',
  'Billing Support',
  'Security Administrator',
  'Super Administrator',
];

export function requireAdmin(allowedRoles: AdminRole[] = ADMIN_ROLES) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const auth = (req as AuthenticatedRequest).auth;
      if (auth.aal !== 'aal2') {
        res.status(403).json({ error: 'ADMIN_MFA_REQUIRED' });
        return;
      }

      const { data, error } = await supabaseAdmin.rpc('get_active_admin_roles', {
        p_user_id: auth.userId,
      });
      if (error) throw error;

      const roles = (Array.isArray(data) ? data : [])
        .map((row) => row.role)
        .filter((role): role is AdminRole => ADMIN_ROLES.includes(role as AdminRole));

      if (!roles.some((role) => allowedRoles.includes(role))) {
        res.status(403).json({ error: 'ADMIN_ACCESS_DENIED' });
        return;
      }

      auth.adminRoles = roles;
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireRecentAdminAuth(maxAgeSeconds = 10 * 60) {
  return (req: Request, res: Response, next: NextFunction) => {
    const auth = (req as AuthenticatedRequest).auth;
    if (!auth.issuedAt || Math.floor(Date.now() / 1000) - auth.issuedAt > maxAgeSeconds) {
      res.status(401).json({ error: 'ADMIN_REAUTHENTICATION_REQUIRED' });
      return;
    }
    next();
  };
}
