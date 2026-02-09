import { useOpenClawStatus } from "./useOpenClawStatus";

interface OpenClawInstallerStepProps {
  onContinue: () => void;
}

export function OpenClawInstallerStep({ onContinue }: OpenClawInstallerStepProps) {
  const { status, updateInfo, installLog, installing, loading, error, install } = useOpenClawStatus();

  return (
    <section className="space-y-5">
      <header>
        <h2 className="text-2xl font-semibold text-slate-900">Step 3: Install OpenClaw</h2>
        <p className="text-sm text-slate-600">Install OpenClaw in the app-managed global directory.</p>
        {loading ? (
          <p className="mt-2 inline-flex items-center gap-2 text-xs text-slate-500">
            <span className="h-3 w-3 animate-spin rounded-full border border-slate-400 border-t-transparent" />
            Syncing installer status...
          </p>
        ) : null}
      </header>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-sm text-slate-700">Installed version</p>
        <p className="text-lg font-semibold text-slate-900">{status?.version ?? "Not installed"}</p>
        {updateInfo?.update_available ? (
          <p className="mt-1 text-sm text-amber-700">Update available: {updateInfo.latest_version}</p>
        ) : null}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-950 p-3 text-xs text-slate-200 shadow-sm">
        <p className="mb-2 text-slate-400">Install log</p>
        <div className="max-h-40 overflow-y-auto font-mono">
          {installLog.length === 0 ? <p className="text-slate-500">No output yet.</p> : null}
          {installLog.map((line, index) => (
            <p key={`${index}-${line}`}>{line}</p>
          ))}
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => {
            void install();
          }}
          disabled={installing}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-40"
        >
          {installing ? "Installing..." : "Install OpenClaw"}
        </button>

        <button
          type="button"
          onClick={onContinue}
          disabled={!status?.installed || installing}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          Continue
        </button>
      </div>
    </section>
  );
}
