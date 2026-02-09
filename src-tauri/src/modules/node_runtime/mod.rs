use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::io::{Read, Write};
use std::path::Path;
use std::process::Command;
use tauri::{AppHandle, Emitter};

use crate::modules::common;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeStatus {
    pub installed: bool,
    pub version: Option<String>,
    pub node_path: Option<String>,
    pub npm_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstallProgress {
    pub stage: String,
    pub percent: Option<f64>,
    pub detail: String,
}

#[derive(Clone, Copy)]
enum ArchiveKind {
    TarGz,
    TarXz,
    Zip,
}

#[tauri::command]
pub fn get_node_status(app: AppHandle) -> Result<NodeStatus, String> {
    let app_data_dir = common::app_data_dir(&app)?;
    Ok(node_status_from_path(&app_data_dir))
}

#[tauri::command]
pub fn get_node_env(app: AppHandle) -> Result<HashMap<String, String>, String> {
    let app_data_dir = common::app_data_dir(&app)?;
    let mut env = HashMap::new();
    let path = common::prepend_path_env(&env, &common::node_bin_dir(&app_data_dir));
    env.insert("PATH".to_string(), path);
    Ok(env)
}

#[tauri::command]
pub fn install_node(app: AppHandle, os: String, arch: String) -> Result<NodeStatus, String> {
    let app_data_dir = common::app_data_dir(&app)?;
    let current_status = node_status_from_path(&app_data_dir);
    if current_status.installed && current_status.version.as_deref() == Some(common::NODE_VERSION) {
        return Ok(current_status);
    }

    let (download_url, archive_kind, extension) = node_download_target(&os, &arch)?;
    let tmp_dir = app_data_dir.join("tmp");
    fs::create_dir_all(&tmp_dir).map_err(|e| format!("failed to create temp dir: {e}"))?;
    let archive_path = tmp_dir.join(format!("node-runtime.{extension}"));
    let extract_dir = tmp_dir.join("node-extract");

    emit_progress(
        &app,
        InstallProgress {
            stage: "downloading".to_string(),
            percent: Some(0.0),
            detail: format!("Downloading {download_url}"),
        },
    )?;

    download_archive(&download_url, &archive_path)?;

    emit_progress(
        &app,
        InstallProgress {
            stage: "downloading".to_string(),
            percent: Some(1.0),
            detail: format!("Downloaded {}", archive_path.display()),
        },
    )?;

    emit_progress(
        &app,
        InstallProgress {
            stage: "extracting".to_string(),
            percent: None,
            detail: "Extracting Node.js archive".to_string(),
        },
    )?;

    if extract_dir.exists() {
        fs::remove_dir_all(&extract_dir).map_err(|e| format!("failed to reset extract dir: {e}"))?;
    }
    fs::create_dir_all(&extract_dir).map_err(|e| format!("failed to create extract dir: {e}"))?;

    extract_archive(&archive_path, &extract_dir, archive_kind)?;

    let node_root = common::node_root_dir(&app_data_dir);
    if node_root.exists() {
        fs::remove_dir_all(&node_root).map_err(|e| format!("failed to remove existing node dir: {e}"))?;
    }

    move_extracted_runtime(&extract_dir, &node_root)?;

    let _ = fs::remove_file(&archive_path);
    let _ = fs::remove_dir_all(&extract_dir);

    emit_progress(
        &app,
        InstallProgress {
            stage: "verifying".to_string(),
            percent: None,
            detail: "Checking node --version".to_string(),
        },
    )?;

    let status = node_status_from_path(&app_data_dir);
    if !status.installed {
        return Err("node installation completed but verification failed".to_string());
    }

    Ok(status)
}

fn emit_progress(app: &AppHandle, payload: InstallProgress) -> Result<(), String> {
    app.emit("node:progress", payload)
        .map_err(|e| format!("failed to emit node progress: {e}"))
}

fn node_status_from_path(app_data_dir: &Path) -> NodeStatus {
    let bundled = bundled_node_status(app_data_dir);
    if bundled.installed {
        return bundled;
    }

    let system = system_node_status();
    if system.version.is_some() {
        return system;
    }

    bundled
}

fn bundled_node_status(app_data_dir: &Path) -> NodeStatus {
    let node_path = common::node_binary_path(app_data_dir);
    let npm_path = common::npm_binary_path(app_data_dir);

    if !node_path.exists() || !npm_path.exists() {
        return NodeStatus {
            installed: false,
            version: None,
            node_path: None,
            npm_path: None,
        };
    }

    let version = Command::new(&node_path)
        .arg("--version")
        .output()
        .ok()
        .filter(|output| output.status.success())
        .and_then(|output| String::from_utf8(output.stdout).ok())
        .map(|output| common::normalize_version(&output));

    NodeStatus {
        installed: version
            .as_deref()
            .map(is_node_runtime_acceptable)
            .unwrap_or(false),
        version,
        node_path: Some(node_path.to_string_lossy().to_string()),
        npm_path: Some(npm_path.to_string_lossy().to_string()),
    }
}

fn system_node_status() -> NodeStatus {
    let node_path = resolve_binary_path("node");
    let npm_path = resolve_binary_path("npm");
    let version = node_path
        .as_deref()
        .and_then(read_node_version)
        .or_else(|| read_node_version("node"));

    let installed = version
        .as_deref()
        .map(is_node_runtime_acceptable)
        .unwrap_or(false)
        && npm_path.is_some();

    NodeStatus {
        installed,
        version,
        node_path,
        npm_path,
    }
}

fn resolve_binary_path(binary: &str) -> Option<String> {
    #[cfg(target_os = "windows")]
    let output = Command::new("where").arg(binary).output().ok()?;

    #[cfg(not(target_os = "windows"))]
    let output = Command::new("which").arg(binary).output().ok()?;

    let from_path_lookup = if output.status.success() {
        String::from_utf8(output.stdout)
            .ok()
            .and_then(|stdout| {
                stdout
                    .lines()
                    .map(str::trim)
                    .find(|line| !line.is_empty())
                    .map(ToString::to_string)
            })
    } else {
        None
    };

    from_path_lookup.or_else(|| {
        default_binary_candidates(binary)
            .into_iter()
            .find(|candidate| Path::new(candidate).exists())
    })
}

fn is_node_runtime_acceptable(version: &str) -> bool {
    let normalized = common::normalize_version(version);
    let major = normalized
        .split('.')
        .next()
        .and_then(|value| value.parse::<u64>().ok());
    major.map(|value| value >= 22).unwrap_or(false)
}

fn read_node_version(binary: &str) -> Option<String> {
    Command::new(binary)
        .arg("--version")
        .output()
        .ok()
        .filter(|output| output.status.success())
        .and_then(|output| String::from_utf8(output.stdout).ok())
        .map(|output| common::normalize_version(&output))
}

fn default_binary_candidates(binary: &str) -> Vec<String> {
    #[cfg(target_os = "macos")]
    {
        return vec![
            format!("/opt/homebrew/bin/{binary}"),
            format!("/usr/local/bin/{binary}"),
            format!("/usr/bin/{binary}"),
        ];
    }

    #[cfg(target_os = "linux")]
    {
        return vec![format!("/usr/local/bin/{binary}"), format!("/usr/bin/{binary}")];
    }

    #[cfg(target_os = "windows")]
    {
        let names = if binary.eq_ignore_ascii_case("npm") {
            vec!["npm.cmd", "npm.exe", "npm"]
        } else {
            vec!["node.exe", "node"]
        };
        return names
            .into_iter()
            .map(|name| format!(r"C:\Program Files\nodejs\{name}"))
            .collect();
    }

    #[allow(unreachable_code)]
    Vec::new()
}

fn node_download_target(
    os: &str,
    arch: &str,
) -> Result<(String, ArchiveKind, &'static str), String> {
    let version = common::NODE_VERSION;
    match (os, arch) {
        ("macos", "arm64") => Ok((
            format!("https://nodejs.org/dist/v{version}/node-v{version}-darwin-arm64.tar.gz"),
            ArchiveKind::TarGz,
            "tar.gz",
        )),
        ("macos", "x64") => Ok((
            format!("https://nodejs.org/dist/v{version}/node-v{version}-darwin-x64.tar.gz"),
            ArchiveKind::TarGz,
            "tar.gz",
        )),
        ("windows", "x64") => Ok((
            format!("https://nodejs.org/dist/v{version}/node-v{version}-win-x64.zip"),
            ArchiveKind::Zip,
            "zip",
        )),
        ("windows", "arm64") => Ok((
            format!("https://nodejs.org/dist/v{version}/node-v{version}-win-arm64.zip"),
            ArchiveKind::Zip,
            "zip",
        )),
        ("linux", "x64") => Ok((
            format!("https://nodejs.org/dist/v{version}/node-v{version}-linux-x64.tar.xz"),
            ArchiveKind::TarXz,
            "tar.xz",
        )),
        ("linux", "arm64") => Ok((
            format!("https://nodejs.org/dist/v{version}/node-v{version}-linux-arm64.tar.xz"),
            ArchiveKind::TarXz,
            "tar.xz",
        )),
        _ => Err(format!("unsupported platform combination: os={os}, arch={arch}")),
    }
}

fn download_archive(url: &str, destination: &Path) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let script = format!(
            "Invoke-WebRequest -Uri '{}' -OutFile '{}'",
            url,
            destination.display()
        );
        let status = Command::new("powershell")
            .args(["-NoProfile", "-Command", &script])
            .status()
            .map_err(|e| format!("failed to run powershell download: {e}"))?;
        if !status.success() {
            return Err(format!("node download failed with status {status}"));
        }
        return Ok(());
    }

    #[cfg(not(target_os = "windows"))]
    {
        let status = Command::new("curl")
            .arg("-L")
            .arg("--fail")
            .arg("--output")
            .arg(destination)
            .arg(url)
            .status()
            .map_err(|e| format!("failed to run curl download: {e}"))?;

        if !status.success() {
            return Err(format!("node download failed with status {status}"));
        }

        Ok(())
    }
}

