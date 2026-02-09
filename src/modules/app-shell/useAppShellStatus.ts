import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { GatewayStatus } from "../service-manager";
import type { OpenClawStatus } from "../openclaw-installer";

export function useAppShellStatus(): {
  gatewayState: GatewayStatus["state"];
  openClawVersion: string;
  refresh: () => Promise<void>;
} {
  const [gatewayState, setGatewayState] = useState<GatewayStatus["state"]>("stopped");
  const [openClawVersion, setOpenClawVersion] = useState("unknown");

  const refresh = useCallback(async () => {
    try {
      const [gateway, openclaw] = await Promise.all([
        invoke<GatewayStatus>("get_gateway_status"),
        invoke<OpenClawStatus>("get_openclaw_status"),
      ]);
      setGatewayState(gateway.state);
      setOpenClawVersion(openclaw.version ?? "not installed");
    } catch {
      setGatewayState("error");
    }
  }, []);

  useEffect(() => {
    void refresh();
    let disposed = false;
    let unlisten: (() => void) | null = null;

    const onWindowFocus = () => {
      void refresh();
    };
    window.addEventListener("focus", onWindowFocus);
    document.addEventListener("visibilitychange", onWindowFocus);

    void listen<GatewayStatus>("gateway:status", (event) => {
      if (!disposed) {
        setGatewayState(event.payload.state);
      }
    }).then((nextUnlisten) => {
      unlisten = nextUnlisten;
      if (disposed) {
        nextUnlisten();
      }
    });

    return () => {
      disposed = true;
      window.removeEventListener("focus", onWindowFocus);
      document.removeEventListener("visibilitychange", onWindowFocus);
      if (unlisten) {
        unlisten();
      }
    };
  }, [refresh]);

  return { gatewayState, openClawVersion, refresh };
}
