use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::{Mutex, OnceLock};
use std::thread;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};

use crate::modules::{common, node_runtime};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenClawStatus {
    pub installed: bool,
    pub version: Option<String>,
    pub binary_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateInfo {
    pub installed_version: String,
    pub latest_version: String,
    pub update_available: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstallProgress {
    pub stage: String,
    pub percent: Option<f64>,
    pub detail: String,
}

const STATUS_CACHE_TTL: Duration = Duration::from_secs(30);

#[derive(Debug, Clone)]
struct OpenClawStatusCache {
    status: OpenClawStatus,
    app_data_dir: PathBuf,
    checked_at: Instant,
}

#[tauri::command]
pub fn get_openclaw_status(app: AppHandle) -> Result<OpenClawStatus, String> {
    let app_data_dir = common::app_data_dir(&app)?;
    if let Some(cached) = read_cached_status(&app_data_dir) {
        return Ok(cached);
    }
    let status = openclaw_status_from_dir(&app_data_dir);
    write_cached_status(&app_data_dir, &status);
    Ok(status)
}

#[tauri::command]
pub fn install_openclaw(app: AppHandle) -> Result<OpenClawStatus, String> {
    install_or_update_openclaw(app)
}

#[tauri::command]
pub fn update_openclaw(app: AppHandle) -> Result<OpenClawStatus, String> {
    install_or_update_openclaw(app)
}

#[tauri::command]
pub fn check_openclaw_update(app: AppHandle) -> Result<UpdateInfo, String> {
    let installed = get_openclaw_status(app.clone())?;
    let latest_version = query_latest_version(&app)?;
    let installed_version = installed.version.clone().unwrap_or_default();

    let update_available = if installed_version.is_empty() {
        false
    } else {
        version_is_newer(&installed_version, &latest_version)
    };

    Ok(UpdateInfo {
        installed_version,
        latest_version,
        update_available,
    })
}

fn install_or_update_openclaw(app: AppHandle) -> Result<OpenClawStatus, String> {
    let lock = install_lock();
    {
        let mut running = lock
            .lock()
            .map_err(|_| "openclaw install lock poisoned".to_string())?;
        if *running {
            return Err("OpenClaw install is already in progress".to_string());
        }
        *running = true;
    }

    let result = install_or_update_openclaw_inner(app);

    if let Ok(mut running) = lock.lock() {
        *running = false;
    }

    result
}

fn install_or_update_openclaw_inner(app: AppHandle) -> Result<OpenClawStatus, String> {
    clear_cached_status();

    let node_status = node_runtime::get_node_status(app.clone())?;
    if !node_status.installed {
        return Err("node runtime is not installed; run install_node first".to_string());
    }

    let npm_path = node_status
        .npm_path
        .ok_or_else(|| "npm path missing from node status".to_string())?;
    let app_data_dir = common::app_data_dir(&app)?;
    let prefix_dir = common::openclaw_global_dir(&app_data_dir);
    std::fs::create_dir_all(&prefix_dir)
        .map_err(|e| format!("failed to create OpenClaw prefix dir: {e}"))?;

    emit_install_progress(
        &app,
        InstallProgress {
            stage: "installing".to_string(),
            percent: None,
            detail: "Running npm install -g openclaw@latest".to_string(),
        },
    )?;

    let env = node_runtime::get_node_env(app.clone())?;
    let mut command = Command::new(&npm_path);
    command
        .arg("install")
        .arg("-g")
        .arg("openclaw@latest")
        .arg("--prefix")
        .arg(prefix_dir)
        .envs(env)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let mut child = command
        .spawn()
        .map_err(|e| format!("failed to start npm install: {e}"))?;

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "failed to capture npm stdout".to_string())?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "failed to capture npm stderr".to_string())?;

    let app_stdout = app.clone();
    let out_handle = thread::spawn(move || {
        let reader = BufReader::new(stdout);
        for line in reader.lines().map_while(Result::ok) {
            let _ = emit_install_progress(
                &app_stdout,
                InstallProgress {
                    stage: "installing".to_string(),
                    percent: None,
                    detail: line,
                },
            );
        }
    });

    let app_stderr = app.clone();
    let err_handle = thread::spawn(move || {
        let reader = BufReader::new(stderr);
        for line in reader.lines().map_while(Result::ok) {
            let _ = emit_install_progress(
                &app_stderr,
                InstallProgress {
                    stage: "installing".to_string(),
                    percent: None,
                    detail: line,
                },
            );
        }
    });

    let status = child
        .wait()
        .map_err(|e| format!("npm process wait failed: {e}"))?;
    let _ = out_handle.join();
    let _ = err_handle.join();

    if !status.success() {
        return Err(format!("npm install failed with status {status}"));
    }

    let openclaw_status = openclaw_status_from_dir(&app_data_dir);
    write_cached_status(&app_data_dir, &openclaw_status);
    if !openclaw_status.installed {
        return Err("OpenClaw install completed but binary verification failed".to_string());
    }

    Ok(openclaw_status)
}

