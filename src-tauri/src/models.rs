use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Theme {
    Light,
    Dark,
    System,
}

/// What a game accepts. `Both` means each mod carries its own [`ModKind`].
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum GameModType {
    Folder,
    File,
    Both,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ModKind {
    Folder,
    File,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ModStatus {
    /// Present in the pool and deployed to the game folder.
    Active,
    /// Present in the pool, not deployed.
    None,
    /// Parked in `pool/{game_id}/disabled/`.
    Disabled,
    /// Pool files are missing — fix via the Update flow.
    Broken,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub pool_path: String,
    pub theme: Theme,
    pub accent_color: String,
    pub font: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Mod {
    pub id: String,
    pub display_name: String,
    pub file_name: String,
    #[serde(default)]
    pub version: String,
    #[serde(default)]
    pub notes: String,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub url: String,
    #[serde(rename = "type")]
    pub kind: ModKind,
    pub status: ModStatus,
    #[serde(default)]
    pub deployed_files: Vec<String>,
    pub date_added: String,
    pub last_updated: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Game {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub notes: String,
    #[serde(default)]
    pub cover_image: String,
    #[serde(default)]
    pub icon: String,
    #[serde(default)]
    pub hero_image: String,
    pub game_path: String,
    pub mods_path: String,
    pub mod_type: GameModType,
    pub date_added: String,
    pub last_updated: String,
    #[serde(default)]
    pub mods: Vec<Mod>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Db {
    #[serde(default)]
    pub games: Vec<Game>,
    pub settings: AppSettings,
}

// ---------------------------------------------------------------------------
// Command payloads
// ---------------------------------------------------------------------------

/// `source` copies a new image in; `clear` drops the current one.
/// Both unset means "leave whatever is already there".
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(default)]
pub struct ImageInput {
    pub source: Option<String>,
    pub clear: bool,
}

#[derive(Debug, Clone, Deserialize)]
pub struct GameInput {
    pub name: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub notes: String,
    pub game_path: String,
    pub mods_path: String,
    pub mod_type: GameModType,
    #[serde(default)]
    pub cover_image: ImageInput,
    #[serde(default)]
    pub icon: ImageInput,
    #[serde(default)]
    pub hero_image: ImageInput,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ModInput {
    pub display_name: String,
    pub file_name: String,
    #[serde(default)]
    pub version: String,
    #[serde(default)]
    pub notes: String,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub url: String,
    #[serde(rename = "type")]
    pub kind: ModKind,
}

/// Edit-drawer payload: metadata only, never touches files on disk except for
/// a rename of the pool entry when `file_name` changes.
#[derive(Debug, Clone, Deserialize)]
pub struct ModMetaInput {
    pub display_name: String,
    pub file_name: String,
    #[serde(default)]
    pub version: String,
    #[serde(default)]
    pub notes: String,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub url: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct UpdateDiff {
    pub added: Vec<String>,
    pub removed: Vec<String>,
    pub changed: Vec<String>,
    pub unchanged: Vec<String>,
}
