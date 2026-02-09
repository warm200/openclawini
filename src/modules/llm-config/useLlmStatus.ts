import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { LlmConfigState, ProviderInfo } from "./types";

export function useLlmStatus(): {
  providers: ProviderInfo[];
  selectedProviderId: string | null;
  selectedModelId: string | null;
  apiKey: string;
  loading: boolean;
  saving: boolean;
  error: string | null;
  saveMessage: string | null;
  selectedProvider: ProviderInfo | null;
  canSave: boolean;
  selectProvider: (providerId: string) => void;
  selectModel: (modelId: string) => void;
  setApiKey: (value: string) => void;
  save: () => Promise<void>;
  refresh: () => Promise<void>;
} {
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const selectedProvider = useMemo(
    () => providers.find((provider) => provider.id === selectedProviderId) ?? null,
    [providers, selectedProviderId],
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSaveMessage(null);

    try {
      const [providerList, state] = await Promise.all([
        invoke<ProviderInfo[]>("list_providers"),
        invoke<LlmConfigState>("get_llm_config_state"),
      ]);

      setProviders(providerList);

      if (state.selected_provider) {
        setSelectedProviderId(state.selected_provider);
      } else {
        setSelectedProviderId(providerList[0]?.id ?? null);
      }

      if (state.selected_model) {
        setSelectedModelId(state.selected_model);
      } else {
        const defaultModel = providerList[0]?.models.find((model) => model.is_default)?.id;
        setSelectedModelId(defaultModel ?? providerList[0]?.models[0]?.id ?? null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load LLM configuration");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const selectProvider = useCallback(
    (providerId: string) => {
      setSelectedProviderId(providerId);
      const provider = providers.find((item) => item.id === providerId);
      if (provider) {
        const defaultModel = provider.models.find((model) => model.is_default)?.id;
        setSelectedModelId(defaultModel ?? provider.models[0]?.id ?? null);
      }
      setSaveMessage(null);
    },
    [providers],
  );

  const selectModel = useCallback((modelId: string) => {
    setSelectedModelId(modelId);
    setSaveMessage(null);
  }, []);

  const canSave = useMemo(
    () => Boolean(selectedProvider && selectedModelId),
    [selectedModelId, selectedProvider],
  );

  const save = useCallback(async () => {
    if (!selectedProvider || !selectedModelId) {
      setError("Provider and model must be selected");
      return;
    }

    setSaving(true);
    setError(null);
    setSaveMessage(null);

    try {
      await invoke("save_llm_config", {
        provider: selectedProvider.id,
        model: selectedModelId,
        apiKey:
          selectedProvider.requires_api_key && apiKey.trim().length > 0 ? apiKey : undefined,
      });
      setSaveMessage("Configuration saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save configuration");
    } finally {
      setSaving(false);
    }
  }, [apiKey, selectedModelId, selectedProvider]);

  return {
    providers,
    selectedProviderId,
    selectedModelId,
    apiKey,
    loading,
    saving,
    error,
    saveMessage,
    selectedProvider,
    canSave,
    selectProvider,
    selectModel,
    setApiKey,
    save,
    refresh,
  };
}
