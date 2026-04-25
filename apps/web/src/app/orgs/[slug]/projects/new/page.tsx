'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { orgsApi, projectsApi, ApiClientError } from '@/lib/api';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/components/ui/toaster';

export default function NewProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const { data: orgs } = useQuery({ queryKey: ['orgs'], queryFn: () => orgsApi.list() });
  const currentOrg = orgs?.find((o) => o.slug === slug);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrg) return;
    setLoading(true);
    try {
      const project = await projectsApi.create(currentOrg.id, { name, description });
      router.push(`/orgs/${slug}/projects/${project.slug}`);
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : 'Failed to create project';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout currentOrg={currentOrg} orgSlug={slug}>
      <div className="p-6 max-w-lg">
        <h1 className="text-xl font-semibold mb-6">New project</h1>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Project details</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Project name</Label>
                <Input id="name" placeholder="My API" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="desc">Description (optional)</Label>
                <Input id="desc" placeholder="A short description" value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={loading || !currentOrg}>
                  {loading ? 'Creating…' : 'Create project'}
                </Button>
                <Button type="button" variant="ghost" onClick={() => router.back()}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
