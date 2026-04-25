'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { orgsApi, ApiClientError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/components/ui/toaster';

export default function OnboardingPage() {
  const router = useRouter();
  const [orgName, setOrgName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const org = await orgsApi.create({ name: orgName });
      router.push(`/orgs/${org.slug}`);
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : 'Failed to create org';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg-0)] p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[var(--accent)] text-2xl font-bold">⬡</span>
          </div>
          <CardTitle>Create your organization</CardTitle>
          <CardDescription>
            An organization is a shared workspace for your team&apos;s API projects.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="orgName">Organization name</Label>
              <Input
                id="orgName"
                placeholder="Acme Corp"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                required
                minLength={2}
              />
              {orgName && (
                <p className="text-xs text-[var(--text-muted)]">
                  Slug: {orgName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}
                </p>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Creating…' : 'Create organization'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
