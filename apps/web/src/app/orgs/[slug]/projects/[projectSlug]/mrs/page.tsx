'use client';

import { use, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { GitMerge, Plus, MessageSquare, CheckCircle2, Circle, XCircle } from 'lucide-react';
import { orgsApi, projectsApi, mrsApi, branchesApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog } from '@/components/ui/dialog';

const STATUS_COLORS = {
  OPEN: 'bg-green-500/15 text-green-600 border-green-500/30',
  MERGED: 'bg-violet-500/15 text-violet-600 border-violet-500/30',
  CLOSED: 'bg-[var(--bg-3)] text-[var(--text-muted)] border-[var(--border)]',
};

const STATUS_ICONS = {
  OPEN: Circle,
  MERGED: GitMerge,
  CLOSED: XCircle,
};

// ─── New MR Dialog ───────────────────────────────────────────────────────────

interface NewMrDialogProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  orgSlug: string;
  projectSlug: string;
}

function NewMrDialog({ open, onClose, projectId, orgSlug, projectSlug }: NewMrDialogProps) {
  const [sourceBranch, setSourceBranch] = useState('');
  const [targetBranch, setTargetBranch] = useState('main');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const qc = useQueryClient();

  const { data: branches = [] } = useQuery({
    queryKey: ['branches', projectId],
    queryFn: () => branchesApi.list(projectId),
    enabled: open,
  });

  const createMr = useMutation({
    mutationFn: () => mrsApi.create(projectId, { sourceBranch, targetBranch, title, description }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['mrs', projectId] });
      onClose();
      setTitle('');
      setDescription('');
      setSourceBranch('');
    },
  });

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/40" onClick={onClose} />
        <div className="relative z-10 w-full max-w-md bg-[var(--bg-1)] border border-[var(--border)] rounded-xl shadow-2xl p-6 space-y-4">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">New Merge Request</h2>

          <div className="space-y-3">
            <div>
              <label className="text-xs text-[var(--text-muted)] mb-1 block">Source branch</label>
              <select
                value={sourceBranch}
                onChange={(e) => setSourceBranch(e.target.value)}
                className="w-full text-sm bg-[var(--bg-2)] border border-[var(--border)] rounded-md px-3 py-1.5 text-[var(--text-primary)] outline-none"
              >
                <option value="">Select branch…</option>
                {branches.filter((b) => b.name !== targetBranch).map((b) => (
                  <option key={b.id} value={b.name}>{b.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-[var(--text-muted)] mb-1 block">Target branch</label>
              <select
                value={targetBranch}
                onChange={(e) => setTargetBranch(e.target.value)}
                className="w-full text-sm bg-[var(--bg-2)] border border-[var(--border)] rounded-md px-3 py-1.5 text-[var(--text-primary)] outline-none"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.name}>{b.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-[var(--text-muted)] mb-1 block">Title</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Merge request title…"
                className="text-sm"
              />
            </div>

            <div>
              <label className="text-xs text-[var(--text-muted)] mb-1 block">Description (optional)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What does this MR do?"
                rows={3}
                className="w-full text-sm bg-[var(--bg-2)] border border-[var(--border)] rounded-md px-3 py-1.5 text-[var(--text-primary)] outline-none resize-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
            <Button
              size="sm"
              onClick={() => createMr.mutate()}
              disabled={!sourceBranch || !title.trim() || createMr.isPending}
            >
              {createMr.isPending ? 'Creating…' : 'Create MR'}
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MrsPage({
  params,
}: {
  params: Promise<{ slug: string; projectSlug: string }>;
}) {
  const { slug, projectSlug } = use(params);
  const [statusFilter, setStatusFilter] = useState<'OPEN' | 'MERGED' | 'CLOSED' | 'all'>('OPEN');
  const [showNew, setShowNew] = useState(false);

  const { data: orgs } = useQuery({ queryKey: ['orgs'], queryFn: () => orgsApi.list() });
  const currentOrg = orgs?.find((o) => o.slug === slug);

  const { data: project } = useQuery({
    queryKey: ['project', currentOrg?.id, projectSlug],
    queryFn: () => projectsApi.getBySlug(currentOrg!.id, projectSlug),
    enabled: !!currentOrg?.id,
  });

  const { data: mrs = [], isLoading } = useQuery({
    queryKey: ['mrs', project?.id, statusFilter],
    queryFn: () => mrsApi.list(project!.id, statusFilter === 'all' ? undefined : statusFilter),
    enabled: !!project?.id,
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
          <GitMerge className="h-4 w-4 text-[var(--text-muted)]" />
          <h1 className="text-sm font-semibold text-[var(--text-primary)]">Merge Requests</h1>

          {/* Status filter */}
          <div className="flex items-center gap-1 bg-[var(--bg-2)] border border-[var(--border)] rounded-md p-0.5">
            {(['OPEN', 'MERGED', 'CLOSED', 'all'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-2.5 py-0.5 rounded text-xs transition-colors ${
                  statusFilter === s
                    ? 'bg-[var(--bg-0)] text-[var(--text-primary)] shadow-sm'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                {s === 'all' ? 'All' : s[0] + s.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>

        <Button size="sm" className="h-7 text-xs gap-1" onClick={() => setShowNew(true)}>
          <Plus className="h-3.5 w-3.5" /> New MR
        </Button>
      </div>

      {/* MR list */}
      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="space-y-3 max-w-2xl mx-auto">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}
          </div>
        ) : mrs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-[var(--text-muted)]">
            <GitMerge className="h-8 w-8 opacity-40" />
            <p className="text-sm">No merge requests</p>
            <Button size="sm" onClick={() => setShowNew(true)}>
              Create first MR
            </Button>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto space-y-2">
            {mrs.map((mr) => {
              const Icon = STATUS_ICONS[mr.status];
              const approvalCount = mr.reviews.filter((r) => r.approved).length;
              return (
                <Link
                  key={mr.id}
                  href={`/orgs/${slug}/projects/${projectSlug}/mrs/${mr.id}`}
                  className="block bg-[var(--bg-1)] border border-[var(--border)] rounded-lg px-4 py-3 hover:border-[var(--accent)] transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <Icon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${
                      mr.status === 'OPEN' ? 'text-green-500' :
                      mr.status === 'MERGED' ? 'text-violet-500' : 'text-[var(--text-muted)]'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-[var(--text-primary)] truncate">
                          {mr.title}
                        </span>
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium border ${STATUS_COLORS[mr.status]}`}>
                          {mr.status.toLowerCase()}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[10px] text-[var(--text-muted)]">
                        <span>
                          <code className="font-mono">{mr.sourceBranch}</code>
                          {' → '}
                          <code className="font-mono">{mr.targetBranch}</code>
                        </span>
                        <span>{mr.author.name}</span>
                        <span>{formatDistanceToNow(new Date(mr.createdAt), { addSuffix: true })}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0 text-[10px] text-[var(--text-muted)]">
                      {approvalCount > 0 && (
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3 text-green-500" />
                          {approvalCount}
                        </span>
                      )}
                      {(mr._count?.comments ?? 0) > 0 && (
                        <span className="flex items-center gap-1">
                          <MessageSquare className="h-3 w-3" />
                          {mr._count?.comments}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <NewMrDialog
        open={showNew}
        onClose={() => setShowNew(false)}
        projectId={project.id}
        orgSlug={slug}
        projectSlug={projectSlug}
      />
    </div>
  );
}
