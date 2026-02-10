import { useLlmStatus } from "./useLlmStatus";

interface LlmConfigStepProps {
  onContinue: () => void;
}

export function LlmConfigStep({ onContinue }: LlmConfigStepProps) {
  const {
    providers,
    selectedProvider,
    selectedProviderId,
    selectedModelId,
    apiKey,
    loading,
    saving,
    error,
    saveMessage,
    canSave,
    selectProvider,
    selectModel,
    setApiKey,
    save,
  } = useLlmStatus();

  return (
    <section className="space-y-5">
      <header>
        <h2 className="text-2xl font-semibold text-slate-900">Step 4: Configure AI Model</h2>
        <p className="text-sm text-slate-600">Choose provider and model. API key is optional.</p>
        {loading ? (
          <p className="mt-2 inline-flex items-center gap-2 text-xs text-slate-500">
            <span className="h-3 w-3 animate-spin rounded-full border border-slate-400 border-t-transparent" />
            Loading providers...
          </p>
        ) : null}
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        {providers.map((provider) => {
          const active = selectedProviderId === provider.id;
          return (
            <button
              key={provider.id}
              type="button"
              className={`rounded-2xl border px-4 py-3 text-left transition ${
                active
                  ? "border-brand bg-brand/10 text-slate-900"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
              }`}
              onClick={() => {
                selectProvider(provider.id);
              }}
            >
              <p className="font-semibold">{provider.display_name}</p>
              <p className="text-xs opacity-80">
                {provider.requires_api_key ? "Requires API key" : "No API key required"}
              </p>
            </button>
          );
        })}
      </div>

      {selectedProvider ? (
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div>
            <label htmlFor="model-selector" className="mb-1 block text-sm font-medium text-slate-700">
              Model
            </label>
            <select
              id="model-selector"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={selectedModelId ?? ""}
              onChange={(event) => {
                selectModel(event.target.value);
              }}
            >
              {selectedProvider.models.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.display_name}
                </option>
              ))}
            </select>
          </div>

          {selectedProvider.requires_api_key ? (
            <div className="space-y-2">
              <label htmlFor="api-key" className="block text-sm font-medium text-slate-700">
                API key ({selectedProvider.env_var})
              </label>
              <input
                id="api-key"
                type="password"
                value={apiKey}
                onChange={(event) => {
                  setApiKey(event.target.value);
                }}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="Optional: paste API key"
              />
            </div>
          ) : (
            <p className="text-sm text-emerald-700">This provider works without an API key.</p>
          )}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      ) : null}
      {saveMessage ? <p className="text-sm text-emerald-700">{saveMessage}</p> : null}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => {
            void save();
          }}
          disabled={!canSave || saving}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving ? (
            <>
              <span
                aria-hidden="true"
                className="h-3.5 w-3.5 animate-spin rounded-full border border-slate-500 border-t-transparent"
              />
              Saving...
            </>
          ) : (
            "Save"
          )}
        </button>
        <button
          type="button"
          onClick={onContinue}
          disabled={!canSave || saving}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          Continue
        </button>
      </div>
    </section>
  );
}
