'use client';

import { use, useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Save, Trash2, AlertTriangle, Info, AlertCircle, ChevronDown, ChevronRight, Plus, X } from 'lucide-react';
import dynamic from 'next/dynamic';
import { orgsApi, projectsApi, endpointsApi, schemasApi, linterApi } from '@/lib/api';
import type { Endpoint, LintIssue } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { MethodPill } from '@/components/ui/MethodPill';

// Monaco loaded client-side only
const MonacoEditor = dynamic(() => import('@monaco-editor/react').then((m) => m.default), {
  ssr: false,
  loading: () => <div className="flex-1 bg-[var(--bg-2)] animate-pulse" />,
});

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as const;

const SEVERITY_ICON = {
  error: <AlertCircle className="h-3.5 w-3.5 text-red-500" />,
  warn: <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />,
  info: <Info className="h-3.5 w-3.5 text-blue-500" />,
  hint: <Info className="h-3.5 w-3.5 text-[var(--text-muted)]" />,
};

// ─── Parameter row ────────────────────────────────────────────────────────────

interface Parameter {
  name: string;
  in: 'path' | 'query' | 'header' | 'cookie';
  required?: boolean;
  description?: string;
  schema?: { type?: string };
}

function ParameterRow({
  param,
  onChange,
  onDelete,
}: {
  param: Parameter;
  onChange: (p: Parameter) => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-2 py-1 border-b border-[var(--border)] last:border-0">
      <select
        value={param.in}
        onChange={(e) => onChange({ ...param, in: e.target.value as Parameter['in'] })}
        className="text-xs bg-[var(--bg-2)] border border-[var(--border)] rounded px-1.5 py-1 text-[var(--text-secondary)]"
      >
        {['path', 'query', 'header', 'cookie'].map((loc) => (
          <option key={loc} value={loc}>{loc}</option>
        ))}
      </select>
      <Input
        value={param.name}
        onChange={(e) => onChange({ ...param, name: e.target.value })}
        placeholder="name"
        className="h-7 text-xs font-mono flex-1"
      />
      <select
        value={param.schema?.type ?? 'string'}
        onChange={(e) => onChange({ ...param, schema: { type: e.target.value } })}
        className="text-xs bg-[var(--bg-2)] border border-[var(--border)] rounded px-1.5 py-1 text-[var(--text-secondary)]"
      >
        {['string', 'integer', 'number', 'boolean', 'array', 'object'].map((t) => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>
      <label className="flex items-center gap-1 text-xs text-[var(--text-muted)] cursor-pointer">
        <input
          type="checkbox"
          checked={param.required ?? false}
          onChange={(e) => onChange({ ...param, required: e.target.checked })}
          className="rounded"
        />
        req
      </label>
      <Input
        value={param.description ?? ''}
        onChange={(e) => onChange({ ...param, description: e.target.value })}
        placeholder="description"
        className="h-7 text-xs flex-1"
      />
      <button onClick={onDelete} className="text-[var(--text-muted)] hover:text-red-500 transition-colors">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ─── Main endpoint editor ─────────────────────────────────────────────────────

export default function EndpointEditorPage({
  params,
}: {
  params: Promise<{ slug: string; projectSlug: string; endpointId: string }>;
}) {
  const { slug, projectSlug, endpointId } = use(params);
  const queryClient = useQueryClient();

  const { data: orgs } = useQuery({ queryKey: ['orgs'], queryFn: () => orgsApi.list() });
  const currentOrg = orgs?.find((o) => o.slug === slug);

  const { data: project } = useQuery({
    queryKey: ['project', currentOrg?.id, projectSlug],
    queryFn: () => projectsApi.getBySlug(currentOrg!.id, projectSlug),
    enabled: !!currentOrg?.id,
  });

  const { data: endpoint, isLoading } = useQuery({
    queryKey: ['endpoint', project?.id, endpointId],
    queryFn: () => endpointsApi.get(project!.id, 'main', endpointId),
    enabled: !!project?.id,
  });

  const { data: lintResult, refetch: refetchLint } = useQuery({
    queryKey: ['lint-endpoint', project?.id, endpointId],
    queryFn: () => linterApi.lintEndpoint(project!.id, 'main', endpointId),
    enabled: !!project?.id && !!endpointId,
    refetchInterval: false,
    staleTime: 0,
  });

  // Local draft state
  const [method, setMethod] = useState('GET');
  const [path, setPath] = useState('/');
  const [summary, setSummary] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [parameters, setParameters] = useState<Parameter[]>([]);
  const [responsesJson, setResponsesJson] = useState('{}');
  const [requestBodyJson, setRequestBodyJson] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [lintExpanded, setLintExpanded] = useState(true);

  // Sync endpoint data to local state
  useEffect(() => {
    if (!endpoint) return;
    setMethod(endpoint.method);
    setPath(endpoint.path);
    setSummary(endpoint.summary ?? '');
    setDescription(endpoint.description ?? '');
    setTags(endpoint.tags.join(', '));
    setParameters((endpoint.parameters as Parameter[]) ?? []);
    setResponsesJson(JSON.stringify(endpoint.responses, null, 2));
    setRequestBodyJson(endpoint.requestBody ? JSON.stringify(endpoint.requestBody, null, 2) : '');
    setIsDirty(false);
  }, [endpoint]);

  const markDirty = useCallback(() => setIsDirty(true), []);

  // Build live preview YAML
  const livePreview = (() => {
    try {
      const responses = JSON.parse(responsesJson || '{}') as Record<string, unknown>;
      const requestBody = requestBodyJson.trim() ? JSON.parse(requestBodyJson) as unknown : undefined;
      const op: Record<string, unknown> = {
        summary: summary || undefined,
        description: description || undefined,
        tags: tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : undefined,
        parameters: parameters.length > 0 ? parameters : undefined,
        requestBody,
        responses,
      };
      for (const k of Object.keys(op)) if (op[k] === undefined) delete op[k];
      const doc = {
        openapi: '3.1.0',
        info: { title: project?.name ?? 'API', version: '0.1.0' },
        paths: { [path]: { [method.toLowerCase()]: op } },
      };
      return JSON.stringify(doc, null, 2);
    } catch {
      return '// Invalid JSON in responses or request body';
    }
  })();

  const saveMutation = useMutation({
    mutationFn: () => {
      let responses: Record<string, unknown> = {};
      let requestBody: unknown = undefined;
      try { responses = JSON.parse(responsesJson) as Record<string, unknown>; } catch { /* keep current */ }
      try { if (requestBodyJson.trim()) requestBody = JSON.parse(requestBodyJson); } catch { /* keep current */ }
      return endpointsApi.update(project!.id, 'main', endpointId, {
        method,
        path,
        summary: summary || undefined,
        description: description || undefined,
        tags: tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
        parameters: parameters as unknown[],
        requestBody: requestBody ?? undefined,
        responses,
      });
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(['endpoint', project?.id, endpointId], updated);
      void queryClient.invalidateQueries({ queryKey: ['endpoints', project?.id] });
      void refetchLint();
      setIsDirty(false);
      toast.success('Saved');
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Save failed'),
  });

  if (isLoading) {
    return (
      <div className="flex-1 p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!endpoint) {
    return <div className="flex-1 p-6 text-[var(--text-muted)]">Endpoint not found.</div>;
  }

  const lintIssues = lintResult?.issues ?? [];
  const errorCount = lintResult?.errorCount ?? 0;
  const warnCount = lintResult?.warnCount ?? 0;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--border)] bg-[var(--bg-1)] flex-shrink-0">
        {/* Method selector */}
        <select
          value={method}
          onChange={(e) => { setMethod(e.target.value); markDirty(); }}
          className="bg-transparent text-xs font-mono font-bold border border-[var(--border)] rounded px-2 py-1 focus:outline-none"
          style={{ color: 'inherit' }}
        >
          {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>

        {/* Path */}
        <Input
          value={path}
          onChange={(e) => { setPath(e.target.value); markDirty(); }}
          className="font-mono text-sm h-8 flex-1 max-w-md"
          placeholder="/path/{param}"
        />

        {/* Summary */}
        <Input
          value={summary}
          onChange={(e) => { setSummary(e.target.value); markDirty(); }}
          className="text-sm h-8 flex-1"
          placeholder="Summary…"
        />

        <div className="ml-auto flex items-center gap-2">
          {isDirty && <span className="text-xs text-[var(--text-muted)]">Unsaved changes</span>}
          <Button
            size="sm"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !isDirty}
          >
            <Save className="h-3.5 w-3.5 mr-1" />
            {saveMutation.isPending ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>

      {/* Editor body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Design form */}
        <div className="flex-1 overflow-y-auto">
          <Tabs defaultValue="design" className="h-full flex flex-col">
            <TabsList className="mx-4 mt-3 w-fit">
              <TabsTrigger value="design" className="text-xs">Design</TabsTrigger>
              <TabsTrigger value="mock" className="text-xs">Mock</TabsTrigger>
              <TabsTrigger value="test" className="text-xs">Test</TabsTrigger>
            </TabsList>

            <TabsContent value="design" className="flex-1 px-4 pb-4 space-y-5 overflow-y-auto">
              {/* Description & tags */}
              <div className="space-y-3 pt-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">Description</label>
                  <Textarea
                    value={description}
                    onChange={(e) => { setDescription(e.target.value); markDirty(); }}
                    placeholder="Describe what this endpoint does…"
                    className="text-sm resize-none"
                    rows={2}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">Tags</label>
                  <Input
                    value={tags}
                    onChange={(e) => { setTags(e.target.value); markDirty(); }}
                    placeholder="users, auth (comma-separated)"
                    className="text-sm h-8"
                  />
                </div>
              </div>

              {/* Parameters */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">Parameters</label>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 text-xs gap-1 px-2"
                    onClick={() => {
                      setParameters((prev) => [...prev, { name: '', in: 'query', required: false, schema: { type: 'string' } }]);
                      markDirty();
                    }}
                  >
                    <Plus className="h-3 w-3" /> Add
                  </Button>
                </div>
                <div className="rounded-md border border-[var(--border)] bg-[var(--bg-2)] px-3 py-1">
                  {parameters.length === 0 ? (
                    <p className="text-xs text-[var(--text-muted)] py-2">No parameters defined</p>
                  ) : (
                    parameters.map((p, i) => (
                      <ParameterRow
                        key={i}
                        param={p}
                        onChange={(updated) => {
                          setParameters((prev) => prev.map((x, idx) => idx === i ? updated : x));
                          markDirty();
                        }}
                        onDelete={() => {
                          setParameters((prev) => prev.filter((_, idx) => idx !== i));
                          markDirty();
                        }}
                      />
                    ))
                  )}
                </div>
              </div>

              {/* Request body */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">Request body</label>
                <div className="rounded-md border border-[var(--border)] overflow-hidden" style={{ height: 160 }}>
                  <MonacoEditor
                    language="json"
                    value={requestBodyJson}
                    onChange={(v) => { setRequestBodyJson(v ?? ''); markDirty(); }}
                    theme="vs-dark"
                    options={{ minimap: { enabled: false }, fontSize: 12, lineNumbers: 'off', scrollBeyondLastLine: false, padding: { top: 8, bottom: 8 }, wordWrap: 'on' }}
                  />
                </div>
              </div>

              {/* Responses */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">Responses</label>
                <div className="rounded-md border border-[var(--border)] overflow-hidden" style={{ height: 200 }}>
                  <MonacoEditor
                    language="json"
                    value={responsesJson}
                    onChange={(v) => { setResponsesJson(v ?? '{}'); markDirty(); }}
                    theme="vs-dark"
                    options={{ minimap: { enabled: false }, fontSize: 12, lineNumbers: 'off', scrollBeyondLastLine: false, padding: { top: 8, bottom: 8 }, wordWrap: 'on' }}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="mock" className="flex-1 flex items-center justify-center p-10 text-center">
              <div>
                <p className="text-sm text-[var(--text-muted)] font-medium">Mock tab</p>
                <p className="text-xs text-[var(--text-muted)] mt-1">Coming in Phase 5</p>
              </div>
            </TabsContent>

            <TabsContent value="test" className="flex-1 flex items-center justify-center p-10 text-center">
              <div>
                <p className="text-sm text-[var(--text-muted)] font-medium">Test tab</p>
                <p className="text-xs text-[var(--text-muted)] mt-1">Coming in Phase 6</p>
              </div>
            </TabsContent>
          </Tabs>

          {/* Lint findings */}
          <div className="border-t border-[var(--border)] bg-[var(--bg-1)]">
            <button
              className="flex items-center gap-2 w-full px-4 py-2 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              onClick={() => setLintExpanded((v) => !v)}
            >
              {lintExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              <span className="font-medium">Lint</span>
              {errorCount > 0 && <Badge variant="destructive" className="text-[10px] h-4 px-1">{errorCount} error{errorCount !== 1 ? 's' : ''}</Badge>}
              {warnCount > 0 && <Badge variant="secondary" className="text-[10px] h-4 px-1">{warnCount} warn{warnCount !== 1 ? 's' : ''}</Badge>}
              {lintIssues.length === 0 && <span className="text-[10px] text-emerald-500">All good</span>}
            </button>
            {lintExpanded && lintIssues.length > 0 && (
              <div className="px-4 pb-3 space-y-1 max-h-36 overflow-y-auto">
                {lintIssues.map((issue: LintIssue, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs py-0.5">
                    <span className="mt-0.5 flex-shrink-0">{SEVERITY_ICON[issue.severity]}</span>
                    <span className="text-[var(--text-secondary)]">{issue.message}</span>
                    {issue.path.length > 0 && (
                      <span className="ml-auto font-mono text-[10px] text-[var(--text-muted)] shrink-0">{issue.path.join('.')}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Live YAML preview */}
        {showPreview && (
          <div className="w-96 flex-shrink-0 border-l border-[var(--border)] flex flex-col">
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-[var(--border)] bg-[var(--bg-1)]">
              <span className="text-xs text-[var(--text-muted)] font-medium">Live preview</span>
              <button
                className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                onClick={() => setShowPreview(false)}
              >
                ×
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <MonacoEditor
                language="json"
                value={livePreview}
                theme="vs-dark"
                options={{ readOnly: true, minimap: { enabled: false }, fontSize: 11, lineNumbers: 'off', scrollBeyondLastLine: false }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
