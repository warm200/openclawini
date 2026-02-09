use serde::{Deserialize, Serialize};
use serde_json::json;
use std::collections::HashMap;
use tauri::AppHandle;

use crate::modules::common;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderInfo {
    pub id: String,
    pub display_name: String,
    pub requires_api_key: bool,
    pub env_var: Option<String>,
    pub models: Vec<ModelInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelInfo {
    pub id: String,
    pub display_name: String,
    pub is_default: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LlmConfigState {
    pub selected_provider: Option<String>,
    pub selected_model: Option<String>,
    pub has_api_key: bool,
}

#[tauri::command]
pub fn list_providers() -> Vec<ProviderInfo> {
    providers()
}

#[tauri::command]
pub fn get_llm_config_state(app: AppHandle) -> Result<LlmConfigState, String> {
    let selected_model = read_selected_model()?;
    let selected_provider = selected_model
        .as_deref()
        .and_then(|model| model.split('/').next().map(str::to_string));

    let keys = load_api_keys(app)?;
    let has_api_key = if let Some(provider_id) = selected_provider.as_deref() {
        if let Some(provider) = provider_by_id(provider_id) {
            if let Some(env_name) = provider.env_var {
                keys.get(&env_name)
                    .map(|value| !value.trim().is_empty())
                    .unwrap_or(false)
            } else {
                false
            }
        } else {
            false
        }
    } else {
        false
    };

    Ok(LlmConfigState {
        selected_provider,
        selected_model,
        has_api_key,
    })
}

#[tauri::command]
pub fn save_llm_config(
    app: AppHandle,
    provider: String,
    model: String,
    api_key: Option<String>,
) -> Result<(), String> {
    let provider_info =
        provider_by_id(&provider).ok_or_else(|| format!("unknown provider: {provider}"))?;

    let model_valid = provider_info
        .models
        .iter()
        .any(|candidate| candidate.id == model);
    if !model_valid {
        return Err(format!(
            "model {model} is not valid for provider {provider}"
        ));
    }

    let config_path = common::openclaw_config_path()?;
    if let Some(parent) = config_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("failed to create config dir {}: {e}", parent.display()))?;
    }

    let config_content = json!({
        "agent": {
            "model": model,
        }
    });
    let serialized = serde_json::to_string_pretty(&config_content)
        .map_err(|e| format!("failed to serialize openclaw config: {e}"))?;
    std::fs::write(&config_path, serialized)
        .map_err(|e| format!("failed to write {}: {e}", config_path.display()))?;

    if provider_info.requires_api_key {
        let env_name = provider_info
            .env_var
            .clone()
            .ok_or_else(|| format!("provider {provider} missing env var metadata"))?;

        let app_data_dir = common::app_data_dir(&app)?;
        let keys_path = common::keys_file_path(&app_data_dir);
        if let Some(parent) = keys_path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("failed to create keys dir {}: {e}", parent.display()))?;
        }

        let mut keys = load_api_keys(app)?;
        if let Some(key_value) = api_key.and_then(|value| {
            let trimmed = value.trim().to_string();
            if trimmed.is_empty() {
                None
            } else {
                Some(trimmed)
            }
        }) {
            keys.insert(env_name, key_value);
            write_keys(&keys_path, &keys)?;
        }
    }

    Ok(())
}

#[tauri::command]
pub fn load_api_keys(app: AppHandle) -> Result<HashMap<String, String>, String> {
    let app_data_dir = common::app_data_dir(&app)?;
    let keys_path = common::keys_file_path(&app_data_dir);
    if !keys_path.exists() {
        return Ok(HashMap::new());
    }

    let raw = std::fs::read_to_string(&keys_path)
        .map_err(|e| format!("failed to read {}: {e}", keys_path.display()))?;

    serde_json::from_str(&raw)
        .map_err(|e| format!("invalid keys json in {}: {e}", keys_path.display()))
}

fn providers() -> Vec<ProviderInfo> {
    vec![
        ProviderInfo {
            id: "anthropic".to_string(),
            display_name: "Anthropic (Claude)".to_string(),
            requires_api_key: true,
            env_var: Some("ANTHROPIC_API_KEY".to_string()),
            models: vec![
                ModelInfo {
                    id: "anthropic/claude-sonnet-4-5-20250929".to_string(),
                    display_name: "Claude Sonnet 4.5".to_string(),
                    is_default: true,
                },
                ModelInfo {
                    id: "anthropic/claude-opus-4-6".to_string(),
                    display_name: "Claude Opus 4.6".to_string(),
                    is_default: false,
                },
            ],
        },
        ProviderInfo {
            id: "openai".to_string(),
            display_name: "OpenAI".to_string(),
            requires_api_key: true,
            env_var: Some("OPENAI_API_KEY".to_string()),
            models: vec![
                ModelInfo {
                    id: "openai/gpt-4o".to_string(),
                    display_name: "GPT-4o".to_string(),
                    is_default: true,
                },
                ModelInfo {
                    id: "openai/gpt-4o-mini".to_string(),
                    display_name: "GPT-4o Mini".to_string(),
                    is_default: false,
                },
            ],
        },
        ProviderInfo {
            id: "ollama".to_string(),
            display_name: "Ollama".to_string(),
            requires_api_key: false,
            env_var: None,
            models: vec![
                ModelInfo {
                    id: "ollama/llama3.2".to_string(),
                    display_name: "Llama 3.2".to_string(),
                    is_default: true,
                },
                ModelInfo {
                    id: "ollama/mistral".to_string(),
                    display_name: "Mistral".to_string(),
                    is_default: false,
                },
            ],
        },
    ]
}

fn provider_by_id(provider: &str) -> Option<ProviderInfo> {
    providers().into_iter().find(|item| item.id == provider)
}

fn read_selected_model() -> Result<Option<String>, String> {
    let path = common::openclaw_config_path()?;
    if !path.exists() {
        return Ok(None);
    }

    let raw = std::fs::read_to_string(&path)
        .map_err(|e| format!("failed to read {}: {e}", path.display()))?;
    let parsed: serde_json::Value = serde_json::from_str(&raw)
        .map_err(|e| format!("invalid json in {}: {e}", path.display()))?;

    Ok(parsed
        .get("agent")
        .and_then(|agent| agent.get("model"))
        .and_then(|model| model.as_str())
        .map(|value| value.to_string()))
}

fn write_keys(path: &std::path::Path, keys: &HashMap<String, String>) -> Result<(), String> {
    let serialized =
        serde_json::to_string_pretty(keys).map_err(|e| format!("failed to serialize keys: {e}"))?;
    std::fs::write(path, serialized).map_err(|e| format!("failed to write {}: {e}", path.display()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn provider_ids_are_unique() {
        let providers = providers();
        let mut ids = providers.iter().map(|p| p.id.clone()).collect::<Vec<_>>();
        ids.sort();
        ids.dedup();
        assert_eq!(ids.len(), providers.len());
    }
}
