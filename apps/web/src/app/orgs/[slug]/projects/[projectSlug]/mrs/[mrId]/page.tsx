'use client';

import { use, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import {
  GitMerge, CheckCircle2, XCircle, MessageSquare, ArrowLeft,
  Plus, Minus, Pencil, ChevronDown, ChevronRight,
} from 'lucide-react';
import { orgsApi, projectsApi, mrsApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

const STATUS_COLOR = {
  OPEN: 'text-green-500',
  MERGED: 'text-violet-500',
  CLOSED: 'text-[var(--text-muted)]',
};

type DiffChange = {
  type: string;
  path: string;
  before?: unknown;
  after?: unknown;
};

function DiffView({ changes }: { changes: DiffChange[] }) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set([0, 1, 2]));

  if (changes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-32 text-[var(--text-muted)] text-sm">
        No spec differences between these branches.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {changes.map((change, idx) => {
        const isOpen = expanded.has(idx);
        const Icon = change.type === 'added' ? Plus : change.type === 'removed' ? Minus : Pencil;
        const color =
          change.type === 'added' ? 'text-green-500' :
          change.type === 'removed' ? 'text-red-500' : 'text-yellow-500';
        const bg =
          change.type === 'added' ? 'bg-green-500/5 border-green-500/20' :
          change.type === 'removed' ? 'bg-red-500/5 border-red-500/20' : 'bg-yellow-500/5 border-yellow-500/20';

        return (
          <div key={idx} className={`border rounded-lg overflow-hidden ${bg}`}>
            <button
              className="flex items-center gap-2 w-full px-3 py-2 text-xs font-medium hover:opacity-80"
              onClick={() => setExpanded((s) => { const n = new Set(s); if (n.has(idx)) n.delete(idx); else n.add(idx); return n; })}
            >
              {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              <Icon className={`h-3 w-3 ${color}`} />
              <span className={`font-mono ${color}`}>{change.type}</span>
              <span className="text-[var(--text-primary)] font-mono">{change.path}</span>
            </button>
            {isOpen && (change.before !== undefined || change.after !== undefined) && (
              <div className="border-t border-inherit px-3 py-2 font-mono text-[10px] space-y-1">
                {change.before !== undefined && (
                  <div className="text-red-500">
                    <span className="select-none mr-1">−</span>
                    <span>{JSON.stringify(change.before as unknown, null, 2)}</span>
                  </div>
                )}
                {change.after !== undefined && (
                  <div className="text-green-500">
                    <span className="select-none mr-1">+</span>
                    <span>{JSON.stringify(change.after as unknown, null, 2)}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function MrDetailPage({
  params,
}: {
  params: Promise<{ slug: string; projectSlug: string; mrId: string }>;
}) {
  const { slug, projectSlug, mrId } = use(params);
  const router = useRouter();
  const qc = useQueryClient();
  const [commentBody, setCommentBody] = useState('');
  const [showComment, setShowComment] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'diff'>('overview');

  const { data: orgs } = useQuery({ queryKey: ['orgs'], queryFn: () => orgsApi.list() });
  const currentOrg = orgs?.find((o) => o.slug === slug);

  const { data: project } = useQuery({
    queryKey: ['project', currentOrg?.id, projectSlug],
    queryFn: () => projectsApi.getBySlug(currentOrg!.id, projectSlug),
    enabled: !!currentOrg?.id,
  });

  const { data: mr, isLoading } = useQuery({
    queryKey: ['mr', project?.id, mrId],
    queryFn: () => mrsApi.get(project!.id, mrId),
    enabled: !!project?.id,
  });

  const { data: diffData, isLoading: diffLoading } = useQuery({
    queryKey: ['mr-diff', project?.id, mrId],
    queryFn: () => mrsApi.diff(project!.id, mrId),
    enabled: !!project?.id && activeTab === 'diff',
  });

  const approveMutation = useMutation({
    mutationFn: () => mrsApi.approve(project!.id, mrId),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['mr', project?.id, mrId] }); },
  });

  const mergeMutation = useMutation({
    mutationFn: () => mrsApi.merge(project!.id, mrId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['mrs', project?.id] });
      void qc.invalidateQueries({ queryKey: ['mr', project?.id, mrId] });
    },
  });

  const closeMutation = useMutation({
    mutationFn: () => mrsApi.close(project!.id, mrId),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['mr', project?.id, mrId] }); },
  });

  const commentMutation = useMutation({
    mutationFn: () => mrsApi.addComment(project!.id, mrId, commentBody),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['mr', project?.id, mrId] });
      setCommentBody('');
      setShowComment(false);
    },
  });

  if (isLoading || !mr) {
    return (
      <div className="p-8 max-w-2xl mx-auto space-y-4">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  const approvalCount = mr.reviews.filter((r) => r.approved).length;
  const isOpen = mr.status === 'OPEN';

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 py-3 border-b border-[var(--border)] bg-[var(--bg-0)] flex-shrink-0">
        <div className="flex items-center gap-2 mb-2">
          <button
            onClick={() => router.push(`/orgs/${slug}/projects/${projectSlug}/mrs`)}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <span className={`flex items-center gap-1 text-xs font-medium ${STATUS_COLOR[mr.status]}`}>
            <GitMerge className="h-3.5 w-3.5" />
            {mr.status.toLowerCase()}
          </span>
          <h1 className="text-sm font-semibold text-[var(--text-primary)] truncate">{mr.title}</h1>
        </div>

        <div className="flex items-center gap-4 text-[10px] text-[var(--text-muted)]">
          <span>
            <code className="font-mono">{mr.sourceBranch}</code>
            {' → '}
            <code className="font-mono">{mr.targetBranch}</code>
          </span>
          <span>by {mr.author.name}</span>
          <span>{formatDistanceToNow(new Date(mr.createdAt), { addSuffix: true })}</span>
          {approvalCount > 0 && (
            <span className="flex items-center gap-1 text-green-500">
              <CheckCircle2 className="h-3 w-3" /> {approvalCount} approval{approvalCount > 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mt-3">
          {(['overview', 'diff'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                activeTab === tab
                  ? 'bg-[var(--accent)] text-white'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              {tab === 'overview' ? 'Overview' : 'Spec Diff'}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto space-y-4">
          {activeTab === 'overview' ? (
            <>
              {/* Description */}
              {mr.description && (
                <div className="bg-[var(--bg-1)] border border-[var(--border)] rounded-lg p-4">
                  <p className="text-sm text-[var(--text-primary)] whitespace-pre-wrap">{mr.description}</p>
                </div>
              )}

              {/* Reviewers */}
              <div className="bg-[var(--bg-1)] border border-[var(--border)] rounded-lg p-4">
                <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-3">Reviews</h3>
                {mr.reviews.length === 0 ? (
                  <p className="text-xs text-[var(--text-muted)]">No reviews yet</p>
                ) : (
                  <div className="space-y-2">
                    {mr.reviews.map((rev) => (
                      <div key={rev.id} className="flex items-center gap-2">
                        <CheckCircle2 className={`h-3.5 w-3.5 ${rev.approved ? 'text-green-500' : 'text-[var(--text-muted)]'}`} />
                        <span className="text-xs text-[var(--text-primary)]">{rev.user.name}</span>
                        <span className="text-[10px] text-[var(--text-muted)]">{rev.approved ? 'approved' : 'requested changes'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Comments */}
              <div className="bg-[var(--bg-1)] border border-[var(--border)] rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">
                    Comments ({mr.comments?.length ?? 0})
                  </h3>
                  {isOpen && (
                    <Button variant="ghost" size="sm" className="h-6 text-xs gap-1" onClick={() => setShowComment(true)}>
                      <MessageSquare className="h-3 w-3" /> Add comment
                    </Button>
                  )}
                </div>

                {(mr.comments ?? []).length === 0 ? (
                  <p className="text-xs text-[var(--text-muted)]">No comments yet</p>
                ) : (
                  <div className="space-y-3">
                    {(mr.comments ?? []).map((c) => (
                      <div key={c.id} className="border-l-2 border-[var(--border)] pl-3">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-[var(--text-primary)]">{c.author.name}</span>
                          <span className="text-[10px] text-[var(--text-muted)]">
                            {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}
                          </span>
                          {c.path && <code className="text-[10px] text-[var(--text-muted)] bg-[var(--bg-2)] px-1 rounded">{c.path}</code>}
                        </div>
                        <p className="text-xs text-[var(--text-secondary)] whitespace-pre-wrap">{c.body}</p>
                      </div>
                    ))}
                  </div>
                )}

                {showComment && (
                  <div className="mt-3 space-y-2">
                    <textarea
                      value={commentBody}
                      onChange={(e) => setCommentBody(e.target.value)}
                      placeholder="Leave a comment…"
                      rows={3}
                      className="w-full text-sm bg-[var(--bg-2)] border border-[var(--border)] rounded-md px-3 py-2 text-[var(--text-primary)] outline-none resize-none"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => commentMutation.mutate()} disabled={!commentBody.trim() || commentMutation.isPending}>
                        {commentMutation.isPending ? 'Posting…' : 'Post comment'}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => { setShowComment(false); setCommentBody(''); }}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="bg-[var(--bg-1)] border border-[var(--border)] rounded-lg p-4">
              <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-3">
                Spec Changes
              </h3>
              {diffLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10" />)}
                </div>
              ) : (
                <DiffView changes={(diffData?.changes as DiffChange[] | undefined) ?? []} />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Action bar */}
      {isOpen && (
        <div className="border-t border-[var(--border)] bg-[var(--bg-0)] px-6 py-3 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => closeMutation.mutate()}
              disabled={closeMutation.isPending}
            >
              <XCircle className="h-3.5 w-3.5 mr-1" />
              Close MR
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => approveMutation.mutate()}
              disabled={approveMutation.isPending}
            >
              <CheckCircle2 className="h-3.5 w-3.5 mr-1 text-green-500" />
              {approveMutation.isPending ? 'Approving…' : 'Approve'}
            </Button>
            <Button
              size="sm"
              className="text-xs bg-violet-600 hover:bg-violet-700"
              onClick={() => mergeMutation.mutate()}
              disabled={mergeMutation.isPending}
            >
              <GitMerge className="h-3.5 w-3.5 mr-1" />
              {mergeMutation.isPending ? 'Merging…' : 'Merge'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
