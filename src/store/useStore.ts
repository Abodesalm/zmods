import { create } from "zustand";
import { api } from "@/lib/api";
import type { DB, Game, Mod } from "@/lib/types";

export type View =
  | { kind: "home" }
  | { kind: "game"; gameId: string }
  | { kind: "settings" };

type State = {
  db: DB | null;
  ready: boolean;
  loadError: string | null;
  view: View;
  /** `${gameId}/${fileName}` -> data URL. `null` while in flight. */
  assets: Record<string, string | null>;

  init: () => Promise<void>;
  setDb: (db: DB) => void;
  navigate: (view: View) => void;
  loadAsset: (gameId: string, fileName: string) => void;
  dropGameAssets: (gameId: string) => void;
};

export const assetKey = (gameId: string, fileName: string) => `${gameId}/${fileName}`;

export const useStore = create<State>((set, get) => ({
  db: null,
  ready: false,
  loadError: null,
  view: { kind: "home" },
  assets: {},

  init: async () => {
    try {
      const db = await api.loadDb();
      set({ db, ready: true, loadError: null });
    } catch (e) {
      set({
        ready: true,
        loadError: typeof e === "string" ? e : "Could not open the ZMods library.",
      });
    }
  },

  setDb: (db) => {
    const { view } = get();
    // A deleted game must not leave the app staring at a blank page.
    if (view.kind === "game" && !db.games.some((g) => g.id === view.gameId)) {
      set({ db, view: { kind: "home" } });
    } else {
      set({ db });
    }
  },

  navigate: (view) => set({ view }),

  loadAsset: (gameId, fileName) => {
    if (!fileName) return;
    const key = assetKey(gameId, fileName);
    if (key in get().assets) return;

    set((s) => ({ assets: { ...s.assets, [key]: null } }));
    api
      .readAsset(gameId, fileName)
      .then((dataUrl) => set((s) => ({ assets: { ...s.assets, [key]: dataUrl } })))
      .catch(() =>
        // A missing image is a cosmetic problem — leave the placeholder up
        // rather than shouting at the user with an error toast.
        set((s) => {
          const next = { ...s.assets };
          delete next[key];
          return { assets: next };
        }),
      );
  },

  dropGameAssets: (gameId) =>
    set((s) => {
      const next: Record<string, string | null> = {};
      for (const [k, v] of Object.entries(s.assets)) {
        if (!k.startsWith(`${gameId}/`)) next[k] = v;
      }
      return { assets: next };
    }),
}));

// --- selectors ---------------------------------------------------------------

export const useGames = (): Game[] => useStore((s) => s.db?.games ?? EMPTY_GAMES);

export const useGame = (gameId: string | null): Game | undefined =>
  useStore((s) => (gameId ? s.db?.games.find((g) => g.id === gameId) : undefined));

export const useSettings = () => useStore((s) => s.db?.settings);

export function activeModCount(game: Game): number {
  return game.mods.filter((m) => m.status === "active").length;
}

export function allTags(mods: Mod[]): string[] {
  const seen = new Map<string, string>();
  for (const m of mods) {
    for (const t of m.tags) {
      const key = t.toLowerCase();
      if (!seen.has(key)) seen.set(key, t);
    }
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

const EMPTY_GAMES: Game[] = [];
