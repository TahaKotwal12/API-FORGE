import { cn } from '@/lib/utils';

const METHOD_STYLES: Record<string, string> = {
  GET:     'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  POST:    'bg-amber-500/10 text-amber-500 border-amber-500/20',
  PUT:     'bg-blue-500/10 text-blue-500 border-blue-500/20',
  PATCH:   'bg-purple-500/10 text-purple-500 border-purple-500/20',
  DELETE:  'bg-red-500/10 text-red-500 border-red-500/20',
  HEAD:    'bg-gray-500/10 text-gray-400 border-gray-500/20',
  OPTIONS: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
};

interface MethodPillProps {
  method: string;
  size?: 'xs' | 'sm' | 'md';
}

export function MethodPill({ method, size = 'sm' }: MethodPillProps) {
  const style = METHOD_STYLES[method.toUpperCase()] ?? 'bg-gray-500/10 text-gray-400 border-gray-500/20';
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded border font-mono font-semibold uppercase shrink-0',
        style,
        size === 'xs' && 'text-[9px] px-1 py-0 h-4 min-w-[32px]',
        size === 'sm' && 'text-[10px] px-1.5 py-0.5 min-w-[44px]',
        size === 'md' && 'text-xs px-2 py-0.5 min-w-[56px]',
      )}
    >
      {method.toUpperCase()}
    </span>
  );
}
