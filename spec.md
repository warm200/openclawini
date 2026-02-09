# OpenClawini — Product Specification

## Vision

A cross-platform desktop app that helps non-technical users install, configure, and run [OpenClaw](./openclaw/) on their machine. No terminal, no manual setup. Walk through a wizard, pick your AI model, and start chatting.

## Tech Stack

- **Desktop shell:** Tauri v2 (Rust backend)
- **Frontend:** React 19 + TypeScript, Tailwind CSS v4, Vite
- **Testing:** Vitest + React Testing Library (frontend), `cargo test` (backend)
- **Package manager:** pnpm
- **Theme color:** `#fa5e55`

## OpenClaw Reference

The OpenClaw source is in `./openclaw/` (read-only reference). Key facts:

- Requires **Node.js >= 22.12.0**
- Install: `npm install -g openclaw@latest`
- Config file: `~/.openclaw/openclaw.json`
- Gateway command: `openclaw gateway --port 18789`
- Default port: **18789**, bind mode: `loopback` (127.0.0.1 only)
- Minimal config:
  ```json5
  {
    "agent": { "model": "anthropic/claude-sonnet-4-5-20250929" }
  }
  ```
- Supported LLM providers: Anthropic, OpenAI, Ollama, Bedrock, GitHub Copilot, and more
- API keys passed as environment variables (e.g. `ANTHROPIC_API_KEY`)

---

## App Flow

```
┌──────────────────────────────────────────────┐
│             Setup Wizard (first run)         │
│                                              │
│  Step 1: Platform Check                      │
│    → Detect OS/arch, verify prerequisites    │
│                                              │
│  Step 2: Install Node.js Runtime             │
│    → Download portable latest stable Node.js │
│                                              │
│  Step 3: Install OpenClaw                    │
│    → npm install -g openclaw@latest          │
│                                              │
│  Step 4: Configure AI Model                  │
│    → Pick provider, enter API key            │
│                                              │
│  Step 5: Launch                              │
│    → Start gateway, open browser to WebChat  │
│                                              │
└──────────────────────────────────────────────┘
           │
           ▼ (after first-time setup)
┌──────────────────────────────────────────────┐
│              Main App                        │
│  ┌────────┐  ┌───────────────────────────┐   │
│  │ Sidebar│  │ Content Area              │   │
│  │        │  │                           │   │
│  │ Home   │  │  Gateway controls         │   │
│  │ Config │  │  Start / Stop buttons     │   │
│  │ Logs   │  │  Live log viewer          │   │
│  │ About  │  │                           │   │
│  └────────┘  └───────────────────────────┘   │
│  ┌────────────────────────────────────────┐  │
│  │ Status Bar: gateway status │ version   │  │
│  └────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘
```

---

## Features

### F1: Platform Detection

Detect the user's OS, CPU architecture, and OS version. Run prerequisite checks before allowing installation.

**Behavior:**
- Automatically detect: OS (`macos` / `windows` / `linux`), arch (`x64` / `arm64`), OS version
- Check prerequisites:
  - **Disk space:** >= 500 MB free on the volume containing app data
  - **Write permission:** Can write to Tauri's `app_data_dir`
  - **Network:** Can reach `https://nodejs.org` (needed for Node.js download)
- Show results as a checklist with pass/fail for each item
- Block proceeding if any check fails; show actionable error message

**Implementation notes:**
- OS/arch: `std::env::consts::OS`, `std::env::consts::ARCH`
- OS version: macOS `sw_vers`, Windows registry, Linux `uname -r`
- Network check: HTTP HEAD to `https://nodejs.org` with 5s timeout

---

### F2: Node.js Runtime Manager

Download and manage a portable Node.js binary. Users never install Node.js themselves.

**Behavior:**
- Download official Node.js binary for detected OS/arch
- Use the **latest stable** Node.js version at install time (must satisfy minimum runtime requirement `>=22`)
- Extract to `<app_data_dir>/node/`
- Show download progress bar with percentage and bytes transferred
- Verify with `node --version` after extraction
- Progress reaches 100% when verification completes successfully
- Skip download if already installed (show version, allow reinstall)
- Node.js is only used internally — not added to user's system PATH

**Download matrix:**

| OS | Arch | URL | Format |
|----|------|-----|--------|
| macos | arm64 | `nodejs.org/dist/v{V}/node-v{V}-darwin-arm64.tar.gz` | tar.gz |
| macos | x64 | `nodejs.org/dist/v{V}/node-v{V}-darwin-x64.tar.gz` | tar.gz |
| windows | x64 | `nodejs.org/dist/v{V}/node-v{V}-win-x64.zip` | zip |
| windows | arm64 | `nodejs.org/dist/v{V}/node-v{V}-win-arm64.zip` | zip |
| linux | x64 | `nodejs.org/dist/v{V}/node-v{V}-linux-x64.tar.xz` | tar.xz |
| linux | arm64 | `nodejs.org/dist/v{V}/node-v{V}-linux-arm64.tar.xz` | tar.xz |

Fallback version (if latest lookup fails): `22.16.0`

**Environment construction:**
- Build a `PATH` env var that prepends `<app_data_dir>/node/bin/` (Unix) or `<app_data_dir>/node/` (Windows)
- This env is passed to any child process that needs Node (M3, M5)

---

### F3: OpenClaw Installer

Install and update OpenClaw using the bundled Node.js.

**Behavior:**
- Run `npm install -g openclaw@latest` using bundled Node.js
- Set `--prefix <app_data_dir>/openclaw_global` so install is app-contained
- Show npm output in a log area during install
- After install, verify with `openclaw --version`
- Track installed version
- Check for updates: compare installed version against `npm view openclaw version`
- Show update banner when newer version available
- "Update Now" button runs the same install command

