import { create } from 'zustand';

interface UiStore {
  commandPaletteOpen: boolean;
  theme: 'dark' | 'light';
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
  toggleCommandPalette: () => void;
  toggleTheme: () => void;
}

export const useUiStore = create<UiStore>((set) => ({
  commandPaletteOpen: false,
  theme: 'dark',
  openCommandPalette: () => set({ commandPaletteOpen: true }),
  closeCommandPalette: () => set({ commandPaletteOpen: false }),
  toggleCommandPalette: () => set((s) => ({ commandPaletteOpen: !s.commandPaletteOpen })),
  toggleTheme: () =>
    set((s) => {
      const next = s.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.classList.toggle('light', next === 'light');
      return { theme: next };
    }),
}));
