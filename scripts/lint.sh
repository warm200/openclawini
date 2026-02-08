#!/bin/bash
set -uo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

cd "$(dirname "$0")/.."

FAILED=0

echo -e "${BOLD}${CYAN}========================================${NC}"
echo -e "${BOLD}${CYAN}  OpenClawini — Lint & Type Check${NC}"
echo -e "${BOLD}${CYAN}========================================${NC}"
echo ""

# --- TypeScript type checking ---
echo -e "${CYAN}=== TypeScript Type Check ===${NC}"
echo ""
if pnpm tsc --noEmit 2>&1; then
  echo -e "${GREEN}TypeScript: OK${NC}"
else
  echo -e "${RED}TypeScript: FAILED${NC}"
  FAILED=$((FAILED + 1))
fi
echo ""

# --- Rust clippy (if available) ---
echo -e "${CYAN}=== Rust Check ===${NC}"
echo ""
if cargo check --manifest-path src-tauri/Cargo.toml 2>&1; then
  echo -e "${GREEN}Rust: OK${NC}"
else
  echo -e "${RED}Rust: FAILED${NC}"
  FAILED=$((FAILED + 1))
fi
echo ""

# --- Summary ---
echo -e "${BOLD}${CYAN}========================================${NC}"
if [ "$FAILED" -gt 0 ]; then
  echo -e "${RED}FAILURE: ${FAILED} check(s) failed${NC}"
  exit 1
else
  echo -e "${GREEN}SUCCESS: No lint errors${NC}"
  exit 0
fi
