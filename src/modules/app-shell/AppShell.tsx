import { useMemo, useState } from "react";
import { BrowserLauncherPage } from "../browser-launcher";
import { LlmConfigPage } from "../llm-config";
import { NodeRuntimePage } from "../node-runtime";
import { OpenClawInstallerPage } from "../openclaw-installer";
import { PlatformPage } from "../platform";
import { LogViewer, ServiceManagerPage, useServiceManagerStatus } from "../service-manager";
import { SetupWizard } from "./SetupWizard";
import { useAppShellStatus } from "./useAppShellStatus";

type AppPage = "home" | "configuration" | "logs" | "system";
const SETUP_KEY = "openclawini.setup.complete";

function statusPillClass(state: string): string {
  if (state === "running") {
    return "bg-emerald-100 text-emerald-800";
  }
  if (state === "starting") {
    return "bg-amber-100 text-amber-800";
  }
  if (state === "error") {
    return "bg-rose-100 text-rose-800";
  }
  return "bg-slate-200 text-slate-800";
}

function LogsPanel() {
  const { logs, clearLogs } = useServiceManagerStatus();
  return <LogViewer logs={logs} onClear={clearLogs} />;
}

export function AppShell() {
  const [setupCompleted, setSetupCompleted] = useState(() => localStorage.getItem(SETUP_KEY) === "yes");
  const [page, setPage] = useState<AppPage>("home");
  const { gatewayState, openClawVersion } = useAppShellStatus();

  const pageContent = useMemo(() => {
    if (page === "home") {
      return (
        <div className="space-y-6">
          <ServiceManagerPage />
          <BrowserLauncherPage />
        </div>
      );
    }

    if (page === "configuration") {
      return <LlmConfigPage />;
    }

    if (page === "logs") {
      return <LogsPanel />;
    }

    return (
      <div className="space-y-6">
        <PlatformPage />
        <NodeRuntimePage />
        <OpenClawInstallerPage />
      </div>
    );
  }, [page]);

  if (!setupCompleted) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#ffe5db,_#fff5f1_45%,_#f5f7ff)] p-4 sm:p-8">
        <SetupWizard
          onFinish={() => {
            localStorage.setItem(SETUP_KEY, "yes");
            setSetupCompleted(true);
          }}
        />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_10%_0%,_#ffe1d8,_#fff_32%,_#eef3ff)] p-3 sm:p-6">
      <div className="mx-auto flex min-h-[calc(100vh-1.5rem)] w-full max-w-7xl gap-3 rounded-3xl border border-slate-200 bg-white/90 p-3 shadow-xl shadow-slate-900/5 backdrop-blur sm:p-4">
        <aside className="w-44 shrink-0 rounded-2xl border border-slate-200 bg-slate-50 p-2 sm:w-56">
          <div className="rounded-xl bg-brand px-3 py-3 text-white">
            <p className="text-xs uppercase tracking-wide text-white/80">OpenClawini</p>
            <p className="text-lg font-semibold">Control Panel</p>
          </div>
          <nav className="mt-3 space-y-1">
            <button
              type="button"
              onClick={() => setPage("home")}
              className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
                page === "home" ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-200"
              }`}
            >
              Home
            </button>
            <button
              type="button"
              onClick={() => setPage("configuration")}
              className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
                page === "configuration" ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-200"
              }`}
            >
              Configuration
            </button>
            <button
              type="button"
              onClick={() => setPage("logs")}
              className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
                page === "logs" ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-200"
              }`}
            >
              Logs
            </button>
            <button
              type="button"
              onClick={() => setPage("system")}
              className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
                page === "system" ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-200"
              }`}
            >
              System
            </button>
          </nav>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
          <div className="min-h-0 flex-1 overflow-y-auto">{pageContent}</div>
          <footer className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <span>Gateway:</span>
              <span className={`rounded-full px-2 py-1 font-semibold ${statusPillClass(gatewayState)}`}>
                {gatewayState}
              </span>
            </div>
            <span>OpenClaw version: {openClawVersion}</span>
          </footer>
        </section>
      </div>
    </main>
  );
}
