import { useNodeRuntimeStatus } from "./useNodeRuntimeStatus";

export function NodeRuntimePage() {
  const { status, loading, error, refresh, installNode, installing } = useNodeRuntimeStatus();

  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-xl font-semibold text-slate-900">Node Runtime</h2>
        <p className="text-sm text-slate-600">Internal runtime used to run OpenClaw installation tasks.</p>
      </header>

      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Installed</p>
          <p className="text-sm font-medium text-slate-900">{status?.installed ? "Yes" : "No"}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Version</p>
          <p className="text-sm font-medium text-slate-900">{status?.version ?? "Unknown"}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">node path</p>
          <p className="truncate text-sm text-slate-700">{status?.node_path ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">npm path</p>
          <p className="truncate text-sm text-slate-700">{status?.npm_path ?? "—"}</p>
        </div>
      </div>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => {
            void refresh();
          }}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
        <button
          type="button"
          onClick={() => {
            void installNode();
          }}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white"
          disabled={installing}
        >
          {installing ? "Installing..." : "Install/Reinstall"}
        </button>
      </div>
    </section>
  );
}
