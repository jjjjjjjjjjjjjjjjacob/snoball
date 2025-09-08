import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createAuthMiddleware } from '@snoball/auth/middleware';

const publicPaths = [
  '/',
  '/auth/signin',
  '/auth/error',
  '/api/auth/signin',
  '/api/auth/callback/workos',
  '/api/webhooks/workos',
  '/api/health',
];

const authMiddleware = createAuthMiddleware({
  requireAuth: true,
  redirectUrl: '/auth/signin',
});

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths without authentication
  if (publicPaths.some(path => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Apply authentication middleware to protected routes
  return authMiddleware(request, NextResponse.next());
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};