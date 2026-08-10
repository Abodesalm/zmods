import { invoke } from "@tauri-apps/api/core";
import type {
  AppSettings,
  DB,
  GameInput,
  ModInput,
  ModMetaInput,
  UpdateDiff,
} from "./types";

/**
 * Every mutating command returns the whole DB, so the store can replace its
 * state wholesale instead of patching it and drifting from disk.
 */
export const api = {
  loadDb: () => invoke<DB>("load_db"),

  saveSettings: (settings: AppSettings) => invoke<DB>("save_settings", { settings }),

  setPoolPath: (new_path: string) => invoke<DB>("set_pool_path", { new_path }),

  addGame: (input: GameInput) => invoke<DB>("add_game", { input }),

  updateGame: (game_id: string, input: GameInput) =>
    invoke<DB>("update_game", { game_id, input }),

  deleteGame: (game_id: string) => invoke<DB>("delete_game", { game_id }),

  addMod: (game_id: string, input: ModInput, sources: string[]) =>
    invoke<DB>("add_mod", { game_id, input, sources }),

  updateModMeta: (game_id: string, mod_id: string, input: ModMetaInput) =>
    invoke<DB>("update_mod_meta", { game_id, mod_id, input }),

  removeModFromPool: (game_id: string, mod_id: string) =>
    invoke<DB>("remove_mod_from_pool", { game_id, mod_id }),

  applyMod: (game_id: string, mod_id: string) => invoke<DB>("apply_mod", { game_id, mod_id }),

  removeModFromGame: (game_id: string, mod_id: string) =>
    invoke<DB>("remove_mod_from_game", { game_id, mod_id }),

  disableMod: (game_id: string, mod_id: string) => invoke<DB>("disable_mod", { game_id, mod_id }),

  enableMod: (game_id: string, mod_id: string) => invoke<DB>("enable_mod", { game_id, mod_id }),

  previewModUpdate: (game_id: string, mod_id: string, sources: string[]) =>
    invoke<UpdateDiff>("preview_mod_update", { game_id, mod_id, sources }),

  updateModFiles: (game_id: string, mod_id: string, sources: string[]) =>
    invoke<DB>("update_mod_files", { game_id, mod_id, sources }),

  markModBroken: (game_id: string, mod_id: string) =>
    invoke<DB>("mark_mod_broken", { game_id, mod_id }),

  readAsset: (game_id: string, file_name: string) =>
    invoke<string>("read_asset", { game_id, file_name }),

  readImagePreview: (path: string) => invoke<string>("read_image_preview", { path }),

  modPoolStats: (game_id: string, mod_id: string) =>
    invoke<[number, number]>("mod_pool_stats", { game_id, mod_id }),
};
