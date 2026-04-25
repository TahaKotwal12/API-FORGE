'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { invitesApi, ApiClientError } from '@/lib/api';
import { useAuth } from '@/contexts/auth.context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/components/ui/toaster';

interface InviteDetails {
  token: string;
  email: string;
  role: string;
  org: { name: string; slug: string };
}

export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const { user } = useAuth();
  const router = useRouter();
  const [invite, setInvite] = useState<InviteDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    invitesApi.getByToken(token)
      .then((data) => setInvite(data))
      .catch(() => setError('Invite not found or expired.'))
      .finally(() => setLoading(false));
  }, [token]);

  const handleAccept = async () => {
    if (!user) {
      router.push(`/login?redirect=/invites/${token}`);
      return;
    }
    setAccepting(true);
    try {
      const result = await invitesApi.accept(token);
      toast.success(`Joined ${invite?.org.name}!`);
      router.push(`/orgs/${result.orgId}`);
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : 'Failed to accept invite';
      toast.error(msg);
    } finally {
      setAccepting(false);
    }
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center"><p className="text-[var(--text-muted)]">Loading…</p></div>;

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg-0)] p-4">
      <Card className="w-full max-w-sm text-center">
        <CardHeader>
          <CardTitle>You&apos;re invited</CardTitle>
          {invite && (
            <CardDescription>
              Join <strong>{invite.org.name}</strong> as <strong className="capitalize">{invite.role.toLowerCase()}</strong>
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? (
            <p className="text-[var(--danger)] text-sm">{error}</p>
          ) : (
            <>
              {!user && (
                <p className="text-xs text-[var(--text-muted)]">You need to sign in to accept this invite.</p>
              )}
              <Button className="w-full" onClick={handleAccept} disabled={accepting}>
                {accepting ? 'Accepting…' : user ? 'Accept invite' : 'Sign in to accept'}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
