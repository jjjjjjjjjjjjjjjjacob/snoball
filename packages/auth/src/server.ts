import { WorkOS } from '@workos-inc/node';
import { SignJWT, jwtVerify } from 'jose';
import type { 
  WorkOSConfig, 
  WorkOSUser, 
  WorkOSSession, 
  AuthenticationResult,
  JWTPayload 
} from './types';
import { createWorkOSConfig } from './config';

export class WorkOSAuthServer {
  private workos: WorkOS;
  private config: WorkOSConfig;
  private jwtSecret: Uint8Array;

  constructor(config?: Partial<WorkOSConfig>, jwtSecret?: string) {
    this.config = config ? { ...createWorkOSConfig(process.env), ...config } : createWorkOSConfig(process.env);
    this.workos = new WorkOS(this.config.apiKey);
    this.jwtSecret = new TextEncoder().encode(jwtSecret || process.env.NEXTAUTH_SECRET || 'fallback-secret');
  }

  /**
   * Generate authorization URL for WorkOS SSO
   */
  getAuthorizationUrl(organizationId?: string, connectionId?: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      scope: 'openid profile email',
    });

    if (organizationId) {
      params.set('organization_id', organizationId);
    }

    if (connectionId) {
      params.set('connection_id', connectionId);
    }

    return `https://api.workos.com/oauth/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for user profile
   */
  async authenticateWithCode(code: string): Promise<AuthenticationResult> {
    try {
      // Exchange code for access token and profile
      const { profile, accessToken, organizationId } = await this.workos.sso.getProfile({
        code,
        clientId: this.config.clientId,
      });

      const user: WorkOSUser = {
        ...profile,
        organizationId,
      };

      // Get organization details if organizationId is present
      let organization;
      if (organizationId) {
        try {
          organization = await this.workos.organizations.getOrganization(organizationId);
        } catch (error) {
          console.warn('Failed to fetch organization details:', error);
        }
      }

      const session: WorkOSSession = {
        user,
        organization,
        accessToken,
        expiresAt: Date.now() + (24 * 60 * 60 * 1000), // 24 hours
      };

      return {
        success: true,
        user,
        organization,
        session,
      };
    } catch (error) {
      console.error('WorkOS authentication failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication failed',
      };
    }
  }

  /**
   * Create a JWT token for the authenticated user
   */
  async createJWT(session: WorkOSSession): Promise<string> {
    const payload: JWTPayload = {
      sub: session.user.id,
      email: session.user.email,
      name: `${session.user.firstName} ${session.user.lastName}`.trim(),
      organizationId: session.user.organizationId,
      role: session.user.role,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(session.expiresAt / 1000),
      iss: 'snoball-auth',
    };

    return new SignJWT(payload)
      .setProtectedHeader({ alg: 'HS256' })
      .sign(this.jwtSecret);
  }

  /**
   * Verify and decode a JWT token
   */
  async verifyJWT(token: string): Promise<JWTPayload | null> {
    try {
      const { payload } = await jwtVerify(token, this.jwtSecret);
      return payload as JWTPayload;
    } catch (error) {
      console.error('JWT verification failed:', error);
      return null;
    }
  }

  /**
   * Get user by ID from WorkOS
   */
  async getUser(userId: string): Promise<WorkOSUser | null> {
    try {
      const user = await this.workos.users.getUser(userId);
      return user as WorkOSUser;
    } catch (error) {
      console.error('Failed to fetch user:', error);
      return null;
    }
  }

  /**
   * Get organization by ID from WorkOS
   */
  async getOrganization(organizationId: string) {
    try {
      return await this.workos.organizations.getOrganization(organizationId);
    } catch (error) {
      console.error('Failed to fetch organization:', error);
      return null;
    }
  }

  /**
   * List organizations for a user
   */
  async getUserOrganizations(userId: string) {
    try {
      const { data: memberships } = await this.workos.organizationMemberships.listOrganizationMemberships({
        userId,
      });
      
      return memberships.map(membership => ({
        organization: membership.organization,
        role: membership.role,
      }));
    } catch (error) {
      console.error('Failed to fetch user organizations:', error);
      return [];
    }
  }

  /**
   * Verify webhook signature
   */
  verifyWebhook(payload: string, signature: string): boolean {
    try {
      return this.workos.webhooks.verifyHeader({
        payload,
        sigHeader: signature,
        secret: this.config.webhookSecret,
      });
    } catch (error) {
      console.error('Webhook verification failed:', error);
      return false;
    }
  }

  /**
   * Handle WorkOS webhook events
   */
  async handleWebhook(payload: string, signature: string) {
    if (!this.verifyWebhook(payload, signature)) {
      throw new Error('Invalid webhook signature');
    }

    const event = JSON.parse(payload);
    
    switch (event.event) {
      case 'user.created':
        // Handle user creation
        break;
      case 'user.updated':
        // Handle user updates
        break;
      case 'user.deleted':
        // Handle user deletion
        break;
      case 'organization.created':
        // Handle organization creation
        break;
      case 'organization.updated':
        // Handle organization updates
        break;
      case 'organization.deleted':
        // Handle organization deletion
        break;
      default:
        console.log('Unhandled webhook event:', event.event);
    }

    return event;
  }
}