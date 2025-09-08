import type { Context, Next } from 'hono';
import { WorkOSAuthServer } from '@snoball/auth/server';
import type { AuthContext } from '@snoball/shared-types';

export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (!token) {
    return c.json({ error: 'Authorization token required' }, 401);
  }

  try {
    const authServer = new WorkOSAuthServer();
    const payload = await authServer.verifyJWT(token);

    if (!payload || payload.exp <= Date.now() / 1000) {
      return c.json({ error: 'Invalid or expired token' }, 401);
    }

    // Get user details
    const user = await authServer.getUser(payload.sub);
    if (!user) {
      return c.json({ error: 'User not found' }, 401);
    }

    // Get organization if present
    const organization = payload.organizationId 
      ? await authServer.getOrganization(payload.organizationId)
      : null;

    // Create auth context
    const authContext: AuthContext = {
      user: {
        ...user,
        organizationId: payload.organizationId,
        role: payload.role,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      organization: organization ? {
        id: organization.id,
        workosId: organization.id,
        name: organization.name,
        domain: organization.domains?.[0]?.domain,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      } : null,
      isAuthenticated: true,
      session: {
        user: {
          ...user,
          organizationId: payload.organizationId,
          role: payload.role,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        organization: organization ? {
          id: organization.id,
          workosId: organization.id,
          name: organization.name,
          domain: organization.domains?.[0]?.domain,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        } : null,
        accessToken: token,
        expiresAt: payload.exp * 1000,
      },
    };

    // Add auth context to request context
    c.set('auth', authContext);
    
    await next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return c.json({ error: 'Authentication failed' }, 401);
  }
}

export function getAuthContext(c: Context): AuthContext {
  return c.get('auth');
}

export function requireOrganization(c: Context): boolean {
  const auth = getAuthContext(c);
  return !!auth.organization;
}