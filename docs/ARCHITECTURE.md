# Architecture

Notes for anyone working on ZMods itself. For installing and using the app, see
the [README](../README.md).

## Stack

Tauri v2 (Rust) + React 19 + TypeScript + Tailwind v4, with Zustand for state
and Radix primitives under hand-rolled shadcn-style components.

## Where things live

Every file operation lives in Rust. The frontend never touches the filesystem.

| File | Role |
| --- | --- |
| `src-tauri/src/models.rs` | The `db.json` schema and command payloads |
| `src-tauri/src/db.rs` | Load/save, path helpers, validation, integrity scan |
| `src-tauri/src/fsops.rs` | Recursive copy/move/delete, diffing, source materialisation |
| `src-tauri/src/commands.rs` | The `#[tauri::command]` surface |
| `src/lib/api.ts` | Typed `invoke` wrappers |
| `src/lib/actions.ts` | Command + toast + store update, one call per user action |
| `src/store/useStore.ts` | Zustand store (db, current view, image cache) |
| `src/components/ui/` | Generic primitives — button, dialog, sheet, select… |
| `src/components/app/` | ZMods-specific pieces — mods table, drawers, pickers |
| `src/views/` | Home, Game and Settings screens |

## Conventions

**Every mutating command returns the whole `DB`.** The store replaces its state
wholesale rather than patching it, so the UI cannot drift from what is on disk.

**`db.json` is written atomically** — temp file plus rename. A partial write
would lose the entire library.

**Commands take `snake_case` arguments** via `#[tauri::command(rename_all =
"snake_case")]`, so the TypeScript side uses one naming convention throughout.

## Storage layout

`db.json` lives in the platform data directory. The pool location is a setting
and can be moved from the Settings page.

```
~/.local/share/zmods/
├── db.json
└── pool/
    └── {game_id}/
        ├── assets/          cover.*, icon.*, hero.*
        ├── {mod_file_name}/ active mods (folders or files)
        └── disabled/
            └── {mod_file_name}/
```

## Mod state

`status` is one of:

| Status | Meaning |
| --- | --- |
| `active` | In the pool and deployed to the game folder |
| `none` | In the pool only |
| `disabled` | Parked in `pool/{game_id}/disabled/` |
| `broken` | Pool files are missing |

On every load, `reconcile()` re-reads the disk and repairs the record: missing
pool files mark a mod broken, a broken mod whose files reappear is recovered,
and an active mod whose deployed files are gone drops back to `none`. That last
check only runs when the game's mods folder is actually visible, so an unmounted
drive cannot rewrite the library.

`deployed_files` records every file written into the game folder, which is what
makes "remove from game" precise: it deletes exactly what it put there and then
prunes the directories it emptied, never pre-existing files alongside them.

## How sources become a mod

Both the initial import and the update flow run through the same rules
(`plan_sources` / `materialize` in `fsops.rs`), so the update diff is always
truthful:

- A **file** mod takes exactly one source file, keyed under the mod's
  `file_name` — picking a differently named file reads as a change, not as an
  add plus a remove.
- A **folder** mod given a single directory takes that directory's *contents*.
  Given anything else, each source is placed side by side under the mod root by
  base name.

## Theming

Design tokens are CSS custom properties in `src/index.css`, mapped to Tailwind
utilities via `@theme inline`. `--accent` is the user's accent colour;
`--accent-fg` is derived from its relative luminance so button labels stay
readable at any hue. Fonts are bundled through `@fontsource`, so nothing is
fetched at runtime.

## Known gaps

The file operations are compile-verified and the UI has been driven end to end,
but there are no automated tests over `fsops` against real directories yet.
That is the first thing worth adding.
