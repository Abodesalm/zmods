import { api } from "./api";
import { notify } from "./toast";
import { useStore } from "@/store/useStore";
import type { AppSettings, DB, GameInput, ModInput, ModMetaInput } from "./types";

/**
 * Runs a backend command, folds the returned DB back into the store and
 * reports the outcome. Returns `true` only when the command succeeded, so
 * callers can decide whether to close their dialog.
 */
async function run(
  fn: () => Promise<DB>,
  success: string,
  failure: string,
  detail?: string,
): Promise<boolean> {
  try {
    const db = await fn();
    useStore.getState().setDb(db);
    notify.success(success, detail);
    return true;
  } catch (e) {
    notify.error(failure, e);
    return false;
  }
}

export const actions = {
  // --- settings -------------------------------------------------------------

  /** Settings are saved on every change, so the toast would be noise. */
  async saveSettings(settings: AppSettings): Promise<boolean> {
    try {
      const db = await api.saveSettings(settings);
      useStore.getState().setDb(db);
      return true;
    } catch (e) {
      notify.error("Could not save settings", e);
      return false;
    }
  },

  setPoolPath: (path: string) =>
    run(
      () => api.setPoolPath(path),
      "Pool moved",
      "Could not move the pool",
      path,
    ),

  // --- games ----------------------------------------------------------------

  addGame: (input: GameInput) =>
    run(() => api.addGame(input), "Game added", "Could not add game", input.name),

  updateGame: (gameId: string, input: GameInput) =>
    run(() => api.updateGame(gameId, input), "Game updated", "Could not update game", input.name),

  async deleteGame(gameId: string, name: string): Promise<boolean> {
    const ok = await run(
      () => api.deleteGame(gameId),
      "Game deleted",
      "Could not delete game",
      name,
    );
    if (ok) useStore.getState().dropGameAssets(gameId);
    return ok;
  },

  // --- pool -----------------------------------------------------------------

  addMod: (gameId: string, input: ModInput, sources: string[]) =>
    run(
      () => api.addMod(gameId, input, sources),
      "Mod added to pool",
      "Could not add mod",
      input.display_name,
    ),

  updateModMeta: (gameId: string, modId: string, input: ModMetaInput) =>
    run(
      () => api.updateModMeta(gameId, modId, input),
      "Mod updated",
      "Could not update mod",
      input.display_name,
    ),

  updateModFiles: (gameId: string, modId: string, sources: string[], name: string) =>
    run(
      () => api.updateModFiles(gameId, modId, sources),
      "Mod files updated",
      "Could not update mod files",
      name,
    ),

  removeModFromPool: (gameId: string, modId: string, name: string) =>
    run(
      () => api.removeModFromPool(gameId, modId),
      "Mod removed from pool",
      "Could not remove mod from pool",
      name,
    ),

  // --- deployment -----------------------------------------------------------

  applyMod: (gameId: string, modId: string, name: string) =>
    run(() => api.applyMod(gameId, modId), "Mod applied", "Could not apply mod", name),

  removeModFromGame: (gameId: string, modId: string, name: string) =>
    run(
      () => api.removeModFromGame(gameId, modId),
      "Mod removed from game",
      "Could not remove mod from game",
      name,
    ),

  disableMod: (gameId: string, modId: string, name: string) =>
    run(() => api.disableMod(gameId, modId), "Mod disabled", "Could not disable mod", name),

  enableMod: (gameId: string, modId: string, name: string) =>
    run(() => api.enableMod(gameId, modId), "Mod enabled", "Could not enable mod", name),

  markModBroken: (gameId: string, modId: string, name: string) =>
    run(
      () => api.markModBroken(gameId, modId),
      "Mod marked as broken",
      "Could not mark mod as broken",
      name,
    ),
};
