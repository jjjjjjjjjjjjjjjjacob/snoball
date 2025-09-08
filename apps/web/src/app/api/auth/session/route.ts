import { NextRequest, NextResponse } from 'next/server';
import { WorkOSAuthServer } from '@snoball/auth/server';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get('snoball-auth-token')?.value;

    if (!token) {
      return NextResponse.json(null);
    }

    const authServer = new WorkOSAuthServer();
    const payload = await authServer.verifyJWT(token);

    if (!payload || payload.exp <= Date.now() / 1000) {
      // Token is expired or invalid
      cookieStore.delete('snoball-auth-token');
      return NextResponse.json(null);
    }

    // Get current user and organization data
    const user = await authServer.getUser(payload.sub);
    const organization = payload.organizationId 
      ? await authServer.getOrganization(payload.organizationId)
      : null;

    if (!user) {
      cookieStore.delete('snoball-auth-token');
      return NextResponse.json(null);
    }

    const session = {
      user: {
        ...user,
        organizationId: payload.organizationId,
        role: payload.role,
      },
      organization,
      accessToken: token,
      expiresAt: payload.exp * 1000,
    };

    return NextResponse.json(session);
  } catch (error) {
    console.error('Session fetch error:', error);
    return NextResponse.json(null);
  }
}