'use client';

import { useSearchParams } from 'next/navigation';
import { Button } from '@snoball/ui/components/button';
import { Card } from '@snoball/ui/components/card';
import { AlertCircle } from 'lucide-react';

export default function AuthErrorPage() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md p-8">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center w-12 h-12 rounded-full bg-red-100 mb-4">
            <AlertCircle className="w-6 h-6 text-red-600" />
          </div>
          
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Authentication Error
          </h1>
          
          <p className="text-gray-600 mb-6">
            {getErrorMessage(error || 'unknown')}
          </p>

          <div className="space-y-3">
            <Button 
              onClick={() => window.location.href = '/auth/signin'}
              className="w-full"
            >
              Try Again
            </Button>
            
            <Button 
              variant="outline"
              onClick={() => window.location.href = '/'}
              className="w-full"
            >
              Go Home
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function getErrorMessage(error: string): string {
  switch (error) {
    case 'missing_code':
      return 'The authorization code was missing from the callback. This might be a temporary issue.';
    case 'authentication_failed':
      return 'We could not authenticate your account. Please check your credentials and try again.';
    case 'processing_error':
      return 'There was an error processing your authentication request. Our team has been notified.';
    case 'access_denied':
      return 'Access was denied. You may not have permission to access this application.';
    case 'invalid_request':
      return 'The authentication request was invalid. Please try signing in again.';
    default:
      return 'An unexpected error occurred during authentication. Please try again or contact support if the problem persists.';
  }
}