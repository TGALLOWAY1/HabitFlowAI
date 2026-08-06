# Bottom Nav Drifts Up While Scrolling (iOS)

The fixed header and bottom tab bar float up with the content mid-scroll on iOS
(reported from an iPhone), leaving the tab bar stranded in the middle of the screen
until scrolling stops.

- [x] 1. Diagnose: fixed positioning is correct in Chromium at iPhone size (nav pinned, no
      transform/filter/contain ancestor, no horizontal document overflow) — the drift is iOS
      deferring `position: fixed` repaints until a document scroll ends. In the report both bars
      are displaced by the same offset (the scroll delta), which is the signature of that behavior.
- [x] 2. Fix: turn the signed-in chrome into a real app shell — `.app-shell` (100dvh,
      `overflow: hidden`) + `main.app-scroll` as the only scroll container, so the
      document never scrolls and the fixed bars have nothing to drift against (commit 1)
- [x] 3. Carried in the same commit (inseparable from the shell change): page-scroll callers must
      scroll `main.app-scroll` (`TourPage.goTo`); bottom padding now clears the tab bar *plus*
      `safe-area-inset-bottom` (previously `pb-20` = 80px vs. a 90px tab bar on notched iPhones —
      the last habit card sat ~10px under the bar)
- [x] 4. Docs: app shell & scrolling section in HABITFLOW_UI_ARCHITECTURE.md (commit 2)
- [x] 5. Verify: `npm run build`, `npm run test:run`, `npm run lint`, plus a Playwright check at
      390×500 and 1280×800 asserting the document is unscrollable, the tab bar stays pinned to
      the viewport bottom through container/wheel scrolling, PageDown still scrolls, and the last
      card clears the bar

Design decisions:
- Header and tab bar keep `position: fixed`. With no document scroll they are stable, and
  keeping them fixed leaves the header's translucent blur over the content intact and avoids
  restructuring where `BottomTabBar` is mounted (still rendered from `HabitTrackerContent`).
- Height uses `height: 100vh` then `height: 100dvh` in `.app-shell` so browsers without `dvh`
  fall back to `vh` rather than to `auto`.
- Auth screens render outside `Layout` and keep ordinary document scrolling; untouched.
