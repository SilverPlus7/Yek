pub mod backup;
pub mod commands;
pub mod crypto;
pub mod entries;
pub mod settings;
pub mod sync;
pub mod vault;

use commands::AppState;
use std::sync::Mutex;
use vault::VaultState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(AppState(Mutex::new(VaultState::new())))
        .invoke_handler(tauri::generate_handler![
            commands::create_vault,
            commands::unlock_vault,
            commands::lock_vault,
            commands::get_entries,
            commands::get_vault_info,
            commands::get_saved_vault_path,
            commands::create_entry,
            commands::delete_entry,
            commands::get_entry,
            commands::get_folders,
            commands::create_folder,
            commands::check_vault_changed,
            commands::reload_vault,
            commands::list_backups,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
