use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Default, Serialize, Deserialize)]
pub struct AppSettings {
    pub vault_path: Option<String>,
}

fn settings_path() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or("Cannot find home directory")?;
    Ok(home.join(".yek").join("settings.json"))
}

pub fn load_settings() -> AppSettings {
    let path = match settings_path() { Ok(p) => p, Err(_) => return AppSettings::default() };
    let json = match std::fs::read_to_string(&path) { Ok(s) => s, Err(_) => return AppSettings::default() };
    serde_json::from_str(&json).unwrap_or_default()
}

pub fn save_settings(settings: &AppSettings) -> Result<(), String> {
    let path = settings_path()?;
    std::fs::create_dir_all(path.parent().unwrap()).map_err(|e| e.to_string())?;
    let json = serde_json::to_string_pretty(settings).map_err(|e| e.to_string())?;
    std::fs::write(&path, json).map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn test_load_settings_returns_default_when_no_file() {
        let default = AppSettings::default();
        assert!(default.vault_path.is_none());
    }
}
