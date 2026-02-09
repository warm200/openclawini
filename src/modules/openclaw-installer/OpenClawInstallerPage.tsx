import { useOpenClawStatus } from "./useOpenClawStatus";

export function OpenClawInstallerPage() {
  const {
    status,
    updateInfo,
    installLog,
    loading,
    installing,
    checkingUpdate,
    refresh,
    install,
    update,
    checkUpdate,
  } = useOpenClawStatus();

  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-xl font-semibold text-slate-900">OpenClaw Installation</h2>
        <p className="text-sm text-slate-600">Manage installation and updates.</p>
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
        <div className="sm:col-span-2">
          <p className="text-xs uppercase tracking-wide text-slate-500">Binary path</p>
          <p className="truncate text-sm text-slate-700">{status?.binary_path ?? "—"}</p>
        </div>
      </div>

      {updateInfo?.update_available ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          New version available: {updateInfo.latest_version} (installed {updateInfo.installed_version})
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
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
            void install();
          }}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
          disabled={installing}
        >
          {installing ? "Installing..." : "Install/Reinstall"}
        </button>
        <button
          type="button"
          onClick={() => {
            void checkUpdate();
          }}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 disabled:opacity-40"
          disabled={checkingUpdate || installing}
        >
          {checkingUpdate ? "Checking..." : "Check updates"}
        </button>
        <button
          type="button"
          onClick={() => {
            void update();
          }}
          className="rounded-lg border border-amber-300 bg-amber-100 px-4 py-2 text-sm font-medium text-amber-900 disabled:opacity-40"
          disabled={installing || !updateInfo?.update_available}
        >
          Update now
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-950 p-3 text-xs text-slate-200 shadow-sm">
        <p className="mb-2 text-slate-400">Recent install output</p>
        <div className="max-h-48 overflow-y-auto font-mono">
          {installLog.length === 0 ? <p className="text-slate-500">No logs yet.</p> : null}
          {installLog.map((line, index) => (
            <p key={`${index}-${line}`}>{line}</p>
          ))}
        </div>
      </div>
    </section>
  );
}
