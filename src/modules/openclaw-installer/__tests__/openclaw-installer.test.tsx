import { render, screen, waitFor } from "@testing-library/react";
import { renderHook, act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OpenClawInstallerStep } from "../OpenClawInstallerStep";
import { useOpenClawStatus } from "../useOpenClawStatus";
import type { InstallProgress } from "../types";

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

describe("openclaw-installer module", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    listenMock.mockReset();
  });

  it("loads installer status and progress log", async () => {
    let handler: ((event: { payload: InstallProgress }) => void) | undefined;
    listenMock.mockImplementation((_event: string, cb: (event: { payload: InstallProgress }) => void) => {
      handler = cb;
      return Promise.resolve(() => {});
    });

    invokeMock.mockImplementation((command: string) => {
      if (command === "get_openclaw_status") {
        return Promise.resolve({ installed: true, version: "1.0.0", binary_path: "/tmp/openclaw" });
      }
      if (command === "check_openclaw_update") {
        return Promise.resolve({
          installed_version: "1.0.0",
          latest_version: "1.1.0",
          update_available: true,
        });
      }
      return Promise.resolve(null);
    });

    const { result } = renderHook(() => useOpenClawStatus());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      handler?.({ payload: { stage: "installing", percent: null, detail: "npm install" } });
    });

    expect(result.current.updateInfo?.update_available).toBe(true);
    expect(result.current.installLog[result.current.installLog.length - 1]).toBe("npm install");
  });

  it("enables continue only when installed", async () => {
    listenMock.mockResolvedValue(() => {});
    invokeMock.mockImplementation((command: string) => {
      if (command === "get_openclaw_status") {
        return Promise.resolve({ installed: false, version: null, binary_path: null });
      }
      return Promise.resolve({
        installed_version: "",
        latest_version: "",
        update_available: false,
      });
    });

    render(<OpenClawInstallerStep onContinue={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Not installed")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  });
});
