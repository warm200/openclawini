import { useBrowserLauncherStatus } from "./useBrowserLauncherStatus";

interface BrowserLauncherStepProps {
  onFinish: () => void;
}

export function BrowserLauncherStep({ onFinish }: BrowserLauncherStepProps) {
  const { url, openWebChat, copyUrl, opening, error } = useBrowserLauncherStatus();

  return (
    <section className="space-y-5">
      <header>
        <h2 className="text-2xl font-semibold text-slate-900">Step 6: Open WebChat</h2>
        <p className="text-sm text-slate-600">OpenClaw is ready. Launch WebChat in your default browser.</p>
      </header>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-xs uppercase tracking-wide text-slate-500">WebChat URL</p>
        <p className="mt-1 break-all font-mono text-sm text-slate-900">{url}</p>
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
            void openWebChat();
          }}
          disabled={opening}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          {opening ? "Opening..." : "Open WebChat"}
        </button>
        <button
          type="button"
          onClick={() => {
            void copyUrl();
          }}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
        >
          Copy URL
        </button>
        <button
          type="button"
          onClick={onFinish}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
        >
          Finish Setup
        </button>
      </div>
    </section>
  );
}
