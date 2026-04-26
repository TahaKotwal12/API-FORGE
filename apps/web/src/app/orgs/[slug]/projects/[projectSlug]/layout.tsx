'use client';

import { use, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  Plus, ChevronRight, ChevronDown, Search, Code2, FileJson, Layers,
  GitBranch, GitMerge, History, Settings2, Check, X, Zap,
} from 'lucide-react';
import { orgsApi, projectsApi, endpointsApi, branchesApi, mrsApi } from '@/lib/api';
import type { Endpoint, Branch } from '@/lib/api';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { MethodPill } from '@/components/ui/MethodPill';
import { NewEndpointDialog } from '@/components/endpoint-editor/NewEndpointDialog';

const METHOD_ORDER = { GET: 0, POST: 1, PUT: 2, PATCH: 3, DELETE: 4, HEAD: 5, OPTIONS: 6 };

function groupByTag(endpoints: Endpoint[]): Record<string, Endpoint[]> {
  const groups: Record<string, Endpoint[]> = {};
  for (const ep of endpoints) {
    const tag = ep.tags[0] ?? 'untagged';
    if (!groups[tag]) groups[tag] = [];
    groups[tag].push(ep);
  }
  for (const tag of Object.keys(groups)) {
    groups[tag]?.sort(
      (a, b) =>
        (METHOD_ORDER[a.method as keyof typeof METHOD_ORDER] ?? 99) -
        (METHOD_ORDER[b.method as keyof typeof METHOD_ORDER] ?? 99),
    );
  }
  return groups;
}

// ─── Branch Switcher ──────────────────────────────────────────────────────────

interface BranchSwitcherProps {
  projectId: string;
  currentBranch: string;
  onBranchChange: (branch: string) => void;
}

