'use client';

import { use, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Code2, Download, Loader2, CheckCircle2, XCircle, Clock, Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { orgsApi, projectsApi, generatorApi, type GenerationRun } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

const LANGUAGES = [
  { value: 'typescript', label: 'TypeScript', ext: 'ts' },
  { value: 'java', label: 'Java', ext: 'java' },
  { value: 'python', label: 'Python', ext: 'py' },
  { value: 'go', label: 'Go', ext: 'go' },
  { value: 'rust', label: 'Rust', ext: 'rs' },
] as const;

const MODES = [
  { value: 'sdk', label: 'SDK Client', description: 'Typed HTTP client with all operations' },
  { value: 'dto-only', label: 'DTOs only', description: 'Data models / types only' },
  { value: 'server', label: 'Server stubs', description: 'Skeleton server handlers' },
  { value: 'hooks', label: 'React hooks', description: 'TanStack Query hooks (TS only)' },
] as const;

function statusBadge(status: GenerationRun['status']) {
  switch (status) {
    case 'COMPLETED': return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Completed</Badge>;
    case 'FAILED':    return <Badge className="bg-red-100 text-red-700 border-red-200">Failed</Badge>;
    case 'RUNNING':   return <Badge className="bg-blue-100 text-blue-700 border-blue-200">Running</Badge>;
    default:          return <Badge variant="secondary">Pending</Badge>;
  }
}

function StatusIcon({ status }: { status: GenerationRun['status'] }) {
  switch (status) {
    case 'COMPLETED': return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
    case 'FAILED':    return <XCircle className="h-4 w-4 text-red-500" />;
    case 'RUNNING':   return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
    default:          return <Clock className="h-4 w-4 text-gray-400" />;
  }
}

function downloadBundle(base64: string, language: string, mode: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${language}-${mode}-sdk.zip`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function GeneratePage({
  params,
}: {
  params: Promise<{ slug: string; projectSlug: string }>;
}) {
  const { slug, projectSlug } = use(params);
  const qc = useQueryClient();

  const [language, setLanguage] = useState<string>('typescript');
  const [mode, setMode] = useState<string>('sdk');
  const [branchName, setBranchName] = useState('main');
  const [packageName, setPackageName] = useState('');
  const [packageVersion, setPackageVersion] = useState('');

  const { data: orgs } = useQuery({ queryKey: ['orgs'], queryFn: () => orgsApi.list() });
  const currentOrg = orgs?.find((o) => o.slug === slug);

  const { data: project } = useQuery({
    queryKey: ['project', currentOrg?.id, projectSlug],
    queryFn: () => projectsApi.getBySlug(currentOrg!.id, projectSlug),
    enabled: !!currentOrg?.id,
  });

  const { data: runs = [], isLoading: runsLoading } = useQuery({
    queryKey: ['generations', project?.id],
    queryFn: () => generatorApi.listRuns(project!.id),
    enabled: !!project?.id,
    refetchInterval: 5000,
  });

  const generateMutation = useMutation({
    mutationFn: () => {
      if (!project) throw new Error('No project');
      return generatorApi.generate(project.id, {
        language,
        mode,
        branchName,
        packageName: packageName || undefined,
        packageVersion: packageVersion || undefined,
      });
    },
    onSuccess: (result) => {
      void qc.invalidateQueries({ queryKey: ['generations', project?.id] });
      toast.success(`Generated ${result.fileCount} files (${result.language} ${result.mode})`);
      downloadBundle(result.bundleBase64, result.language, result.mode);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Generation failed'),
  });

  if (!project) {
    return (
      <div className="flex-1 p-6">
        <Skeleton className="h-8 w-48" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-auto">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border)] flex-shrink-0">
        <Zap className="h-4 w-4 text-[var(--accent)]" />
        <span className="text-sm font-medium">Code Generator</span>
        <span className="text-xs text-[var(--text-muted)] ml-1">— {project.name}</span>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left: configuration panel */}
        <div className="w-80 flex-shrink-0 border-r border-[var(--border)] p-4 overflow-y-auto space-y-5">
          {/* Language */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-[var(--text-secondary)]">Language</label>
            <div className="grid grid-cols-2 gap-1.5">
              {LANGUAGES.map((l) => (
                <button
                  key={l.value}
                  onClick={() => setLanguage(l.value)}
                  className={`flex items-center justify-between px-2.5 py-2 rounded border text-xs transition-colors ${
                    language === l.value
                      ? 'border-[var(--accent)] bg-[var(--accent-subtle)] text-[var(--text-primary)]'
                      : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <span>{l.label}</span>
                  <span className="font-mono text-[10px] opacity-60">.{l.ext}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Mode */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-[var(--text-secondary)]">Output mode</label>
            <div className="space-y-1.5">
              {MODES.map((m) => (
                <button
                  key={m.value}
                  onClick={() => setMode(m.value)}
                  disabled={m.value === 'hooks' && language !== 'typescript'}
                  className={`flex flex-col items-start w-full px-2.5 py-2 rounded border text-left text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                    mode === m.value
                      ? 'border-[var(--accent)] bg-[var(--accent-subtle)] text-[var(--text-primary)]'
                      : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <span className="font-medium">{m.label}</span>
                  <span className="text-[10px] opacity-70 mt-0.5">{m.description}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Branch */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--text-secondary)]">Branch</label>
            <Input
              className="h-7 text-xs"
              value={branchName}
              onChange={(e) => setBranchName(e.target.value)}
              placeholder="main"
            />
          </div>

          {/* Optional: package name / version */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--text-secondary)]">Package name (optional)</label>
            <Input
              className="h-7 text-xs"
              value={packageName}
              onChange={(e) => setPackageName(e.target.value)}
              placeholder="my-api-client"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--text-secondary)]">Package version (optional)</label>
            <Input
              className="h-7 text-xs"
              value={packageVersion}
              onChange={(e) => setPackageVersion(e.target.value)}
              placeholder="1.0.0"
            />
          </div>

          <Button
            className="w-full gap-2"
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
          >
            {generateMutation.isPending ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Generating…</>
            ) : (
              <><Code2 className="h-4 w-4" /> Generate & Download</>
            )}
          </Button>
        </div>

        {/* Right: history panel */}
        <div className="flex-1 p-4 overflow-y-auto">
          <h2 className="text-xs font-medium text-[var(--text-secondary)] mb-3">Generation history</h2>

          {runsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14" />)}
            </div>
          ) : runs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center text-[var(--text-muted)]">
              <Code2 className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-sm">No generations yet</p>
              <p className="text-xs mt-1">Choose a language and click Generate to get started</p>
            </div>
          ) : (
            <div className="space-y-2">
              {runs.map((run) => (
                <div
                  key={run.id}
                  className="flex items-start gap-3 p-3 rounded-md border border-[var(--border)] bg-[var(--bg-1)]"
                >
                  <StatusIcon status={run.status} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-medium capitalize">{run.language}</span>
                      <Badge variant="outline" className="text-[10px] px-1 py-0">{run.mode}</Badge>
                      {statusBadge(run.status)}
                    </div>
                    <div className="text-[10px] text-[var(--text-muted)] mt-0.5">
                      {new Date(run.createdAt).toLocaleString()}
                      {run.specHash && (
                        <span className="ml-2 font-mono">#{run.specHash.slice(0, 8)}</span>
                      )}
                    </div>
                    {run.errorMessage && (
                      <p className="text-[10px] text-red-500 mt-1 truncate">{run.errorMessage}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
