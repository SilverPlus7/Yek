use std::path::Path;
use std::time::SystemTime;

pub fn vault_modified_at(path: &Path) -> Option<SystemTime> {
    std::fs::metadata(path).ok()?.modified().ok()
}

pub fn vault_changed_since(path: &Path, since: SystemTime) -> bool {
    vault_modified_at(path).map(|t| t > since).unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::thread::sleep;
    use std::time::Duration;
    use tempfile::tempdir;

    #[test]
    fn test_vault_changed_since_detects_new_file() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("vault.yek");
        let before = SystemTime::now();
        sleep(Duration::from_millis(10));
        std::fs::write(&path, b"data").unwrap();
        assert!(vault_changed_since(&path, before));
    }

    #[test]
    fn test_vault_not_changed_when_same_time() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("vault.yek");
        std::fs::write(&path, b"data").unwrap();
        let after = SystemTime::now();
        assert!(!vault_changed_since(&path, after));
    }
}
