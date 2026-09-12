import type { Request } from 'express';

export type OrganizationRole = 'owner' | 'admin' | 'member' | 'viewer' | string;
export type AdminRole = 'Support' | 'Analyst' | 'Billing Support' | 'Security Administrator' | 'Super Administrator';

export interface AuthContext {
  userId: string;
  organizationId: string;
  organizationRole: OrganizationRole;
  aal: string | null;
  issuedAt: number | null;
  sessionId: string | null;
  adminRoles?: AdminRole[];
}

export interface AuthenticatedRequest extends Request {
  auth: AuthContext;
}
