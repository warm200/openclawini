#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! Welcome to OpenClawini.", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![greet])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn greet_returns_expected_message() {
        let result = greet("World");
        assert_eq!(result, "Hello, World! Welcome to OpenClawini.");
    }

    #[test]
    fn greet_handles_empty_name() {
        let result = greet("");
        assert_eq!(result, "Hello, ! Welcome to OpenClawini.");
    }
}
