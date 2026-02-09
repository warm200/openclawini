import { render, screen, waitFor } from "@testing-library/react";
import { renderHook, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LlmConfigStep } from "../LlmConfigStep";
import { useLlmStatus } from "../useLlmStatus";

const { invokeMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
}));

const providers = [
  {
    id: "anthropic",
    display_name: "Anthropic",
    requires_api_key: true,
    env_var: "ANTHROPIC_API_KEY",
    models: [{ id: "anthropic/claude-sonnet-4-5-20250929", display_name: "Claude", is_default: true }],
  },
  {
    id: "ollama",
    display_name: "Ollama",
    requires_api_key: false,
    env_var: null,
    models: [{ id: "ollama/llama3.2", display_name: "Llama 3.2", is_default: true }],
  },
];

describe("llm-config module", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    invokeMock.mockImplementation((command: string) => {
      if (command === "list_providers") {
        return Promise.resolve(providers);
      }
      if (command === "get_llm_config_state") {
        return Promise.resolve({
          selected_provider: "anthropic",
          selected_model: "anthropic/claude-sonnet-4-5-20250929",
          has_api_key: false,
        });
      }
      return Promise.resolve(undefined);
    });
  });

  it("loads provider data from backend", async () => {
    const { result } = renderHook(() => useLlmStatus());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.providers).toHaveLength(2);
    expect(result.current.selectedProviderId).toBe("anthropic");
  });

  it("allows no-key provider to continue immediately", async () => {
    render(<LlmConfigStep onContinue={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Anthropic")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Ollama No API key required" }));

    await waitFor(() => {
      expect(screen.getByText("This provider works without an API key.")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();
  });

  it("allows key-required provider to continue without validation", async () => {
    render(<LlmConfigStep onContinue={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Anthropic")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();
  });
});
