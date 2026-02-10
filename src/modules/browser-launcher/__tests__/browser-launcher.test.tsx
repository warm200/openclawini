import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { renderHook, act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BrowserLauncherStep } from "../BrowserLauncherStep";
import { useBrowserLauncherStatus } from "../useBrowserLauncherStatus";

const { invokeMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
}));

const writeTextMock = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
}));

describe("browser-launcher module", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    invokeMock.mockResolvedValue(undefined);
    writeTextMock.mockReset();

    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: writeTextMock },
    });
  });

  it("opens webchat through backend command", async () => {
    const { result } = renderHook(() => useBrowserLauncherStatus());

    await act(async () => {
      await result.current.openWebChat();
    });

    expect(invokeMock).toHaveBeenCalledWith("open_webchat", { port: 18789 });
  });

  it("shows url and handles copy action", async () => {
    render(<BrowserLauncherStep onFinish={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Copy URL" }));

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith("http://127.0.0.1:18789");
    });
  });

  it("shows pending copy state while clipboard write is running", async () => {
    let releaseWrite = () => {};
    writeTextMock.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          releaseWrite = () => {
            resolve();
          };
        }),
    );

    render(<BrowserLauncherStep onFinish={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Copy URL" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Copying..." })).toBeDisabled();
    });

    releaseWrite();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Copy URL" })).toBeEnabled();
    });
  });
});
