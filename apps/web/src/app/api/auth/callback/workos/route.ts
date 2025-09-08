import { NextRequest, NextResponse } from 'next/server';
import { WorkOSAuthServer } from '@snoball/auth/server';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error) {
    console.error('WorkOS callback error:', error);
    return NextResponse.redirect(new URL('/auth/error?error=' + encodeURIComponent(error), request.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL('/auth/error?error=missing_code', request.url));
  }

  try {
    const authServer = new WorkOSAuthServer();
    const result = await authServer.authenticateWithCode(code);

    if (!result.success || !result.session) {
      return NextResponse.redirect(new URL('/auth/error?error=' + encodeURIComponent(result.error || 'authentication_failed'), request.url));
    }

    // Create JWT token
    const token = await authServer.createJWT(result.session);

    // Set secure cookie
    const cookieStore = cookies();
    cookieStore.set('snoball-auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60, // 24 hours
      path: '/',
    });

    // TODO: Save/update user in database
    // This would involve:
    // 1. Check if user exists by workos_id
    // 2. Create or update user record
    // 3. Handle organization membership

    return NextResponse.redirect(new URL('/dashboard', request.url));
  } catch (error) {
    console.error('Authentication processing error:', error);
    return NextResponse.redirect(new URL('/auth/error?error=processing_error', request.url));
  }
}