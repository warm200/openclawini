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
PASSED=0

echo -e "${BOLD}${CYAN}========================================${NC}"
echo -e "${BOLD}${CYAN}  OpenClawini — Full Test Suite${NC}"
echo -e "${BOLD}${CYAN}========================================${NC}"
echo ""

# --- Frontend Tests ---
echo -e "${CYAN}=== Frontend Tests ===${NC}"
echo ""
if pnpm vitest run --reporter=verbose 2>&1; then
  PASSED=$((PASSED + 1))
else
  FAILED=$((FAILED + 1))
fi
echo ""

# --- Backend Tests ---
echo -e "${CYAN}=== Backend Tests (Rust) ===${NC}"
echo ""
if cargo test --manifest-path src-tauri/Cargo.toml 2>&1; then
  PASSED=$((PASSED + 1))
else
  FAILED=$((FAILED + 1))
fi
echo ""

# --- Summary ---
echo -e "${BOLD}${CYAN}========================================${NC}"
echo -e "${BOLD}${CYAN}  Summary${NC}"
echo -e "${BOLD}${CYAN}========================================${NC}"

if [ "$FAILED" -gt 0 ]; then
  echo -e "${RED}FAILURE: ${FAILED} test suite(s) failed, ${PASSED} passed${NC}"
  exit 1
else
  echo -e "${GREEN}SUCCESS: All ${PASSED} test suites passed${NC}"
  exit 0
fi
