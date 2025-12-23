HabitFlow — Fitness Persona Dashboard
Canonical Layout Contract (V1.1 — Revised)
Authoritative Layout Document
This document defines the explicit layout contract for the Fitness Persona dashboard.
Any implementation that violates this layout contract is incorrect.
1. Design Intent (Reconfirmed)
The Fitness Persona dashboard should:
Surface subjective readiness without judgment
Offer clear, intentional actions (routines)
Support lightweight reflection (Quick Log)
Preserve long-horizon context (Goals + Activity)
Avoid visual overload or competing primary actions
This layout prioritizes:
clarity of where I am
clarity of what I can do next
2. Grid Definition (Revised)
Desktop Layout
The dashboard uses a 12-column grid, composed into rows with explicit spans.
This replaces the earlier “3 equal columns” model.
3. Row-by-Row Layout Contract (Non-Negotiable)
Row 1 — Daily Context + Quick Log
Left (8 / 12 columns — 2/3 width)
Subjective Readiness Snapshot
Horizontal row of sliders:
Readiness
Soreness
Hydration
Fueling
Recovery
This card is:
visually calm
dominant in the row
the orientation surface for the day
Purpose
“How do I feel, broadly?”
Right (4 / 12 columns — 1/3 width)
Quick Log (Gratitude-Jar Style)
Compact card
Contains:
Primary CTA: “Log something you did”
Below it: a short list of recent entries
timestamped
lightweight (no metrics)
No visible form inputs by default
Purpose
“What actually happened recently?”
Key Constraint
Quick Log is reflective, not a primary action
It must never visually overpower readiness or routines
Row 2 — Action vs Awareness
This row intentionally contrasts doing vs observing.
Left (8 / 12 columns)
Action Cards (2×2 Grid)
Exactly 2 columns × 2 rows
Max 4 cards
Each card = pinned routine
Compact height
Clear primary CTA (“Start”)
Optional:
One routine marked subtly as My Go-To Routine
Purpose
“What could I intentionally do next?”
Right (4 / 12 columns)
Sleep & Energy Trends
Single card containing:
Sleep Quality (top)
Energy Level (bottom)
Stacked vertically
One shared time-range dropdown:
7 / 14 / 30 days
Dropdown style matches existing Activity Map selector
Purpose
“What’s been happening to my capacity over time?”
Constraints
No scores
No interpretations
No correlation claims
Row 3 — Goals at a Glance (Unchanged)
Uses existing default dashboard component
Full width
Enhancements allowed:
Subtle emphasis for upcoming goals
“Preparing for this” copy
Purpose
“What am I building toward?”
Row 4 — Activity Heat Map (Unchanged)
Uses existing default dashboard component
Full width
Same filters and scale as default dashboard
Purpose
“What patterns emerge over time?”
4. Visual Layout Summary
┌───────────────────────────────────────────────┬───────────────┐
│                                               │               │
│  Subjective Readiness Snapshot (8 cols)       │  Quick Log    │
│  sliders: readiness / soreness / etc.         │  + recent     │
│                                               │  entries      │
├───────────────────────────────────────────────┼───────────────┤
│                                               │               │
│  Action Cards (2×2 grid, 8 cols)              │  Sleep &      │
│  pinned routines                              │  Energy       │
│                                               │  Trends       │
├───────────────────────────────────────────────┴───────────────┤
│                                                               │
│  Goals at a Glance (unchanged)                                │
│                                                               │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│  Activity Heat Map (unchanged)                                │
│                                                               │
└───────────────────────────────────────────────────────────────┘
5. Explicit Non-Goals (Still Enforced)
No readiness scoring
No recovery calculations
No performance grading
No auto-recommendations
No time-of-day logic
6. Why This Layout Is Better
This layout:
Gives readiness the visual weight it deserves
Prevents Quick Log from competing with action
Keeps action and awareness side-by-side, not interleaved
Preserves the trusted lower dashboard spine
Matches how users actually think:
How do I feel?
What could I do?
What’s been happening?
It’s calmer, more legible, and more HabitFlow-honest.
7. Status
This layout contract supersedes the previous Fitness dashboard layout spec and is now canonical.
All future implementation and Cursor prompts must follow this document.
