import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { GatewayLog, GatewayStatus } from "./types";
import type { OpenClawStatus } from "../openclaw-installer/types";

const DEFAULT_PORT = 18789;
const MAX_LOG_LINES = 1000;

function appendLogLine(logs: GatewayLog[], log: GatewayLog): GatewayLog[] {
  const next = [...logs, log];
  if (next.length > MAX_LOG_LINES) {
    return next.slice(next.length - MAX_LOG_LINES);
  }
  return next;
}

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) {
    return err.message;
  }
  if (typeof err === "string") {
    return err;
  }
  if (typeof err === "object" && err !== null && "message" in err) {
    const candidate = (err as { message?: unknown }).message;
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate;
    }
  }
  return fallback;
}

export function useServiceManagerStatus(): {
  status: GatewayStatus;
  logs: GatewayLog[];
  loading: boolean;
  starting: boolean;
  stopping: boolean;
  error: string | null;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  clearLogs: () => void;
  refresh: () => Promise<void>;
} {
  const [status, setStatus] = useState<GatewayStatus>({
    state: "stopped",
    pid: null,
    port: DEFAULT_PORT,
    uptime_secs: null,
    error: null,
  });
  const [logs, setLogs] = useState<GatewayLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const nextStatus = await invoke<GatewayStatus>("get_gateway_status");
      setStatus(nextStatus);
    } catch (err) {
      setError(errorMessage(err, "Failed to load gateway status"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    let disposed = false;
    let statusUnlisten: (() => void) | null = null;
    let logUnlisten: (() => void) | null = null;

    void listen<GatewayStatus>("gateway:status", (event) => {
      if (!disposed) {
        setStatus(event.payload);
      }
    }).then((unlisten) => {
      statusUnlisten = unlisten;
      if (disposed) {
        unlisten();
      }
    });

    void listen<GatewayLog>("gateway:log", (event) => {
      if (!disposed) {
        setLogs((current) => appendLogLine(current, event.payload));
      }
    }).then((unlisten) => {
      logUnlisten = unlisten;
      if (disposed) {
        unlisten();
      }
    });

    return () => {
      disposed = true;
      if (statusUnlisten) {
        statusUnlisten();
      }
      if (logUnlisten) {
        logUnlisten();
      }
    };
  }, []);

  const start = useCallback(async () => {
    setStarting(true);
    setError(null);

    try {
      const [openClaw, nodeEnv, keys] = await Promise.all([
        invoke<OpenClawStatus>("get_openclaw_status"),
        invoke<Record<string, string>>("get_node_env"),
        invoke<Record<string, string>>("load_api_keys"),
      ]);

      if (!openClaw.binary_path) {
        throw new Error("OpenClaw binary path is not available. Install OpenClaw first.");
      }

      await invoke("start_gateway", {
        openclawPath: openClaw.binary_path,
        port: status.port || DEFAULT_PORT,
        envVars: {
          ...nodeEnv,
          ...keys,
        },
      });
    } catch (err) {
      const message = errorMessage(err, "Failed to start gateway");
      setError(message);
      setStatus((current) => ({
        ...current,
        state: "error",
        error: message,
      }));
      setLogs((current) =>
        appendLogLine(current, {
          line: message,
          level: "error",
          timestamp: new Date().toISOString(),
        }),
      );
    } finally {
      setStarting(false);
    }
  }, [status.port]);

  const stop = useCallback(async () => {
    setStopping(true);
    setError(null);

    try {
      await invoke("stop_gateway");
    } catch (err) {
      setError(errorMessage(err, "Failed to stop gateway"));
    } finally {
      setStopping(false);
    }
  }, []);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  return {
    status,
    logs,
    loading,
    starting,
    stopping,
    error,
    start,
    stop,
    clearLogs,
    refresh,
  };
}
