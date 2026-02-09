import type { PlatformArch, PlatformOs } from "../platform/types";
import { useNodeRuntimeStatus } from "./useNodeRuntimeStatus";

interface NodeRuntimeStepProps {
  onContinue: () => void;
  os?: PlatformOs;
  arch?: PlatformArch;
}

function progressPercent(percent: number | null): string {
  if (percent === null) {
    return "--";
  }
  return `${Math.round(percent * 100)}%`;
}

export function NodeRuntimeStep({ onContinue, os, arch }: NodeRuntimeStepProps) {
  const { status, progress, loading, installing, error, installNode } = useNodeRuntimeStatus();

  const installed = Boolean(status?.installed);

  return (
    <section className="space-y-5">
      <header>
        <h2 className="text-2xl font-semibold text-slate-900">Step 2: Install Node.js Runtime</h2>
        <p className="text-sm text-slate-600">
          Download and verify the latest stable internal Node.js runtime (minimum supported: 22).
        </p>
        {loading ? (
          <p className="mt-2 inline-flex items-center gap-2 text-xs text-slate-500">
            <span className="h-3 w-3 animate-spin rounded-full border border-slate-400 border-t-transparent" />
            Syncing runtime status...
          </p>
        ) : null}
      </header>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-sm text-slate-700">Installed</p>
        <p className="text-lg font-semibold text-slate-900">{installed ? "Yes" : "No"}</p>
        <p className="mt-1 text-sm text-slate-600">Version: {status?.version ?? "Unknown"}</p>
      </div>

      {progress ? (
        <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-sm text-slate-700">
            <span>{progress.stage}</span>
            <span>{progressPercent(progress.percent)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full bg-brand transition-all"
              style={{ width: progress.percent === null ? "35%" : `${progress.percent * 100}%` }}
            />
          </div>
          <p className="text-xs text-slate-500">{progress.detail}</p>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => {
            void installNode(os, arch);
          }}
          disabled={installing}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {installing ? "Installing..." : installed ? "Reinstall" : "Install Node.js"}
        </button>
        <button
          type="button"
          onClick={onContinue}
          disabled={!installed || installing}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          Continue
        </button>
      </div>
    </section>
  );
}