**Binary locations:**
- Unix: `<app_data_dir>/openclaw_global/bin/openclaw`
- Windows: `<app_data_dir>/openclaw_global/openclaw.cmd`

---

### F4: LLM Configuration

Let users pick their LLM provider, select a model, enter API keys, and save config.

**Behavior:**
- Show provider cards: Anthropic, OpenAI, Ollama
- User clicks a provider → show model selector for that provider
- If provider requires an API key, show optional password input
- "Save" writes model choice to `~/.openclaw/openclaw.json` and stores API key in `<app_data_dir>/keys.json`
- User can continue with or without API key filled

**Providers:**

| Provider | Models | Key Required | Env Var | Validation Endpoint |
|----------|--------|-------------|---------|-------------------|
| Anthropic | claude-sonnet-4-5-20250929, claude-opus-4-6 | Yes | `ANTHROPIC_API_KEY` | POST `api.anthropic.com/v1/messages` |
| OpenAI | gpt-4o, gpt-4o-mini | Yes | `OPENAI_API_KEY` | GET `api.openai.com/v1/models` |
| Ollama | llama3.2, mistral | No | — | GET `127.0.0.1:11434/api/tags` |

**Config format** (`~/.openclaw/openclaw.json`):
```json5
{
  "agent": {
    "model": "anthropic/claude-sonnet-4-5-20250929"
  }
}
```

**Key storage** (`<app_data_dir>/keys.json`):
```json
{
  "ANTHROPIC_API_KEY": "sk-ant-..."
}
```

Keys are passed as env vars to the OpenClaw process at start time (F5), never written to `openclaw.json`.

---

### F5: Service Manager

Start/stop the OpenClaw gateway and stream live logs to the UI.

**Behavior:**
- **Start:** Spawn `openclaw gateway --port 18789 --verbose` as child process
  - Build env: system env + Node PATH (from F2) + API keys (from F4)
  - Stream stdout/stderr to UI in real time
  - Poll health endpoint until gateway responds
- **Stop:** SIGTERM (Unix) / TerminateProcess (Windows), wait 5s, then SIGKILL
- **Status:** stopped → starting → running → stopping → stopped (or error)
- **Health check:** HTTP GET `http://127.0.0.1:18789/` every 2s while running
- **Performance requirement:** health checks must not block the UI thread
  - Backend executes probes in a background worker (or subprocess with timeout) and returns quickly to the frontend
  - Frontend should keep controls interactive while checks are in-flight

**Log viewer:**
- Monospace font, dark background
- Color by level: white=info, yellow=warn, red=error
- Auto-scroll to bottom (pause when user scrolls up)
- Buffer last 1000 lines, drop oldest
- "Clear" button

**Controls:**
- "Start" button (green `bg-brand`) when stopped
- "Stop" button (red) when running
- Both disabled during transitions (starting/stopping)
- Status badge: gray=stopped, yellow=starting, green=running, red=error

---

### F6: Browser Launcher

Open the user's default browser to the OpenClaw WebChat.

**Behavior:**
- "Open WebChat" button opens `http://127.0.0.1:18789` in default browser
- Uses Tauri's shell plugin for cross-platform browser opening
- Show the URL as copyable text below the button
- In wizard: this is the final step ("OpenClaw is ready! Open WebChat")
- In main app: available as a button on the home page

---

### F7: Installation Path Manager

Allow users to choose where OpenClawini stores runtime data (Node runtime, OpenClaw global install, keys, logs/state files managed under app data).

**Behavior:**
- Default path is Tauri `app_data_dir`
- User can choose a custom absolute path
- Backend validates the selected path is writable before saving
- User can reset back to default path
- After setting path, subsequent backend operations use the selected effective path

---

### F0: App Shell

The outer layout that contains all features. Built after individual features are implemented.

**Behavior:**
- **First run:** Show setup wizard (steps 1–5, one per feature F1–F5+F6)
- **After setup:** Show main layout with sidebar navigation
- **Wizard:** Linear flow, each step has a "Continue" button gated on the step's completion condition
- **Sidebar pages:** Home (gateway controls + open browser), Configuration (LLM settings), Logs (full log viewer), System (platform info, Node version, OpenClaw version)
- **Status bar:** Gateway status indicator + OpenClaw version

---

## Directory Structure

```
src/                          # Frontend (React)
├── modules/
│   ├── app-shell/            # F0: layout, wizard, navigation
│   ├── platform/             # F1: OS detection, prereq checks
│   ├── node-runtime/         # F2: Node.js download/manage
│   ├── openclaw-installer/   # F3: OpenClaw install/update
│   ├── llm-config/           # F4: Provider/model/key config
│   ├── service-manager/      # F5: Start/stop, logs, health
│   └── browser-launcher/     # F6: Open browser
├── App.tsx
├── main.tsx
└── styles.css

src-tauri/src/                # Backend (Rust)
├── modules/
│   ├── platform/             # F1
│   ├── install_location/     # F7
│   ├── node_runtime/         # F2
│   ├── openclaw_installer/   # F3
│   ├── llm_config/           # F4
│   ├── service_manager/      # F5
│   └── browser_launcher/     # F6
├── lib.rs
└── main.rs
```

## Implementation Order

Features can be built in any order, but this order minimizes mocking:

```
F1 (Platform) → F2 (Node Runtime) → F3 (Installer) → F4 (LLM Config) → F5 (Service Manager) → F6 (Browser) → F0 (Shell)
```

For each feature: define the contract in `contract.md` first, then frontend and backend can be implemented in parallel.
