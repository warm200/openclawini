pub mod modules;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            modules::platform::detect_os,
            modules::platform::check_prerequisites,
            modules::install_location::get_install_path_state,
            modules::install_location::set_install_path,
            modules::install_location::reset_install_path,
            modules::node_runtime::get_node_status,
            modules::node_runtime::install_node,
            modules::node_runtime::get_node_env,
            modules::openclaw_installer::get_openclaw_status,
            modules::openclaw_installer::install_openclaw,
            modules::openclaw_installer::check_openclaw_update,
            modules::openclaw_installer::update_openclaw,
            modules::llm_config::list_providers,
            modules::llm_config::get_llm_config_state,
            modules::llm_config::save_llm_config,
            modules::llm_config::load_api_keys,
            modules::service_manager::start_gateway,
            modules::service_manager::stop_gateway,
            modules::service_manager::get_gateway_status,
            modules::service_manager::health_check,
            modules::browser_launcher::open_webchat,
        ])
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
