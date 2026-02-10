import { LogViewer } from "./LogViewer";
import { useServiceManagerStatus } from "./useServiceManagerStatus";

interface ServiceManagerStepProps {
  onContinue: () => void;
}

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

export function ServiceManagerStep({ onContinue }: ServiceManagerStepProps) {
  const { status, logs, loading, starting, stopping, error, start, stop, clearLogs } = useServiceManagerStatus();

  const transition = starting || stopping;

  return (
    <section className="space-y-5">
      <header>
        <h2 className="text-2xl font-semibold text-slate-900">Step 5: Launch Gateway</h2>
        <p className="text-sm text-slate-600">Start OpenClaw gateway and verify it is running.</p>
        {loading ? (
          <p className="mt-2 inline-flex items-center gap-2 text-xs text-slate-500">
            <span className="h-3 w-3 animate-spin rounded-full border border-slate-400 border-t-transparent" />
            Syncing gateway status...
          </p>
        ) : null}
      </header>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-700">Gateway status</p>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeClassName(status.state)}`}>
            {status.state}
          </span>
        </div>
        <p className="mt-2 text-sm text-slate-600">Port: {status.port}</p>
      </div>

      {error || status.error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error ?? status.error}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => {
            void start();
          }}
          disabled={transition || status.state === "running"}
          className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
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
          onClick={() => {
            void stop();
          }}
          disabled={transition || status.state !== "running"}
          className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
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
          onClick={onContinue}
          disabled={status.state !== "running" || transition}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-40"
        >
          Continue
        </button>
      </div>

      <LogViewer logs={logs} onClear={clearLogs} />
    </section>
  );
}
