import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App";

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

describe("App", () => {
  beforeEach(() => {
    localStorage.clear();
    invokeMock.mockReset();
    listenMock.mockReset();

    listenMock.mockResolvedValue(() => {});

    invokeMock.mockImplementation((command: string) => {
      if (command === "detect_os") {
        return Promise.resolve({ os: "macos", arch: "arm64", os_version: "15.0" });
      }
      if (command === "check_prerequisites") {
        return Promise.resolve([
          { name: "disk_space", passed: true, detail: "10GB" },
          { name: "writable_data_dir", passed: true, detail: "ok" },
          { name: "network", passed: true, detail: "ok" },
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
          installed: false,
          version: null,
          binary_path: null,
        });
      }
      return Promise.resolve(undefined);
    });
  });

  it("renders setup wizard by default", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Prepare OpenClawini")).toBeInTheDocument();
    });
  });

  it("renders main control panel after setup completion", async () => {
    localStorage.setItem("openclawini.setup.complete", "yes");
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Control Panel")).toBeInTheDocument();
    });
  });
});
