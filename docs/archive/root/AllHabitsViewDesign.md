# Alternate "All Habits" View Design Note

## What Changed
- We now reuse `TrackerGrid` for the "All Habits" view instead of a checklist format.
- Added a horizontal, scrollable, multi-select category filter bar in the tracker header (when 'All Habits' is active), located in `App.tsx`.
- Drag-and-drop handles are automatically removed when rendering the All Habits list to prevent cross-category reordering bugs.

## How It Works
- The `TrackerGrid` component was updated to take an optional `disableReordering` prop. When true, the `<GripVertical />` icons are hidden.
- `App.tsx` now tracks `selectedCategoryIds` as a `Set<string>`. If the Set is empty, all categories are passed down. Otherwise, habits are filtered to the currently active chips.
- The entire 14-day history view, logic, sub-habits mechanics, and interactions from the standard Grid view remain completely identical.

## Assumptions Made
- The "All Categories" chip implicitly represents "no strict filters applied" (the `Set` is empty). Clicking "All Categories" clears the filter state.
- If we allowed drag-and-drop in this view, dropping a habit from Category A into Category B would just scramble the internal array. Disabling it was safer.

## UX Tradeoffs
- Because we reuse `TrackerGrid`, we regain the ability to easily tap checkmarks for the past 14 days without modifying dates manually, overcoming the prior limitation of the `DayHabitRow` layout.
- You do inevitably see the same 14 checkmark grid UI. The main benefit is seeing all habits at once and mixing categories, giving a broader top-down overview of the entire system.
