'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { endpointsApi, type Endpoint } from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const schema = z.object({
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']),
  path: z.string().min(1).startsWith('/'),
  summary: z.string().optional(),
  tags: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as const;

const METHOD_COLORS: Record<string, string> = {
  GET: 'text-emerald-500',
  POST: 'text-amber-500',
  PUT: 'text-blue-500',
  PATCH: 'text-purple-500',
  DELETE: 'text-red-500',
  HEAD: 'text-gray-400',
  OPTIONS: 'text-slate-400',
};

interface NewEndpointDialogProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  branch: string;
  onCreated: (ep: Endpoint) => void;
}

export function NewEndpointDialog({ open, onClose, projectId, branch, onCreated }: NewEndpointDialogProps) {
  const [submitting, setSubmitting] = useState(false);

  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { method: 'GET', path: '/' },
  });

  const selectedMethod = watch('method');

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    try {
      const tags = values.tags ? values.tags.split(',').map((t) => t.trim()).filter(Boolean) : [];
      const ep = await endpointsApi.create(projectId, branch, {
        method: values.method,
        path: values.path,
        summary: values.summary,
        tags,
        responses: { '200': { description: 'Success' } },
      });
      toast.success(`Created ${values.method} ${values.path}`);
      reset();
      onCreated(ep);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create endpoint');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New endpoint</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
          {/* Method picker */}
          <div className="space-y-1.5">
            <Label className="text-xs">Method</Label>
            <div className="flex flex-wrap gap-1">
              {METHODS.map((m) => (
                <label key={m} className="cursor-pointer">
                  <input type="radio" value={m} {...register('method')} className="sr-only" />
                  <span
                    className={`inline-flex items-center px-2 py-1 rounded text-[11px] font-mono font-bold border transition-all ${
                      selectedMethod === m
                        ? `border-current bg-current/10 ${METHOD_COLORS[m]}`
                        : 'border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border-strong)]'
                    }`}
                  >
                    {m}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Path */}
          <div className="space-y-1.5">
            <Label htmlFor="path" className="text-xs">Path</Label>
            <Input
              id="path"
              {...register('path')}
              placeholder="/users/{id}"
              className="font-mono text-sm"
            />
            {errors.path && <p className="text-xs text-red-500">{errors.path.message}</p>}
          </div>

          {/* Summary */}
          <div className="space-y-1.5">
            <Label htmlFor="summary" className="text-xs">Summary <span className="text-[var(--text-muted)]">(optional)</span></Label>
            <Input id="summary" {...register('summary')} placeholder="Brief description" />
          </div>

          {/* Tags */}
          <div className="space-y-1.5">
            <Label htmlFor="tags" className="text-xs">Tags <span className="text-[var(--text-muted)]">(comma-separated)</span></Label>
            <Input id="tags" {...register('tags')} placeholder="users, auth" />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>Cancel</Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Creating…' : 'Create endpoint'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
