import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import App from "../App";

describe("App", () => {
  it("renders without crashing", () => {
    render(<App />);
    expect(document.getElementById("root") || document.body).toBeTruthy();
  });

  it("renders the main heading", () => {
    render(<App />);
    expect(screen.getByText("OpenClawini")).toBeInTheDocument();
  });

  it("renders the description text", () => {
    render(<App />);
    expect(
      screen.getByText("Bootstrap and run OpenClaw on your machine"),
    ).toBeInTheDocument();
  });
});
