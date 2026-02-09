use serde::{Deserialize, Serialize};
use std::net::{TcpStream, ToSocketAddrs};
use std::path::Path;
use std::process::Command;
use std::time::Duration;
use tauri::AppHandle;

use crate::modules::common;

const MIN_DISK_BYTES: u64 = 500 * 1024 * 1024;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlatformInfo {
    pub os: String,
    pub arch: String,
    pub os_version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrereqCheck {
    pub name: String,
    pub passed: bool,
    pub detail: String,
}

#[tauri::command]
pub fn detect_os() -> PlatformInfo {
    PlatformInfo {
        os: normalize_os(std::env::consts::OS),
        arch: normalize_arch(std::env::consts::ARCH),
        os_version: detect_os_version(),
    }
}

#[tauri::command]
pub fn check_prerequisites(app: AppHandle) -> Result<Vec<PrereqCheck>, String> {
    let data_dir = common::app_data_dir(&app)?;

    let disk_check = disk_space_check(&data_dir);
    let write_check = writable_dir_check(&data_dir);
    let network_check = network_check();

    Ok(vec![disk_check, write_check, network_check])
}

fn normalize_os(value: &str) -> String {
    match value {
        "macos" => "macos".to_string(),
        "windows" => "windows".to_string(),
        "linux" => "linux".to_string(),
        other => other.to_string(),
    }
}

fn normalize_arch(value: &str) -> String {
    match value {
        "x86_64" => "x64".to_string(),
        "aarch64" => "arm64".to_string(),
        "x64" => "x64".to_string(),
        "arm64" => "arm64".to_string(),
        other => other.to_string(),
    }
}

fn detect_os_version() -> String {
    #[cfg(target_os = "macos")]
    {
        return command_output("sw_vers", &["-productVersion"])
            .unwrap_or_else(|| "unknown".to_string());
    }

    #[cfg(target_os = "windows")]
    {
        return command_output(
            "powershell",
            &[
                "-NoProfile",
                "-Command",
                "[System.Environment]::OSVersion.Version.ToString()",
            ],
        )
        .or_else(|| command_output("cmd", &["/C", "ver"]))
        .unwrap_or_else(|| "unknown".to_string());
    }

    #[cfg(target_os = "linux")]
    {
        return command_output("uname", &["-r"]).unwrap_or_else(|| "unknown".to_string());
    }

    #[allow(unreachable_code)]
    "unknown".to_string()
}

fn command_output(cmd: &str, args: &[&str]) -> Option<String> {
    let output = Command::new(cmd).args(args).output().ok()?;
    if !output.status.success() {
        return None;
    }

    let value = String::from_utf8(output.stdout).ok()?;
    Some(value.trim().to_string())
}

fn disk_space_check(path: &Path) -> PrereqCheck {
    match free_bytes(path) {
        Ok(free) => {
            let gb = free as f64 / (1024.0 * 1024.0 * 1024.0);
            PrereqCheck {
                name: "disk_space".to_string(),
                passed: free >= MIN_DISK_BYTES,
                detail: format!("{gb:.2} GB free"),
            }
        }
        Err(err) => PrereqCheck {
            name: "disk_space".to_string(),
            passed: false,
            detail: format!("Failed to inspect free space: {err}"),
        },
    }
}

fn free_bytes(path: &Path) -> Result<u64, String> {
    #[cfg(target_os = "windows")]
    {
        let root = path
            .components()
            .next()
            .ok_or_else(|| "failed to derive drive letter".to_string())?
            .as_os_str()
            .to_string_lossy()
            .to_string();

        let script = format!(
            "(Get-PSDrive -Name '{}').Free",
            root.trim_end_matches(':').replace(':', "")
        );
        let output = Command::new("powershell")
            .args(["-NoProfile", "-Command", &script])
            .output()
            .map_err(|e| format!("powershell call failed: {e}"))?;

        if !output.status.success() {
            return Err("powershell failed to return free bytes".to_string());
        }

        let value = String::from_utf8(output.stdout)
            .map_err(|e| format!("powershell output decode failed: {e}"))?;
        return value
            .trim()
            .parse::<u64>()
            .map_err(|e| format!("failed to parse free bytes: {e}"));
    }

    #[cfg(not(target_os = "windows"))]
    {
        let output = Command::new("df")
            .arg("-k")
            .arg(path)
            .output()
            .map_err(|e| format!("failed to run df: {e}"))?;

        if !output.status.success() {
            return Err("df returned non-zero status".to_string());
        }

        let stdout = String::from_utf8(output.stdout)
            .map_err(|e| format!("df output decode failed: {e}"))?;
        let line = stdout
            .lines()
            .nth(1)
            .ok_or_else(|| "df output did not contain data row".to_string())?;
        let cols = line.split_whitespace().collect::<Vec<_>>();
        if cols.len() < 4 {
            return Err("df output row had unexpected format".to_string());
        }

        let available_kb = cols[3]
            .parse::<u64>()
            .map_err(|e| format!("failed to parse available kb: {e}"))?;
        Ok(available_kb * 1024)
    }
}

fn writable_dir_check(path: &Path) -> PrereqCheck {
    let result = std::fs::create_dir_all(path)
        .and_then(|_| std::fs::write(path.join(".write_test.tmp"), b"openclawini"))
        .and_then(|_| std::fs::remove_file(path.join(".write_test.tmp")));

    match result {
        Ok(_) => PrereqCheck {
            name: "writable_data_dir".to_string(),
            passed: true,
            detail: format!("Writable: {}", path.display()),
        },
        Err(err) => PrereqCheck {
            name: "writable_data_dir".to_string(),
            passed: false,
            detail: format!("Cannot write to {}: {err}", path.display()),
        },
    }
}

fn network_check() -> PrereqCheck {
    let address_candidates = match "nodejs.org:443".to_socket_addrs() {
        Ok(candidates) => candidates.collect::<Vec<_>>(),
        Err(err) => {
            return PrereqCheck {
                name: "network".to_string(),
                passed: false,
                detail: format!("Cannot resolve nodejs.org: {err}"),
            }
        }
    };

    let reachable = address_candidates
        .into_iter()
        .any(|address| TcpStream::connect_timeout(&address, Duration::from_secs(5)).is_ok());

    if reachable {
        PrereqCheck {
            name: "network".to_string(),
            passed: true,
            detail: "Reachable: https://nodejs.org".to_string(),
        }
    } else {
        PrereqCheck {
            name: "network".to_string(),
            passed: false,
            detail: "Cannot reach nodejs.org:443".to_string(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalize_arch_maps_known_values() {
        assert_eq!(normalize_arch("x86_64"), "x64");
        assert_eq!(normalize_arch("aarch64"), "arm64");
    }

    #[test]
    fn detect_os_has_non_empty_fields() {
        let info = detect_os();
        assert!(!info.os.is_empty());
        assert!(!info.arch.is_empty());
        assert!(!info.os_version.is_empty());
    }
}
