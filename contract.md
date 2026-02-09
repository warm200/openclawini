# contract.md — Frontend ↔ Backend Interface

This is the single source of truth for all communication between the frontend (React/TypeScript) and backend (Rust/Tauri). Both agents **must read this file** before implementing any feature, and **must update this file** when adding new commands, events, or types.

## How to Use This File

1. Before starting a feature, check if the contract already defines commands for it.
2. If not, add the command/event/type definitions here FIRST, then implement.
3. Frontend calls backend via `invoke("command_name", { args })`.
4. Backend emits events to frontend via `app_handle.emit("event_name", payload)`.
5. Frontend listens to events via `listen("event_name", callback)`.

---

## Commands

### F1: Platform Detection

#### `detect_os`
```
invoke("detect_os") → PlatformInfo
```
No arguments. Returns the user's OS, architecture, and OS version.

#### `check_prerequisites`
```
invoke("check_prerequisites") → PrereqCheck[]
```
No arguments. Checks disk space, write permissions, and network connectivity. Returns an array of check results.

---

### F2: Node.js Runtime

#### `get_node_status`
```
invoke("get_node_status") → NodeStatus
```
No arguments. Returns whether Node.js is installed, its version, and binary paths.

#### `install_node`
```
invoke("install_node", { os: string, arch: string }) → NodeStatus
```
Downloads and extracts Node.js for the given platform. Emits `node:progress` events during download. Returns the final status on completion.

#### `get_node_env`
```
invoke("get_node_env") → Record<string, string>
```
No arguments. Returns environment variables (PATH etc.) needed to run Node.js processes.

---

### F3: OpenClaw Installer

#### `get_openclaw_status`
```
invoke("get_openclaw_status") → OpenClawStatus
```
No arguments. Returns whether OpenClaw is installed, its version, and binary path.

#### `install_openclaw`
```
invoke("install_openclaw") → OpenClawStatus
```
No arguments. Runs `npm install -g openclaw@latest` using bundled Node.js. Emits `openclaw:install-progress` events. Returns status on completion.

#### `check_openclaw_update`
```
invoke("check_openclaw_update") → UpdateInfo
```
No arguments. Compares installed version against npm registry.

#### `update_openclaw`
```
invoke("update_openclaw") → OpenClawStatus
```
No arguments. Same as `install_openclaw` — installs latest version.

---

### F4: LLM Configuration

#### `list_providers`
```
invoke("list_providers") → ProviderInfo[]
```
No arguments. Returns the list of supported LLM providers with their models.

#### `get_llm_config_state`
```
invoke("get_llm_config_state") → LlmConfigState
```
No arguments. Returns current configuration: selected provider, model, whether a key is stored.

#### `save_llm_config`
```
invoke("save_llm_config", { provider: string, model: string, apiKey?: string }) → void
```
Writes model to `~/.openclaw/openclaw.json` and stores API key in `<app_data>/keys.json`.
`apiKey` is optional and no backend key-validation command is required before saving.

#### `load_api_keys`
```
invoke("load_api_keys") → Record<string, string>
```
No arguments. Returns stored API keys as a map (env var name → key value). Used by F5 to pass env vars to the OpenClaw process.

---

### F5: Service Manager

#### `start_gateway`
```
invoke("start_gateway", { openclawPath: string, port: number, envVars: Record<string, string> }) → void
```
Spawns the OpenClaw gateway process. Emits `gateway:status` and `gateway:log` events. The caller is responsible for assembling `envVars` from `get_node_env()` + `load_api_keys()`.

#### `stop_gateway`
```
invoke("stop_gateway") → void
```
No arguments. Stops the running gateway process (SIGTERM → wait 5s → SIGKILL).

#### `get_gateway_status`
```
invoke("get_gateway_status") → GatewayStatus
```
No arguments. Returns current gateway state.

#### `health_check`
```
invoke("health_check", { port: number }) → boolean
```
HTTP GET to `http://127.0.0.1:{port}/`. Returns true if 2xx response.
Implementation note: backend runs this probe in a background worker/subprocess with a short timeout so the UI thread remains responsive during periodic polling.

---

### F6: Browser Launcher

#### `open_webchat`
```
invoke("open_webchat", { port: number }) → void
```
Opens `http://127.0.0.1:{port}` in the user's default browser.

---

## Events

Events are emitted by the backend and listened to by the frontend.

| Event Name | Payload Type | Emitter | Description |
|------------|-------------|---------|-------------|
| `node:progress` | `InstallProgress` | `install_node` | Download/extract progress for Node.js |
| `openclaw:install-progress` | `InstallProgress` | `install_openclaw` | npm install progress for OpenClaw |
| `gateway:status` | `GatewayStatus` | `start_gateway`, `stop_gateway` | Gateway state transitions |
| `gateway:log` | `GatewayLog` | `start_gateway` | Per-line stdout/stderr from gateway |

---

## Shared Types

These types are used in commands and events above. Frontend defines them in TypeScript, backend defines them in Rust with `Serialize`/`Deserialize`.

### PlatformInfo
```typescript
{
  os: "macos" | "windows" | "linux"
  arch: "x64" | "arm64"
  os_version: string           // e.g. "14.5", "10.0.22631"
}
```

### PrereqCheck
```typescript
{
  name: string                 // "disk_space" | "writable_data_dir" | "network"
  passed: boolean
  detail: string               // "12 GB free" or "Cannot write to /path"
}
```

### NodeStatus
```typescript
{
  installed: boolean
  version: string | null       // "22.16.0"
  node_path: string | null     // full path to node binary
  npm_path: string | null      // full path to npm binary
}
```

### InstallProgress
```typescript
{
  stage: string                // "downloading" | "extracting" | "verifying" | "installing"
  percent: number | null       // 0.0–1.0, null if indeterminate
  detail: string               // "42 MB / 60 MB" or npm output line
}
```

### OpenClawStatus
```typescript
{
  installed: boolean
  version: string | null       // "1.2.3"
  binary_path: string | null
}
```

### UpdateInfo
```typescript
{
  installed_version: string
  latest_version: string
  update_available: boolean
}
```

### ProviderInfo
```typescript
{
  id: string                   // "anthropic"
  display_name: string         // "Anthropic (Claude)"
  requires_api_key: boolean
  env_var: string | null       // "ANTHROPIC_API_KEY"
  models: ModelInfo[]
}
```

### ModelInfo
```typescript
{
  id: string                   // "anthropic/claude-sonnet-4-5-20250929"
  display_name: string         // "Claude Sonnet 4.5"
  is_default: boolean
}
```

### LlmConfigState
```typescript
{
  selected_provider: string | null
  selected_model: string | null
  has_api_key: boolean
}
```

### GatewayStatus
```typescript
{
  state: "stopped" | "starting" | "running" | "stopping" | "error"
  pid: number | null
  port: number
  uptime_secs: number | null
  error: string | null
}
```

### GatewayLog
```typescript
{
  line: string
  level: "info" | "warn" | "error" | "stdout" | "stderr"
  timestamp: string            // ISO 8601
}
```

---

## Status

Track which features have been implemented.

| Feature | Contract Defined | Backend Done | Frontend Done |
|---------|-----------------|-------------|--------------|
| F1: Platform Detection | Yes | Yes | Yes |
| F2: Node.js Runtime | Yes | Yes | Yes |
| F3: OpenClaw Installer | Yes | Yes | Yes |
| F4: LLM Configuration | Yes | Yes | Yes |
| F5: Service Manager | Yes | Yes | Yes |
| F6: Browser Launcher | Yes | Yes | Yes |
| F0: App Shell | — | — | Yes |
