# OpenClawini

OpenClawini 是一个跨平台桌面应用（Tauri + React），帮助用户无需终端手动配置即可安装、配置并运行 OpenClaw。

[English README](./README.md)

## 项目状态（2026-02-09）

`spec.md` 规划的模块在当前代码中已全部落地：

- F0 App Shell
- F1 平台检测
- F2 Node.js 运行时管理
- F3 OpenClaw 安装器
- F4 LLM 配置
- F5 服务管理
- F6 浏览器启动器

前后端契约完成状态以 `contract.md` 的状态表为准。

## 已支持功能

| 功能 | 当前支持情况 |
|---|---|
| 首次安装向导 | 6 步流程：平台检查 -> Node 运行时 -> OpenClaw 安装 -> LLM 配置 -> 网关启动 -> 浏览器打开 |
| 主界面外壳 | 侧边栏页面：Home、Configuration、Logs、System |
| 平台检查（F1） | OS/架构/版本检测 + 磁盘/写权限/网络检查 |
| Node 运行时（F2） | Node 22.16.0 状态检测、安装/重装、进度事件、运行时环境导出 |
| OpenClaw 安装（F3） | 安装/更新 OpenClaw、安装日志流、最新版本检查 |
| LLM 配置（F4） | Provider/Model 选择并写入 `~/.openclaw/openclaw.json`；API Key 存储在应用数据目录 |
| 网关控制（F5） | 网关启动/停止、状态流转、健康检查、实时日志 |
| 浏览器启动（F6） | 打开 WebChat 地址（`http://127.0.0.1:18789`）并支持复制 |

## 技术栈

- Tauri v2（Rust 后端）
- React 19 + TypeScript
- Tailwind CSS v4
- Vite
- Vitest + React Testing Library
- pnpm

## 本地开发

### 前置依赖

- Node.js + pnpm
- Rust 工具链（`cargo`）
- 目标系统所需的 Tauri v2 构建依赖
- 后端运行时依赖的主机工具：
  - macOS/Linux：`curl`、`tar`、`unzip`（或 `python3 -m zipfile`）
  - Windows：PowerShell

### 安装依赖

```bash
pnpm install
```

### 启动应用

```bash
./scripts/dev.sh
```

### 运行检查

```bash
./scripts/test.sh
./scripts/lint.sh
```

## 贡献指南

### 1. 开发前先看文档

1. 阅读 `spec.md`
2. 阅读 `contract.md`
3. 阅读 `AGENTS.md` 中的实现经验记录

### 2. 遵守职责边界

- 前端范围：`src/`
- 后端范围：`src-tauri/`
- 共享文档：`spec.md`、`contract.md`、`AGENTS.md`、`README.md`、`README.zh-CN.md`

### 3. API 变更遵循 contract-first

新增或修改命令/事件/类型时：

1. 先更新 `contract.md`
2. 再实现后端命令/事件/类型
3. 再实现前端 `invoke`/`listen` 对接
4. 补齐或更新测试

### 4. 推送前必须执行检查

- 仅前端改动：`./scripts/test-frontend.sh`
- 仅后端改动：`./scripts/test-backend.sh`
- 合并/推送前：
  - `./scripts/test.sh`
  - `./scripts/lint.sh`

### 5. 变更后同步追踪文档

- 如果完工状态变化，更新 `contract.md` 状态表
- 如果发现新约束或坑点，补充到 `AGENTS.md` 的 Implementation Memory

## 关键文件

- 产品行为定义：`spec.md`
- 前后端契约：`contract.md`
- 双 Agent 协作流程和实现记忆：`AGENTS.md`
- 项目环境与约定：`CLAUDE.md`
