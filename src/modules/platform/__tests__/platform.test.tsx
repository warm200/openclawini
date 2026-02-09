import { render, screen, waitFor } from "@testing-library/react";
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PlatformStep } from "../PlatformStep";
import { usePlatformStatus } from "../usePlatformStatus";

const { invokeMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
}));

describe("platform module", () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it("loads platform + checks from backend", async () => {
    invokeMock.mockImplementation((command: string) => {
      if (command === "detect_os") {
        return Promise.resolve({ os: "macos", arch: "arm64", os_version: "15.0" });
      }
      return Promise.resolve([
        { name: "disk_space", passed: true, detail: "12 GB" },
        { name: "network", passed: true, detail: "reachable" },
      ]);
    });

    const { result } = renderHook(() => usePlatformStatus());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.platform?.os).toBe("macos");
    expect(result.current.canContinue).toBe(true);
  });

  it("disables continue when a prerequisite fails", async () => {
    invokeMock.mockImplementation((command: string) => {
      if (command === "detect_os") {
        return Promise.resolve({ os: "linux", arch: "x64", os_version: "6.12" });
      }
      return Promise.resolve([{ name: "disk_space", passed: false, detail: "only 100 MB" }]);
    });

    render(<PlatformStep onContinue={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("FAIL")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  });
});
