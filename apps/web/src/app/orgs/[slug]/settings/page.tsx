'use client';

import { use, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { orgsApi, ApiClientError } from '@/lib/api';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toaster';

export default function OrgSettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const qc = useQueryClient();
  const [inviteEmail, setInviteEmail] = useState('');

  const { data: orgs, isLoading } = useQuery({ queryKey: ['orgs'], queryFn: () => orgsApi.list() });
  const currentOrg = orgs?.find((o) => o.slug === slug);

  const { data: members } = useQuery({
    queryKey: ['org-members', currentOrg?.id],
    queryFn: () => orgsApi.getMembers(currentOrg!.id),
    enabled: !!currentOrg?.id,
  });

  const inviteMutation = useMutation({
    mutationFn: () => orgsApi.invite(currentOrg!.id, { email: inviteEmail, role: 'VIEWER' }),
    onSuccess: () => {
      toast.success(`Invite sent to ${inviteEmail}`);
      setInviteEmail('');
    },
    onError: (err) => {
      const msg = err instanceof ApiClientError ? err.message : 'Failed to send invite';
      toast.error(msg);
    },
  });

  if (isLoading) {
    return (
      <AppLayout orgSlug={slug}>
        <div className="p-6 space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-40 w-full" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout currentOrg={currentOrg} orgSlug={slug}>
      <div className="p-6 space-y-6 max-w-2xl">
        <h1 className="text-xl font-semibold">Organization settings</h1>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Members</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {members?.map((m) => (
              <div key={m.id} className="flex items-center justify-between text-sm">
                <div>
                  <span className="font-medium">{m.user?.name}</span>
                  <span className="text-[var(--text-muted)] ml-2">{m.user?.email}</span>
                </div>
                <span className="text-xs text-[var(--text-muted)] capitalize">{m.role?.toLowerCase()}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Invite member</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(e) => { e.preventDefault(); inviteMutation.mutate(); }}
              className="flex gap-3"
            >
              <Input
                type="email"
                placeholder="colleague@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
                className="flex-1"
              />
              <Button type="submit" disabled={inviteMutation.isPending}>
                {inviteMutation.isPending ? 'Sending…' : 'Send invite'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
