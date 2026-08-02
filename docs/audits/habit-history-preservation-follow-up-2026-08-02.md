# Habit History Preservation Follow-up — 2026-08-02

## Context and scope

HabitFlowAI currently has one real user. The resolution therefore favors small, explicit safeguards over multi-user migration infrastructure, realtime synchronization, or generalized versioning services. Existing HabitEntry values and DayKeys remain untouched.

## Resolutions

### Target and schedule edits

- A habit stores a small `trackingRevisions` array on its existing document.
- The first completion/schedule edit records the current rule at the habit creation DayKey and the edited rule at the supplied local DayKey.
- Later same-day edits replace that day's revision rather than producing noise.
- Historical completion uses the numeric/boolean target that was effective on the entry DayKey.
- Historical opportunity and weekly-quota calculations use the weekdays/quota effective on that DayKey or week.
- A daily↔weekly streak-unit change starts a new comparable streak segment; days and weeks are never mixed into one streak number.
- Existing HabitEntry documents are not rewritten or copied.

This is deliberately not a separate definitions collection. Habits without revisions continue to use their current top-level configuration, so deployment requires no backfill.

### Archive and restore

- User archive appends a simple open `inactivePeriods` range beginning on the following local day. The archive day remains historical and any completion already recorded that day is preserved.
- Restore closes the range on the day before restoration, making the restore day active.
- Daily streaks skip inactive scheduled opportunities. A weekly quota period touched by an inactive range is excused as one unit.
- A currently archived pre-change habit can infer its one open range from `archivedAt` when restored. Older completed archive/restore cycles cannot be reconstructed because no timestamps exist for them.

### Backdated and imported entries

- A real HabitEntry may predate its habit document because the user backdated it or history was imported/recreated.
- `createdAt` still prevents the application from inventing missed opportunities before a new habit existed.
- When an earlier real entry exists, that DayKey is the first evidenced opportunity for streaks and analytics. Schedule weekday rules still apply, and no opportunity is inferred before that entry.
- A read-only calculation against the configured history confirmed that the ten consecutive `Rogain AM` DayKeys now derive `currentStreak: 10` and `bestStreak: 10`. No record was edited to obtain that result.

### Adjacent derived views

- Historical All/Today/Schedule cells and the history editor display the goal type, target, unit, and cadence effective on the viewed DayKey.
- Dashboard heatmaps retain actual creation-day/backdated completions without inventing activity on neighboring dates.
- The history editor mirrors the one-entry-per-habit/day storage rule; zero clears rather than creating redundant progress, and decimal drafts remain visible.
- The weekly AI review now counts only scheduled target-reaching days; partial numeric entries no longer become “completed” facts.
- Momentum uses the same caller-supplied local DayKey as progress instead of the server calendar day.
- The remaining All-grid header delete mode was removed; normal boolean toggle-off and numeric Clear flows remain.

### Existing duplicate HabitEntries

The configured database was audited before modification:

- 23 duplicate index-key groups
- 44 redundant documents
- zero groups with conflicting active entries
- every group contained at most one active document; all collisions were already soft-deleted

The apply run copied all 67 original documents in the affected groups to `habitEntryDedupeArchive`, removed only the 44 already-deleted collisions, and retained every active HabitEntry unchanged. Final verification reported zero duplicate keys and confirmed the canonical unique index is active.

The migration now refuses to apply mixed freeze/choice/unknown-value groups. Boolean duplicates preserve entry-existence completion; numeric duplicates, if encountered later, preserve the summed quantity already shown by the application. Every original document, including the retained winner, is archived before modification.

## Explicit product rules

- `goal.frequency: total` affects cumulative goal aggregation only. The habit tracker still evaluates each DayKey against its daily target and uses those daily completions for streaks.
- HabitEntry truth outranks a later habit-document creation timestamp for that evidenced DayKey; creation time only prevents unevidenced earlier misses.
- Exact-day activity and weekly quota satisfaction remain different metrics.
- One habit/day has at most one active entry. UI history state replaces the upserted day instead of appending a second visual row.
- Cross-tab visibility/interval refresh is sufficient for the current single-user deployment; realtime conflict infrastructure and offline write queues are intentionally deferred.
- Existing batch preflight, idempotent per-DayKey upserts, rollback, and authoritative refresh are sufficient for one user. MongoDB multi-document transactions are intentionally not added.
- Automatic freezes remain disabled until their legacy service is reconciled with canonical completion.

## Data impact

- No active entry value, DayKey, habit ID, source, or timestamp was changed by the duplicate cleanup.
- No existing HabitEntry is changed by target, schedule, archive, or restore handling.
- New metadata is added lazily to a habit only when its tracking rule changes or it is archived.
- Recovery copies from the duplicate cleanup remain in `habitEntryDedupeArchive`.
