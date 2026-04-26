'use client';

import { use } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, FileJson, Layers, Zap } from 'lucide-react';
import { orgsApi, projectsApi, endpointsApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MethodPill } from '@/components/ui/MethodPill';

export default function ProjectPage({
  params,
}: {
  params: Promise<{ slug: string; projectSlug: string }>;
}) {
  const { slug, projectSlug } = use(params);

  const { data: orgs } = useQuery({ queryKey: ['orgs'], queryFn: () => orgsApi.list() });
  const currentOrg = orgs?.find((o) => o.slug === slug);

  const { data: project } = useQuery({
    queryKey: ['project', currentOrg?.id, projectSlug],
    queryFn: () => projectsApi.getBySlug(currentOrg!.id, projectSlug),
    enabled: !!currentOrg?.id,
  });

  const { data: endpoints = [] } = useQuery({
    queryKey: ['endpoints', project?.id, 'main'],
    queryFn: () => endpointsApi.list(project!.id, 'main'),
    enabled: !!project?.id,
  });

  if (!project) return null;

  const recentEndpoints = endpoints.slice(0, 5);

  return (
    <div className="flex-1 overflow-auto p-6 space-y-6">
      <div>
        <h1 className="text-lg font-semibold">{project.name}</h1>
        {project.description && (
          <p className="text-sm text-[var(--text-muted)] mt-1">{project.description}</p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm font-medium text-[var(--text-muted)]">Endpoints</CardTitle>
          </CardHeader>
          <div className="px-6 pb-4">
            <span className="text-2xl font-bold">{endpoints.length}</span>
          </div>
        </Card>
      </div>

      {endpoints.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Zap className="h-12 w-12 text-[var(--text-muted)] mb-4" />
          <h2 className="text-lg font-medium mb-1">No endpoints yet</h2>
          <p className="text-sm text-[var(--text-muted)] mb-6 max-w-sm">
            Design your first API endpoint or import an existing OpenAPI spec.
          </p>
          <div className="flex gap-2">
            <Button asChild>
              <Link href={`/orgs/${slug}/projects/${projectSlug}/import`}>Import spec</Link>
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-[var(--text-muted)]">Recent endpoints</h2>
          {recentEndpoints.map((ep) => (
            <Link
              key={ep.id}
              href={`/orgs/${slug}/projects/${projectSlug}/endpoints/${ep.id}`}
              className="flex items-center gap-3 p-3 rounded-lg bg-[var(--bg-1)] border border-[var(--border)] hover:border-[var(--border-strong)] transition-colors"
            >
              <MethodPill method={ep.method} />
              <span className="font-mono text-sm flex-1 truncate">{ep.path}</span>
              {ep.summary && (
                <span className="text-xs text-[var(--text-muted)] truncate max-w-48">{ep.summary}</span>
              )}
              <ArrowRight className="h-3.5 w-3.5 text-[var(--text-muted)]" />
            </Link>
          ))}
          {endpoints.length > 5 && (
            <p className="text-xs text-[var(--text-muted)] text-center pt-1">
              +{endpoints.length - 5} more — use the tree on the left to navigate
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
        <Link href={`/orgs/${slug}/projects/${projectSlug}/schemas`}>
          <Card className="hover:border-[var(--border-strong)] transition-colors cursor-pointer h-full">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-[var(--accent)]" />
                <CardTitle className="text-sm">Schema library</CardTitle>
              </div>
              <CardDescription className="text-xs">Reusable components and schemas</CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href={`/orgs/${slug}/projects/${projectSlug}/spec`}>
          <Card className="hover:border-[var(--border-strong)] transition-colors cursor-pointer h-full">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <FileJson className="h-4 w-4 text-[var(--accent)]" />
                <CardTitle className="text-sm">OpenAPI spec</CardTitle>
              </div>
              <CardDescription className="text-xs">View and export the full composed spec</CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>
    </div>
  );
}
