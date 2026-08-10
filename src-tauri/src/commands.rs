use std::fs;
use std::path::{Path, PathBuf};

use base64::{engine::general_purpose::STANDARD as B64, Engine as _};
use tauri::State;

use crate::db::{self, AppState};
use crate::error::{Ctx, Error, Result};
use crate::fsops;
use crate::models::*;

const IMAGE_EXTS: [&str; 8] = ["png", "jpg", "jpeg", "webp", "gif", "bmp", "avif", "svg"];

// ---------------------------------------------------------------------------
// Shared plumbing
// ---------------------------------------------------------------------------

fn lock<'a>(state: &'a AppState) -> Result<std::sync::MutexGuard<'a, Db>> {
    state
        .db
        .lock()
        .map_err(|_| Error::msg("ZMods hit an internal lock error. Restart the app."))
}

/// Runs `f` against the in-memory db, persists the result and hands the whole
/// db back. Every command returns the full db so the UI has one source of truth.
fn mutate<F>(state: &AppState, f: F) -> Result<Db>
where
    F: FnOnce(&mut Db) -> Result<()>,
{
    let mut guard = lock(state)?;
    // Work on a copy so a failure part-way through cannot leave the in-memory
    // db describing a state we never wrote to disk.
    let mut next = guard.clone();
    f(&mut next)?;
    db::save(&state.root, &next)?;
    *guard = next.clone();
    Ok(next)
}

fn to_paths(sources: &[String]) -> Vec<PathBuf> {
    sources
        .iter()
        .filter(|s| !s.trim().is_empty())
        .map(PathBuf::from)
        .collect()
}

fn abs(p: &Path) -> String {
    p.to_string_lossy().to_string()
}

/// Copy a mod out of the pool and into the game's mods folder, returning the
/// absolute path of every file written.
fn deploy(pool_src: &Path, mods_path: &Path, file_name: &str) -> Result<Vec<String>> {
    if !pool_src.exists() {
        return Err(Error(format!(
            "Mod files are missing from the pool: {}",
            pool_src.display()
        )));
    }
    if !mods_path.is_dir() {
        return Err(Error(format!(
            "Mods folder not found: {}",
            mods_path.display()
        )));
    }

    let dest = mods_path.join(file_name);
    fsops::copy_any(pool_src, &dest)?;

    if dest.is_dir() {
        let files = fsops::walk_files(&dest)?;
        Ok(files.values().map(|p| abs(p)).collect())
    } else {
        Ok(vec![abs(&dest)])
    }
}

/// Delete a mod's deployed files and tidy up the directories they left behind.
fn undeploy(m: &mut Mod, mods_path: &Path) -> Result<()> {
    let mut files: Vec<PathBuf> = m.deployed_files.iter().map(PathBuf::from).collect();
    // Deepest first, so pruning can collapse nested folders in one pass.
    files.sort_by_key(|p| std::cmp::Reverse(p.components().count()));

    for f in &files {
        fsops::remove_any(f)?;
        if let Some(parent) = f.parent() {
            fsops::prune_empty_dirs(parent, mods_path);
        }
    }

    // A folder mod that deployed nothing still leaves its root behind.
    let root = mods_path.join(&m.file_name);
    if root.is_dir() {
        fsops::prune_empty_dirs(&root, mods_path);
    }

    m.deployed_files.clear();
    Ok(())
}

fn image_ext(src: &Path) -> Result<String> {
    let ext = src
        .extension()
        .map(|e| e.to_string_lossy().to_lowercase())
        .unwrap_or_default();
    if ext.is_empty() || !IMAGE_EXTS.contains(&ext.as_str()) {
        return Err(Error(format!(
            "Unsupported image format: {}. Use {}.",
            src.display(),
            IMAGE_EXTS.join(", ")
        )));
    }
    Ok(ext)
}

