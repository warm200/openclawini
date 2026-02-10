import { useCallback, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

const DEFAULT_PORT = 18789;

export function useBrowserLauncherStatus(port = DEFAULT_PORT): {
  port: number;
  url: string;
  opening: boolean;
  copying: boolean;
  error: string | null;
  openWebChat: () => Promise<void>;
  copyUrl: () => Promise<void>;
} {
  const [opening, setOpening] = useState(false);
  const [copying, setCopying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const url = useMemo(() => `http://127.0.0.1:${port}`, [port]);

  const openWebChat = useCallback(async () => {
    setOpening(true);
    setError(null);
    try {
      await invoke("open_webchat", { port });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open browser");
    } finally {
      setOpening(false);
    }
  }, [port]);

  const copyUrl = useCallback(async () => {
    setCopying(true);
    setError(null);

    if (!navigator.clipboard) {
      setError("Clipboard API is not available");
      setCopying(false);
      return;
    }

    try {
      await navigator.clipboard.writeText(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to copy URL");
    } finally {
      setCopying(false);
    }
  }, [url]);

  return {
    port,
    url,
    opening,
    copying,
    error,
    openWebChat,
    copyUrl,
  };
}
