use tauri::AppHandle;
use tauri_plugin_shell::ShellExt;

#[tauri::command]
#[allow(deprecated)]
pub fn open_webchat(app: AppHandle, port: u16) -> Result<(), String> {
    let url = format!("http://127.0.0.1:{port}");
    app.shell()
        .open(url, None)
        .map_err(|e| format!("failed to open webchat URL: {e}"))
}

#[cfg(test)]
mod tests {
    #[test]
    fn webchat_url_format_matches_expected() {
        let port = 18_789;
        let url = format!("http://127.0.0.1:{port}");
        assert_eq!(url, "http://127.0.0.1:18789");
    }
}
