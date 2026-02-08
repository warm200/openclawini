#!/bin/bash
set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

cd "$(dirname "$0")/.."

echo -e "${CYAN}=== Backend Tests (Rust) ===${NC}"
echo ""

if cargo test --manifest-path src-tauri/Cargo.toml 2>&1; then
  echo ""
  echo -e "${GREEN}SUCCESS: Backend tests passed${NC}"
  exit 0
else
  echo ""
  echo -e "${RED}FAILURE: Backend tests failed${NC}"
  exit 1
fi
