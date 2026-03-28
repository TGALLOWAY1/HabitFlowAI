# HabitFlow iPhone Usability Audit Report

**Date:** 2026-03-28  
**Viewport target:** iPhone 13/14 standard width (390px), one-handed use, thumb-first interactions.  
**Method:** Code-level UI audit across major pages/components and modal flows (no simulator screenshots in this pass).

## Critical Issues (Must Fix)

| Screen | Issue | Why It’s Bad | Recommended Fix |
|---|---|---|---|
| Global layout (Header + Bottom Nav) | Fixed header + fixed bottom nav with static content padding (`pb-20`) | Static bottom padding can drift from real nav height + safe area, causing last interactive row to sit too close to or under nav/home indicator on some iPhones and PWA states. | Replace hardcoded bottom spacing with a shared token (`--bottom-nav-total-height`) derived from nav height + `env(safe-area-inset-bottom)` and apply to all scroll containers. |
| Bottom Tab Bar | 6-tab navigation on small width causes cramped targets and label crowding | Each tab gets limited horizontal space at 390px; easier to miss taps one-handed and labels become visually noisy. | Move to 4 primary tabs + “More” sheet, or icon-only compact mode with enlarged 44x44 tap zones and optional haptics. |
| Habit Creation Inline Modal | Modal has no explicit max height or internal scroll container | On iPhone + keyboard open, lower fields/actions can be unreachable or clipped; this is a direct completion blocker. | Convert to bottom-sheet style (`max-h: 85dvh`) with dedicated internal scroll area and sticky footer actions. |
| Routine Editor / Runner Modals | Desktop-like modal sizing (`h-[85vh]`, wide layouts) reused on mobile | Dense multi-panel content can overwhelm small screens; keyboard/IME can occlude fields and CTA buttons. | Introduce a mobile variant: full-height sheet with sticky top bar and sticky primary actions; collapse side controls into accordions. |
| Modal stack coordination | Many modals use same `z-50`; settings uses `z-[100]` | Inconsistent stacking can create hard-to-debug overlap where a lower-context modal appears above/under another unexpectedly. | Define modal layering system (`base`, `sheet`, `dialog`, `critical`) and enforce via shared modal primitives. |

## Medium Issues (Should Fix)

| Screen | Issue | Recommendation |
|---|---|---|
| Dashboard | `ProgressDashboard` contains nested scroll assumptions and additional bottom padding patterns | Consolidate to a single scroll parent per page; let shared page scaffold own all safe-area/bottom-nav spacing. |
| Tasks | Intro copy + dual status counters (“pending/active”) + footer explanatory text add vertical noise | Collapse helper copy into empty-state only. Keep one concise status signal per list header. |
| Goals | Empty-state heading + paragraph + chips + CTA creates tall first-load block | Trim to one heading + one line + CTA; move examples to learn-more tooltip. |
| Journal | 3-tab header + editor history mode switching can hide context while editing | Add sticky compact breadcrumb in edit mode (“History > Edit entry”) and keep close/back affordance always visible. |
| Category picker / lists | Search appears only at >=6 categories; behavior shift may feel inconsistent | Keep search affordance visible but collapsed; reveal input on tap to preserve predictable pattern. |

## Low Priority Improvements

| Screen | Improvement | Recommendation |
|---|---|---|
| Header | Header includes demo/dev controls in top-right cluster | In non-dev/mobile contexts, move secondary controls into settings to reduce top-bar density. |
| Cards (global) | Minor inconsistency in micro-text sizing and metadata placement | Normalize metadata rows to one line, same font token and icon size across cards. |
| Confirmation dialogs | Button copy patterns vary (“Delete”, “Remove”, “Clear”) | Standardize destructive language hierarchy and button order for consistency. |

## Redundant Text to Remove

1. **Tasks page helper text at top**: “Capture anything on your mind…” should be empty-state-only, not always visible.
2. **Tasks footer note** about midnight reset should move to an info icon/tooltip in section header.
3. **Goals empty-state chips/examples** can be removed or moved behind a “See examples” disclosure.
4. **Settings “How HabitFlow Works” cards** are useful but verbose for repeated access; condense to bullets or first-run onboarding.
5. **Repeated micro-copy in habit creation** (multiple explanatory snippets) should be progressively disclosed by field focus/help icon.

## Layout Standardization Recommendations

- **Card height:** Use compact cards with predictable min-height bands (e.g., 88–120px summary cards on iPhone).
- **Icon size:** Primary 20px, secondary 16px, tertiary 14px only.
- **Padding:** Page horizontal 16px; card internal 12–16px; section gaps 16px.
- **Font sizes:** Body 15/16px, metadata 12/13px minimum, avoid 10px labels except tab captions.
- **Modal max height:** 85–90dvh; prefer bottom sheets on iPhone for form flows.
- **Bottom sheet behavior:** Draggable handle + swipe-to-close + sticky primary action when form-based.
- **Tap target minimum:** 44x44pt minimum for all actionable elements.
- **Section spacing:** 16px standard, 24px between major groups, 8px within metadata clusters.

## iPhone Layout Rules (Global)

1. **Single scroll owner per screen.** Avoid nested vertical scroll unless strictly necessary.
2. **Safe area is mandatory.** Top and bottom insets must be included in all fixed bars/sheets.
3. **Bottom nav never overlaps content.** Content must reserve nav+safe-area space using one shared token.
4. **No critical action below keyboard fold.** Inputs and primary CTA must remain visible or auto-scroll into view.
5. **One modal layer at a time (default).** Opening a second modal requires explicit parent minimization or dismissal.
6. **Modal close is always reachable.** Top-right close button + backdrop tap + swipe-down (for sheets).
7. **Prefer bottom sheets for mobile forms.** Reserve centered dialogs for short confirmations only.
8. **Reduce always-on helper copy.** Show guidance contextually (empty states, first run, long-press hints).
9. **Keep thumb-zone actions low.** Primary actions near lower third but above home indicator.
10. **Consistent feedback loop.** Every create/edit/delete action must immediately show state change + lightweight toast.

## Interaction Flow Fixes (Priority)

1. **Add/Edit habit flow:** Convert long form to stepper sections (Basics → Goal → Schedule → Links) to cut scroll fatigue.
2. **Routine edit flow:** Break into tabs (Overview, Steps, Variants) with sticky save bar.
3. **Task quick-capture flow:** Keep add input persistently visible; move instructional copy to contextual states.
4. **Modal close behavior:** Standardize escape/backdrop/swipe-close semantics and prevent accidental data loss with dirty-state guard.
5. **Delete/clear actions:** Use a consistent confirm pattern only for destructive, irreversible actions.

---

## Screen-by-Screen Coverage Matrix

- Dashboard: ✅ Reviewed
- Habits: ✅ Reviewed
- Journal: ✅ Reviewed
- Goals: ✅ Reviewed
- Routines: ✅ Reviewed
- Tasks: ✅ Reviewed
- Settings: ✅ Reviewed
- Creation/Edit screens: ✅ Reviewed (habit/routine/goal/task/journal patterns)
- Modals/popups/bottom-sheets/dropdowns/pickers/dialogs: ✅ Reviewed representative components and shared patterns

