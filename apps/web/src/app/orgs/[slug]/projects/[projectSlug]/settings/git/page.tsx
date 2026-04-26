'use client';

import { use, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Github, GitBranch, Link2, RefreshCw, Save, Trash2 } from 'lucide-react';
import { orgsApi, projectsApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';

const BASE = '/api/v1';

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
  if (!res.ok) throw new Error(`${res.status}`);
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

interface GitConfig {
  remoteUrl: string | null;
  syncBranch: string | null;
  pushEnabled: boolean;
  pullEnabled: boolean;
}

export default function GitSettingsPage({
  params,
}: {
  params: Promise<{ slug: string; projectSlug: string }>;
}) {
  const { slug, projectSlug } = use(params);
  const qc = useQueryClient();

  const { data: orgs } = useQuery({ queryKey: ['orgs'], queryFn: () => orgsApi.list() });
  const currentOrg = orgs?.find((o) => o.slug === slug);

  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ['project', currentOrg?.id, projectSlug],
    queryFn: () => projectsApi.getBySlug(currentOrg!.id, projectSlug),
    enabled: !!currentOrg?.id,
  });

  const { data: config, isLoading: configLoading } = useQuery<GitConfig>({
    queryKey: ['git-config', project?.id],
    queryFn: () => req<GitConfig>(`/projects/${project!.id}/git/config`),
    enabled: !!project?.id,
    retry: false,
    // Config endpoint may not exist yet — default to empty
    placeholderData: { remoteUrl: null, syncBranch: 'main', pushEnabled: false, pullEnabled: false },
  });

  const [remoteUrl, setRemoteUrl] = useState('');
  const [syncBranch, setSyncBranch] = useState('main');
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pullEnabled, setPullEnabled] = useState(false);
  const [saved, setSaved] = useState(false);

  // Populate form from config once loaded
  const configLoaded = !configLoading && config;
  if (configLoaded && remoteUrl === '' && config.remoteUrl) {
    setRemoteUrl(config.remoteUrl ?? '');
    setSyncBranch(config.syncBranch ?? 'main');
    setPushEnabled(config.pushEnabled);
    setPullEnabled(config.pullEnabled);
  }

  const saveMutation = useMutation({
    mutationFn: () =>
      req(`/projects/${project!.id}/git/config`, {
        method: 'PUT',
        body: JSON.stringify({ remoteUrl, syncBranch, pushEnabled, pullEnabled }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['git-config', project?.id] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const pushNow = useMutation({
    mutationFn: () => req(`/projects/${project!.id}/git/push`, { method: 'POST' }),
  });

  const pullNow = useMutation({
    mutationFn: () => req(`/projects/${project!.id}/git/pull`, { method: 'POST' }),
  });

  if (projectLoading || !project) {
    return (
      <div className="p-8 max-w-xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-6 py-4 border-b border-[var(--border)] bg-[var(--bg-0)] flex-shrink-0">
        <div className="flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-[var(--text-muted)]" />
          <h1 className="text-sm font-semibold text-[var(--text-primary)]">Git Integration</h1>
        </div>
        <p className="text-xs text-[var(--text-muted)] mt-0.5">
          Connect an external GitHub or GitLab repository to sync your spec.
        </p>
      </div>

      <div className="flex-1 p-6">
        <div className="max-w-xl space-y-6">
          {/* Remote URL */}
          <div className="bg-[var(--bg-1)] border border-[var(--border)] rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <Link2 className="h-4 w-4 text-[var(--accent)]" />
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">Repository</h2>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Remote URL</Label>
              <Input
                value={remoteUrl}
                onChange={(e) => setRemoteUrl(e.target.value)}
                placeholder="https://github.com/acme/my-api.git"
                className="text-sm font-mono"
              />
              <p className="text-[10px] text-[var(--text-muted)]">
                HTTPS URL of the GitHub or GitLab repository. Use a GitHub App installation or personal access token.
              </p>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Sync branch</Label>
              <Input
                value={syncBranch}
                onChange={(e) => setSyncBranch(e.target.value)}
                placeholder="main"
                className="text-sm font-mono"
              />
              <p className="text-[10px] text-[var(--text-muted)]">
                The branch in the external repo to push/pull the spec file.
              </p>
            </div>
          </div>

          {/* Sync settings */}
          <div className="bg-[var(--bg-1)] border border-[var(--border)] rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Sync Options</h2>

            <label className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[var(--text-primary)]">Push on merge</p>
                <p className="text-xs text-[var(--text-muted)]">
                  When a MR is merged to main, push the composed spec to the external repo.
                </p>
              </div>
              <div
                role="checkbox"
                aria-checked={pushEnabled}
                tabIndex={0}
                onClick={() => setPushEnabled((v) => !v)}
                onKeyDown={(e) => { if (e.key === ' ') setPushEnabled((v) => !v); }}
                className={`relative w-9 h-5 rounded-full cursor-pointer transition-colors ${pushEnabled ? 'bg-[var(--accent)]' : 'bg-[var(--bg-3)]'}`}
              >
                <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${pushEnabled ? 'translate-x-4' : ''}`} />
              </div>
            </label>

            <label className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[var(--text-primary)]">Pull on push</p>
                <p className="text-xs text-[var(--text-muted)]">
                  When a commit is pushed to the external repo, open a pull MR in APIForge.
                </p>
              </div>
              <div
                role="checkbox"
                aria-checked={pullEnabled}
                tabIndex={0}
                onClick={() => setPullEnabled((v) => !v)}
                onKeyDown={(e) => { if (e.key === ' ') setPullEnabled((v) => !v); }}
                className={`relative w-9 h-5 rounded-full cursor-pointer transition-colors ${pullEnabled ? 'bg-[var(--accent)]' : 'bg-[var(--bg-3)]'}`}
              >
                <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${pullEnabled ? 'translate-x-4' : ''}`} />
              </div>
            </label>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="gap-1"
            >
              <Save className="h-3.5 w-3.5" />
              {saved ? 'Saved!' : saveMutation.isPending ? 'Saving…' : 'Save settings'}
            </Button>

            {remoteUrl && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1 text-xs"
                  onClick={() => pushNow.mutate()}
                  disabled={pushNow.isPending}
                >
                  <Github className="h-3.5 w-3.5" />
                  {pushNow.isPending ? 'Pushing…' : 'Push now'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1 text-xs"
                  onClick={() => pullNow.mutate()}
                  disabled={pullNow.isPending}
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${pullNow.isPending ? 'animate-spin' : ''}`} />
                  {pullNow.isPending ? 'Pulling…' : 'Pull now'}
                </Button>
              </>
            )}
          </div>

          {/* GitHub App info */}
          <div className="bg-[var(--bg-2)] border border-[var(--border)] rounded-xl p-4 text-xs text-[var(--text-muted)] space-y-1">
            <p className="font-medium text-[var(--text-primary)]">GitHub App (coming soon)</p>
            <p>
              Install the APIForge GitHub App on your organization to use fine-grained repository access
              instead of personal access tokens. Webhook delivery will be automatic.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
