'use client';

import { use, useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Search, Layers, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { orgsApi, projectsApi, schemasApi, type SchemaComponent } from '@/lib/api';
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

const DEFAULT_SCHEMA = JSON.stringify(
  { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
  null,
  2,
);

interface NewSchemaDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (name: string) => void;
}

function NewSchemaDialog({ open, onClose, onConfirm }: NewSchemaDialogProps) {
  const [name, setName] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onConfirm(name.trim());
    setName('');
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>New schema</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 pt-2">
          <Input
            autoFocus
            placeholder="SchemaName (PascalCase)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={!name.trim()}>Create</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function SchemasPage({
  params,
}: {
  params: Promise<{ slug: string; projectSlug: string }>;
}) {
  const { slug, projectSlug } = use(params);
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editorValue, setEditorValue] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const { data: orgs } = useQuery({ queryKey: ['orgs'], queryFn: () => orgsApi.list() });
  const currentOrg = orgs?.find((o) => o.slug === slug);

  const { data: project } = useQuery({
    queryKey: ['project', currentOrg?.id, projectSlug],
    queryFn: () => projectsApi.getBySlug(currentOrg!.id, projectSlug),
    enabled: !!currentOrg?.id,
  });

  const branch = 'main';

  const { data: schemas = [], isLoading } = useQuery({
    queryKey: ['schemas', project?.id, branch],
    queryFn: () => schemasApi.list(project!.id, branch),
    enabled: !!project?.id,
  });

  const filtered = schemas.filter((s) =>
    search === '' || s.name.toLowerCase().includes(search.toLowerCase()),
  );

  const selected = schemas.find((s) => s.id === selectedId) ?? null;

  useEffect(() => {
    if (selected) {
      setEditorValue(JSON.stringify(selected.schema, null, 2));
      setIsDirty(false);
    }
  }, [selectedId, selected?.id]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selected || !project) return;
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(editorValue) as Record<string, unknown>;
      } catch {
        throw new Error('Invalid JSON — fix schema before saving');
      }
      return schemasApi.update(project.id, branch, selected.id, { schema: parsed });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['schemas', project?.id, branch] });
      setIsDirty(false);
      toast.success('Schema saved');
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Save failed'),
  });

  const createMutation = useMutation({
    mutationFn: (name: string) => {
      if (!project) throw new Error('No project');
      return schemasApi.create(project.id, branch, {
        name,
        schema: { type: 'object', properties: {}, required: [] },
      });
    },
    onSuccess: (schema) => {
      void qc.invalidateQueries({ queryKey: ['schemas', project?.id, branch] });
      setSelectedId(schema.id);
      setShowNew(false);
      toast.success(`Created ${schema.name}`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Create failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (schemaId: string) => {
      if (!project) throw new Error('No project');
      return schemasApi.delete(project.id, branch, schemaId);
    },
    onSuccess: (_, deletedId) => {
      void qc.invalidateQueries({ queryKey: ['schemas', project?.id, branch] });
      if (selectedId === deletedId) {
        setSelectedId(null);
        setEditorValue('');
      }
      toast.success('Schema deleted');
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Delete failed'),
  });

  if (!project) return null;

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: schema list */}
      <aside className="w-56 flex-shrink-0 border-r border-[var(--border)] bg-[var(--bg-1)] flex flex-col overflow-hidden">
        <div className="p-2 border-b border-[var(--border)] space-y-2 flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-muted)]" />
            <Input
              className="pl-7 h-7 text-xs bg-[var(--bg-2)] border-[var(--border)]"
              placeholder="Search schemas…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button size="sm" className="w-full h-7 text-xs gap-1" onClick={() => setShowNew(true)}>
            <Plus className="h-3.5 w-3.5" /> New schema
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto py-1">
          {isLoading ? (
            <div className="p-2 space-y-1">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-6" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-4 text-center text-xs text-[var(--text-muted)]">
              {search ? 'No schemas match' : 'No schemas yet'}
            </div>
          ) : (
            filtered.map((s) => (
              <div
                key={s.id}
                className={`group flex items-center gap-2 px-3 py-1.5 mx-1 rounded text-xs cursor-pointer transition-colors ${
                  selectedId === s.id
                    ? 'bg-[var(--accent-subtle)] text-[var(--text-primary)]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-3)]'
                }`}
                onClick={() => setSelectedId(s.id)}
              >
                <Layers className="h-3 w-3 flex-shrink-0 text-[var(--accent)]" />
                <span className="truncate flex-1 font-mono">{s.name}</span>
                <button
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:text-red-500"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Delete schema "${s.name}"?`)) {
                      deleteMutation.mutate(s.id);
                    }
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* Right: editor */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selected ? (
          <>
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-2 border-b border-[var(--border)] flex-shrink-0">
              <Layers className="h-4 w-4 text-[var(--accent)]" />
              <span className="font-mono text-sm font-medium">{selected.name}</span>
              <div className="flex-1" />
              {isDirty && (
                <span className="text-xs text-[var(--text-muted)]">Unsaved changes</span>
              )}
              <Button
                size="sm"
                disabled={!isDirty || saveMutation.isPending}
                onClick={() => saveMutation.mutate()}
              >
                {saveMutation.isPending ? 'Saving…' : 'Save'}
              </Button>
            </div>

            {/* Monaco */}
            <div className="flex-1 overflow-hidden">
              <MonacoEditor
                height="100%"
                defaultLanguage="json"
                value={editorValue}
                onChange={(v) => {
                  setEditorValue(v ?? '');
                  setIsDirty(true);
                }}
                options={{
                  minimap: { enabled: false },
                  fontSize: 13,
                  lineNumbers: 'on',
                  scrollBeyondLastLine: false,
                  wordWrap: 'on',
                  tabSize: 2,
                }}
                theme="vs-dark"
              />
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center text-[var(--text-muted)]">
            <Layers className="h-10 w-10 mb-3 opacity-40" />
            <p className="text-sm">Select a schema to edit, or create a new one</p>
          </div>
        )}
      </div>

      <NewSchemaDialog
        open={showNew}
        onClose={() => setShowNew(false)}
        onConfirm={(name) => createMutation.mutate(name)}
      />
    </div>
  );
}
