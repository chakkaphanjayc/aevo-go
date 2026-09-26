import { create } from "zustand";
import { localRepository } from "@/lib/local-repository";
import { getPreference, setPreference } from "@/lib/preferences";

export type ThemeMode = "light" | "dark";

interface UiState {
  theme: ThemeMode;
  savedStoreSlugs: string[];
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  toggleSavedStore: (storeSlug: string) => void;
  setSavedStore: (storeSlug: string, saved: boolean) => void;
}

export const useUiStore = create<UiState>()((set) => ({
  theme: "dark",
  savedStoreSlugs: [],
  hydrated: false,
  hydrate: async () => {
    const [theme, favorites] = await Promise.all([
      getPreference<ThemeMode>("aevo-go-theme"),
      localRepository.listFavorites()
    ]);
    set({
      theme: theme === "light" || theme === "dark" ? theme : "dark",
      savedStoreSlugs: favorites.map((favorite) => favorite.slug),
      hydrated: true
    });
  },
  setTheme: (theme) => {
    set({ theme });
    void setPreference("aevo-go-theme", theme);
  },
  toggleTheme: () => {
    const nextTheme = useUiStore.getState().theme === "light" ? "dark" : "light";
    set({ theme: nextTheme });
    void setPreference("aevo-go-theme", nextTheme);
  },
  toggleSavedStore: (storeSlug) => {
    const isSaved = useUiStore.getState().savedStoreSlugs.includes(storeSlug);
    set((state) => ({
      savedStoreSlugs: isSaved
        ? state.savedStoreSlugs.filter((slug) => slug !== storeSlug)
        : [...state.savedStoreSlugs, storeSlug]
    }));
    if (isSaved) void localRepository.removeFavorite(storeSlug);
  },
  setSavedStore: (storeSlug, saved) => {
    set((state) => ({
      savedStoreSlugs: saved
        ? (state.savedStoreSlugs.includes(storeSlug) ? state.savedStoreSlugs : [...state.savedStoreSlugs, storeSlug])
        : state.savedStoreSlugs.filter((slug) => slug !== storeSlug)
    }));
    if (!saved) void localRepository.removeFavorite(storeSlug);
  }
}));

export async function hydrateUiState(): Promise<void> {
  await useUiStore.getState().hydrate();
}