/// Resolve one of the three per-game images. Returns the stored file name.
fn apply_image(assets: &Path, slot: &str, current: &str, input: &ImageInput) -> Result<String> {
    if input.clear {
        if !current.is_empty() {
            fsops::remove_any(&assets.join(current))?;
        }
        return Ok(String::new());
    }

    let Some(source) = input.source.as_ref().filter(|s| !s.trim().is_empty()) else {
        return Ok(current.to_string());
    };

    let src = PathBuf::from(source.trim());
    if !src.is_file() {
        return Err(Error(format!("Image not found: {}", src.display())));
    }

    let ext = image_ext(&src)?;
    let name = format!("{slot}.{ext}");
    fs::create_dir_all(assets).ctx_path("Cannot create assets folder", assets)?;

    if !current.is_empty() && current != name {
        fsops::remove_any(&assets.join(current))?;
    }
    let dest = assets.join(&name);
    fsops::remove_any(&dest)?;
    fs::copy(&src, &dest).ctx_pair("Copy failed", &src, &dest)?;
    Ok(name)
}

fn mime_for(ext: &str) -> &'static str {
    match ext {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "webp" => "image/webp",
        "gif" => "image/gif",
        "bmp" => "image/bmp",
        "avif" => "image/avif",
        "svg" => "image/svg+xml",
        _ => "application/octet-stream",
    }
}

// ---------------------------------------------------------------------------
// Library
// ---------------------------------------------------------------------------

#[tauri::command(rename_all = "snake_case")]
pub fn load_db(state: State<'_, AppState>) -> Result<Db> {
    let mut guard = lock(&state)?;
    let mut fresh = db::load(&state.root)?;
    db::reconcile(&mut fresh);
    db::save(&state.root, &fresh)?;
    *guard = fresh.clone();
    Ok(fresh)
}

#[tauri::command(rename_all = "snake_case")]
pub fn save_settings(state: State<'_, AppState>, settings: AppSettings) -> Result<Db> {
    mutate(&state, |db| {
        // Pool moves are a file operation, not a settings write.
        let pool_path = db.settings.pool_path.clone();
        db.settings = settings;
        db.settings.pool_path = pool_path;
        Ok(())
    })
}

#[tauri::command(rename_all = "snake_case")]
pub fn set_pool_path(state: State<'_, AppState>, new_path: String) -> Result<Db> {
    mutate(&state, |db| {
        let old = PathBuf::from(&db.settings.pool_path);
        let new = PathBuf::from(new_path.trim());

        if new.as_os_str().is_empty() {
            return Err(Error::msg("Pick a folder for the pool."));
        }
        if old == new {
            return Ok(());
        }
        if new.starts_with(&old) || old.starts_with(&new) {
            return Err(Error::msg(
                "The new pool folder cannot sit inside the current one (or vice versa).",
            ));
        }

        fs::create_dir_all(&new).ctx_path("Cannot create pool folder", &new)?;

        if old.is_dir() {
            for entry in fs::read_dir(&old).ctx_path("Cannot read pool folder", &old)? {
                let entry = entry.ctx_path("Cannot read pool entry in", &old)?;
                let from = entry.path();
                let to = new.join(entry.file_name());
                if to.exists() {
                    return Err(Error(format!(
                        "{} already exists in the new pool folder — move or delete it first.",
                        to.display()
                    )));
                }
                fsops::move_any(&from, &to)?;
            }
        }

        db.settings.pool_path = abs(&new);
        Ok(())
    })
}

// ---------------------------------------------------------------------------
// Games
// ---------------------------------------------------------------------------

#[tauri::command(rename_all = "snake_case")]
pub fn add_game(state: State<'_, AppState>, input: GameInput) -> Result<Db> {
    mutate(&state, |db| {
        let name = input.name.trim();
        if name.is_empty() {
            return Err(Error::msg("Game name is required."));
        }
        db::require_dir(&input.game_path, "Game folder")?;
        db::require_dir(&input.mods_path, "Mods folder")?;

        let id = db::new_id();
        let assets = db::assets_dir(db, &id);
        fs::create_dir_all(&assets).ctx_path("Cannot create assets folder", &assets)?;

        let cover = apply_image(&assets, "cover", "", &input.cover_image)?;
        let icon = apply_image(&assets, "icon", "", &input.icon)?;
        let hero = apply_image(&assets, "hero", "", &input.hero_image)?;

        let now = db::now_iso();
        db.games.push(Game {
            id,
            name: name.to_string(),
            description: input.description.trim().to_string(),
            notes: input.notes.trim().to_string(),
            cover_image: cover,
            icon,
            hero_image: hero,
            game_path: input.game_path.trim().to_string(),
            mods_path: input.mods_path.trim().to_string(),
            mod_type: input.mod_type,
            date_added: now.clone(),
            last_updated: now,
            mods: Vec::new(),
        });
        Ok(())
    })
}

