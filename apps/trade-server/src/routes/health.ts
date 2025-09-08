import { Hono } from 'hono';

export const healthRoutes = new Hono();

healthRoutes.get('/', (c) => {
  return c.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'snoball-trade-server',
    version: process.env.npm_package_version || '0.1.0',
    environment: process.env.ENVIRONMENT || 'development',
  });
});

healthRoutes.get('/ready', (c) => {
  // Add readiness checks here (database, external services, etc.)
  const isReady = true; // TODO: Implement actual readiness checks
  
  if (!isReady) {
    return c.json({ status: 'not ready' }, 503);
  }
  
  return c.json({
    status: 'ready',
    timestamp: new Date().toISOString(),
  });
});

healthRoutes.get('/live', (c) => {
  return c.json({
    status: 'alive',
    timestamp: new Date().toISOString(),
  });
});