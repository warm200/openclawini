use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::{BufRead, BufReader, Read, Write};
use std::net::TcpStream;
use std::process::{Child, Command, Stdio};
use std::sync::{Mutex, OnceLock};
use std::thread;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};

use crate::modules::common;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GatewayStatus {
    pub state: String,
    pub pid: Option<u32>,
    pub port: u16,
    pub uptime_secs: Option<u64>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GatewayLog {
    pub line: String,
    pub level: String,
    pub timestamp: String,
}

struct GatewayRuntime {
    state: String,
    pid: Option<u32>,
    port: u16,
    error: Option<String>,
    started_at: Option<Instant>,
    child: Option<Child>,
}

impl GatewayRuntime {
    fn new() -> Self {
        Self {
            state: "stopped".to_string(),
            pid: None,
            port: common::DEFAULT_GATEWAY_PORT,
            error: None,
            started_at: None,
            child: None,
        }
    }

    fn snapshot(&self) -> GatewayStatus {
        let uptime_secs = self.started_at.and_then(|started| {
            if self.state == "running" || self.state == "starting" {
                Some(started.elapsed().as_secs())
            } else {
                None
            }
        });

        GatewayStatus {
            state: self.state.clone(),
            pid: self.pid,
            port: self.port,
            uptime_secs,
            error: self.error.clone(),
        }
    }

    fn set_state(
        &mut self,
        state: impl Into<String>,
        pid: Option<u32>,
        port: u16,
        error: Option<String>,
        keep_start_time: bool,
    ) {
        self.state = state.into();
        self.pid = pid;
        self.port = port;
        self.error = error;
        if !keep_start_time {
            self.started_at = None;
        }
    }
}

fn gateway_state() -> &'static Mutex<GatewayRuntime> {
    static GATEWAY: OnceLock<Mutex<GatewayRuntime>> = OnceLock::new();
    GATEWAY.get_or_init(|| Mutex::new(GatewayRuntime::new()))
}

#[tauri::command]
pub fn start_gateway(
    app: AppHandle,
    openclaw_path: String,
    port: u16,
    env_vars: HashMap<String, String>,
) -> Result<(), String> {
    {
        let state_lock = gateway_state();
        let mut runtime = state_lock
            .lock()
            .map_err(|_| "gateway state lock poisoned".to_string())?;
        refresh_process_state(&mut runtime);
        if runtime.child.is_some() && (runtime.state == "starting" || runtime.state == "running") {
            let message = "gateway already running".to_string();
            let _ = emit_gateway_log(&app, message.clone(), "warn");
            return Err(message);
        }
        runtime.set_state("starting", None, port, None, false);
        emit_gateway_status(&app, runtime.snapshot())?;
    }

    let _ = emit_gateway_log(
        &app,
        format!("Starting gateway: {openclaw_path} gateway --port {port} --verbose"),
        "info",
    );

    let mut command = Command::new(&openclaw_path);
    command
        .arg("gateway")
        .arg("--port")
        .arg(port.to_string())
        .arg("--verbose")
        .envs(env_vars)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let mut child = match command.spawn() {
        Ok(child) => child,
        Err(err) => {
            let message = format!("failed to spawn gateway with {}: {err}", openclaw_path);
            let state_lock = gateway_state();
            let mut runtime = state_lock
                .lock()
                .map_err(|_| "gateway state lock poisoned".to_string())?;
            runtime.set_state("error", None, port, Some(message.clone()), false);
            emit_gateway_status(&app, runtime.snapshot())?;
            let _ = emit_gateway_log(&app, message.clone(), "error");
            return Err(message);
        }
    };

    let pid = child.id();
    let stdout = child.stdout.take();
    let stderr = child.stderr.take();

    {
        let state_lock = gateway_state();
        let mut runtime = state_lock
            .lock()
            .map_err(|_| "gateway state lock poisoned".to_string())?;
        runtime.child = Some(child);
        runtime.started_at = Some(Instant::now());
        runtime.set_state("starting", Some(pid), port, None, true);
        emit_gateway_status(&app, runtime.snapshot())?;
    }

    if let Some(stdout) = stdout {
        let app_stdout = app.clone();
        thread::spawn(move || {
            stream_logs(stdout, app_stdout, "stdout");
        });
    }

    if let Some(stderr) = stderr {
        let app_stderr = app.clone();
        thread::spawn(move || {
            stream_logs(stderr, app_stderr, "stderr");
        });
    }

    let app_health = app.clone();
    thread::spawn(move || {
        wait_until_running(app_health.clone(), port);
        monitor_health(app_health, port);
    });

    Ok(())
}

