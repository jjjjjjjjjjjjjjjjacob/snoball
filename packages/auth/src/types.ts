import type { User, Organization } from '@workos-inc/node';

export interface WorkOSUser extends User {
  organizationId?: string;
  role?: string;
}

export interface WorkOSSession {
  user: WorkOSUser;
  organization?: Organization;
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
}

export interface AuthenticationResult {
  success: boolean;
  user?: WorkOSUser;
  organization?: Organization;
  session?: WorkOSSession;
  error?: string;
}

export interface JWTPayload {
  sub: string; // User ID
  email: string;
  name?: string;
  organizationId?: string;
  role?: string;
  iat: number;
  exp: number;
  iss: string;
}

export interface AuthContext {
  user: WorkOSUser | null;
  organization: Organization | null;
  isAuthenticated: boolean;
  session: WorkOSSession | null;
}

export interface AuthMiddlewareOptions {
  requireAuth?: boolean;
  requireOrganization?: boolean;
  allowedRoles?: string[];
  redirectUrl?: string;
}