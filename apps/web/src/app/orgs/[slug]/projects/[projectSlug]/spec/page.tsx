'use client';

import { use, useState } from 'react';
import dynamic from 'next/dynamic';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Download, Upload, RefreshCw, FileJson, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { orgsApi, projectsApi, specApi, linterApi, type LintIssue } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

const SEVERITY_ICON: Record<string, React.ReactNode> = {
  error: <AlertCircle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />,
  warn: <AlertCircle className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />,
  info: <AlertCircle className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />,
  hint: <AlertCircle className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />,
};

interface ImportDialogProps {
  open: boolean;
  onClose: () => void;
  onImport: (urlOrContent: string) => void;
  importing: boolean;
}

function ImportDialog({ open, onClose, onImport, importing }: ImportDialogProps) {
  const [value, setValue] = useState('');
  const isUrl = value.startsWith('http://') || value.startsWith('https://');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim()) return;
    onImport(value.trim());
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import OpenAPI spec</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 pt-2">
          <p className="text-xs text-[var(--text-muted)]">
            Paste a URL or raw OpenAPI / Swagger JSON/YAML content.
          </p>
          <textarea
            className="w-full h-40 rounded border border-[var(--border)] bg-[var(--bg-2)] text-xs font-mono p-2 resize-none focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            placeholder={'https://petstore3.swagger.io/api/v3/openapi.json\n\n— or paste raw JSON/YAML —'}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={importing}>
              Cancel
            </Button>
            <Button type="submit" disabled={!value.trim() || importing}>
              {importing ? 'Importing…' : isUrl ? 'Import URL' : 'Import content'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function SpecPage({
  params,
}: {
  params: Promise<{ slug: string; projectSlug: string }>;
}) {
  const { slug, projectSlug } = use(params);
  const qc = useQueryClient();

  const [showImport, setShowImport] = useState(false);
  const [lintExpanded, setLintExpanded] = useState(true);

  const { data: orgs } = useQuery({ queryKey: ['orgs'], queryFn: () => orgsApi.list() });
  const currentOrg = orgs?.find((o) => o.slug === slug);

  const { data: project } = useQuery({
    queryKey: ['project', currentOrg?.id, projectSlug],
    queryFn: () => projectsApi.getBySlug(currentOrg!.id, projectSlug),
    enabled: !!currentOrg?.id,
  });

  const branch = 'main';

  const {
    data: spec,
    isLoading: specLoading,
    refetch: refetchSpec,
    isFetching,
  } = useQuery({
    queryKey: ['spec', project?.id, branch],
    queryFn: () => specApi.compose(project!.id, branch),
    enabled: !!project?.id,
  });

  const { data: lintResult, refetch: refetchLint } = useQuery({
    queryKey: ['lint', project?.id, branch],
    queryFn: () => linterApi.lintBranch(project!.id, branch),
    enabled: !!project?.id,
  });

  const importMutation = useMutation({
    mutationFn: async (urlOrContent: string) => {
      if (!project) throw new Error('No project');
      const isUrl = urlOrContent.startsWith('http://') || urlOrContent.startsWith('https://');
      return specApi.importSpec(project.id, branch, isUrl ? { url: urlOrContent } : { content: urlOrContent });
    },
    onSuccess: (result) => {
      void qc.invalidateQueries({ queryKey: ['endpoints', project?.id, branch] });
      void qc.invalidateQueries({ queryKey: ['schemas', project?.id, branch] });
      void refetchSpec();
      void refetchLint();
      setShowImport(false);
      toast.success(
        `Imported ${result.imported} endpoint${result.imported !== 1 ? 's' : ''}, ${result.schemas} schema${result.schemas !== 1 ? 's' : ''}`,
      );
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Import failed'),
  });

  const specText = spec ? JSON.stringify(spec, null, 2) : '';
  const issues: LintIssue[] = lintResult?.issues ?? [];
  const errorCount = issues.filter((i) => i.severity === 'error').length;
  const warnCount = issues.filter((i) => i.severity === 'warn').length;

  if (!project) return null;

  const exportJsonUrl = project ? specApi.exportUrl(project.id, branch, 'json') : '#';
  const exportYamlUrl = project ? specApi.exportUrl(project.id, branch, 'yaml') : '#';

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--border)] flex-shrink-0">
        <FileJson className="h-4 w-4 text-[var(--accent)]" />
        <span className="text-sm font-medium">OpenAPI Spec</span>
        <span className="text-xs text-[var(--text-muted)] ml-1">({branch})</span>
        <div className="flex-1" />

        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs gap-1"
          onClick={() => { void refetchSpec(); void refetchLint(); }}
          disabled={isFetching}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>

        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs gap-1"
          onClick={() => setShowImport(true)}
        >
          <Upload className="h-3.5 w-3.5" />
          Import
        </Button>

        <a href={exportYamlUrl} download={`${projectSlug}.yaml`}>
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
            <Download className="h-3.5 w-3.5" />
            YAML
          </Button>
        </a>

        <a href={exportJsonUrl} download={`${projectSlug}.json`}>
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
            <Download className="h-3.5 w-3.5" />
            JSON
          </Button>
        </a>
      </div>

      {/* Lint summary bar */}
      {lintResult && (
        <button
          className="flex items-center gap-2 px-4 py-1.5 border-b border-[var(--border)] text-xs w-full text-left hover:bg-[var(--bg-2)] transition-colors flex-shrink-0"
          onClick={() => setLintExpanded((v) => !v)}
        >
          {errorCount === 0 && warnCount === 0 ? (
            <>
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              <span className="text-emerald-600">All lint checks passed</span>
            </>
          ) : (
            <>
              {errorCount > 0 && (
                <span className="text-red-500">{errorCount} error{errorCount !== 1 ? 's' : ''}</span>
              )}
              {warnCount > 0 && (
                <span className="text-amber-500 ml-1">{warnCount} warning{warnCount !== 1 ? 's' : ''}</span>
              )}
            </>
          )}
          <span className="ml-auto text-[var(--text-muted)]">{lintExpanded ? '▲' : '▼'} Lint findings</span>
        </button>
      )}

      {/* Lint panel */}
      {lintExpanded && issues.length > 0 && (
        <div className="border-b border-[var(--border)] max-h-36 overflow-y-auto flex-shrink-0 bg-[var(--bg-1)]">
          {issues.map((issue, i) => (
            <div key={i} className="flex items-start gap-2 px-4 py-1.5 text-xs border-b border-[var(--border)] last:border-0">
              {SEVERITY_ICON[issue.severity]}
              <span className="font-mono text-[var(--text-muted)] shrink-0">{issue.code}</span>
              <span className="text-[var(--text-secondary)] flex-1">{issue.message}</span>
              {issue.path.length > 0 && (
                <span className="font-mono text-[var(--text-muted)] text-[10px]">{issue.path.join('.')}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Monaco */}
      <div className="flex-1 overflow-hidden">
        {specLoading ? (
          <div className="p-4 space-y-2">
            {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-5" />)}
          </div>
        ) : (
          <MonacoEditor
            height="100%"
            defaultLanguage="json"
            value={specText}
            options={{
              readOnly: true,
              minimap: { enabled: false },
              fontSize: 12,
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              wordWrap: 'on',
              tabSize: 2,
            }}
            theme="vs-dark"
          />
        )}
      </div>

      <ImportDialog
        open={showImport}
        onClose={() => setShowImport(false)}
        onImport={(v) => importMutation.mutate(v)}
        importing={importMutation.isPending}
      />
    </div>
  );
}