fn extract_archive(archive_path: &Path, destination: &Path, kind: ArchiveKind) -> Result<(), String> {
    let status = match kind {
        ArchiveKind::TarGz => Command::new("tar")
            .arg("-xzf")
            .arg(archive_path)
            .arg("-C")
            .arg(destination)
            .status(),
        ArchiveKind::TarXz => Command::new("tar")
            .arg("-xJf")
            .arg(archive_path)
            .arg("-C")
            .arg(destination)
            .status(),
        ArchiveKind::Zip => {
            #[cfg(target_os = "windows")]
            {
                let script = format!(
                    "Expand-Archive -Path '{}' -DestinationPath '{}' -Force",
                    archive_path.display(),
                    destination.display()
                );
                Command::new("powershell")
                    .args(["-NoProfile", "-Command", &script])
                    .status()
            }

            #[cfg(not(target_os = "windows"))]
            {
                let unzip_status = Command::new("unzip")
                    .arg("-q")
                    .arg(archive_path)
                    .arg("-d")
                    .arg(destination)
                    .status();

                match unzip_status {
                    Ok(status) if status.success() => return Ok(()),
                    _ => Command::new("python3")
                        .arg("-m")
                        .arg("zipfile")
                        .arg("-e")
                        .arg(archive_path)
                        .arg(destination)
                        .status(),
                }
            }
        }
    }
    .map_err(|e| format!("failed to run archive extraction tool: {e}"))?;

    if !status.success() {
        return Err(format!("archive extraction failed with status {status}"));
    }

    Ok(())
}