#[tauri::command]
pub fn stop_gateway(app: AppHandle) -> Result<(), String> {
    let mut child = {
        let state_lock = gateway_state();
        let mut runtime = state_lock
            .lock()
            .map_err(|_| "gateway state lock poisoned".to_string())?;
        refresh_process_state(&mut runtime);

        let Some(child) = runtime.child.take() else {
            let current_port = runtime.port;
            runtime.set_state("stopped", None, current_port, None, false);
            emit_gateway_status(&app, runtime.snapshot())?;
            return Ok(());
        };

        let current_port = runtime.port;
        let current_pid = runtime.pid;
        runtime.set_state("stopping", current_pid, current_port, None, true);
        emit_gateway_status(&app, runtime.snapshot())?;
        child
    };

    #[cfg(unix)]
    {
        let pid = child.id();
        let _ = Command::new("kill")
            .arg("-TERM")
            .arg(pid.to_string())
            .status();
    }

    #[cfg(windows)]
    {
        let _ = child.kill();
    }

    let start = Instant::now();
    loop {
        match child.try_wait() {
            Ok(Some(_)) => break,
            Ok(None) => {
                if start.elapsed() >= Duration::from_secs(5) {
                    let _ = child.kill();
                    let _ = child.wait();
                    break;
                }
                thread::sleep(Duration::from_millis(100));
            }
            Err(_) => break,
        }
    }

    {
        let state_lock = gateway_state();
        let mut runtime = state_lock
            .lock()
            .map_err(|_| "gateway state lock poisoned".to_string())?;
        let current_port = runtime.port;
        runtime.set_state("stopped", None, current_port, None, false);
        emit_gateway_status(&app, runtime.snapshot())?;
    }

    Ok(())
}

#[tauri::command]
pub fn get_gateway_status() -> GatewayStatus {
    let state_lock = gateway_state();
    if let Ok(mut runtime) = state_lock.lock() {
        refresh_process_state(&mut runtime);
        runtime.snapshot()
    } else {
        GatewayStatus {
            state: "error".to_string(),
            pid: None,
            port: common::DEFAULT_GATEWAY_PORT,
            uptime_secs: None,
            error: Some("gateway state lock poisoned".to_string()),
        }
    }
}

#[tauri::command]
pub async fn health_check(port: u16) -> bool {
    let probe = tauri::async_runtime::spawn_blocking(move || health_check_via_subprocess(port)).await;
    match probe {
        Ok(Some(healthy)) => healthy,
        Ok(None) | Err(_) => health_check_inner(port),
    }
}

fn refresh_process_state(runtime: &mut GatewayRuntime) {
    let Some(child) = runtime.child.as_mut() else {
        return;
    };

    match child.try_wait() {
        Ok(Some(status)) => {
            runtime.child = None;
            let port = runtime.port;
            if runtime.state == "stopping" || status.success() {
                runtime.set_state("stopped", None, port, None, false);
            } else {
                runtime.set_state(
                    "error",
                    None,
                    port,
                    Some(format!("gateway exited unexpectedly with status {status}")),
                    false,
                );
            }
        }
        Ok(None) => {}
        Err(err) => {
            runtime.child = None;
            let port = runtime.port;
            runtime.set_state(
                "error",
                None,
                port,
                Some(format!("failed to inspect gateway process state: {err}")),
                false,
            );
        }
    }
}

fn wait_until_running(app: AppHandle, port: u16) {
    for _ in 0..30 {
        if health_check_inner(port) {
            if let Ok(mut runtime) = gateway_state().lock() {
                if runtime.state == "starting" {
                    runtime.state = "running".to_string();
                    runtime.error = None;
                    let _ = emit_gateway_status(&app, runtime.snapshot());
                    let _ = emit_gateway_log(&app, format!("gateway is running on port {port}"), "info");
                }
            }
            return;
        }

        if let Ok(mut runtime) = gateway_state().lock() {
            let prev_state = runtime.state.clone();
            refresh_process_state(&mut runtime);
            if runtime.state != prev_state {
                let _ = emit_gateway_status(&app, runtime.snapshot());
                if runtime.state == "error" {
                    let line = runtime
                        .error
                        .clone()
                        .unwrap_or_else(|| "gateway entered error state".to_string());
                    let _ = emit_gateway_log(&app, line, "error");
                }
            }
            if runtime.state == "stopped" || runtime.state == "error" {
                return;
            }
        }

        thread::sleep(Duration::from_secs(2));
    }

    if let Ok(mut runtime) = gateway_state().lock() {
        if runtime.state == "starting" {
            runtime.state = "error".to_string();
            runtime.error = Some("gateway did not become healthy within 60 seconds".to_string());
            let _ = emit_gateway_status(&app, runtime.snapshot());
            let _ = emit_gateway_log(
                &app,
                "gateway did not become healthy within 60 seconds".to_string(),
                "error",
            );
        }
    }
}

