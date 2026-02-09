use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use crate::modules::common;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstallPathState {
    pub default_path: String,
    pub selected_path: Option<String>,
    pub effective_path: String,
}

#[tauri::command]
pub fn get_install_path_state(app: AppHandle) -> Result<InstallPathState, String> {
    install_path_state(&app)
}

#[tauri::command]
pub fn set_install_path(app: AppHandle, path: String) -> Result<InstallPathState, String> {
    common::set_install_path_override(&app, path)?;
    install_path_state(&app)
}

#[tauri::command]
pub fn reset_install_path(app: AppHandle) -> Result<InstallPathState, String> {
    common::reset_install_path_override(&app)?;
    install_path_state(&app)
}

fn install_path_state(app: &AppHandle) -> Result<InstallPathState, String> {
    let default_path = common::default_app_data_dir(app)?;
    let selected_path = common::get_install_path_override(app)?;
    let effective_path = common::app_data_dir(app)?;

    Ok(InstallPathState {
        default_path: default_path.to_string_lossy().to_string(),
        selected_path: selected_path.map(|path| path.to_string_lossy().to_string()),
        effective_path: effective_path.to_string_lossy().to_string(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn install_path_state_type_fields_exist() {
        let value = InstallPathState {
            default_path: "a".to_string(),
            selected_path: Some("b".to_string()),
            effective_path: "c".to_string(),
        };

        assert_eq!(value.default_path, "a");
        assert_eq!(value.selected_path.as_deref(), Some("b"));
        assert_eq!(value.effective_path, "c");
    }
}