fn move_extracted_runtime(extract_dir: &Path, node_root: &Path) -> Result<(), String> {
    fs::create_dir_all(node_root).map_err(|e| format!("failed to create node root dir: {e}"))?;

    let mut entries = fs::read_dir(extract_dir)
        .map_err(|e| format!("failed to read extract dir: {e}"))?
        .filter_map(Result::ok)
        .collect::<Vec<_>>();

    if entries.len() == 1 && entries[0].path().is_dir() {
        let extracted_root = entries.pop().expect("single entry").path();
        move_directory_contents(&extracted_root, node_root)?;
    } else {
        for entry in entries {
            let src = entry.path();
            let dst = node_root.join(entry.file_name());
            move_path(&src, &dst)?;
        }
    }

    Ok(())
}

fn move_directory_contents(src_dir: &Path, dst_dir: &Path) -> Result<(), String> {
    for entry in fs::read_dir(src_dir).map_err(|e| format!("failed to read {}: {e}", src_dir.display()))? {
        let entry = entry.map_err(|e| format!("failed to read directory entry: {e}"))?;
        let src = entry.path();
        let dst = dst_dir.join(entry.file_name());
        move_path(&src, &dst)?;
    }
    Ok(())
}

fn move_path(src: &Path, dst: &Path) -> Result<(), String> {
    if src.is_dir() {
        fs::create_dir_all(dst)
            .map_err(|e| format!("failed to create destination dir {}: {e}", dst.display()))?;
        move_directory_contents(src, dst)?;
        fs::remove_dir_all(src).map_err(|e| format!("failed to remove source dir {}: {e}", src.display()))?;
        return Ok(());
    }

    if let Some(parent) = dst.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("failed to create destination parent {}: {e}", parent.display()))?;
    }

    match fs::rename(src, dst) {
        Ok(_) => Ok(()),
        Err(_) => {
            let mut in_file = fs::File::open(src)
                .map_err(|e| format!("failed to open source file {}: {e}", src.display()))?;
            let mut out_file = fs::File::create(dst)
                .map_err(|e| format!("failed to create destination file {}: {e}", dst.display()))?;
            let mut buf = Vec::new();
            in_file
                .read_to_end(&mut buf)
                .map_err(|e| format!("failed to read source file {}: {e}", src.display()))?;
            out_file
                .write_all(&buf)
                .map_err(|e| format!("failed to write destination file {}: {e}", dst.display()))?;
            fs::remove_file(src).map_err(|e| format!("failed to remove source file {}: {e}", src.display()))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn download_target_covers_matrix() {
        let (url, _, _) = node_download_target("linux", "x64").expect("linux x64 supported");
        assert!(url.contains("linux-x64.tar.xz"));
    }

    #[test]
    fn unsupported_platform_returns_error() {
        assert!(node_download_target("linux", "sparc").is_err());
    }

    #[test]
    fn node_runtime_acceptance_checks_major_version() {
        assert!(is_node_runtime_acceptable("22.16.0"));
        assert!(is_node_runtime_acceptable("25.6.0"));
        assert!(!is_node_runtime_acceptable("21.9.0"));
    }

    #[test]
    fn default_candidates_include_homebrew_on_macos() {
        #[cfg(target_os = "macos")]
        {
            let candidates = default_binary_candidates("node");
            assert!(candidates.iter().any(|value| value == "/opt/homebrew/bin/node"));
        }
    }
}
