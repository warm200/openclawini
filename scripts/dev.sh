#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "Starting OpenClawini development server..."
pnpm tauri dev
