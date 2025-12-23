# Emotion Regulation Persona Dashboard Implementation

## Overview
This PR implements a complete dashboard experience for the **Emotion Regulation** persona, featuring a focused, supportive UI for tracking emotional wellbeing metrics and habits. The dashboard emphasizes "today-focused" insights while maintaining access to historical patterns.

## Key Features

### 🎯 Current Vibe Widget
- **Icon-based selection**: Replaced text chips with 5 rounded-square icon tiles (strained, tender, steady, open, thriving)
- **Visual feedback**: Selected state includes subtle glow, ring, and shadow effects
- **Persistent storage**: Vibe selections stored as `JournalEntry` with `templateId="current_vibe"` for stability across personas
- **Clean layout**: Removed dynamic message text for a cleaner, more focused interface

### 📊 Today's Snapshot Widget
- **Metric overview**: Displays all emotional wellbeing metrics from Daily Check-In
- **Soft intensity indicators**: Uses filled/unfilled dots (pips) instead of numbers for a non-judgmental presentation
- **Single-row layout**: All 5 metric cards fit on one row on large screens
- **Supportive messaging**: Includes "You can feel more than one thing at once." in the header

### 🧘 Gratitude Jar Widget
- **Inline layout**: Positioned beside Current Vibe in a secondary column (35-40% width)
- **Reduced emphasis**: Lower contrast background, smaller header for supportive (not primary) role
- **Custom icon**: Added minimal SVG jar icon matching app aesthetic
- **Quick add**: "+ Quick add" button in header for easy entry creation
- **Height matching**: Aligned with Current Vibe card for visual consistency

### 📈 Habits & Mood Patterns Widget
- **Vertical slice visualization**: Each habit row shows activity heatmap directly above mood metric heatmap
- **Single shared mood row**: One mood metric row (not per-habit) for clear pattern comparison
- **Square cells**: Heatmap cells are square (not rectangular) for better visual consistency
- **Distinct colors**: Habit rows use emerald, mood row uses blue tones for clear differentiation
- **Metric selection**: Dropdown to choose which mood metric to compare against habits
- **30-day window**: Shows last 30 days of habit activity and mood data

### 🎴 Action Cards (Pinned Routines)
- **Pinned routines**: Users can pin 2-3 routines to display as action cards
- **Placeholder icons**: Each card includes a placeholder icon (Sparkles) on the right
- **Consolidated text**: Compact layout with "Gentle reset" subtitle
- **Edit button**: Icon-based edit button in header (top-right) for managing pins
- **Modal interface**: Pin/unpin routines via modal dialog

### 🔧 Developer Tools
- **Seed data generator**: New `npm run seed:emotion` command for generating test data
  - Creates 60 days of HabitEntries for Walk, Hydration, Sleep Routine, Morning Routine
  - Generates corresponding wellbeing logs and entries with realistic patterns
  - Deterministic RNG (seed-based) for reproducible test data
  - Includes "messy weeks" for realistic pattern visualization

## Technical Implementation

### Data Model
- **WellbeingEntry**: Uses canonical `wellbeingEntries` collection for mood metrics
- **JournalEntry**: Stores Current Vibe as `JournalEntry` with `templateId="current_vibe"`
- **DashboardPrefs**: Stores `pinnedRoutineIds` and `checkinExtraMetricKeys` per user
- **Idempotency**: All upserts are idempotent (no duplicates on re-seed)

### UI Components
- **Dashboard Composer Pattern**: View-only pattern for persona-specific widget arrangement
- **Persona Configuration**: `emotionalWellbeingPersona` defines widget stack and check-in subset
- **Responsive Layout**: Cards use flexbox for height matching and responsive grid layouts

### Wellbeing History Page
- **Heat map visualization**: Calendar-style grid replacing line charts
- **Multiple views**: Heat Map (default), Weekly Summary, Small Multiples
- **Time ranges**: 30/90/180 day windows
- **Quick presets**: "Emotional core", "Energy & focus", "Sleep" metric groupings

## UI Polish & Fixes

### Layout Improvements
- ✅ Matched Current Vibe and Gratitude Jar card heights using flexbox
- ✅ Standardized header sizes across all widgets
- ✅ Improved spacing and padding consistency
- ✅ Fixed heatmap orientation (horizontal weeks, vertical days)

### Visual Refinements
- ✅ Replaced text buttons with icon buttons where appropriate
- ✅ Added placeholder icons to Action Cards
- ✅ Consolidated text for better space utilization
- ✅ Removed redundant helper text and footers
- ✅ Fixed React key warnings in heatmap components

### Bug Fixes
- ✅ Fixed missing lucide-react icon imports (Spiral → Repeat, Heart)
- ✅ Fixed duplicate mood row rendering in Habits & Mood Patterns
- ✅ Fixed heatmap cell aspect ratios (square instead of rectangular)

## Files Changed

### New Files
- `src/components/personas/emotionalWellbeing/EmotionalWellbeingDashboard.tsx` - Main dashboard component
- `src/components/icons/GratitudeJarIcon.tsx` - Custom SVG icon component
- `scripts/seed-emotion-regulation.ts` - Seed data generator script
- `src/shared/personas/emotionalWellbeingPersona.ts` - Persona configuration
- `src/shared/personas/dashboardComposer.ts` - Dashboard composer pattern
- `src/shared/personas/activePersona.ts` - Active persona management

### Modified Files
- `src/pages/WellbeingHistoryPage.tsx` - Heat map visualization updates
- `src/components/ProgressDashboard.tsx` - Persona-based routing
- `src/components/DailyCheckInModal.tsx` - Persona-specific metric subsets
- `package.json` - Added `seed:emotion` script

## Testing

### Manual Verification
- ✅ Demo mode shows Emotional Wellbeing dashboard
- ✅ Real mode shows default dashboard (unchanged)
- ✅ Seed script generates deterministic test data
- ✅ All widgets render correctly with proper spacing
- ✅ Height matching works across screen sizes
- ✅ Persona switching doesn't affect HabitEntry CRUD (view-only)

### Seed Data
Run `npm run seed:emotion -- --days=60 --seed=123` to generate test data for visual validation.

## Breaking Changes
None. This is an additive feature that doesn't modify existing functionality.

## Next Steps
- [ ] Add routine image support to Action Cards
- [ ] Implement persona selector UI (currently demo-only default)
- [ ] Add more sophisticated pattern detection in Habits & Mood Patterns
- [ ] Consider adding trend indicators to Today's Snapshot


