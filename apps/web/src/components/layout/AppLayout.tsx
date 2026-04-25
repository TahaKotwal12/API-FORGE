'use client';

import { TopBar } from './TopBar';
import { LeftNav } from './LeftNav';
import { CommandPalette } from '@/components/CommandPalette';
import type { Org } from '@/lib/api';

interface AppLayoutProps {
  children: React.ReactNode;
  currentOrg?: Org;
  orgSlug?: string;
}

export function AppLayout({ children, currentOrg, orgSlug }: AppLayoutProps) {
  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <TopBar currentOrg={currentOrg} />
      <div className="flex flex-1 overflow-hidden">
        <LeftNav orgSlug={orgSlug} />
        <main className="flex-1 overflow-auto bg-[var(--bg-0)]">{children}</main>
      </div>
      {/* Status bar */}
      <footer className="flex h-6 items-center border-t border-[var(--border)] bg-[var(--bg-1)] px-3 text-xs text-[var(--text-muted)]">
        <span>APIForge</span>
      </footer>
      <CommandPalette />
    </div>
  );
}