fn install_lock() -> &'static Mutex<bool> {
    static LOCK: OnceLock<Mutex<bool>> = OnceLock::new();
    LOCK.get_or_init(|| Mutex::new(false))
}

fn query_latest_version(app: &AppHandle) -> Result<String, String> {
    let node_status = node_runtime::get_node_status(app.clone())?;
    if !node_status.installed {
        return Err("node runtime is not installed".to_string());
    }

    let npm_path = node_status
        .npm_path
        .ok_or_else(|| "npm path missing from node status".to_string())?;
    let env = node_runtime::get_node_env(app.clone())?;

    let output = Command::new(npm_path)
        .arg("view")
        .arg("openclaw")
        .arg("version")
        .envs(env)
        .output()
        .map_err(|e| format!("failed to query npm version: {e}"))?;

    if !output.status.success() {
        return Err(format!(
            "npm view openclaw version failed with status {}",
            output.status
        ));
    }

    let version = String::from_utf8(output.stdout)
        .map_err(|e| format!("npm output was not valid utf8: {e}"))?
        .trim()
        .to_string();

    if version.is_empty() {
        return Err("npm did not return a version string".to_string());
    }

    Ok(version)
}

fn emit_install_progress(app: &AppHandle, payload: InstallProgress) -> Result<(), String> {
    app.emit("openclaw:install-progress", payload)
        .map_err(|e| format!("failed to emit openclaw install progress: {e}"))
}

fn openclaw_status_from_dir(app_data_dir: &Path) -> OpenClawStatus {
    let bundled = bundled_openclaw_status(app_data_dir);
    if bundled.installed {
        return bundled;
    }

    let system = system_openclaw_status();
    if system.installed {
        return system;
    }

    bundled
}

fn bundled_openclaw_status(app_data_dir: &Path) -> OpenClawStatus {
    for binary_path in bundled_openclaw_candidates(app_data_dir) {
        if !binary_path.exists() {
            continue;
        }

        let binary = binary_path.to_string_lossy().to_string();
        let version = read_openclaw_version(&binary);
        if version.is_none() {
            continue;
        }

        return OpenClawStatus {
            installed: true,
            version,
            binary_path: Some(binary),
        };
    }

    OpenClawStatus {
        installed: false,
        version: None,
        binary_path: None,
    }
}

fn bundled_openclaw_candidates(app_data_dir: &Path) -> Vec<PathBuf> {
    let prefix_dir = common::openclaw_global_dir(app_data_dir);
    let mut candidates = Vec::new();

    if cfg!(target_os = "windows") {
        candidates.push(prefix_dir.join("openclaw.cmd"));
        candidates.push(prefix_dir.join("openclaw.exe"));
        candidates.push(prefix_dir.join("bin").join("openclaw.cmd"));
        candidates.push(prefix_dir.join("bin").join("openclaw.exe"));
        candidates.push(
            prefix_dir
                .join("node_modules")
                .join(".bin")
                .join("openclaw.cmd"),
        );
        candidates.push(
            prefix_dir
                .join("node_modules")
                .join(".bin")
                .join("openclaw.exe"),
        );
    } else {
        candidates.push(common::openclaw_binary_path(app_data_dir));
        candidates.push(prefix_dir.join("openclaw"));
        candidates.push(
            prefix_dir
                .join("node_modules")
                .join(".bin")
                .join("openclaw"),
        );
    }

    let mut seen = HashSet::new();
    candidates
        .into_iter()
        .filter(|path| seen.insert(path.clone()))
        .collect()
}

fn system_openclaw_status() -> OpenClawStatus {
    let binary_path = resolve_openclaw_binary_path();
    let version = binary_path.as_deref().and_then(read_openclaw_version);

    OpenClawStatus {
        installed: version.is_some(),
        version,
        binary_path,
    }
}

fn resolve_openclaw_binary_path() -> Option<String> {
    let from_known_locations = default_openclaw_candidates()
        .into_iter()
        .find(|candidate| std::path::Path::new(candidate).exists());
    if from_known_locations.is_some() {
        return from_known_locations;
    }

    #[cfg(target_os = "windows")]
    let output = Command::new("where").arg("openclaw").output().ok()?;

    #[cfg(not(target_os = "windows"))]
    let output = Command::new("which").arg("openclaw").output().ok()?;

    let from_path_lookup = if output.status.success() {
        String::from_utf8(output.stdout).ok().and_then(|stdout| {
            stdout
                .lines()
                .map(str::trim)
                .find(|line| !line.is_empty())
                .map(ToString::to_string)
        })
    } else {
        None
    };

    from_path_lookup
}

fn default_openclaw_candidates() -> Vec<String> {
    #[cfg(target_os = "macos")]
    {
        return vec![
            "/opt/homebrew/bin/openclaw".to_string(),
            "/usr/local/bin/openclaw".to_string(),
            "/usr/bin/openclaw".to_string(),
        ];
    }

    #[cfg(target_os = "linux")]
    {
        return vec![
            "/usr/local/bin/openclaw".to_string(),
            "/usr/bin/openclaw".to_string(),
        ];
    }

    #[cfg(target_os = "windows")]
    {
        return vec![
            r"C:\Program Files\nodejs\openclaw.cmd".to_string(),
            r"C:\Program Files\nodejs\openclaw.exe".to_string(),
            "openclaw.cmd".to_string(),
        ];
    }

    #[allow(unreachable_code)]
    Vec::new()
}

