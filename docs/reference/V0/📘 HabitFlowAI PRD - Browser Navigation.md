> ⚠️ Status: Historical PRD (v0)
>
> This document reflects earlier design intent and may reference
> legacy concepts or naming (e.g., Activity, DayLog).
>
> Canonical behavior is defined in:
> /docs/canonical/Canonical Domain Rules.md


# Add Browser History Navigation for Main App Views

## Overview
Implements browser history navigation using the native History API, enabling users to navigate between main app views (Habit Tracking, Progress, Activities, Goals, Wins) using browser Back and Forward buttons.

## Problem
Previously, the app's view state was managed entirely in React state without URL synchronization. This meant:
- Browser Back/Forward buttons had no effect
- Users couldn't bookmark or share links to specific views
- Hard refreshes would always return to the default view
- Navigation history was lost when using browser navigation

## Solution
Implemented a lightweight routing mechanism that:
- Syncs the current view with URL query parameters (`?view=tracker`, `?view=progress`, etc.)
- Listens to browser `popstate` events to handle Back/Forward button clicks
- Pushes new history entries when users navigate between views
- Initializes the URL on first load if not present

## Changes Made

### 1. Route Type Definition
- Added `AppRoute` union type: `"tracker" | "progress" | "activities" | "goals" | "wins"`
- Provides type safety for all route values

### 2. URL Helper Functions
- `parseRouteFromLocation(location: Location): AppRoute`
  - Parses the current route from URL query parameter `view`
  - Returns `"tracker"` as default if no valid route is found
- `buildUrlForRoute(route: AppRoute): string`
  - Constructs a URL with the appropriate `view` query parameter
  - Preserves other existing query parameters

### 3. State Initialization
- Updated `view` state to initialize from URL on mount:
  ```ts
  const [view, setView] = useState<AppRoute>(() => parseRouteFromLocation(window.location));
  ```
- Added `useEffect` to ensure URL has `view` param on initial load (uses `replaceState` to avoid adding to history)

### 4. Browser History Integration
- Added `popstate` event listener to handle Back/Forward navigation
- Created `handleNavigate(route: AppRoute)` function that:
  - Updates React state
  - Pushes new entry to browser history using `window.history.pushState()`

### 5. Navigation Updates
- Replaced all direct `setView()` calls with `handleNavigate()` throughout the component
- Updated navigation buttons (Tracker, Progress, Activities, Goals)
- Updated all callback functions that trigger view changes (goal flows, completed goals, etc.)

## Technical Details

### Implementation Approach
- **No external dependencies**: Uses native browser `History API` instead of a router library
- **Lightweight**: Minimal code changes, no bundle size increase
- **Type-safe**: Full TypeScript support with union types

### URL Format
- Routes are stored as query parameters: `?view=<route>`
- Examples:
  - `?view=tracker` - Habit Tracking view
  - `?view=progress` - Progress Dashboard
  - `?view=activities` - Activities list
  - `?view=goals` - Goals page
  - `?view=wins` - Win Archive

## Testing

### Manual Testing Checklist
- [x] Navigate between views: Habit Tracking → Activities → Goals → Wins
  - Content switches correctly
  - URL updates with `?view=` parameter
- [x] Browser Back button
  - Navigates to previous view
  - URL updates appropriately
- [x] Browser Forward button
  - Navigates forward through history
  - URL updates appropriately
- [x] Hard refresh on non-default view (e.g., `?view=activities`)
  - App opens directly on the correct view
- [x] Direct URL access
  - Visiting `?view=goals` directly opens Goals page
  - Invalid routes default to `tracker`

## Files Changed
- `src/App.tsx`
  - Added route type and helper functions
  - Updated state initialization
  - Added history event listeners
  - Replaced all navigation calls with `handleNavigate()`

## Benefits
1. **Better UX**: Users can use familiar browser navigation controls
2. **Shareable links**: Users can bookmark or share links to specific views
3. **Persistent navigation**: Hard refreshes maintain the current view
4. **No bundle bloat**: Uses native APIs, no additional dependencies

## Future Considerations
- Could extend to support nested routes (e.g., `?view=goals&goalId=123`)
- Could add route transitions/animations
- Could implement route guards or authentication checks if needed