function BranchSwitcher({ projectId, currentBranch, onBranchChange }: BranchSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [showNewBranch, setShowNewBranch] = useState(false);
  const [newName, setNewName] = useState('');
  const qc = useQueryClient();

  const { data: branches = [] } = useQuery({
    queryKey: ['branches', projectId],
    queryFn: () => branchesApi.list(projectId),
  });

  const filtered = branches.filter((b) => b.name.includes(search));

  const createBranch = async () => {
    if (!newName.trim()) return;
    await branchesApi.create(projectId, { name: newName.trim(), fromBranch: currentBranch });
    void qc.invalidateQueries({ queryKey: ['branches', projectId] });
    onBranchChange(newName.trim());
    setNewName('');
    setShowNewBranch(false);
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-[10px] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
      >
        <GitBranch className="h-3 w-3" />
        <span className="max-w-[80px] truncate">{currentBranch}</span>
        <ChevronDown className="h-2.5 w-2.5" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-50 w-52 rounded-md border border-[var(--border)] bg-[var(--bg-1)] shadow-lg">
            <div className="p-1.5 border-b border-[var(--border)]">
              <Input
                className="h-6 text-xs"
                placeholder="Find branch…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
              />
            </div>
            <div className="max-h-48 overflow-y-auto py-1">
              {filtered.map((b) => (
                <button
                  key={b.id}
                  onClick={() => { onBranchChange(b.name); setOpen(false); setSearch(''); }}
                  className="flex items-center justify-between w-full px-2.5 py-1 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-3)] hover:text-[var(--text-primary)]"
                >
                  <span className="truncate">{b.name}</span>
                  {b.name === currentBranch && <Check className="h-3 w-3 text-[var(--accent)]" />}
                </button>
              ))}
              {filtered.length === 0 && (
                <div className="px-2.5 py-2 text-[10px] text-[var(--text-muted)]">No branches match</div>
              )}
            </div>
            <div className="border-t border-[var(--border)] p-1.5">
              {showNewBranch ? (
                <div className="flex gap-1">
                  <Input
                    className="h-6 text-xs flex-1"
                    placeholder="branch-name"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') void createBranch(); }}
                    autoFocus
                  />
                  <button onClick={() => void createBranch()} className="p-1 text-[var(--accent)] hover:opacity-80">
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => { setShowNewBranch(false); setNewName(''); }} className="p-1 text-[var(--text-muted)]">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowNewBranch(true)}
                  className="flex items-center gap-1 w-full px-1.5 py-1 text-xs text-[var(--accent)] hover:opacity-80"
                >
                  <Plus className="h-3 w-3" /> New branch
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Endpoint Tree ────────────────────────────────────────────────────────────

interface EndpointTreeProps {
  projectId: string;
  orgSlug: string;
  projectSlug: string;
  branch: string;
  activeEndpointId?: string;
}

function EndpointTree({ projectId, orgSlug, projectSlug, branch, activeEndpointId }: EndpointTreeProps) {
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [showNew, setShowNew] = useState(false);

  const { data: endpoints = [], isLoading, refetch } = useQuery({
    queryKey: ['endpoints', projectId, branch],
    queryFn: () => endpointsApi.list(projectId, branch),
  });

  const filtered = endpoints.filter(
    (ep) =>
      search === '' ||
      ep.path.toLowerCase().includes(search.toLowerCase()) ||
      ep.method.toLowerCase().includes(search.toLowerCase()) ||
      (ep.summary ?? '').toLowerCase().includes(search.toLowerCase()),
  );

  const groups = groupByTag(filtered);

  const toggleTag = (tag: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="p-2 border-b border-[var(--border)] space-y-2 flex-shrink-0">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-muted)]" />
          <Input
            className="pl-7 h-7 text-xs bg-[var(--bg-2)] border-[var(--border)]"
            placeholder="Search endpoints…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button size="sm" className="w-full h-7 text-xs gap-1" onClick={() => setShowNew(true)}>
          <Plus className="h-3.5 w-3.5" /> New endpoint
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {isLoading ? (
          <div className="p-2 space-y-1">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-6" />)}
          </div>
        ) : Object.keys(groups).length === 0 ? (
          <div className="p-4 text-center text-xs text-[var(--text-muted)]">
            {search ? 'No endpoints match' : 'No endpoints yet'}
          </div>
        ) : (
          Object.entries(groups).map(([tag, eps]) => (
            <div key={tag}>
              <button
                className="flex items-center w-full px-2 py-1 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] gap-1"
                onClick={() => toggleTag(tag)}
              >
                {collapsed.has(tag) ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                <span className="truncate">{tag}</span>
                <span className="ml-auto text-[10px] opacity-60">{eps.length}</span>
              </button>
              {!collapsed.has(tag) && eps.map((ep) => (
                <Link
                  key={ep.id}
                  href={`/orgs/${orgSlug}/projects/${projectSlug}/endpoints/${ep.id}`}
                  className={`flex items-center gap-2 px-3 py-1 mx-1 rounded text-xs hover:bg-[var(--bg-3)] transition-colors ${
                    activeEndpointId === ep.id ? 'bg-[var(--accent-subtle)] text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'
                  }`}
                >
                  <MethodPill method={ep.method} size="xs" />
                  <span className="truncate font-mono">{ep.path}</span>
                </Link>
              ))}
            </div>
          ))
        )}
      </div>

      {/* Schema / Spec / Git nav items */}
      <div className="border-t border-[var(--border)] py-1 flex-shrink-0">
        {[
          { href: `/orgs/${orgSlug}/projects/${projectSlug}/schemas`, icon: Layers, label: 'Schemas' },
          { href: `/orgs/${orgSlug}/projects/${projectSlug}/spec`, icon: FileJson, label: 'Spec' },
          { href: `/orgs/${orgSlug}/projects/${projectSlug}/commits`, icon: History, label: 'History' },
          { href: `/orgs/${orgSlug}/projects/${projectSlug}/mrs`, icon: GitMerge, label: 'Merge Requests' },
          { href: `/orgs/${orgSlug}/projects/${projectSlug}/settings/git`, icon: Settings2, label: 'Git Settings' },
          { href: `/orgs/${orgSlug}/projects/${projectSlug}/generate`, icon: Zap, label: 'Generate SDK' },
        ].map(({ href, icon: Icon, label }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-2 px-3 py-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-3)] mx-1 rounded transition-colors"
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </Link>
        ))}
      </div>

      <NewEndpointDialog
        open={showNew}
        onClose={() => setShowNew(false)}
        projectId={projectId}
        branch={branch}
        onCreated={() => { void refetch(); setShowNew(false); }}
      />
    </div>
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function ProjectWorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string; projectSlug: string }>;
}) {
  const { slug, projectSlug } = use(params);
  const pathname = usePathname();
  const [branch, setBranch] = useState('main');

  const { data: orgs } = useQuery({ queryKey: ['orgs'], queryFn: () => orgsApi.list() });
  const currentOrg = orgs?.find((o) => o.slug === slug);

  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ['project', currentOrg?.id, projectSlug],
    queryFn: () => projectsApi.getBySlug(currentOrg!.id, projectSlug),
    enabled: !!currentOrg?.id,
  });

  // Derive active endpoint ID from URL if on endpoint route
  const endpointMatch = pathname.match(/\/endpoints\/([^/]+)$/);
  const activeEndpointId = endpointMatch?.[1];

  if (!currentOrg || projectLoading) {
    return (
      <AppLayout>
        <div className="flex h-full items-center justify-center">
          <Skeleton className="h-8 w-48" />
        </div>
      </AppLayout>
    );
  }

  if (!project) {
    return (
      <AppLayout>
        <div className="p-6 text-[var(--text-muted)]">Project not found.</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout currentOrg={currentOrg} orgSlug={slug}>
      <div className="flex h-full overflow-hidden">
        {/* Left: endpoint tree — 240px */}
        <aside className="w-60 flex-shrink-0 border-r border-[var(--border)] bg-[var(--bg-1)] flex flex-col overflow-hidden">
          {/* Project header */}
          <div className="px-3 py-2 border-b border-[var(--border)] flex-shrink-0">
            <div className="flex items-center gap-1.5 text-xs">
              <Code2 className="h-3.5 w-3.5 text-[var(--accent)]" />
              <span className="font-medium truncate text-[var(--text-primary)]">{project.name}</span>
            </div>
            <div className="mt-0.5">
              <BranchSwitcher
                projectId={project.id}
                currentBranch={branch}
                onBranchChange={setBranch}
              />
            </div>
          </div>

          <EndpointTree
            projectId={project.id}
            orgSlug={slug}
            projectSlug={projectSlug}
            branch={branch}
            activeEndpointId={activeEndpointId}
          />
        </aside>

        {/* Main content area */}
        <main className="flex-1 overflow-hidden flex flex-col">
          {children}
        </main>
      </div>
    </AppLayout>
  );
}
