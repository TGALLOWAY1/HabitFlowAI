#!/usr/bin/env bash
# Usage: ./scripts/migrate-theme-tokens.sh <file1> <file2> ...
# Applies the mechanical Tailwind-class → semantic-token migration in place.
# INTENDED ONLY FOR THIS PR. Not a long-running script.
#
# After running on a file, ALWAYS review the diff — category color classes
# (bg-emerald-500 on a category chip), and context-sensitive patterns
# (text-neutral-900 NOT on an accent bg) will need hand correction.

set -euo pipefail

for f in "$@"; do
  if [[ ! -f "$f" ]]; then
    echo "skip (not a file): $f" >&2
    continue
  fi

  # Use a marker-based approach so chained replacements don't double-apply
  # (e.g. bg-neutral-900 -> bg-surface-0, but bg-surface-0 should NOT
  # match a later rule for bg-neutral). sed -i '' for BSD sed on macOS.
  sed -i '' \
    -e 's/bg-neutral-900/bg-surface-0/g' \
    -e 's/bg-neutral-800\/50/bg-surface-1\/50/g' \
    -e 's/bg-neutral-800\/80/bg-surface-1\/80/g' \
    -e 's/bg-neutral-800/bg-surface-1/g' \
    -e 's/bg-neutral-700/bg-surface-2/g' \
    -e 's/bg-neutral-600/bg-surface-2/g' \
    -e 's/hover:bg-neutral-800/hover:bg-surface-2/g' \
    -e 's/hover:bg-neutral-700/hover:bg-surface-2/g' \
    -e 's/hover:bg-white\/10/hover:bg-surface-2/g' \
    -e 's/hover:bg-white\/5/hover:bg-surface-2/g' \
    -e 's/text-white/text-content-primary/g' \
    -e 's/text-neutral-100/text-content-primary/g' \
    -e 's/text-neutral-200/text-content-primary/g' \
    -e 's/text-neutral-300/text-content-secondary/g' \
    -e 's/text-neutral-400/text-content-secondary/g' \
    -e 's/text-neutral-500/text-content-muted/g' \
    -e 's/text-neutral-600/text-content-muted/g' \
    -e 's/hover:text-white/hover:text-content-primary/g' \
    -e 's/hover:text-neutral-200/hover:text-content-primary/g' \
    -e 's/hover:text-neutral-300/hover:text-content-secondary/g' \
    -e 's/hover:text-neutral-400/hover:text-content-secondary/g' \
    -e 's/border-white\/5/border-line-subtle/g' \
    -e 's/border-white\/10/border-line-subtle/g' \
    -e 's/border-white\/20/border-line-strong/g' \
    -e 's/border-neutral-700/border-line-strong/g' \
    -e 's/border-neutral-800/border-line-subtle/g' \
    -e 's/border-neutral-600/border-line-strong/g' \
    -e 's/ring-emerald-500\/50/ring-focus\/50/g' \
    -e 's/ring-emerald-500\/30/ring-focus\/30/g' \
    -e 's/hover:bg-emerald-400/hover:bg-accent-strong/g' \
    -e 's/hover:bg-emerald-500/hover:bg-accent-strong/g' \
    -e 's/bg-emerald-500\/10/bg-accent-soft/g' \
    -e 's/bg-emerald-500\/15/bg-accent-soft/g' \
    -e 's/bg-emerald-500\/20/bg-accent-soft/g' \
    -e 's/border-emerald-500\/30/border-accent\/30/g' \
    -e 's/border-emerald-500\/20/border-accent\/20/g' \
    -e 's/text-emerald-300/text-accent-contrast/g' \
    -e 's/text-emerald-400/text-accent-contrast/g' \
    -e 's/hover:text-emerald-400/hover:text-accent-contrast/g' \
    "$f"

  echo "migrated: $f"
done
