export type Theme = "light" | "dark" | "system";
export type GameModType = "folder" | "file" | "both";
export type ModKind = "folder" | "file";
export type ModStatus = "active" | "none" | "disabled" | "broken";

export type AppSettings = {
  pool_path: string;
  theme: Theme;
  accent_color: string;
  font: string;
};

export type Mod = {
  id: string;
  display_name: string;
  file_name: string;
  version: string;
  notes: string;
  tags: string[];
  url: string;
  type: ModKind;
  status: ModStatus;
  deployed_files: string[];
  date_added: string;
  last_updated: string;
};

export type Game = {
  id: string;
  name: string;
  description: string;
  notes: string;
  cover_image: string;
  icon: string;
  hero_image: string;
  game_path: string;
  mods_path: string;
  mod_type: GameModType;
  date_added: string;
  last_updated: string;
  mods: Mod[];
};

export type DB = {
  games: Game[];
  settings: AppSettings;
};

/** `source` copies a new image in, `clear` drops the current one. */
export type ImageInput = {
  source?: string | null;
  clear?: boolean;
};

export type GameInput = {
  name: string;
  description: string;
  notes: string;
  game_path: string;
  mods_path: string;
  mod_type: GameModType;
  cover_image: ImageInput;
  icon: ImageInput;
  hero_image: ImageInput;
};

export type ModInput = {
  display_name: string;
  file_name: string;
  version: string;
  notes: string;
  tags: string[];
  url: string;
  type: ModKind;
};

export type ModMetaInput = Omit<ModInput, "type">;

export type UpdateDiff = {
  added: string[];
  removed: string[];
  changed: string[];
  unchanged: string[];
};

export const FONT_OPTIONS = [
  { label: "Inter", stack: '"Inter Variable"' },
  { label: "Geist", stack: '"Geist Variable"' },
  { label: "JetBrains Mono", stack: '"JetBrains Mono Variable"' },
  { label: "IBM Plex Sans", stack: '"IBM Plex Sans Variable"' },
  { label: "Roboto", stack: '"Roboto Variable"' },
  { label: "Fira Sans", stack: '"Fira Sans"' },
] as const;

export const ACCENT_PRESETS = [
  "#7c5cff",
  "#4f8cff",
  "#22d3ee",
  "#10b981",
  "#a3e635",
  "#f59e0b",
  "#f97316",
  "#f43f5e",
  "#ec4899",
  "#94a3b8",
] as const;

export const MOD_TYPE_LABELS: Record<GameModType, string> = {
  folder: "Folder mods",
  file: "File mods",
  both: "Folder or file mods",
};

export const STATUS_LABELS: Record<ModStatus, string> = {
  active: "Active",
  none: "Not applied",
  disabled: "Disabled",
  broken: "Broken",
};
