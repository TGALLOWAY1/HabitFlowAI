#!/usr/bin/env bash
# Second-pass migration specifically for primary-accent button patterns.
# Run AFTER migrate-theme-tokens.sh. Targets the common pairings that
# appear after the initial pass: bg-emerald-500 + text-neutral-900/black,
# hover:bg-emerald-600 etc. Still leaves category-color emerald uses alone
# by requiring the specific textual pairing.

set -euo pipefail

for f in "$@"; do
  [[ -f "$f" ]] || { echo "skip (not a file): $f" >&2; continue; }

  sed -i '' \
    -e 's/bg-emerald-500 text-neutral-900/bg-accent text-content-on-accent/g' \
    -e 's/bg-emerald-500 text-black/bg-accent text-content-on-accent/g' \
    -e 's/text-neutral-900 bg-emerald-500/text-content-on-accent bg-accent/g' \
    -e 's/bg-emerald-500 border-emerald-500/bg-accent border-accent/g' \
    -e 's/bg-emerald-500 hover:bg-accent-strong/bg-accent hover:bg-accent-strong/g' \
    -e 's/bg-emerald-500 shadow/bg-accent shadow/g' \
    -e 's/hover:bg-emerald-600/hover:bg-accent-strong/g' \
    -e 's/hover:bg-emerald-400/hover:bg-accent-strong/g' \
    -e 's/border-emerald-500\/50/border-accent\/50/g' \
    -e 's/border-emerald-500\/40/border-accent\/40/g' \
    -e 's/border-emerald-500\/20/border-accent\/20/g' \
    -e 's/border-emerald-500\b/border-accent/g' \
    -e 's/focus:border-emerald-500/focus:border-focus/g' \
    -e 's/ring-emerald-500/ring-focus/g' \
    "$f"

  echo "accent-migrated: $f"
done
