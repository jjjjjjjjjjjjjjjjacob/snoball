import { Hono } from 'hono';
import { WorkOSAuthServer } from '@snoball/auth/server';

export const webhookRoutes = new Hono();

// WorkOS webhook handler
webhookRoutes.post('/workos', async (c) => {
  try {
    const body = await c.req.text();
    const signature = c.req.header('workos-signature');

    if (!signature) {
      return c.json({ error: 'Missing signature' }, 400);
    }

    const authServer = new WorkOSAuthServer();
    const event = await authServer.handleWebhook(body, signature);

    // Process the webhook event
    await processWorkOSEvent(event);

    return c.json({ received: true });
  } catch (error) {
    console.error('WorkOS webhook error:', error);
    return c.json({ error: 'Webhook processing failed' }, 500);
  }
});

// Alpaca webhook handler
webhookRoutes.post('/alpaca', async (c) => {
  try {
    const body = await c.req.json();
    
    // TODO: Verify Alpaca webhook signature
    // TODO: Process Alpaca events (order fills, account updates, etc.)
    
    console.log('Alpaca webhook received:', body);
    
    await processAlpacaEvent(body);

    return c.json({ received: true });
  } catch (error) {
    console.error('Alpaca webhook error:', error);
    return c.json({ error: 'Webhook processing failed' }, 500);
  }
});

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

async function processAlpacaEvent(event: any) {
  switch (event.event_type) {
    case 'trade_updates':
      console.log('Trade update:', event.data);
      // TODO: Update order status in database
      // TODO: Create day trade record if applicable
      break;
      
    case 'account_updates':
      console.log('Account update:', event.data);
      // TODO: Update user account info
      break;
      
    default:
      console.log('Unhandled Alpaca event:', event.event_type);
  }
}