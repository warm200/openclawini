import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { PlatformInfo, PlatformStatus, PrereqCheck } from "./types";

export function usePlatformStatus(): PlatformStatus & { refresh: () => Promise<void> } {
  const [platform, setPlatform] = useState<PlatformInfo | null>(null);
  const [checks, setChecks] = useState<PrereqCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [platformInfo, prereqChecks] = await Promise.all([
        invoke<PlatformInfo>("detect_os"),
        invoke<PrereqCheck[]>("check_prerequisites"),
      ]);

      setPlatform(platformInfo);
      setChecks(prereqChecks);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to detect platform status");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const canContinue = useMemo(() => {
    if (checks.length === 0) {
      return false;
    }
    return checks.every((check) => check.passed);
  }, [checks]);

  return {
    platform,
    checks,
    loading,
    error,
    canContinue,
    refresh,
  };
}
