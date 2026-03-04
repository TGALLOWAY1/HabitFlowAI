#!/usr/bin/env bash
# CI-like verification: tests, typecheck, lint.
# Usage: ./scripts/verify.sh  or  npm run verify
set -e

cd "$(dirname "$0")/.."

echo "=== 1. Typecheck (tsc -b) ==="
npx tsc -b

echo ""
echo "=== 2. Lint (eslint) ==="
npm run lint

echo ""
echo "=== 3. Test suite (vitest run) ==="
npm run test:run

echo ""
echo "=== verify: all steps passed ==="