#[tauri::command(rename_all = "snake_case")]
pub fn update_game(state: State<'_, AppState>, game_id: String, input: GameInput) -> Result<Db> {
    mutate(&state, |db| {
        let gi = db::game_index(db, &game_id)?;

        let name = input.name.trim();
        if name.is_empty() {
            return Err(Error::msg("Game name is required."));
        }
        db::require_dir(&input.game_path, "Game folder")?;
        let new_mods_path = db::require_dir(&input.mods_path, "Mods folder")?;

        let assets = db::assets_dir(db, &game_id);
        fs::create_dir_all(&assets).ctx_path("Cannot create assets folder", &assets)?;

        let (cur_cover, cur_icon, cur_hero, old_mods_path) = {
            let g = &db.games[gi];
            (
                g.cover_image.clone(),
                g.icon.clone(),
                g.hero_image.clone(),
                PathBuf::from(&g.mods_path),
            )
        };

        let cover = apply_image(&assets, "cover", &cur_cover, &input.cover_image)?;
        let icon = apply_image(&assets, "icon", &cur_icon, &input.icon)?;
        let hero = apply_image(&assets, "hero", &cur_hero, &input.hero_image)?;

        // Pointing the game at a different mods folder has to carry the
        // deployed mods across, otherwise deployed_files goes stale.
        if old_mods_path != new_mods_path {
            let gdir = db::game_dir(db, &game_id);
            for m in &mut db.games[gi].mods {
                if m.status != ModStatus::Active {
                    continue;
                }
                undeploy(m, &old_mods_path)?;
                let src = gdir.join(&m.file_name);
                m.deployed_files = deploy(&src, &new_mods_path, &m.file_name)?;
            }
        }

        let g = &mut db.games[gi];
        g.name = name.to_string();
        g.description = input.description.trim().to_string();
        g.notes = input.notes.trim().to_string();
        g.game_path = input.game_path.trim().to_string();
        g.mods_path = input.mods_path.trim().to_string();
        g.mod_type = input.mod_type;
        g.cover_image = cover;
        g.icon = icon;
        g.hero_image = hero;
        g.last_updated = db::now_iso();

        // Narrowing a "both" game forces every mod onto the surviving kind.
        if let Some(kind) = match g.mod_type {
            GameModType::Folder => Some(ModKind::Folder),
            GameModType::File => Some(ModKind::File),
            GameModType::Both => None,
        } {
            for m in &mut g.mods {
                m.kind = kind;
            }
        }
        Ok(())
    })
}

#[tauri::command(rename_all = "snake_case")]
pub fn delete_game(state: State<'_, AppState>, game_id: String) -> Result<Db> {
    mutate(&state, |db| {
        let gi = db::game_index(db, &game_id)?;
        let mods_path = PathBuf::from(&db.games[gi].mods_path);

        // Pull deployed mods back out of the game folder before forgetting them.
        if mods_path.is_dir() {
            for m in &mut db.games[gi].mods {
                if m.status == ModStatus::Active {
                    undeploy(m, &mods_path)?;
                }
            }
        }

        fsops::remove_any(&db::game_dir(db, &game_id))?;
        db.games.remove(gi);
        Ok(())
    })
}

// ---------------------------------------------------------------------------
// Mods — pool membership
// ---------------------------------------------------------------------------

