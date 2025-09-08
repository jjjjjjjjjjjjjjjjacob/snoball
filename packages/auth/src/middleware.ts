import type { NextRequest, NextResponse } from 'next/server';
import { WorkOSAuthServer } from './server';
import type { AuthMiddlewareOptions, AuthContext, JWTPayload } from './types';

/**
 * Authentication middleware for Next.js API routes and pages
 */
export function createAuthMiddleware(options: AuthMiddlewareOptions = {}) {
  const {
    requireAuth = true,
    requireOrganization = false,
    allowedRoles = [],
    redirectUrl = '/auth/signin',
  } = options;

  return async function authMiddleware(
    request: NextRequest,
    response: NextResponse,
    next?: () => Promise<void> | void
  ): Promise<NextResponse | void> {
    const authServer = new WorkOSAuthServer();
    
    // Get JWT token from cookies or Authorization header
    const token = request.cookies.get('snoball-auth-token')?.value ||
                  request.headers.get('authorization')?.replace('Bearer ', '');

    let authContext: AuthContext = {
      user: null,
      organization: null,
      isAuthenticated: false,
      session: null,
    };

    if (token) {
      const payload = await authServer.verifyJWT(token);
      
      if (payload && payload.exp > Date.now() / 1000) {
        const user = await authServer.getUser(payload.sub);
        const organization = payload.organizationId 
          ? await authServer.getOrganization(payload.organizationId)
          : null;

        if (user) {
          authContext = {
            user: { ...user, organizationId: payload.organizationId, role: payload.role },
            organization,
            isAuthenticated: true,
            session: {
              user: { ...user, organizationId: payload.organizationId, role: payload.role },
              organization,
              accessToken: token,
              expiresAt: payload.exp * 1000,
            },
          };
        }
      }
    }

    // Check authentication requirements
    if (requireAuth && !authContext.isAuthenticated) {
      if (isApiRoute(request)) {
        return new NextResponse(
          JSON.stringify({ error: 'Authentication required' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }
      
      return NextResponse.redirect(new URL(redirectUrl, request.url));
    }

    // Check organization requirements
    if (requireOrganization && !authContext.organization) {
      if (isApiRoute(request)) {
        return new NextResponse(
          JSON.stringify({ error: 'Organization membership required' }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }
      
      return NextResponse.redirect(new URL('/auth/organization-required', request.url));
    }

    // Check role requirements
    if (allowedRoles.length > 0 && authContext.user?.role && !allowedRoles.includes(authContext.user.role)) {
      if (isApiRoute(request)) {
        return new NextResponse(
          JSON.stringify({ error: 'Insufficient permissions' }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }
      
      return NextResponse.redirect(new URL('/auth/insufficient-permissions', request.url));
    }

    // Add auth context to request headers for API routes
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-auth-context', JSON.stringify(authContext));

    // Continue to next middleware or route handler
    if (next) {
      await next();
    }

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  };
}

/**
 * Get authentication context from request headers (for API routes)
 */
export function getAuthContext(request: Request): AuthContext {
  const authContextHeader = request.headers.get('x-auth-context');
  
  if (authContextHeader) {
    try {
      return JSON.parse(authContextHeader);
    } catch (error) {
      console.error('Failed to parse auth context:', error);
    }
  }

  return {
    user: null,
    organization: null,
    isAuthenticated: false,
    session: null,
  };
}

/**
 * Require authentication for API route
 */
export function requireAuth(handler: (req: Request, context: AuthContext) => Promise<Response>) {
  return async function (request: Request): Promise<Response> {
    const authContext = getAuthContext(request);
    
    if (!authContext.isAuthenticated) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return handler(request, authContext);
  };
}

/**
 * Require organization membership for API route
 */
export function requireOrganization(handler: (req: Request, context: AuthContext) => Promise<Response>) {
  return async function (request: Request): Promise<Response> {
    const authContext = getAuthContext(request);
    
    if (!authContext.isAuthenticated) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!authContext.organization) {
      return new Response(
        JSON.stringify({ error: 'Organization membership required' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return handler(request, authContext);
  };
}

/**
 * Check if the request is for an API route
 */
function isApiRoute(request: NextRequest): boolean {
  return request.nextUrl.pathname.startsWith('/api/');
}