'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, LogOut, Settings, ChevronDown } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/auth.context';
import { useUiStore } from '@/store/ui.store';
import { orgsApi, type Org } from '@/lib/api';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface TopBarProps {
  currentOrg?: Org;
}

export function TopBar({ currentOrg }: TopBarProps) {
  const { user, signOut } = useAuth();
  const { toggleCommandPalette } = useUiStore();
  const router = useRouter();

  const { data: orgs } = useQuery({
    queryKey: ['orgs'],
    queryFn: () => orgsApi.list(),
    enabled: !!user,
  });

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  const initials = user?.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() ?? '??';

  return (
    <header className="flex h-12 items-center border-b border-[var(--border)] bg-[var(--bg-1)] px-4 gap-3 shrink-0">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2 font-semibold text-[var(--text-primary)] shrink-0">
        <span className="text-[var(--accent)] font-bold text-lg">⬡</span>
        <span className="text-sm">APIForge</span>
      </Link>

      {/* Org switcher */}
      {orgs && orgs.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1 text-[var(--text-secondary)]">
              {currentOrg?.name ?? 'Select org'}
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>Organizations</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {orgs.map((org) => (
              <DropdownMenuItem key={org.id} onClick={() => router.push(`/orgs/${org.slug}`)}>
                {org.name}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push('/onboarding')}>
              + New organization
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <div className="flex-1" />

      {/* ⌘K search trigger */}
      <Button
        variant="ghost"
        size="sm"
        className="gap-2 text-[var(--text-muted)] text-xs hidden sm:flex"
        onClick={toggleCommandPalette}
      >
        <Search className="h-3.5 w-3.5" />
        <span>Search</span>
        <kbd className="pointer-events-none rounded border border-[var(--border)] bg-[var(--bg-2)] px-1 py-0.5 text-[10px]">
          ⌘K
        </kbd>
      </Button>

      {/* User menu */}
      {user && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]">
              <Avatar className="h-7 w-7">
                {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name} />}
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium">{user.name}</p>
                <p className="text-xs text-[var(--text-muted)]">{user.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push('/account')}>
              <Settings className="mr-2 h-4 w-4" />
              Account settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="text-[var(--danger)]">
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </header>
  );
}
