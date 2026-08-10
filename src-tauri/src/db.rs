use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use crate::error::{Ctx, Error, Result};
use crate::models::*;

pub struct AppState {
    /// `~/.local/share/zmods` (or the platform equivalent).
    pub root: PathBuf,
    pub db: Mutex<Db>,
}

pub fn data_root() -> Result<PathBuf> {
    let base = dirs::data_dir()
        .ok_or_else(|| Error::msg("Could not resolve the system data directory."))?;
    Ok(base.join("zmods"))
}

pub fn default_settings(root: &Path) -> AppSettings {
    AppSettings {
        pool_path: root.join("pool").to_string_lossy().to_string(),
        theme: Theme::Dark,
        accent_color: "#7c5cff".into(),
        font: "Inter".into(),
    }
}

pub fn now_iso() -> String {
    chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Secs, true)
}

pub fn new_id() -> String {
    uuid::Uuid::new_v4().to_string()
}

/// Read `db.json`, creating a fresh one when it is missing.
pub fn load(root: &Path) -> Result<Db> {
    fs::create_dir_all(root).ctx_path("Cannot create app data folder", root)?;
    let file = root.join("db.json");

    if !file.exists() {
        let db = Db {
            games: Vec::new(),
            settings: default_settings(root),
        };
        save(root, &db)?;
        return Ok(db);
    }

    let raw = fs::read_to_string(&file).ctx_path("Cannot read db.json", &file)?;
    if raw.trim().is_empty() {
        let db = Db {
            games: Vec::new(),
            settings: default_settings(root),
        };
        save(root, &db)?;
        return Ok(db);
    }

    let db: Db = serde_json::from_str(&raw)?;
    fs::create_dir_all(&db.settings.pool_path)
        .ctx_path("Cannot create pool folder", Path::new(&db.settings.pool_path))?;
    Ok(db)
}

/// Write atomically — a half-written `db.json` would lose the whole library.
pub fn save(root: &Path, db: &Db) -> Result<()> {
    fs::create_dir_all(root).ctx_path("Cannot create app data folder", root)?;
    let file = root.join("db.json");
    let tmp = root.join("db.json.tmp");
    let json = serde_json::to_string_pretty(db)
        .map_err(|e| Error(format!("Cannot serialise db.json: {e}")))?;
    fs::write(&tmp, json).ctx_path("Cannot write db.json", &tmp)?;
    fs::rename(&tmp, &file).ctx_pair("Cannot replace db.json", &tmp, &file)?;
    Ok(())
}

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

pub fn pool_root(db: &Db) -> PathBuf {
    PathBuf::from(&db.settings.pool_path)
}

pub fn game_dir(db: &Db, game_id: &str) -> PathBuf {
    pool_root(db).join(game_id)
}

pub fn assets_dir(db: &Db, game_id: &str) -> PathBuf {
    game_dir(db, game_id).join("assets")
}

pub fn disabled_dir(db: &Db, game_id: &str) -> PathBuf {
    game_dir(db, game_id).join("disabled")
}

/// Where a mod's files live right now, which depends on whether it is disabled.
pub fn mod_pool_path(db: &Db, game_id: &str, m: &Mod) -> PathBuf {
    if m.status == ModStatus::Disabled {
        disabled_dir(db, game_id).join(&m.file_name)
    } else {
        game_dir(db, game_id).join(&m.file_name)
    }
}

pub fn mod_pool_path_active(db: &Db, game_id: &str, file_name: &str) -> PathBuf {
    game_dir(db, game_id).join(file_name)
}

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

pub fn find_game<'a>(db: &'a Db, game_id: &str) -> Result<&'a Game> {
    db.games
        .iter()
        .find(|g| g.id == game_id)
        .ok_or_else(|| Error::msg("That game is no longer in the library."))
}

pub fn game_index(db: &Db, game_id: &str) -> Result<usize> {
    db.games
        .iter()
        .position(|g| g.id == game_id)
        .ok_or_else(|| Error::msg("That game is no longer in the library."))
}

pub fn mod_index(game: &Game, mod_id: &str) -> Result<usize> {
    game.mods
        .iter()
        .position(|m| m.id == mod_id)
        .ok_or_else(|| Error::msg("That mod is no longer in the pool."))
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/// `file_name` becomes a real path segment in both the pool and the game
/// folder, so it must not escape either of them.
pub fn validate_file_name(name: &str) -> Result<()> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err(Error::msg("File name is required."));
    }
    if trimmed.contains('/') || trimmed.contains('\\') {
        return Err(Error::msg("File name cannot contain slashes."));
    }
    if trimmed == "." || trimmed == ".." {
        return Err(Error::msg("That file name is not allowed."));
    }
    if trimmed.eq_ignore_ascii_case("disabled") || trimmed.eq_ignore_ascii_case("assets") {
        return Err(Error(format!(
            "\"{trimmed}\" is reserved by ZMods — pick another file name."
        )));
    }
    Ok(())
}

pub fn require_dir(path: &str, label: &str) -> Result<PathBuf> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err(Error(format!("{label} is required.")));
    }
    let p = PathBuf::from(trimmed);
    if !p.is_dir() {
        return Err(Error(format!("{label} not found: {trimmed}")));
    }
    Ok(p)
}

// ---------------------------------------------------------------------------
// Integrity scan
// ---------------------------------------------------------------------------

/// Reconciles recorded state with what is actually on disk. Runs on every load
/// so the table never claims a mod is applied when its files are gone.
pub fn reconcile(db: &mut Db) {
    let pool = pool_root(db);
    for gi in 0..db.games.len() {
        let game_id = db.games[gi].id.clone();
        let mods_path = PathBuf::from(&db.games[gi].mods_path);
        let mods_path_exists = mods_path.is_dir();
        let gdir = pool.join(&game_id);

        for m in &mut db.games[gi].mods {
            let pool_path = if m.status == ModStatus::Disabled {
                gdir.join("disabled").join(&m.file_name)
            } else {
                gdir.join(&m.file_name)
            };

            if !pool_path.exists() {
                // Files vanished from the pool — the Update flow is the fix.
                m.status = ModStatus::Broken;
                continue;
            }

            match m.status {
                ModStatus::Broken => {
                    // Pool files are back; recover from whatever is deployed.
                    let deployed_ok = !m.deployed_files.is_empty()
                        && m.deployed_files.iter().all(|p| Path::new(p).exists());
                    if deployed_ok {
                        m.status = ModStatus::Active;
                    } else {
                        m.status = ModStatus::None;
                        m.deployed_files.clear();
                    }
                }
                ModStatus::Active => {
                    // Only downgrade when we can actually see the game folder;
                    // an unmounted drive must not rewrite the library.
                    if mods_path_exists
                        && (m.deployed_files.is_empty()
                            || !m.deployed_files.iter().any(|p| Path::new(p).exists()))
                    {
                        m.status = ModStatus::None;
                        m.deployed_files.clear();
                    }
                }
                ModStatus::None | ModStatus::Disabled => {}
            }
        }
    }
}
