# OpenClawini

OpenClawini is a cross-platform desktop app (Tauri + React) that helps users install, configure, and run OpenClaw without terminal setup.

[简体中文 README](./README.zh-CN.md)

## Project Status (2026-02-09)

All planned product modules in `spec.md` are implemented in the current codebase:

- F0 App Shell
- F1 Platform Detection
- F2 Node.js Runtime Manager
- F3 OpenClaw Installer
- F4 LLM Configuration
- F5 Service Manager
- F6 Browser Launcher

The frontend and backend contract status table is tracked in `contract.md`.

## Supported Features

| Feature | Current Support |
|---|---|
| Setup wizard | 6-step first-run flow: Platform -> Node Runtime -> OpenClaw Install -> LLM Config -> Gateway Launch -> Browser |
| Main app shell | Sidebar pages: Home, Configuration, Logs, System |
| Platform checks (F1) | OS/arch/version detection + disk/write/network prerequisite checks |
| Node runtime (F2) | Node 22.16.0 status detection, install/reinstall, progress events, runtime env export |
| OpenClaw installer (F3) | Install/update OpenClaw, stream install logs, check latest version |
| LLM config (F4) | Provider/model selection and config save to `~/.openclaw/openclaw.json`; API keys stored in app data |
| Gateway control (F5) | Start/stop gateway, status transitions, health checks, live log streaming |
| Browser launcher (F6) | Open WebChat URL (`http://127.0.0.1:18789`) and copy URL in UI |

## Tech Stack

- Tauri v2 (Rust backend)
- React 19 + TypeScript
- Tailwind CSS v4
- Vite
- Vitest + React Testing Library
- pnpm

## Local Development

### Prerequisites

- Node.js + pnpm
- Rust toolchain (`cargo`)
- Tauri v2 OS prerequisites
- Host tools used by backend runtime operations:
  - macOS/Linux: `curl`, `tar`, and `unzip` (or `python3 -m zipfile`)
  - Windows: PowerShell

### Install dependencies

```bash
pnpm install
```

### Run app

```bash
./scripts/dev.sh
```

### Run checks

```bash
./scripts/test.sh
./scripts/lint.sh
```

## Contribution Guide

### 1. Start with design docs

1. Read `spec.md`
2. Read `contract.md`
3. Read implementation notes in `AGENTS.md`

### 2. Respect ownership boundaries

- Frontend scope: `src/`
- Backend scope: `src-tauri/`
- Shared docs: `spec.md`, `contract.md`, `AGENTS.md`, `README.md`, `README.zh-CN.md`

### 3. Contract-first for API changes

When adding/changing a command/event/type:

1. Update `contract.md` first
2. Implement backend command/event/type
3. Implement frontend `invoke`/`listen` integration
4. Add or update tests

### 4. Run required checks before pushing

- Frontend-only changes: `./scripts/test-frontend.sh`
- Backend-only changes: `./scripts/test-backend.sh`
- Before merge/push:
  - `./scripts/test.sh`
  - `./scripts/lint.sh`

### 5. Update tracking docs with your change

- Update `contract.md` status table if completion state changes
- Add implementation memory notes in `AGENTS.md` when you learn new constraints or pitfalls

## Key Files

- Product behavior: `spec.md`
- Frontend-backend API contract: `contract.md`
- Two-agent workflow and implementation memory: `AGENTS.md`
- Project setup and conventions: `CLAUDE.md`
