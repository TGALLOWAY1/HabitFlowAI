#!/usr/bin/env bash
# Theme-token drift guard.
#
# Scans a specific allowlist of "migrated" directories/files for raw
# dark-mode-only Tailwind classes that should have been converted to
# semantic theme tokens. Fails (exit 1) if any remain.
#
# Files OUTSIDE this allowlist are NOT checked — they're grandfathered
# and can continue to use raw neutral-/white- classes until they're
# migrated in a future PR.
#
# When migrating a new surface:
#   1. Fully convert it to semantic tokens.
#   2. Add its path to MIGRATED_GLOBS below.
#   3. Run `./scripts/check-theme-tokens.sh` locally.
#
# This script is intentionally grep-based so it runs anywhere without
# installing a custom ESLint plugin. If we add eslint-plugin-tailwindcss
# later, this becomes a delete.

set -euo pipefail

# Paths that MUST speak semantic tokens — no raw bg-neutral-*, text-neutral-*,
# bg-white/*, or border-white/* allowed.
MIGRATED_GLOBS=(
  "src/components/Layout.tsx"
  "src/components/BottomTabBar.tsx"
  "src/components/EmptyState.tsx"
  "src/components/Toast.tsx"
  "src/components/SettingsModal.tsx"
  "src/components/CategoryTabs.tsx"
  "src/components/TrackerGrid.tsx"
  "src/components/ProgressRings.tsx"
  "src/components/MomentumHeader.tsx"
  "src/components/CategoryMomentumBanner.tsx"
  "src/components/CategoryCompletionRow.tsx"
  "src/components/ProgressDashboard.tsx"
  "src/components/HeatmapLegend.tsx"
  "src/components/YearHeatmapGrid.tsx"
  "src/components/RecentHeatmapGrid.tsx"
  "src/components/dashboard"
  "src/components/day-view"
  "src/components/goals/GoalCard.tsx"
  "src/components/goals/GoalGridCard.tsx"
  "src/components/goals/GoalPulseCard.tsx"
  "src/components/goals/GoalTrendChart.tsx"
  "src/components/goals/GoalCumulativeChart.tsx"
  "src/components/goals/GoalSparkline.tsx"
  "src/components/goals/MiniHeatmap.tsx"
  "src/components/goals/GoalSharedComponents.tsx"
)

# Raw classes that are forbidden inside MIGRATED files. Extend cautiously.
# bg-neutral-500 is treated as a user-chosen data-encoding color (category
# palette), not a theme token — allowed. 600/700/800/900 are dark-only surfaces.
FORBIDDEN='\bbg-neutral-(600|700|800|900)\b|\btext-neutral-(600|700|800|900)\b|\bborder-neutral-(600|700|800|900)\b|\bbg-white\/[0-9]+\b|\bborder-white\/[0-9]+\b'

status=0
for glob in "${MIGRATED_GLOBS[@]}"; do
  if [[ -d "$glob" ]]; then
    files=$(find "$glob" -type f \( -name '*.tsx' -o -name '*.ts' \) ! -path '*__tests__*')
  elif [[ -f "$glob" ]]; then
    files="$glob"
  else
    echo "skip (missing): $glob" >&2
    continue
  fi

  for f in $files; do
    # Ignore commented-out lines (//, /* */, docstring examples)
    if grep -En "$FORBIDDEN" "$f" \
        | grep -Ev '^\s*[0-9]+:\s*(\*|//|/\*)' \
        | grep -Ev 'bg-to-text' \
        | head -5; then
      echo "  ^^^ raw theme-fragile classes found in $f (see above)"
      status=1
    fi
  done
done

if [[ $status -eq 0 ]]; then
  echo "theme-token check: OK"
fi
exit $status