fn status_cache() -> &'static Mutex<Option<OpenClawStatusCache>> {
    static CACHE: OnceLock<Mutex<Option<OpenClawStatusCache>>> = OnceLock::new();
    CACHE.get_or_init(|| Mutex::new(None))
}

fn read_cached_status(app_data_dir: &Path) -> Option<OpenClawStatus> {
    let lock = status_cache();
    let guard = lock.lock().ok()?;
    let entry = guard.as_ref()?;
    if entry.app_data_dir != app_data_dir {
        return None;
    }
    if entry.checked_at.elapsed() <= STATUS_CACHE_TTL {
        Some(entry.status.clone())
    } else {
        None
    }
}

fn write_cached_status(app_data_dir: &Path, status: &OpenClawStatus) {
    let lock = status_cache();
    if let Ok(mut guard) = lock.lock() {
        *guard = Some(OpenClawStatusCache {
            status: status.clone(),
            app_data_dir: app_data_dir.to_path_buf(),
            checked_at: Instant::now(),
        });
    }
}

fn clear_cached_status() {
    let lock = status_cache();
    if let Ok(mut guard) = lock.lock() {
        *guard = None;
    }
}

fn read_openclaw_version(binary: &str) -> Option<String> {
    let attempts = [
        Command::new(binary).arg("--version").output(),
        Command::new(binary).arg("-v").output(),
    ];

    for output in attempts.into_iter().flatten() {
        if !output.status.success() {
            continue;
        }

        let stdout = String::from_utf8_lossy(&output.stdout);
        if let Some(version) = parse_version_from_output(&stdout) {
            return Some(version);
        }

        let stderr = String::from_utf8_lossy(&output.stderr);
        if let Some(version) = parse_version_from_output(&stderr) {
            return Some(version);
        }
    }

    None
}

fn parse_version_from_output(output: &str) -> Option<String> {
    let sanitized = strip_ansi_sequences(output);
    sanitized.split_whitespace().find_map(parse_version_token)
}

fn parse_version_token(token: &str) -> Option<String> {
    let normalized = token
        .trim()
        .trim_matches(|ch: char| !ch.is_ascii_alphanumeric() && ch != '.')
        .trim_start_matches('v');

    let valid = normalized
        .chars()
        .all(|ch| ch.is_ascii_digit() || ch == '.');
    if valid && normalized.contains('.') {
        Some(normalized.to_string())
    } else {
        None
    }
}

fn strip_ansi_sequences(input: &str) -> String {
    let mut output = String::with_capacity(input.len());
    let mut escape = false;
    let mut csi = false;

    for ch in input.chars() {
        if escape {
            if !csi {
                if ch == '[' {
                    csi = true;
                } else {
                    escape = false;
                }
                continue;
            }

            if ('@'..='~').contains(&ch) {
                escape = false;
                csi = false;
            }
            continue;
        }

        if ch == '\u{1b}' {
            escape = true;
            csi = false;
            continue;
        }

        output.push(ch);
    }

    output
}

fn version_is_newer(installed: &str, latest: &str) -> bool {
    let installed_parts = parse_version_parts(installed);
    let latest_parts = parse_version_parts(latest);

    for idx in 0..installed_parts.len().max(latest_parts.len()) {
        let current = *installed_parts.get(idx).unwrap_or(&0);
        let incoming = *latest_parts.get(idx).unwrap_or(&0);
        if incoming > current {
            return true;
        }
        if incoming < current {
            return false;
        }
    }

    false
}

fn parse_version_parts(value: &str) -> Vec<u64> {
    value
        .trim()
        .split('.')
        .filter_map(|segment| {
            let numeric = segment
                .chars()
                .take_while(|ch| ch.is_ascii_digit())
                .collect::<String>();
            if numeric.is_empty() {
                None
            } else {
                numeric.parse::<u64>().ok()
            }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn version_comparison_detects_newer_release() {
        assert!(version_is_newer("1.2.3", "1.3.0"));
        assert!(!version_is_newer("2.0.0", "1.9.9"));
    }

    #[test]
    fn parse_version_handles_plain_and_prefixed_values() {
        assert_eq!(
            parse_version_from_output("2026.2.1"),
            Some("2026.2.1".to_string())
        );
        assert_eq!(
            parse_version_from_output("v2026.2.1"),
            Some("2026.2.1".to_string())
        );
        assert_eq!(
            parse_version_from_output("OpenClaw 2026.2.1 (build)"),
            Some("2026.2.1".to_string())
        );
        assert_eq!(
            parse_version_from_output(
                "\u{1b}[32mOpenClaw\u{1b}[0m version: \u{1b}[1m2026.2.1\u{1b}[0m"
            ),
            Some("2026.2.1".to_string())
        );
    }
}
