import { NextRequest, NextResponse } from 'next/server';
import { WorkOSAuthServer } from '@snoball/auth/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('workos-signature');

    if (!signature) {
      return NextResponse.json(
        { error: 'Missing signature' },
        { status: 400 }
      );
    }

    const authServer = new WorkOSAuthServer();
    const event = await authServer.handleWebhook(body, signature);

    // Process the webhook event
    await processWorkOSEvent(event);

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('WorkOS webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

async function processWorkOSEvent(event: any) {
  switch (event.event) {
    case 'user.created':
      console.log('User created:', event.data);
      // TODO: Create user in database
      break;
      
    case 'user.updated':
      console.log('User updated:', event.data);
      // TODO: Update user in database
      break;
      
    case 'user.deleted':
      console.log('User deleted:', event.data);
      // TODO: Deactivate user in database
      break;
      
    case 'organization.created':
      console.log('Organization created:', event.data);
      // TODO: Create organization in database
      break;
      
    case 'organization.updated':
      console.log('Organization updated:', event.data);
      // TODO: Update organization in database
      break;
      
    case 'organization.deleted':
      console.log('Organization deleted:', event.data);
      // TODO: Deactivate organization in database
      break;
      
    default:
      console.log('Unhandled WorkOS event:', event.event);
  }
}