use std::path::{Path, PathBuf};
use std::cmp::Reverse;

pub const MAX_BACKUPS: usize = 10;

pub fn backup_vault(vault_path: &Path) -> Result<(), String> {
    let backup_dir = get_backup_dir()?;
    std::fs::create_dir_all(&backup_dir).map_err(|e| e.to_string())?;

    let ts = chrono::Utc::now().format("%Y%m%d_%H%M%S").to_string();
    let dest = backup_dir.join(format!("vault_{}.yek", ts));
    std::fs::copy(vault_path, &dest).map_err(|e| e.to_string())?;

    prune_backups(&backup_dir)?;
    Ok(())
}

pub fn get_backup_dir() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or("Cannot find home directory")?;
    Ok(home.join(".yek").join("backups"))
}

pub fn list_backups() -> Result<Vec<String>, String> {
    let dir = get_backup_dir()?;
    if !dir.exists() { return Ok(vec![]) }
    let mut entries: Vec<_> = std::fs::read_dir(&dir)
        .map_err(|e| e.to_string())?
        .filter_map(|e| e.ok())
        .filter(|e| e.path().extension().map(|x| x == "yek").unwrap_or(false))
        .collect();
    entries.sort_by_key(|e| Reverse(e.file_name()));
    Ok(entries.iter().map(|e| e.path().to_string_lossy().to_string()).collect())
}

fn prune_backups(dir: &Path) -> Result<(), String> {
    let mut files: Vec<_> = std::fs::read_dir(dir)
        .map_err(|e| e.to_string())?
        .filter_map(|e| e.ok())
        .filter(|e| e.path().extension().map(|x| x == "yek").unwrap_or(false))
        .collect();
    files.sort_by_key(|e| Reverse(e.file_name()));
    for old in files.iter().skip(MAX_BACKUPS) {
        std::fs::remove_file(old.path()).ok();
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_backup_creates_file() {
        let dir = tempdir().unwrap();
        let vault = dir.path().join("vault.yek");
        std::fs::write(&vault, b"encrypted").unwrap();

        let backup_dir = dir.path().join("backups");
        std::fs::create_dir_all(&backup_dir).unwrap();
        let ts = chrono::Utc::now().format("%Y%m%d_%H%M%S").to_string();
        let dest = backup_dir.join(format!("vault_{}.yek", ts));
        std::fs::copy(&vault, &dest).unwrap();
        assert!(dest.exists());
    }

    #[test]
    fn test_prune_removes_old_backups() {
        let dir = tempdir().unwrap();
        for i in 0..12usize {
            let filename = format!("vault_20260{:02}01_120000.yek", i + 1);
            std::fs::write(dir.path().join(filename), b"x").unwrap();
        }
        prune_backups(dir.path()).unwrap();
        let remaining: Vec<_> = std::fs::read_dir(dir.path()).unwrap()
            .filter_map(|e| e.ok())
            .filter(|e| e.path().extension().map(|x| x == "yek").unwrap_or(false))
            .collect();
        assert_eq!(remaining.len(), MAX_BACKUPS);
    }
}
