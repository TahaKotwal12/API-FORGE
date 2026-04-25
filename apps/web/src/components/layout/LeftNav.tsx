'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Settings, FolderKanban, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

interface LeftNavProps {
  orgSlug?: string;
}

export function LeftNav({ orgSlug }: LeftNavProps) {
  const pathname = usePathname();

  const items: NavItem[] = orgSlug
    ? [
        { label: 'Dashboard', href: `/orgs/${orgSlug}`, icon: LayoutDashboard },
        { label: 'Projects', href: `/orgs/${orgSlug}`, icon: FolderKanban },
        { label: 'Members', href: `/orgs/${orgSlug}/settings`, icon: Users },
        { label: 'Settings', href: `/orgs/${orgSlug}/settings`, icon: Settings },
      ]
    : [];

  return (
    <nav className="flex w-[260px] shrink-0 flex-col border-r border-[var(--border)] bg-[var(--bg-1)] py-3 px-2 gap-0.5">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href + item.label}
            href={item.href}
            className={cn(
              'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
              isActive
                ? 'bg-[var(--accent-subtle)] text-[var(--accent)]'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-2)] hover:text-[var(--text-primary)]',
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
