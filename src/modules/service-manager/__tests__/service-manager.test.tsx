import { render, screen, waitFor } from "@testing-library/react";
import { renderHook, act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ServiceManagerStep } from "../ServiceManagerStep";
import { useServiceManagerStatus } from "../useServiceManagerStatus";
import type { GatewayLog, GatewayStatus } from "../types";

const { invokeMock, listenMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  listenMock: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: listenMock,
}));

describe("service-manager module", () => {
  beforeEach(() => {
    vi.useRealTimers();
    invokeMock.mockReset();
    listenMock.mockReset();
  });

  it("loads current gateway status", async () => {
    const handlers = new Map<string, (event: { payload: GatewayStatus | GatewayLog }) => void>();
    listenMock.mockImplementation((name: string, cb: (event: { payload: GatewayStatus | GatewayLog }) => void) => {
      handlers.set(name, cb);
      return Promise.resolve(() => {});
    });

    invokeMock.mockImplementation((command: string) => {
      if (command === "get_gateway_status") {
        return Promise.resolve({
          state: "stopped",
          pid: null,
          port: 18789,
          uptime_secs: null,
          error: null,
        });
      }
      return Promise.resolve(true);
    });

    const { result } = renderHook(() => useServiceManagerStatus());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.status.state).toBe("stopped");
    expect(handlers.has("gateway:status")).toBe(true);
  });

  it("caps log buffer to 1000 lines", async () => {
    let logHandler: ((event: { payload: GatewayLog }) => void) | undefined;

    listenMock.mockImplementation((name: string, cb: (event: { payload: GatewayStatus | GatewayLog }) => void) => {
      if (name === "gateway:log") {
        logHandler = cb as (event: { payload: GatewayLog }) => void;
      }
      return Promise.resolve(() => {});
    });

    invokeMock.mockResolvedValue({
      state: "stopped",
      pid: null,
      port: 18789,
      uptime_secs: null,
      error: null,
    });

    const { result } = renderHook(() => useServiceManagerStatus());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      for (let index = 0; index < 1005; index += 1) {
        logHandler?.({
          payload: {
            line: `line-${index}`,
            level: "info",
            timestamp: new Date().toISOString(),
          },
        });
      }
    });

    expect(result.current.logs).toHaveLength(1000);
    expect(result.current.logs[0]?.line).toBe("line-5");
  });

  it("disables continue while gateway is not running", async () => {
    listenMock.mockResolvedValue(() => {});
    invokeMock.mockResolvedValue({
      state: "stopped",
      pid: null,
      port: 18789,
      uptime_secs: null,
      error: null,
    });

    render(<ServiceManagerStep onContinue={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("stopped")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  });

  it("does not run automatic health_check polling from the frontend", async () => {
    listenMock.mockResolvedValue(() => {});

    invokeMock.mockImplementation((command: string) => {
      if (command === "get_gateway_status") {
        return Promise.resolve({
          state: "running",
          pid: 999,
          port: 18789,
          uptime_secs: 10,
          error: null,
        });
      }

      return Promise.resolve(undefined);
    });

    renderHook(() => useServiceManagerStatus());
    await waitFor(() => {
      expect(invokeMock.mock.calls.some(([name]) => name === "get_gateway_status")).toBe(true);
    });

    expect(invokeMock.mock.calls.filter(([name]) => name === "health_check")).toHaveLength(0);
  });

  it("keeps start failure message and appends error log line", async () => {
    listenMock.mockResolvedValue(() => {});

    invokeMock.mockImplementation((command: string) => {
      if (command === "get_gateway_status") {
        return Promise.resolve({
          state: "stopped",
          pid: null,
          port: 18789,
          uptime_secs: null,
          error: null,
        });
      }
      if (command === "get_openclaw_status") {
        return Promise.resolve({
          installed: true,
          version: "2026.2.1",
          binary_path: "/usr/local/bin/openclaw",
        });
      }
      if (command === "get_node_env" || command === "load_api_keys") {
        return Promise.resolve({});
      }
      if (command === "start_gateway") {
        return Promise.reject("spawn failed: permission denied");
      }
      return Promise.resolve(undefined);
    });

    const { result } = renderHook(() => useServiceManagerStatus());
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.error).toBe("spawn failed: permission denied");
    expect(result.current.logs.at(-1)?.line).toContain("spawn failed: permission denied");
    expect(result.current.logs.at(-1)?.level).toBe("error");
  });
});
