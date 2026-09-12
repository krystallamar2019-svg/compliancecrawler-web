import type { Request } from 'express';

export type OrganizationRole = 'owner' | 'admin' | 'member' | 'viewer' | string;

export interface AuthContext {
  userId: string;
  organizationId: string;
  organizationRole: OrganizationRole;
}

export interface AuthenticatedRequest extends Request {
  auth: AuthContext;
}
