import { render, screen, waitFor } from "@testing-library/react";
import { renderHook, act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NodeRuntimeStep } from "../NodeRuntimeStep";
import { useNodeRuntimeStatus } from "../useNodeRuntimeStatus";
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

describe("node-runtime module", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    listenMock.mockReset();
  });

  it("loads status and consumes progress events", async () => {
    let handler: ((event: { payload: InstallProgress }) => void) | undefined;

    listenMock.mockImplementation((_name: string, cb: (event: { payload: InstallProgress }) => void) => {
      handler = cb;
      return Promise.resolve(() => {});
    });

    invokeMock.mockResolvedValue({ installed: false, version: null, node_path: null, npm_path: null });

    const { result } = renderHook(() => useNodeRuntimeStatus());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      handler?.({ payload: { stage: "downloading", percent: 0.5, detail: "30MB / 60MB" } });
    });

    expect(result.current.progress?.stage).toBe("downloading");
  });

  it("requires installation before continue", async () => {
    listenMock.mockResolvedValue(() => {});
    invokeMock.mockResolvedValue({ installed: false, version: null, node_path: null, npm_path: null });

    render(<NodeRuntimeStep onContinue={vi.fn()} os="macos" arch="arm64" />);

    await waitFor(() => {
      expect(screen.getByText("No")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  });
});
