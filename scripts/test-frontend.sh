#!/bin/bash
set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

cd "$(dirname "$0")/.."

echo -e "${CYAN}=== Frontend Tests ===${NC}"
echo ""

if pnpm vitest run --reporter=verbose 2>&1; then
  echo ""
  echo -e "${GREEN}SUCCESS: Frontend tests passed${NC}"
  exit 0
else
  echo ""
  echo -e "${RED}FAILURE: Frontend tests failed${NC}"
  exit 1
fi
