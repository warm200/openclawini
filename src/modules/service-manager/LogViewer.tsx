import { useEffect, useMemo, useRef, useState } from "react";
import type { GatewayLog } from "./types";

interface LogViewerProps {
  logs: GatewayLog[];
  onClear: () => void;
}

function levelColor(level: GatewayLog["level"]): string {
  if (level === "warn") {
    return "text-amber-300";
  }
  if (level === "error" || level === "stderr") {
    return "text-rose-300";
  }
  return "text-slate-100";
}

export function LogViewer({ logs, onClear }: LogViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [stickToBottom, setStickToBottom] = useState(true);

  useEffect(() => {
    if (!stickToBottom || !containerRef.current) {
      return;
    }
    containerRef.current.scrollTop = containerRef.current.scrollHeight;
  }, [logs, stickToBottom]);

  const countLabel = useMemo(() => `${logs.length} lines`, [logs.length]);

  return (
    <section className="space-y-2 rounded-2xl border border-slate-700 bg-slate-950 p-3 shadow-sm">
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>{countLabel}</span>
        <div className="flex items-center gap-3">
          <span>{stickToBottom ? "Auto-scroll on" : "Auto-scroll paused"}</span>
          <button
            type="button"
            onClick={onClear}
            className="rounded border border-slate-600 px-2 py-1 text-slate-300 hover:border-slate-400"
          >
            Clear
          </button>
        </div>
      </div>
      <div
        ref={containerRef}
        onScroll={(event) => {
          const element = event.currentTarget;
          const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
          setStickToBottom(distanceFromBottom < 16);
        }}
        className="max-h-80 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950 p-3 font-mono text-xs"
      >
        {logs.length === 0 ? <p className="text-slate-500">No gateway logs yet.</p> : null}
        {logs.map((log, index) => (
          <p key={`${log.timestamp}-${index}`} className={`${levelColor(log.level)} leading-5`}>
            [{new Date(log.timestamp).toLocaleTimeString()}] {log.line}
          </p>
        ))}
      </div>
    </section>
  );
}