#[tauri::command(rename_all = "snake_case")]
pub fn add_mod(
    state: State<'_, AppState>,
    game_id: String,
    input: ModInput,
    sources: Vec<String>,
) -> Result<Db> {
    mutate(&state, |db| {
        let gi = db::game_index(db, &game_id)?;

        let display_name = input.display_name.trim();
        if display_name.is_empty() {
            return Err(Error::msg("Display name is required."));
        }
        let file_name = input.file_name.trim().to_string();
        db::validate_file_name(&file_name)?;

        if db.games[gi]
            .mods
            .iter()
            .any(|m| m.file_name.eq_ignore_ascii_case(&file_name))
        {
            return Err(Error(format!(
                "This game already has a mod using the file name \"{file_name}\"."
            )));
        }

        let kind = match db.games[gi].mod_type {
            GameModType::Folder => ModKind::Folder,
            GameModType::File => ModKind::File,
            GameModType::Both => input.kind,
        };

        let paths = to_paths(&sources);
        if paths.is_empty() {
            return Err(Error::msg("Select the mod's files or folder first."));
        }
        // Validate before writing anything.
        fsops::plan_sources(&paths, kind, &file_name)?;

        let gdir = db::game_dir(db, &game_id);
        fs::create_dir_all(&gdir).ctx_path("Cannot create pool folder", &gdir)?;
        let dest = gdir.join(&file_name);
        if dest.exists() {
            return Err(Error(format!(
                "\"{file_name}\" already exists in this game's pool."
            )));
        }
        fsops::materialize(&paths, &dest, kind)?;

        let now = db::now_iso();
        db.games[gi].mods.push(Mod {
            id: db::new_id(),
            display_name: display_name.to_string(),
            file_name,
            version: input.version.trim().to_string(),
            notes: input.notes.trim().to_string(),
            tags: normalize_tags(input.tags),
            url: input.url.trim().to_string(),
            kind,
            status: ModStatus::None,
            deployed_files: Vec::new(),
            date_added: now.clone(),
            last_updated: now.clone(),
        });
        db.games[gi].last_updated = now;
        Ok(())
    })
}

#[tauri::command(rename_all = "snake_case")]
pub fn update_mod_meta(
    state: State<'_, AppState>,
    game_id: String,
    mod_id: String,
    input: ModMetaInput,
) -> Result<Db> {
    mutate(&state, |db| {
        let gi = db::game_index(db, &game_id)?;
        let mi = db::mod_index(&db.games[gi], &mod_id)?;

        let display_name = input.display_name.trim();
        if display_name.is_empty() {
            return Err(Error::msg("Display name is required."));
        }
        let new_name = input.file_name.trim().to_string();
        db::validate_file_name(&new_name)?;

        let old_name = db.games[gi].mods[mi].file_name.clone();
        if !new_name.eq_ignore_ascii_case(&old_name)
            && db.games[gi]
                .mods
                .iter()
                .enumerate()
                .any(|(i, m)| i != mi && m.file_name.eq_ignore_ascii_case(&new_name))
        {
            return Err(Error(format!(
                "This game already has a mod using the file name \"{new_name}\"."
            )));
        }

        if new_name != old_name {
            let status = db.games[gi].mods[mi].status;
            let mods_path = PathBuf::from(&db.games[gi].mods_path);
            let gdir = db::game_dir(db, &game_id);
            let base = if status == ModStatus::Disabled {
                gdir.join("disabled")
            } else {
                gdir.clone()
            };

            if status == ModStatus::Active {
                undeploy(&mut db.games[gi].mods[mi], &mods_path)?;
            }

            let from = base.join(&old_name);
            let to = base.join(&new_name);
            if to.exists() {
                return Err(Error(format!(
                    "\"{new_name}\" already exists in this game's pool folder."
                )));
            }
            if from.exists() {
                fsops::move_any(&from, &to)?;
            }
            db.games[gi].mods[mi].file_name = new_name.clone();

            if status == ModStatus::Active {
                let files = deploy(&gdir.join(&new_name), &mods_path, &new_name)?;
                db.games[gi].mods[mi].deployed_files = files;
            }
        }

        let now = db::now_iso();
        let m = &mut db.games[gi].mods[mi];
        m.display_name = display_name.to_string();
        m.version = input.version.trim().to_string();
        m.notes = input.notes.trim().to_string();
        m.tags = normalize_tags(input.tags);
        m.url = input.url.trim().to_string();
        m.last_updated = now.clone();
        db.games[gi].last_updated = now;
        Ok(())
    })
}

#[tauri::command(rename_all = "snake_case")]
pub fn remove_mod_from_pool(
    state: State<'_, AppState>,
    game_id: String,
    mod_id: String,
) -> Result<Db> {
    mutate(&state, |db| {
        let gi = db::game_index(db, &game_id)?;
        let mi = db::mod_index(&db.games[gi], &mod_id)?;

        let mods_path = PathBuf::from(&db.games[gi].mods_path);
        if db.games[gi].mods[mi].status == ModStatus::Active && mods_path.is_dir() {
            undeploy(&mut db.games[gi].mods[mi], &mods_path)?;
        }

        let pool_path = db::mod_pool_path(db, &game_id, &db.games[gi].mods[mi]);
        fsops::remove_any(&pool_path)?;

        db.games[gi].mods.remove(mi);
        db.games[gi].last_updated = db::now_iso();
        Ok(())
    })
}

