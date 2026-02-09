# OpenClawini

OpenClawini 是一个跨平台桌面应用（Tauri + React），目标是帮助非技术用户无需终端即可安装、配置并运行 OpenClaw。

[English README](./README.md)

## 当前状态快照（2026-02-09）

当前仓库处于早期开发阶段。

- 已实现：
  - Tauri 基础工程框架
  - React 落地页
  - 前端 `platform` 模块原型（`usePlatformStatus`、`PlatformStep`、`PlatformPage`）及测试
- 尚未实现：
  - `contract.md` 中 F1-F6 对应的后端命令
  - 完整安装向导与主界面（App Shell）

## 功能支持情况

功能定义来源于 `spec.md`。

| ID | 功能 | 支持状态 |
|---|---|---|
| F0 | App Shell（向导 + 侧边栏页面） | 计划中 |
| F1 | 平台检测 | 仅前端原型；后端未接入 |
| F2 | Node.js 运行时管理 | 计划中 |
| F3 | OpenClaw 安装器 | 计划中 |
| F4 | LLM 配置 | 计划中 |
| F5 | 服务管理 | 计划中 |
| F6 | 浏览器启动器 | 计划中 |

接口与命令约定见 `contract.md`。

## 技术栈

- Tauri v2（Rust 后端）
- React 19 + TypeScript
- Tailwind CSS v4
- Vite
- Vitest + React Testing Library
- pnpm

## 本地开发

### 前置依赖

- Node.js（用于前端工具链）
- pnpm
- Rust 工具链（`cargo`）
- 目标系统所需的 Tauri v2 构建依赖

### 安装依赖

```bash
pnpm install
```

### 启动开发环境

```bash
./scripts/dev.sh
```

### 校验

```bash
./scripts/test.sh
./scripts/lint.sh
```

## 贡献指南

### 1. 先读文档再开发

开始任何功能前：

1. 阅读 `spec.md`（行为和交互要求）
2. 阅读 `contract.md`（前后端命令/事件/类型）
3. 若 `contract.md` 缺少该功能定义，先补齐再写代码
4. 阅读 `AGENTS.md` 的 Implementation Memory

### 2. 遵守模块边界

- 前端负责：`src/`（不含 `src-tauri/`）
- 后端负责：`src-tauri/`
- 共享文档：`contract.md`、`AGENTS.md`

### 3. 推荐实现顺序

按照 `spec.md` 建议：

`F1 -> F2 -> F3 -> F4 -> F5 -> F6 -> F0`

### 4. 保持协议与实现同步

新增或变更命令/事件时：

1. 先更新 `contract.md`
2. 实现后端命令/事件/类型
3. 实现前端 `invoke` / `listen`
4. 补充或更新测试

### 5. 提交前必须执行

- 前端相关：
  - `./scripts/test-frontend.sh`
- 后端相关：
  - `./scripts/test-backend.sh`
- 合并前统一执行：
  - `./scripts/test.sh`
  - `./scripts/lint.sh`

### 6. 完成后更新追踪文档

- 在 `contract.md` 的 Status 表更新 Frontend/Backend Done
- 在 `AGENTS.md` 的 Implementation Memory 写入经验与注意事项

## 常用路径

- 产品规格：`spec.md`
- 前后端契约：`contract.md`
- 双 Agent 工作规则：`AGENTS.md`
- 项目约定：`CLAUDE.md`

