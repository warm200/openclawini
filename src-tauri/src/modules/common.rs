use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager};

pub const MIN_NODE_MAJOR: u64 = 22;
pub const NODE_FALLBACK_VERSION: &str = "22.16.0";
pub const DEFAULT_GATEWAY_PORT: u16 = 18_789;

pub fn app_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = get_install_path_override(app)?.unwrap_or(default_app_data_dir(app)?);
    validate_writable_dir(&dir)?;
    Ok(dir)
}

pub fn default_app_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map_err(|e| format!("failed to resolve default app_data_dir: {e}"))
}

pub fn get_install_path_override(app: &AppHandle) -> Result<Option<PathBuf>, String> {
    let settings = read_settings(app)?;
    Ok(settings
        .install_path
        .filter(|value| !value.trim().is_empty())
        .map(PathBuf::from))
}

pub fn set_install_path_override(app: &AppHandle, path: String) -> Result<PathBuf, String> {
    let normalized = normalize_user_path(path)?;
    validate_writable_dir(&normalized)?;

    let mut settings = read_settings(app)?;
    settings.install_path = Some(normalized.to_string_lossy().to_string());
    write_settings(app, &settings)?;

    Ok(normalized)
}

pub fn reset_install_path_override(app: &AppHandle) -> Result<PathBuf, String> {
    let mut settings = read_settings(app)?;
    settings.install_path = None;
    write_settings(app, &settings)?;

    let default_dir = default_app_data_dir(app)?;
    validate_writable_dir(&default_dir)?;
    Ok(default_dir)
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
        openclaw_global_dir(app_data_dir)
            .join("bin")
            .join("openclaw")
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

    path_parts.join(if cfg!(target_os = "windows") {
        ";"
    } else {
        ":"
    })
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

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
struct Settings {
    install_path: Option<String>,
}

fn settings_file_path(app: &AppHandle) -> Result<PathBuf, String> {
    let config_dir = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("failed to resolve app_config_dir: {e}"))?;
    std::fs::create_dir_all(&config_dir).map_err(|e| {
        format!(
            "failed to create app_config_dir {}: {e}",
            config_dir.display()
        )
    })?;
    Ok(config_dir.join("settings.json"))
}

fn read_settings(app: &AppHandle) -> Result<Settings, String> {
    let file_path = settings_file_path(app)?;
    if !file_path.exists() {
        return Ok(Settings::default());
    }

    let raw = std::fs::read_to_string(&file_path)
        .map_err(|e| format!("failed to read settings {}: {e}", file_path.display()))?;
    serde_json::from_str::<Settings>(&raw)
        .map_err(|e| format!("failed to parse settings {}: {e}", file_path.display()))
}

fn write_settings(app: &AppHandle, settings: &Settings) -> Result<(), String> {
    let file_path = settings_file_path(app)?;
    let serialized = serde_json::to_string_pretty(settings)
        .map_err(|e| format!("failed to serialize settings: {e}"))?;
    std::fs::write(&file_path, serialized)
        .map_err(|e| format!("failed to write settings {}: {e}", file_path.display()))
}

fn normalize_user_path(path: String) -> Result<PathBuf, String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("installation path cannot be empty".to_string());
    }

    let candidate = PathBuf::from(trimmed);
    if candidate.is_absolute() {
        return Ok(candidate);
    }

    let cwd = std::env::current_dir().map_err(|e| format!("failed to resolve current dir: {e}"))?;
    Ok(cwd.join(candidate))
}

fn validate_writable_dir(path: &Path) -> Result<(), String> {
    std::fs::create_dir_all(path)
        .map_err(|e| format!("failed to create directory {}: {e}", path.display()))?;

    let marker = path.join(".openclawini-write-test");
    std::fs::write(&marker, b"openclawini")
        .map_err(|e| format!("directory is not writable {}: {e}", path.display()))?;
    std::fs::remove_file(&marker).map_err(|e| {
        format!(
            "failed to cleanup write test file {}: {e}",
            marker.display()
        )
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalize_version_trims_v_prefix() {
        assert_eq!(normalize_version("v22.16.0\n"), "22.16.0");
    }

    #[test]
    fn normalize_user_path_rejects_empty_input() {
        assert!(normalize_user_path(" ".to_string()).is_err());
    }
}
