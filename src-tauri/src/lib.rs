mod commands;
mod db;
mod error;
mod fsops;
mod models;

use std::sync::Mutex;

use db::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let root = db::data_root().expect("could not resolve the system data directory");
    let mut initial = db::load(&root).expect("could not open db.json");
    db::reconcile(&mut initial);

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(AppState {
            root,
            db: Mutex::new(initial),
        })
        .invoke_handler(tauri::generate_handler![
            commands::load_db,
            commands::save_settings,
            commands::set_pool_path,
            commands::add_game,
            commands::update_game,
            commands::delete_game,
            commands::add_mod,
            commands::update_mod_meta,
            commands::remove_mod_from_pool,
            commands::apply_mod,
            commands::remove_mod_from_game,
            commands::disable_mod,
            commands::enable_mod,
            commands::preview_mod_update,
            commands::update_mod_files,
            commands::mark_mod_broken,
            commands::read_asset,
            commands::read_image_preview,
            commands::mod_pool_stats,
        ])
        .run(tauri::generate_context!())
        .expect("error while running ZMods");
}
