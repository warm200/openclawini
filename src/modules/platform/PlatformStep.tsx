import type { PrereqCheck } from "./types";
import { usePlatformStatus } from "./usePlatformStatus";

interface PlatformStepProps {
  onContinue: () => void;
}

const CHECK_LABELS: Record<string, string> = {
  disk_space: "Disk space",
  writable_data_dir: "Writable app data directory",
  network: "Network reachability",
};

function statusClassName(passed: boolean): string {
  return passed
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-rose-200 bg-rose-50 text-rose-700";
}

function CheckRow({ check }: { check: PrereqCheck }) {
  return (
    <li
      className={`flex items-start justify-between rounded-xl border px-3 py-2 text-sm ${statusClassName(
        check.passed,
      )}`}
    >
      <div>
        <p className="font-medium">{CHECK_LABELS[check.name] ?? check.name}</p>
        <p className="text-xs opacity-80">{check.detail}</p>
      </div>
      <span className="ml-3 text-base leading-none">{check.passed ? "PASS" : "FAIL"}</span>
    </li>
  );
}

export function PlatformStep({ onContinue }: PlatformStepProps) {
  const { platform, checks, loading, error, canContinue, refresh } = usePlatformStatus();

  return (
    <section className="space-y-5">
      <header>
        <h2 className="text-2xl font-semibold text-slate-900">Step 1: Platform Check</h2>
        <p className="text-sm text-slate-600">Verify OS compatibility and prerequisites.</p>
        {loading ? (
          <p className="mt-2 inline-flex items-center gap-2 text-xs text-slate-500">
            <span className="h-3 w-3 animate-spin rounded-full border border-slate-400 border-t-transparent" />
            Syncing checks...
          </p>
        ) : null}
      </header>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-sm font-medium text-slate-700">Detected platform</p>
        {platform ? (
          <p className="mt-1 text-sm text-slate-900">
            {platform.os} / {platform.arch} / {platform.os_version}
          </p>
        ) : (
          <p className="mt-1 text-sm text-slate-500">Waiting for backend detection...</p>
        )}
      </div>

      <ul className="space-y-2">
        {checks.map((check) => (
          <CheckRow key={`${check.name}-${check.detail}`} check={check} />
        ))}
      </ul>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => {
            void refresh();
          }}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          {loading ? "Checking..." : "Re-check"}
        </button>
        <button
          type="button"
          onClick={onContinue}
          disabled={!canContinue}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          Continue
        </button>
      </div>
    </section>
  );
}