fn monitor_health(app: AppHandle, port: u16) {
    let mut failed_checks = 0u8;

    loop {
        thread::sleep(Duration::from_secs(2));

        if let Ok(mut runtime) = gateway_state().lock() {
            let prev_state = runtime.state.clone();
            refresh_process_state(&mut runtime);
            if runtime.state != prev_state {
                let _ = emit_gateway_status(&app, runtime.snapshot());
                if runtime.state == "error" {
                    let line = runtime
                        .error
                        .clone()
                        .unwrap_or_else(|| "gateway entered error state".to_string());
                    let _ = emit_gateway_log(&app, line, "error");
                }
            }
            if runtime.state != "running" {
                return;
            }
        }

        if health_check_inner(port) {
            failed_checks = 0;
            continue;
        }

        failed_checks = failed_checks.saturating_add(1);
        if failed_checks < 3 {
            continue;
        }

        if let Ok(mut runtime) = gateway_state().lock() {
            if runtime.state == "running" {
                runtime.state = "error".to_string();
                runtime.error = Some("gateway health checks failed repeatedly".to_string());
                let _ = emit_gateway_status(&app, runtime.snapshot());
                let _ = emit_gateway_log(
                    &app,
                    "gateway health checks failed repeatedly".to_string(),
                    "error",
                );
            }
        }
        return;
    }
}

fn stream_logs<R>(reader: R, app: AppHandle, level: &str)
where
    R: Read,
{
    let reader = BufReader::new(reader);
    for line in reader.lines().map_while(Result::ok) {
        let payload = GatewayLog {
            line,
            level: level.to_string(),
            timestamp: common::iso_utc_now(),
        };
        let _ = app.emit("gateway:log", payload);
    }
}

fn health_check_inner(port: u16) -> bool {
    let mut stream = match TcpStream::connect(("127.0.0.1", port)) {
        Ok(stream) => stream,
        Err(_) => return false,
    };

    if stream
        .set_read_timeout(Some(Duration::from_secs(2)))
        .is_err()
        || stream
            .set_write_timeout(Some(Duration::from_secs(2)))
            .is_err()
    {
        return false;
    }

    let request = format!("GET / HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\nConnection: close\r\n\r\n");
    if stream.write_all(request.as_bytes()).is_err() {
        return false;
    }

    let mut reader = BufReader::new(stream);
    let mut status_line = String::new();
    if reader.read_line(&mut status_line).is_err() {
        return false;
    }

    status_line.starts_with("HTTP/1.1 2") || status_line.starts_with("HTTP/1.0 2")
}

fn health_check_via_subprocess(port: u16) -> Option<bool> {
    let url = format!("http://127.0.0.1:{port}/");

    #[cfg(target_os = "windows")]
    let output = Command::new("curl")
        .args([
            "-sS",
            "-o",
            "NUL",
            "-w",
            "%{http_code}",
            "--connect-timeout",
            "1",
            "--max-time",
            "1",
            &url,
        ])
        .output()
        .ok()?;

    #[cfg(not(target_os = "windows"))]
    let output = Command::new("curl")
        .args([
            "-sS",
            "-o",
            "/dev/null",
            "-w",
            "%{http_code}",
            "--connect-timeout",
            "1",
            "--max-time",
            "1",
            &url,
        ])
        .output()
        .ok()?;

    if !output.status.success() {
        return Some(false);
    }

    let http_code = String::from_utf8(output.stdout)
        .ok()?
        .trim()
        .parse::<u16>()
        .ok()?;

    Some((200..300).contains(&http_code))
}

fn emit_gateway_status(app: &AppHandle, status: GatewayStatus) -> Result<(), String> {
    app.emit("gateway:status", status)
        .map_err(|e| format!("failed to emit gateway status: {e}"))
}

fn emit_gateway_log(app: &AppHandle, line: String, level: &str) -> Result<(), String> {
    app.emit(
        "gateway:log",
        GatewayLog {
            line,
            level: level.to_string(),
            timestamp: common::iso_utc_now(),
        },
    )
    .map_err(|e| format!("failed to emit gateway log: {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn initial_status_is_stopped() {
        let runtime = GatewayRuntime::new();
        let status = runtime.snapshot();
        assert_eq!(status.state, "stopped");
        assert_eq!(status.port, common::DEFAULT_GATEWAY_PORT);
    }
}
