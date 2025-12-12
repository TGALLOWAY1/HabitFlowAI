📘 HabitFlowAI PRD-Habit Bundles with Expand/Collapse
1. 🎯 Purpose & Scope
Introduce a new habit type, Habit Bundle, which allows users to combine multiple habits (existing or newly created) into a grouped structure.
A Habit Bundle:
Appears as a single habit row on the Habits page


Can be expanded/collapsed to show the individual habits underneath


Is considered complete for the day if any sub-habit is completed (configurable later, but MVP = OR logic)


Allows multiple sub-habits to be completed on the same day


Preserves full tracking for each individual habit


Integrates with goal tracking


Supports routines (activities) but does not redefine them



2. 👤 User Stories
US1 — Creating a Bundle
“As a user, I want to combine multiple habits into a single parent habit (e.g., Exercise → Run, Lift, Cycle), so I can see that I exercised without losing detailed habit tracking.”
US2 — Viewing and Completing
“As a user, I want to expand a bundled habit to see its component habits, so I can mark them individually each day.”
US3 — Multiple Sub-Habit Completions
“As a user, if I complete two habits inside the bundle (ex: Reading AND Watching a Tutorial), I want both to count and the parent to show as completed.”
US4 — Clean Daily View
“As a user, I do not want clutter or icons in the habit grid. I want a clean parent habit row with an optional expand view.”
US5 — Sub-Habit Independence
“As a user, I want sub-habits to remain independent habits with their own details, streaks, analytics, and links to goals.”
US6 — Routine Integration
“As a user, completing habits through routines should still mark those habits complete and reflect inside the bundle.”

3. 🧭 UX & Interaction Design
3.1 Habits Page (Collapsed)
Default state shows parent habits normally:
Daily Learning            [Complete/Not]
   ▸ 
Exercise                  [Complete/Not]
   ▸
Meditation                [Complete/Not]

A chevron indicates the habit can be expanded.
3.2 Expand State
When expanded:
Daily Learning           [✓]
   ▾
   Read                    [✓] (20 min)
   Watch Tutorial          [ ]
   Skill Practice          [✓] (10 min)
   Course Module           [ ]

Rules:
New rows appear directly under the parent, indented.


Each sub-habit row uses the exact same UI behavior as a normal habit row.


A parent habit’s daily state is derived from its children.


Completing a sub-habit automatically updates the parent’s completion state.


3.3 Navigation to Detailed Analytics
Two simple, non-conflicting interactions:
Tap habit name → opens Habit Detail page (full analytics)


Tap chevron → expand/collapse


New row behavior:
Sub-habits also have tap-to-open-detail behavior


No double-click required for mobile.

4. 🧩 Data Model Additions
Habit (existing model)
Add:
type: "boolean" | "number" | "time" | "bundle"
subHabitIds?: string[]     // only for bundles
bundleParentId?: string    // sub-habit reference to parent (optional)

Habit Bundle Rules
A bundle is a habit with type = "bundle".


Sub-habits remain real habits stored normally.


subHabitIds determines which habits belong to the bundle.


bundleParentId is optional but useful for UI to quickly determine nesting.


HabitLog stays the same
No changes needed — every sub-habit logs normally.
Parent habit completion is computed, not stored.

5. 🔄 Completion Logic
Sub-habits:
Follow existing completion logic


Boolean habits → instant check


Number/time habits → numerical completion


Parent (bundle) habit:
Computed dynamically: Completed if any sub-habit is complete that day.


If multiple sub-habits are completed, parent shows:


Completed


And optionally: “(2 completions)” on the detail screen.


Streak Logic:
Parent streak increments if at least one sub-habit is completed.


Sub-habit streaks operate independently.



6. 🎯 Goal Integration
A user can link:
A parent habit → goals


Any sub-habit → goals


Goal progress updates when the linked habit is completed.
Example:
Goal: Pass Exam
Linked to: “Daily Learning,” “Read,” “Watch Tutorial”


Goal: Read 10 Books
Linked only to “Read”


Goal: Exercise Consistently
Linked to: “Exercise” parent habit


Also possible: link run, lift, cycle individually


This supports flexible goal logic.

7. 🔧 Routine (Activity) Integration
Routines still:
Mark the underlying habits complete


Affect bundles automatically


When a routine step completes the “Read” habit:
Read gets logged


Daily Learning auto-shows as complete


No bundling logic inside routines needed.
 Bundles operate passively on habit data.

8. ⚠️ Edge Cases
Deleting a sub-habit
Prompt:
 “Remove from bundle or delete habit entirely?”
Changing sub-habit type
Allowed — no impact to parent.
Removing all sub-habits from a bundle
Bundle becomes invalid → convert to normal habit or delete.
Adding same habit to two bundles
Allowed.
 Parent completion logic is independent.
Reordering sub-habit rows
Drag-and-drop inside the Edit Bundle screen.

9. 🧱 Phased Development Plan (Milestones)
Here is an intelligent, low-risk, incremental implementation plan that matches how you build with Cursor.

M1 — Data Model + Backend Support
Scope:
Add type = "bundle" to Habit schema


Add subHabitIds and bundleParentId


Add backend methods:


createBundle


updateBundle


getHabitsWithBundleStructure


Computed parent completion logic


Supporting queries in DayLog repository


Output: backend supports bundles entirely
 Risk: low

M2 — Create/Edit Bundle UI
Scope:
New “Create Habit → Bundle” flow


Add “Add existing habit” selector


Add “Add new sub-habit” flow


Add reorder sub-habits


Add remove sub-habit


Output: full bundle editing experience
 Risk: medium

M3 — Habits Page Expand/Collapse
Scope:
Chevron toggle


Insert/remove sub-habit rows dynamically


Ensure rows follow the correct indentation


Parent habit uses computed completion state


Sub-habits behave identically to normal habits


Sub-habits nest well visually in the react-native/web grid


Output: main UX visible
 Risk: medium

M4 — Completion Logic Integration
Scope:
Daily grid updates parent habit correctly


Routines correctly feed into parent habit completion


Goals integration


Streak logic for bundles


Output: fully functional tracking
 Risk: medium

M5 — Detail View + Analytics
Scope:
Bundle detail page


Show:


Completion breakdown (count of sub-habits)


Tiny bar chart (optional for MVP)


Sub-habit performance table


Output: users can analyze bundles
 Risk: low-medium

M6 — Polish + QA
Animation for expand/collapse


Better spacing


Accessibility pass


Mobile small-screen layout adjustments


Empty state UI


Optional additions (like color accents or tiny indicators)



10. 🧠 Cursor Implementation Notes
Put bundle logic behind a feature flag (ENABLE_HABIT_BUNDLES) to roll out safely.


For grid rendering: flatten the list into a computed structure:


[
  {habit: parent},
  {habit: sub1, isChild: true},
  {habit: sub2, isChild: true},
  ...
]

Parent completion is computed each render; do NOT store in DB.


Use existing HabitRow component for sub-habits → keeps code DRY.


Parent should have separate clickable zones:


Chevron = expand/collapse


Name = open detail page



