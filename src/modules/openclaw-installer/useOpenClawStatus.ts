import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { InstallProgress, OpenClawStatus, UpdateInfo } from "./types";

function appendLog(current: string[], line: string): string[] {
  const next = [...current, line];
  if (next.length > 200) {
    return next.slice(next.length - 200);
  }
  return next;
}

export function useOpenClawStatus(): {
  status: OpenClawStatus | null;
  updateInfo: UpdateInfo | null;
  installLog: string[];
  loading: boolean;
  installing: boolean;
  checkingUpdate: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  install: () => Promise<void>;
  update: () => Promise<void>;
  checkUpdate: () => Promise<void>;
} {
  const [status, setStatus] = useState<OpenClawStatus | null>(null);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [installLog, setInstallLog] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkUpdate = useCallback(async () => {
    setCheckingUpdate(true);
    try {
      const next = await invoke<UpdateInfo>("check_openclaw_update");
      setUpdateInfo(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to check update");
    } finally {
      setCheckingUpdate(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const nextStatus = await invoke<OpenClawStatus>("get_openclaw_status");
      setStatus(nextStatus);
      if (nextStatus.installed) {
        await checkUpdate();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load OpenClaw status");
    } finally {
      setLoading(false);
    }
  }, [checkUpdate]);

  const runInstall = useCallback(async (command: "install_openclaw" | "update_openclaw") => {
    setInstalling(true);
    setError(null);
    try {
      const nextStatus = await invoke<OpenClawStatus>(command);
      setStatus(nextStatus);
      await checkUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "OpenClaw installation failed");
    } finally {
      setInstalling(false);
    }
  }, [checkUpdate]);

  const install = useCallback(async () => {
    await runInstall("install_openclaw");
  }, [runInstall]);

  const update = useCallback(async () => {
    await runInstall("update_openclaw");
  }, [runInstall]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    let disposed = false;
    let unlistenRef: (() => void) | null = null;

    void listen<InstallProgress>("openclaw:install-progress", (event) => {
      if (!disposed) {
        setInstallLog((current) => appendLog(current, event.payload.detail));
      }
    }).then((unlisten) => {
      unlistenRef = unlisten;
      if (disposed) {
        unlisten();
      }
    });

    return () => {
      disposed = true;
      if (unlistenRef) {
        unlistenRef();
      }
    };
  }, []);

  return {
    status,
    updateInfo,
    installLog,
    loading,
    installing,
    checkingUpdate,
    error,
    refresh,
    install,
    update,
    checkUpdate,
  };
}
