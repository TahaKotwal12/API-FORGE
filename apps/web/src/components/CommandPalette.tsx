'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Command } from 'cmdk';
import { LogOut, Moon, Sun, FolderKanban } from 'lucide-react';
import { useUiStore } from '@/store/ui.store';
import { useAuth } from '@/contexts/auth.context';

export function CommandPalette() {
  const { commandPaletteOpen, closeCommandPalette, toggleCommandPalette, toggleTheme, theme } = useUiStore();
  const { signOut } = useAuth();
  const router = useRouter();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        toggleCommandPalette();
      }
      if (e.key === 'Escape') closeCommandPalette();
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [toggleCommandPalette, closeCommandPalette]);

  if (!commandPaletteOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh]" onClick={closeCommandPalette}>
      <div
        className="w-full max-w-lg rounded-xl border border-[var(--border)] bg-[var(--bg-2)] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <Command className="[&_[cmdk-input]]:h-12 [&_[cmdk-input]]:w-full [&_[cmdk-input]]:bg-transparent [&_[cmdk-input]]:px-4 [&_[cmdk-input]]:text-sm [&_[cmdk-input]]:outline-none [&_[cmdk-input]]:text-[var(--text-primary)] [&_[cmdk-input]]:placeholder:text-[var(--text-muted)] [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-[var(--text-muted)]">
          <Command.Input placeholder="Type a command or search..." autoFocus />
          <div className="border-t border-[var(--border)]" />
          <Command.List className="max-h-72 overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center text-sm text-[var(--text-muted)]">
              No results found.
            </Command.Empty>

            <Command.Group heading="Navigation">
              <CommandItem
                onSelect={() => { router.push('/'); closeCommandPalette(); }}
                icon={<FolderKanban className="h-4 w-4" />}
                label="Go to projects"
                shortcut="G P"
              />
            </Command.Group>

            <Command.Group heading="Actions">
              <CommandItem
                onSelect={() => { toggleTheme(); closeCommandPalette(); }}
                icon={theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              />
              <CommandItem
                onSelect={async () => { closeCommandPalette(); await signOut(); router.push('/login'); }}
                icon={<LogOut className="h-4 w-4" />}
                label="Sign out"
              />
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  );
}

function CommandItem({
  onSelect,
  icon,
  label,
  shortcut,
}: {
  onSelect: () => void;
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
}) {
  return (
    <Command.Item
      onSelect={onSelect}
      className="flex items-center gap-3 rounded-md px-3 py-2 text-sm cursor-default select-none text-[var(--text-primary)] data-[selected=true]:bg-[var(--bg-3)]"
    >
      <span className="text-[var(--text-muted)]">{icon}</span>
      <span className="flex-1">{label}</span>
      {shortcut && (
        <kbd className="text-[10px] text-[var(--text-muted)] border border-[var(--border)] rounded px-1">
          {shortcut}
        </kbd>
      )}
    </Command.Item>
  );
}
