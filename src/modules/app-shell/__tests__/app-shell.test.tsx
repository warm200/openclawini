import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "../AppShell";

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

function mockInvoke(command: string): Promise<unknown> {
  if (command === "detect_os") {
    return Promise.resolve({ os: "macos", arch: "arm64", os_version: "15.0" });
  }
  if (command === "check_prerequisites") {
    return Promise.resolve([
      { name: "disk_space", passed: true, detail: "20 GB" },
      { name: "writable_data_dir", passed: true, detail: "ok" },
      { name: "network", passed: true, detail: "reachable" },
    ]);
  }
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
      version: "1.0.0",
      binary_path: "/tmp/openclaw",
    });
  }

  return Promise.resolve(undefined);
}

describe("app-shell module", () => {
  beforeEach(() => {
    localStorage.clear();
    invokeMock.mockReset();
    listenMock.mockReset();
    listenMock.mockResolvedValue(() => {});
    invokeMock.mockImplementation(mockInvoke);
  });

  it("shows setup wizard on first run", async () => {
    render(<AppShell />);

    await waitFor(() => {
      expect(screen.getByText("Setup Wizard")).toBeInTheDocument();
    });

    expect(screen.getByText("Step 1 of 6: Platform")).toBeInTheDocument();
  });

  it("shows main app when setup already completed", async () => {
    localStorage.setItem("openclawini.setup.complete", "yes");

    render(<AppShell />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Home" })).toBeInTheDocument();
    });

    expect(screen.getByText("OpenClaw version: 1.0.0")).toBeInTheDocument();
  });
});