// ---------------------------------------------------------------------------
// Mods — deployment
// ---------------------------------------------------------------------------

#[tauri::command(rename_all = "snake_case")]
pub fn apply_mod(state: State<'_, AppState>, game_id: String, mod_id: String) -> Result<Db> {
    mutate(&state, |db| {
        let gi = db::game_index(db, &game_id)?;
        let mi = db::mod_index(&db.games[gi], &mod_id)?;

        if db.games[gi].mods[mi].status == ModStatus::Disabled {
            return Err(Error::msg("This mod is disabled — enable it first."));
        }

        let mods_path = db::require_dir(&db.games[gi].mods_path.clone(), "Mods folder")?;
        let file_name = db.games[gi].mods[mi].file_name.clone();
        let src = db::mod_pool_path_active(db, &game_id, &file_name);

        if !src.exists() {
            db.games[gi].mods[mi].status = ModStatus::Broken;
            return Err(Error(format!(
                "Mod files are missing from the pool: {}",
                src.display()
            )));
        }

        // Re-applying replaces the previous deployment rather than layering
        // a new copy on top of stale files.
        undeploy(&mut db.games[gi].mods[mi], &mods_path)?;

        let files = deploy(&src, &mods_path, &file_name)?;
        let now = db::now_iso();
        let m = &mut db.games[gi].mods[mi];
        m.deployed_files = files;
        m.status = ModStatus::Active;
        m.last_updated = now.clone();
        db.games[gi].last_updated = now;
        Ok(())
    })
}

#[tauri::command(rename_all = "snake_case")]
pub fn remove_mod_from_game(
    state: State<'_, AppState>,
    game_id: String,
    mod_id: String,
) -> Result<Db> {
    mutate(&state, |db| {
        let gi = db::game_index(db, &game_id)?;
        let mi = db::mod_index(&db.games[gi], &mod_id)?;

        let mods_path = PathBuf::from(&db.games[gi].mods_path);
        if !mods_path.is_dir() && !db.games[gi].mods[mi].deployed_files.is_empty() {
            return Err(Error(format!(
                "Mods folder not found: {}",
                mods_path.display()
            )));
        }

        undeploy(&mut db.games[gi].mods[mi], &mods_path)?;

        let now = db::now_iso();
        let m = &mut db.games[gi].mods[mi];
        if m.status != ModStatus::Broken {
            m.status = ModStatus::None;
        }
        m.last_updated = now.clone();
        db.games[gi].last_updated = now;
        Ok(())
    })
}

#[tauri::command(rename_all = "snake_case")]
pub fn disable_mod(state: State<'_, AppState>, game_id: String, mod_id: String) -> Result<Db> {
    mutate(&state, |db| {
        let gi = db::game_index(db, &game_id)?;
        let mi = db::mod_index(&db.games[gi], &mod_id)?;

        if db.games[gi].mods[mi].status == ModStatus::Disabled {
            return Ok(());
        }

        let mods_path = PathBuf::from(&db.games[gi].mods_path);
        if db.games[gi].mods[mi].status == ModStatus::Active {
            if !mods_path.is_dir() {
                return Err(Error(format!(
                    "Mods folder not found: {}",
                    mods_path.display()
                )));
            }
            undeploy(&mut db.games[gi].mods[mi], &mods_path)?;
        }

        let file_name = db.games[gi].mods[mi].file_name.clone();
        let from = db::mod_pool_path_active(db, &game_id, &file_name);
        let to = db::disabled_dir(db, &game_id).join(&file_name);

        if from.exists() {
            if to.exists() {
                return Err(Error(format!(
                    "\"{file_name}\" already exists in the disabled folder."
                )));
            }
            fsops::move_any(&from, &to)?;
        } else if !to.exists() {
            db.games[gi].mods[mi].status = ModStatus::Broken;
            return Err(Error(format!(
                "Mod files are missing from the pool: {}",
                from.display()
            )));
        }

        let now = db::now_iso();
        let m = &mut db.games[gi].mods[mi];
        m.status = ModStatus::Disabled;
        m.last_updated = now.clone();
        db.games[gi].last_updated = now;
        Ok(())
    })
}

