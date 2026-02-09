import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { InstallProgress, NodeRuntimeState, NodeStatus } from "./types";
import type { PlatformArch, PlatformOs } from "../platform/types";

async function detectPlatform(): Promise<{ os: PlatformOs; arch: PlatformArch }> {
  const info = await invoke<{ os: PlatformOs; arch: PlatformArch }>("detect_os");
  return { os: info.os, arch: info.arch };
}

export function useNodeRuntimeStatus(): NodeRuntimeState & {
  refresh: () => Promise<void>;
  installNode: (os?: PlatformOs, arch?: PlatformArch) => Promise<void>;
} {
  const [status, setStatus] = useState<NodeStatus | null>(null);
  const [progress, setProgress] = useState<InstallProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const nextStatus = await invoke<NodeStatus>("get_node_status");
      setStatus(nextStatus);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load Node.js status");
    } finally {
      setLoading(false);
    }
  }, []);

  const installNode = useCallback(async (os?: PlatformOs, arch?: PlatformArch) => {
    setInstalling(true);
    setError(null);

    try {
      const platform = os && arch ? { os, arch } : await detectPlatform();
      const nextStatus = await invoke<NodeStatus>("install_node", platform);
      setStatus(nextStatus);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Node.js installation failed");
    } finally {
      setInstalling(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    let disposed = false;

    const setupListener = async () => {
      const unlisten = await listen<InstallProgress>("node:progress", (event) => {
        if (!disposed) {
          setProgress(event.payload);
        }
      });

      if (disposed) {
        unlisten();
      }

      return unlisten;
    };

    let unlistenRef: (() => void) | null = null;

    void setupListener().then((unlisten) => {
      unlistenRef = unlisten;
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
    progress,
    loading,
    installing,
    error,
    refresh,
    installNode,
  };
}
