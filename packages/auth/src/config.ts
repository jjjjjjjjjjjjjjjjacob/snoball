import { z } from 'zod';

const WorkOSConfigSchema = z.object({
  apiKey: z.string().min(1, 'WorkOS API key is required'),
  clientId: z.string().min(1, 'WorkOS client ID is required'),
  webhookSecret: z.string().min(1, 'WorkOS webhook secret is required'),
  redirectUri: z.string().url('Valid redirect URI is required'),
  environment: z.enum(['development', 'staging', 'production']).default('development'),
});

export type WorkOSConfig = z.infer<typeof WorkOSConfigSchema>;

export function createWorkOSConfig(env: Record<string, string | undefined>): WorkOSConfig {
  const config = {
    apiKey: env.WORKOS_API_KEY,
    clientId: env.WORKOS_CLIENT_ID,
    webhookSecret: env.WORKOS_WEBHOOK_SECRET,
    redirectUri: env.WORKOS_REDIRECT_URI || `${env.NEXTAUTH_URL || 'http://localhost:3000'}/api/auth/callback/workos`,
    environment: env.NODE_ENV as 'development' | 'staging' | 'production',
  };

  return WorkOSConfigSchema.parse(config);
}

export const defaultWorkOSConfig = (() => {
  try {
    return createWorkOSConfig(process.env);
  } catch {
    // Return minimal config for environments where env vars aren't available
    return {
      apiKey: '',
      clientId: '',
      webhookSecret: '',
      redirectUri: '',
      environment: 'development' as const,
    };
  }
})();