#[tauri::command(rename_all = "snake_case")]
pub fn enable_mod(state: State<'_, AppState>, game_id: String, mod_id: String) -> Result<Db> {
    mutate(&state, |db| {
        let gi = db::game_index(db, &game_id)?;
        let mi = db::mod_index(&db.games[gi], &mod_id)?;

        if db.games[gi].mods[mi].status != ModStatus::Disabled {
            return Err(Error::msg("This mod is not disabled."));
        }

        let mods_path = db::require_dir(&db.games[gi].mods_path.clone(), "Mods folder")?;
        let file_name = db.games[gi].mods[mi].file_name.clone();
        let from = db::disabled_dir(db, &game_id).join(&file_name);
        let to = db::mod_pool_path_active(db, &game_id, &file_name);

        if !from.exists() {
            db.games[gi].mods[mi].status = ModStatus::Broken;
            return Err(Error(format!(
                "Mod files are missing from the disabled folder: {}",
                from.display()
            )));
        }
        if to.exists() {
            return Err(Error(format!(
                "\"{file_name}\" already exists in this game's pool."
            )));
        }
        fsops::move_any(&from, &to)?;

        let files = deploy(&to, &mods_path, &file_name)?;
        let now = db::now_iso();
        let m = &mut db.games[gi].mods[mi];
        m.deployed_files = files;
        m.status = ModStatus::Active;
        m.last_updated = now.clone();
        db.games[gi].last_updated = now;
        Ok(())
    })
}

// ---------------------------------------------------------------------------
// Mods — update flow
// ---------------------------------------------------------------------------

#[tauri::command(rename_all = "snake_case")]
pub fn preview_mod_update(
    state: State<'_, AppState>,
    game_id: String,
    mod_id: String,
    sources: Vec<String>,
) -> Result<UpdateDiff> {
    let guard = lock(&state)?;
    let db = &*guard;
    let game = db::find_game(db, &game_id)?;
    let mi = db::mod_index(game, &mod_id)?;
    let m = &game.mods[mi];

    let paths = to_paths(&sources);
    if paths.is_empty() {
        return Err(Error::msg("Select the new mod files first."));
    }

    let old = fsops::walk_files(&db::mod_pool_path(db, &game_id, m))?;
    let new = fsops::plan_sources(&paths, m.kind, &m.file_name)?;

    let mut diff = UpdateDiff {
        added: Vec::new(),
        removed: Vec::new(),
        changed: Vec::new(),
        unchanged: Vec::new(),
    };

    for (rel, new_path) in &new {
        match old.get(rel) {
            None => diff.added.push(rel.clone()),
            Some(old_path) => {
                if fsops::files_equal(old_path, new_path)? {
                    diff.unchanged.push(rel.clone());
                } else {
                    diff.changed.push(rel.clone());
                }
            }
        }
    }
    for rel in old.keys() {
        if !new.contains_key(rel) {
            diff.removed.push(rel.clone());
        }
    }

    Ok(diff)
}

#[tauri::command(rename_all = "snake_case")]
pub fn update_mod_files(
    state: State<'_, AppState>,
    game_id: String,
    mod_id: String,
    sources: Vec<String>,
) -> Result<Db> {
    mutate(&state, |db| {
        let gi = db::game_index(db, &game_id)?;
        let mi = db::mod_index(&db.games[gi], &mod_id)?;

        let paths = to_paths(&sources);
        if paths.is_empty() {
            return Err(Error::msg("Select the new mod files first."));
        }

        let status = db.games[gi].mods[mi].status;
        let kind = db.games[gi].mods[mi].kind;
        let file_name = db.games[gi].mods[mi].file_name.clone();
        fsops::plan_sources(&paths, kind, &file_name)?;

        let was_active = status == ModStatus::Active;
        let mods_path = PathBuf::from(&db.games[gi].mods_path);
        if was_active {
            if !mods_path.is_dir() {
                return Err(Error(format!(
                    "Mods folder not found: {}",
                    mods_path.display()
                )));
            }
            undeploy(&mut db.games[gi].mods[mi], &mods_path)?;
        }

        let gdir = db::game_dir(db, &game_id);
        let dest = if status == ModStatus::Disabled {
            gdir.join("disabled").join(&file_name)
        } else {
            gdir.join(&file_name)
        };
        if let Some(parent) = dest.parent() {
            fs::create_dir_all(parent).ctx_path("Cannot create pool folder", parent)?;
        }
        fsops::materialize(&paths, &dest, kind)?;

        let now = db::now_iso();
        if was_active {
            let files = deploy(&dest, &mods_path, &file_name)?;
            let m = &mut db.games[gi].mods[mi];
            m.deployed_files = files;
            m.status = ModStatus::Active;
        } else if status == ModStatus::Broken {
            // The Update flow is how a broken mod gets repaired.
            let m = &mut db.games[gi].mods[mi];
            m.status = ModStatus::None;
            m.deployed_files.clear();
        }

        db.games[gi].mods[mi].last_updated = now.clone();
        db.games[gi].last_updated = now;
        Ok(())
    })
}

