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
use tauri::Manager;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
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
            commands::update_entry,
            commands::move_to_trash,
            commands::restore_from_trash,
            commands::delete_from_trash,
            commands::empty_trash,
            commands::get_trash,
        ])
        // Hide window instead of quitting when the X button is clicked
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                window.hide().unwrap();
                api.prevent_close();
            }
        })
        .setup(|app| {
            // System tray menu
            let show = MenuItem::with_id(app, "show", "Show Yek", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &quit])?;

            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .tooltip("Yek — Password Manager")
                .menu_on_left_click(false)
                .on_tray_icon_event(|tray, event| {
                    // Left-click on tray icon → show window
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .build(app)?;

            // Global hotkey: Ctrl+Shift+Y / Cmd+Shift+Y → bring to front
            let handle = app.handle().clone();
            app.global_shortcut().on_shortcut("CommandOrControl+Shift+Y", move |_app, _shortcut, event| {
                if event.state == ShortcutState::Pressed {
                    if let Some(window) = handle.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                        let _ = window.unminimize();
                    }
                }
            })?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
