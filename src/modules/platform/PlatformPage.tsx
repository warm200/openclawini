import { usePlatformStatus } from "./usePlatformStatus";

export function PlatformPage() {
  const { platform, checks, loading, refresh } = usePlatformStatus();

  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-xl font-semibold text-slate-900">System</h2>
        <p className="text-sm text-slate-600">Platform and prerequisite diagnostics.</p>
      </header>

      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">OS</p>
          <p className="text-sm font-medium text-slate-800">{platform?.os ?? "Unknown"}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Architecture</p>
          <p className="text-sm font-medium text-slate-800">{platform?.arch ?? "Unknown"}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Version</p>
          <p className="text-sm font-medium text-slate-800">{platform?.os_version ?? "Unknown"}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-sm font-medium text-slate-700">Prerequisite checks</p>
        <ul className="mt-3 space-y-2 text-sm text-slate-700">
          {checks.map((check) => (
            <li key={`${check.name}-${check.detail}`} className="flex items-center justify-between">
              <span>{check.name}</span>
              <span className={check.passed ? "text-emerald-600" : "text-rose-600"}>
                {check.passed ? "Pass" : "Fail"}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <button
        type="button"
        onClick={() => {
          void refresh();
        }}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
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
    </section>
  );
}
