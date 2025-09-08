import type { WorkOSUser, WorkOSSession, AuthContext } from './types';

export class WorkOSAuthClient {
  private baseUrl: string;

  constructor(baseUrl: string = '/api/auth') {
    this.baseUrl = baseUrl;
  }

  /**
   * Sign in with WorkOS
   */
  async signIn(organizationId?: string, connectionId?: string): Promise<void> {
    const params = new URLSearchParams();
    
    if (organizationId) {
      params.set('organization_id', organizationId);
    }
    
    if (connectionId) {
      params.set('connection_id', connectionId);
    }

    const url = `${this.baseUrl}/signin${params.toString() ? `?${params.toString()}` : ''}`;
    window.location.href = url;
  }

  /**
   * Sign out the current user
   */
  async signOut(): Promise<void> {
    try {
      await fetch(`${this.baseUrl}/signout`, {
        method: 'POST',
        credentials: 'include',
      });
      
      // Redirect to home or login page
      window.location.href = '/';
    } catch (error) {
      console.error('Sign out failed:', error);
      // Force redirect even if API call fails
      window.location.href = '/';
    }
  }

  /**
   * Get current user session
   */
  async getSession(): Promise<WorkOSSession | null> {
    try {
      const response = await fetch(`${this.baseUrl}/session`, {
        credentials: 'include',
      });
      
      if (!response.ok) {
        return null;
      }
      
      return await response.json();
    } catch (error) {
      console.error('Failed to fetch session:', error);
      return null;
    }
  }

  /**
   * Get current authentication context
   */
  async getAuthContext(): Promise<AuthContext> {
    const session = await this.getSession();
    
    return {
      user: session?.user || null,
      organization: session?.organization || null,
      isAuthenticated: !!session,
      session,
    };
  }

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    const session = await this.getSession();
    return !!session && session.expiresAt > Date.now();
  }

  /**
   * Refresh the current session
   */
  async refreshSession(): Promise<WorkOSSession | null> {
    try {
      const response = await fetch(`${this.baseUrl}/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      
      if (!response.ok) {
        return null;
      }
      
      return await response.json();
    } catch (error) {
      console.error('Failed to refresh session:', error);
      return null;
    }
  }
}

// Default client instance
export const authClient = new WorkOSAuthClient();