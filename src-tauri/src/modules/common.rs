use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager};

pub const NODE_VERSION: &str = "22.16.0";
pub const DEFAULT_GATEWAY_PORT: u16 = 18_789;

pub fn app_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("failed to resolve app_data_dir: {e}"))?;
    std::fs::create_dir_all(&dir).map_err(|e| format!("failed to create app_data_dir: {e}"))?;
    Ok(dir)
}

pub fn node_root_dir(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join("node")
}

pub fn node_bin_dir(app_data_dir: &Path) -> PathBuf {
    if cfg!(target_os = "windows") {
        node_root_dir(app_data_dir)
    } else {
        node_root_dir(app_data_dir).join("bin")
    }
}

pub fn node_binary_path(app_data_dir: &Path) -> PathBuf {
    if cfg!(target_os = "windows") {
        node_root_dir(app_data_dir).join("node.exe")
    } else {
        node_bin_dir(app_data_dir).join("node")
    }
}

pub fn npm_binary_path(app_data_dir: &Path) -> PathBuf {
    if cfg!(target_os = "windows") {
        node_root_dir(app_data_dir).join("npm.cmd")
    } else {
        node_bin_dir(app_data_dir).join("npm")
    }
}

pub fn openclaw_global_dir(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join("openclaw_global")
}

pub fn openclaw_binary_path(app_data_dir: &Path) -> PathBuf {
    if cfg!(target_os = "windows") {
        openclaw_global_dir(app_data_dir).join("openclaw.cmd")
    } else {
        openclaw_global_dir(app_data_dir).join("bin").join("openclaw")
    }
}

pub fn keys_file_path(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join("keys.json")
}

pub fn openclaw_config_path() -> Result<PathBuf, String> {
    let home = if cfg!(target_os = "windows") {
        std::env::var("USERPROFILE").ok()
    } else {
        std::env::var("HOME").ok()
    }
    .ok_or_else(|| "failed to resolve home directory from environment".to_string())?;

    Ok(PathBuf::from(home).join(".openclaw").join("openclaw.json"))
}

pub fn normalize_version(value: &str) -> String {
    value.trim().trim_start_matches('v').to_string()
}

pub fn prepend_path_env(base_env: &HashMap<String, String>, node_path_prefix: &Path) -> String {
    let mut path_parts = vec![node_path_prefix.to_string_lossy().to_string()];

    if let Some(existing_path) = base_env.get("PATH") {
        if !existing_path.trim().is_empty() {
            path_parts.push(existing_path.clone());
        }
    } else if let Some(existing_path) = std::env::var_os("PATH") {
        let existing_path = existing_path.to_string_lossy().to_string();
        if !existing_path.trim().is_empty() {
            path_parts.push(existing_path);
        }
    }

    path_parts.join(if cfg!(target_os = "windows") { ";" } else { ":" })
}

pub fn iso_utc_now() -> String {
    #[cfg(target_os = "windows")]
    {
        let output = Command::new("powershell")
            .args(["-NoProfile", "-Command", "Get-Date -AsUTC -Format o"])
            .output();
        if let Ok(output) = output {
            if output.status.success() {
                if let Ok(value) = String::from_utf8(output.stdout) {
                    let trimmed = value.trim();
                    if !trimmed.is_empty() {
                        return trimmed.to_string();
                    }
                }
            }
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        let output = Command::new("date")
            .args(["-u", "+%Y-%m-%dT%H:%M:%SZ"])
            .output();
        if let Ok(output) = output {
            if output.status.success() {
                if let Ok(value) = String::from_utf8(output.stdout) {
                    let trimmed = value.trim();
                    if !trimmed.is_empty() {
                        return trimmed.to_string();
                    }
                }
            }
        }
    }

    let unix_secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or(0);
    format!("{unix_secs}")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalize_version_trims_v_prefix() {
        assert_eq!(normalize_version("v22.16.0\n"), "22.16.0");
    }
}
