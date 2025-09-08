'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { authClient } from '@snoball/auth/client';
import { Button } from '@snoball/ui/components/button';
import { Card } from '@snoball/ui/components/card';

export default function SignInPage() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');

  const handleSignIn = async () => {
    await authClient.signIn();
  };

  useEffect(() => {
    // Auto-redirect if already authenticated
    const checkAuth = async () => {
      const isAuth = await authClient.isAuthenticated();
      if (isAuth) {
        window.location.href = '/dashboard';
      }
    };
    
    checkAuth();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome to Snoball
          </h1>
          <p className="text-gray-600">
            AI-powered trading platform with PDT compliance
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-600 text-sm">
              {getErrorMessage(error)}
            </p>
          </div>
        )}

        <div className="space-y-4">
          <Button 
            onClick={handleSignIn}
            className="w-full"
            size="lg"
          >
            Sign in with WorkOS
          </Button>

          <div className="text-center">
            <p className="text-sm text-gray-500">
              Secure authentication powered by WorkOS
            </p>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-200">
          <div className="text-xs text-gray-400 text-center">
            <p>© 2024 Snoball Trading Platform</p>
            <p>Enterprise-grade authentication and compliance</p>
          </div>
        </div>
      </Card>
    </div>
  );
}

function getErrorMessage(error: string): string {
  switch (error) {
    case 'missing_code':
      return 'Authorization code was missing. Please try again.';
    case 'authentication_failed':
      return 'Authentication failed. Please try again.';
    case 'processing_error':
      return 'There was an error processing your request. Please try again.';
    default:
      return 'An unexpected error occurred. Please try again.';
  }
}