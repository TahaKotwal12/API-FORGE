'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { authApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function VerifyEmailPage() {
  const params = useSearchParams();
  const token = params.get('token');
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');

  useEffect(() => {
    if (!token) { setStatus('error'); return; }
    authApi.verifyEmail(token)
      .then(() => setStatus('success'))
      .catch(() => setStatus('error'));
  }, [token]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg-0)] p-4">
      <Card className="w-full max-w-sm text-center">
        <CardHeader>
          <CardTitle>
            {status === 'verifying' && 'Verifying your email…'}
            {status === 'success' && 'Email verified!'}
            {status === 'error' && 'Verification failed'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === 'verifying' && (
            <p className="text-[var(--text-muted)] text-sm">Please wait…</p>
          )}
          {status === 'success' && (
            <>
              <p className="text-[var(--text-muted)] text-sm">Your email has been verified. You can now sign in.</p>
              <Button asChild className="w-full"><Link href="/login">Sign in</Link></Button>
            </>
          )}
          {status === 'error' && (
            <>
              <p className="text-[var(--text-muted)] text-sm">The link may have expired or already been used.</p>
              <Button asChild variant="secondary" className="w-full"><Link href="/login">Back to sign in</Link></Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
