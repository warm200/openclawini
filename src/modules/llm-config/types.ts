export interface ModelInfo {
  id: string;
  display_name: string;
  is_default: boolean;
}

export interface ProviderInfo {
  id: string;
  display_name: string;
  requires_api_key: boolean;
  env_var: string | null;
  models: ModelInfo[];
}

export interface LlmConfigState {
  selected_provider: string | null;
  selected_model: string | null;
  has_api_key: boolean;
}
