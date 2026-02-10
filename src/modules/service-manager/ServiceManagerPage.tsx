import { LogViewer } from "./LogViewer";
import { useServiceManagerStatus } from "./useServiceManagerStatus";

function badgeClassName(state: string): string {
  if (state === "running") {
    return "bg-emerald-100 text-emerald-700";
  }
  if (state === "starting") {
    return "bg-amber-100 text-amber-700";
  }
  if (state === "error") {
    return "bg-rose-100 text-rose-700";
  }
  return "bg-slate-200 text-slate-700";
}

export function ServiceManagerPage() {
  const { status, logs, loading, starting, stopping, start, stop, clearLogs, refresh } = useServiceManagerStatus();
  const transition = starting || stopping;

  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-xl font-semibold text-slate-900">Gateway</h2>
        <p className="text-sm text-slate-600">Control OpenClaw gateway and inspect logs.</p>
        {loading ? (
          <p className="mt-2 inline-flex items-center gap-2 text-xs text-slate-500">
            <span className="h-3 w-3 animate-spin rounded-full border border-slate-400 border-t-transparent" />
            Syncing gateway status...
          </p>
        ) : null}
      </header>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-700">State</p>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeClassName(status.state)}`}>
            {status.state}
          </span>
        </div>
        <p className="mt-2 text-sm text-slate-600">PID: {status.pid ?? "—"}</p>
        <p className="text-sm text-slate-600">Uptime: {status.uptime_secs ?? 0}s</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
          disabled={transition || status.state === "running"}
          onClick={() => {
            void start();
          }}
        >
          {starting ? (
            <>
              <span
                aria-hidden="true"
                className="h-3.5 w-3.5 animate-spin rounded-full border border-white border-t-transparent"
              />
              Starting...
            </>
          ) : (
            "Start"
          )}
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
          disabled={transition || status.state !== "running"}
          onClick={() => {
            void stop();
          }}
        >
          {stopping ? (
            <>
              <span
                aria-hidden="true"
                className="h-3.5 w-3.5 animate-spin rounded-full border border-white border-t-transparent"
              />
              Stopping...
            </>
          ) : (
            "Stop"
          )}
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={starting || stopping || loading}
          onClick={() => {
            void refresh();
          }}
        >
          {loading ? (
            <>
              <span
                aria-hidden="true"
                className="h-3.5 w-3.5 animate-spin rounded-full border border-slate-500 border-t-transparent"
              />
              Refreshing...
            </>
          ) : (
            "Refresh"
          )}
        </button>
      </div>

      <LogViewer logs={logs} onClear={clearLogs} />
    </section>
  );
}
