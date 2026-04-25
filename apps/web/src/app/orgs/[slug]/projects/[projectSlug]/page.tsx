'use client';

import { use } from 'react';
import { useQuery } from '@tanstack/react-query';
import { orgsApi } from '@/lib/api';
import { AppLayout } from '@/components/layout/AppLayout';
import { Skeleton } from '@/components/ui/skeleton';

export default function ProjectWorkspacePage({
  params,
}: {
  params: Promise<{ slug: string; projectSlug: string }>;
}) {
  const { slug, projectSlug } = use(params);

  const { data: orgs } = useQuery({ queryKey: ['orgs'], queryFn: () => orgsApi.list() });
  const currentOrg = orgs?.find((o) => o.slug === slug);

  return (
    <AppLayout currentOrg={currentOrg} orgSlug={slug}>
      <div className="flex flex-col items-center justify-center h-full text-center p-10">
        <span className="text-[var(--text-muted)] text-4xl mb-6">⬡</span>
        <h2 className="text-lg font-semibold mb-2">Project workspace</h2>
        <p className="text-sm text-[var(--text-muted)] max-w-sm">
          <span className="font-mono text-[var(--accent)]">{projectSlug}</span>
          <br />
          The full endpoint designer and spec editor arrives in Phase 2.
        </p>
      </div>
    </AppLayout>
  );
}
