'use client';

import { use, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { GitCommit, GitBranch, Plus, ChevronDown } from 'lucide-react';
import { orgsApi, projectsApi, branchesApi, commitsApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';

export default function CommitsPage({
  params,
}: {
  params: Promise<{ slug: string; projectSlug: string }>;
}) {
  const { slug, projectSlug } = use(params);
  const [branch, setBranch] = useState('main');
  const [commitMsg, setCommitMsg] = useState('');
  const [showCommitInput, setShowCommitInput] = useState(false);
  const qc = useQueryClient();

  const { data: orgs } = useQuery({ queryKey: ['orgs'], queryFn: () => orgsApi.list() });
  const currentOrg = orgs?.find((o) => o.slug === slug);

  const { data: project } = useQuery({
    queryKey: ['project', currentOrg?.id, projectSlug],
    queryFn: () => projectsApi.getBySlug(currentOrg!.id, projectSlug),
    enabled: !!currentOrg?.id,
  });

  const { data: branches = [] } = useQuery({
    queryKey: ['branches', project?.id],
    queryFn: () => branchesApi.list(project!.id),
    enabled: !!project?.id,
  });

  const { data: commits = [], isLoading } = useQuery({
    queryKey: ['commits', project?.id, branch],
    queryFn: () => commitsApi.list(project!.id, branch),
    enabled: !!project?.id,
  });

  const createCommit = useMutation({
    mutationFn: () => commitsApi.create(project!.id, branch, commitMsg || 'Manual save'),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['commits', project?.id, branch] });
      setCommitMsg('');
      setShowCommitInput(false);
    },
  });

  if (!project) {
    return (
      <div className="p-8 flex items-center justify-center">
        <Skeleton className="h-8 w-48" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-[var(--border)] bg-[var(--bg-0)] flex-shrink-0">
        <div className="flex items-center gap-3">
          <GitCommit className="h-4 w-4 text-[var(--text-muted)]" />
          <h1 className="text-sm font-semibold text-[var(--text-primary)]">Commit History</h1>

          {/* Branch selector */}
          <div className="flex items-center gap-1.5 bg-[var(--bg-2)] border border-[var(--border)] rounded-md px-2 py-1">
            <GitBranch className="h-3.5 w-3.5 text-[var(--text-muted)]" />
            <select
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              className="text-xs bg-transparent text-[var(--text-primary)] border-none outline-none cursor-pointer"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.name}>{b.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {showCommitInput ? (
            <div className="flex items-center gap-2">
              <Input
                className="h-7 w-56 text-xs"
                placeholder="Commit message…"
                value={commitMsg}
                onChange={(e) => setCommitMsg(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') createCommit.mutate(); }}
                autoFocus
              />
              <Button
                size="sm"
                className="h-7 text-xs"
                onClick={() => createCommit.mutate()}
                disabled={createCommit.isPending}
              >
                {createCommit.isPending ? 'Saving…' : 'Create commit'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => { setShowCommitInput(false); setCommitMsg(''); }}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <Button size="sm" className="h-7 text-xs gap-1" onClick={() => setShowCommitInput(true)}>
              <Plus className="h-3.5 w-3.5" /> New commit
            </Button>
          )}
        </div>
      </div>

      {/* Commit list */}
      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="space-y-3 max-w-2xl mx-auto">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16" />)}
          </div>
        ) : commits.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-[var(--text-muted)]">
            <GitCommit className="h-8 w-8 opacity-40" />
            <p className="text-sm">No commits yet on <strong>{branch}</strong></p>
            <Button size="sm" onClick={() => setShowCommitInput(true)}>
              Create first commit
            </Button>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto">
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-4 top-4 bottom-4 w-px bg-[var(--border)]" />

              <div className="space-y-1">
                {commits.map((commit, idx) => (
                  <div key={commit.id} className="relative flex gap-4 pl-10">
                    {/* Dot on timeline */}
                    <div className="absolute left-2.5 top-4 w-3 h-3 rounded-full border-2 border-[var(--accent)] bg-[var(--bg-0)]" />

                    <div className="flex-1 bg-[var(--bg-1)] border border-[var(--border)] rounded-lg px-4 py-3 mb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                            {commit.message}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-[var(--text-muted)]">
                              {commit.author.name}
                            </span>
                            <span className="text-[10px] text-[var(--text-muted)]">
                              {formatDistanceToNow(new Date(commit.createdAt), { addSuffix: true })}
                            </span>
                          </div>
                        </div>
                        <code className="text-[10px] font-mono text-[var(--text-muted)] bg-[var(--bg-2)] px-1.5 py-0.5 rounded flex-shrink-0">
                          {commit.specSnapshot?.sha256.slice(0, 8) ?? '—'}
                        </code>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