#[tauri::command(rename_all = "snake_case")]
pub fn mark_mod_broken(state: State<'_, AppState>, game_id: String, mod_id: String) -> Result<Db> {
    mutate(&state, |db| {
        let gi = db::game_index(db, &game_id)?;
        let mi = db::mod_index(&db.games[gi], &mod_id)?;
        db.games[gi].mods[mi].status = ModStatus::Broken;
        db.games[gi].mods[mi].last_updated = db::now_iso();
        Ok(())
    })
}

// ---------------------------------------------------------------------------
// Misc
// ---------------------------------------------------------------------------

/// Game art is served as a data URL so the pool can live anywhere on disk
/// without widening the asset-protocol scope.
#[tauri::command(rename_all = "snake_case")]
pub fn read_asset(state: State<'_, AppState>, game_id: String, file_name: String) -> Result<String> {
    if file_name.trim().is_empty() {
        return Err(Error::msg("No image set."));
    }
    if file_name.contains('/') || file_name.contains('\\') {
        return Err(Error::msg("Invalid image name."));
    }

    let guard = lock(&state)?;
    let path = db::assets_dir(&guard, &game_id).join(&file_name);
    drop(guard);

    if !path.is_file() {
        return Err(Error(format!("Image not found: {}", path.display())));
    }
    let bytes = fs::read(&path).ctx_path("Cannot read image", &path)?;
    let ext = path
        .extension()
        .map(|e| e.to_string_lossy().to_lowercase())
        .unwrap_or_default();
    Ok(format!("data:{};base64,{}", mime_for(&ext), B64.encode(bytes)))
}

/// Preview an image the user just picked, before it has been copied into the
/// pool. Same data-URL trick as [`read_asset`], for an arbitrary path.
#[tauri::command(rename_all = "snake_case")]
pub fn read_image_preview(path: String) -> Result<String> {
    let p = PathBuf::from(path.trim());
    if !p.is_file() {
        return Err(Error(format!("Image not found: {}", p.display())));
    }
    let ext = image_ext(&p)?;
    let meta = fs::metadata(&p).ctx_path("Cannot inspect", &p)?;
    if meta.len() > 24 * 1024 * 1024 {
        return Err(Error::msg("That image is too large to preview (max 24 MB)."));
    }
    let bytes = fs::read(&p).ctx_path("Cannot read image", &p)?;
    Ok(format!("data:{};base64,{}", mime_for(&ext), B64.encode(bytes)))
}

/// Number of files and total bytes a mod occupies in the pool — shown in the
/// edit drawer so the user can sanity-check what is actually stored.
#[tauri::command(rename_all = "snake_case")]
pub fn mod_pool_stats(
    state: State<'_, AppState>,
    game_id: String,
    mod_id: String,
) -> Result<(usize, u64)> {
    let guard = lock(&state)?;
    let game = db::find_game(&guard, &game_id)?;
    let mi = db::mod_index(game, &mod_id)?;
    let path = db::mod_pool_path(&guard, &game_id, &game.mods[mi]);

    let files = fsops::walk_files(&path)?;
    let mut total = 0u64;
    for p in files.values() {
        if let Ok(meta) = fs::metadata(p) {
            total += meta.len();
        }
    }
    Ok((files.len(), total))
}

fn normalize_tags(tags: Vec<String>) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    for t in tags {
        let t = t.trim().to_string();
        if t.is_empty() {
            continue;
        }
        if !out.iter().any(|e| e.eq_ignore_ascii_case(&t)) {
            out.push(t);
        }
    }
    out
}
