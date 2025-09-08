import { NextRequest, NextResponse } from 'next/server';
import { WorkOSAuthServer } from '@snoball/auth/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get('organization_id');
  const connectionId = searchParams.get('connection_id');

  try {
    const authServer = new WorkOSAuthServer();
    const authUrl = authServer.getAuthorizationUrl(organizationId || undefined, connectionId || undefined);
    
    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('Sign in error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate sign in' },
      { status: 500 }
    );
  }
}