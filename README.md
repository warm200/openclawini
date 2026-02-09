# OpenClawini

OpenClawini is a cross-platform desktop app (Tauri + React) that helps non-technical users install, configure, and run OpenClaw without using a terminal.

[简体中文 README](./README.zh-CN.md)

## Status Snapshot (2026-02-09)

This repository is in early development.

- Implemented now:
  - Base Tauri app scaffold
  - React landing page
  - Frontend `platform` module prototype (`usePlatformStatus`, `PlatformStep`, `PlatformPage`) with tests
- Not implemented yet:
  - Backend commands defined in `contract.md` for F1-F6
  - Full setup wizard + post-setup app shell

## Feature Support

Feature definitions come from `spec.md`.

| ID | Feature | Support Status |
|---|---|---|
| F0 | App Shell (wizard + sidebar pages) | Planned |
| F1 | Platform Detection | Frontend prototype only; backend not connected |
| F2 | Node.js Runtime Manager | Planned |
| F3 | OpenClaw Installer | Planned |
| F4 | LLM Configuration | Planned |
| F5 | Service Manager | Planned |
| F6 | Browser Launcher | Planned |

For API/command contracts, see `contract.md`.

## Tech Stack

- Tauri v2 (Rust backend)
- React 19 + TypeScript
- Tailwind CSS v4
- Vite
- Vitest + React Testing Library
- pnpm

## Local Development

### Prerequisites

- Node.js (for frontend tooling)
- pnpm
- Rust toolchain (`cargo`)
- Tauri v2 build prerequisites for your OS

### Install

```bash
pnpm install
```

### Run

```bash
./scripts/dev.sh
```

### Validate

```bash
./scripts/test.sh
./scripts/lint.sh
```

## Contribution Guide

### 1. Read the design documents first

Before coding any feature:

1. Read `spec.md` for behavior and UX flow.
2. Read `contract.md` for frontend-backend API/events/types.
3. If your feature is missing in `contract.md`, add it first.
4. Read `AGENTS.md` Implementation Memory for known constraints.

### 2. Follow ownership boundaries

- Frontend ownership: `src/` (except `src-tauri/`)
- Backend ownership: `src-tauri/`
- Shared contract/docs: `contract.md`, `AGENTS.md`

### 3. Implement in this order

Recommended order from spec:

`F1 -> F2 -> F3 -> F4 -> F5 -> F6 -> F0`

### 4. Keep contract and implementation in sync

If you add/change commands or events:

1. Update `contract.md` first
2. Implement backend command/event/type
3. Implement frontend invoke/listen usage
4. Add/update tests

### 5. Run required checks before submitting

- Frontend scoped:
  - `./scripts/test-frontend.sh`
- Backend scoped:
  - `./scripts/test-backend.sh`
- Always before merge:
  - `./scripts/test.sh`
  - `./scripts/lint.sh`

### 6. Update tracking docs after finishing

- In `contract.md` Status table, mark Frontend/Backend done.
- In `AGENTS.md` Implementation Memory, add practical notes or pitfalls.

## Useful Paths

- Product spec: `spec.md`
- Frontend-backend contract: `contract.md`
- Agent workflow rules: `AGENTS.md`
- Project setup and conventions: `CLAUDE.md`

