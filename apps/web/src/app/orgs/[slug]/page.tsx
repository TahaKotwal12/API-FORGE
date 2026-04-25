'use client';

import { use } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Plus, FolderKanban } from 'lucide-react';
import { orgsApi, projectsApi } from '@/lib/api';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

export default function OrgDashboardPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);

  const { data: orgs, isLoading: orgsLoading } = useQuery({
    queryKey: ['orgs'],
    queryFn: () => orgsApi.list(),
  });

  const currentOrg = orgs?.find((o) => o.slug === slug);

  const { data: projects, isLoading: projectsLoading } = useQuery({
    queryKey: ['projects', currentOrg?.id],
    queryFn: () => projectsApi.listByOrg(currentOrg!.id),
    enabled: !!currentOrg?.id,
  });

  if (orgsLoading) {
    return (
      <AppLayout>
        <div className="p-6 space-y-4">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32" />)}
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!currentOrg) {
    return (
      <AppLayout>
        <div className="p-6">
          <p className="text-[var(--text-muted)]">Organization not found.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout currentOrg={currentOrg} orgSlug={slug}>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">{currentOrg.name}</h1>
            <p className="text-sm text-[var(--text-muted)] mt-0.5">
              <Badge variant="secondary">{currentOrg.plan}</Badge>
            </p>
          </div>
          <Button asChild>
            <Link href={`/orgs/${slug}/projects/new`}>
              <Plus className="mr-2 h-4 w-4" />
              New project
            </Link>
          </Button>
        </div>

        {projectsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32" />)}
          </div>
        ) : !projects?.length ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <FolderKanban className="h-12 w-12 text-[var(--text-muted)] mb-4" />
            <h2 className="text-lg font-medium mb-1">No projects yet</h2>
            <p className="text-sm text-[var(--text-muted)] mb-6 max-w-sm">
              Projects are where you design, mock, test, and document your APIs.
            </p>
            <Button asChild>
              <Link href={`/orgs/${slug}/projects/new`}>
                <Plus className="mr-2 h-4 w-4" />
                Create first project
              </Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <Link key={project.id} href={`/orgs/${slug}/projects/${project.slug}`}>
                <Card className="hover:border-[var(--border-strong)] transition-colors cursor-pointer">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{project.name}</CardTitle>
                    {project.description && (
                      <CardDescription className="line-clamp-2">{project.description}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <Badge variant="secondary">{project.visibility}</Badge>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
