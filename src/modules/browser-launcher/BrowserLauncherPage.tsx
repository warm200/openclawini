import { useBrowserLauncherStatus } from "./useBrowserLauncherStatus";

export function BrowserLauncherPage() {
  const { url, opening, error, openWebChat, copyUrl } = useBrowserLauncherStatus();

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <header>
        <h2 className="text-xl font-semibold text-slate-900">Open WebChat</h2>
        <p className="text-sm text-slate-600">Launch OpenClaw WebChat in your default browser.</p>
      </header>

      <p className="break-all rounded-lg bg-slate-100 px-3 py-2 font-mono text-sm text-slate-800">{url}</p>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => {
            void openWebChat();
          }}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
          disabled={opening}
        >
          {opening ? "Opening..." : "Open WebChat"}
        </button>
        <button
          type="button"
          onClick={() => {
            void copyUrl();
          }}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700"
        >
          Copy URL
        </button>
      </div>
    </section>
  );
}
