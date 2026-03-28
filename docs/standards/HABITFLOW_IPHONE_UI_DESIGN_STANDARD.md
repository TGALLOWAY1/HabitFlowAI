# HabitFlow iPhone UI Design Standard

**Version:** 1.0  
**Applies to:** iPhone layouts (390px reference width), mobile web/PWA.

## 1) Foundations

- **Design intent:** calm, structured, low-friction.
- **Interaction priority:** one-handed, thumb-friendly, fast completion.
- **Accessibility baseline:** 44x44pt targets, readable contrast, no essential info hidden behind motion/hover.

## 2) Spacing System

- `space-1` = 4px
- `space-2` = 8px
- `space-3` = 12px
- `space-4` = 16px (**default intra-section gap**)
- `space-6` = 24px (**inter-section gap**)
- `space-8` = 32px (**major page separators**)

Rules:
- Page horizontal padding: **16px**.
- Card padding: **12–16px**.
- Between cards: **12px** minimum.
- Between title and first control: **12px**.

## 3) Typography + Iconography

- Screen title: 22–24px semibold/bold.
- Section title: 17–19px semibold.
- Body text: 15–16px.
- Metadata text: 12–13px.
- Avoid persistent 10px text except compact tab labels.

Icon sizes:
- Primary action icons: 20px.
- Secondary icons: 16px.
- Status/micro icons: 14px.

## 4) Cards

- Default card min-height: **88px**.
- “Rich” card max suggested visible height: **120px** before collapsing/truncating.
- Max 2 lines of supporting text in list cards.
- Keep one primary action per card row; move extras to overflow menu.

## 5) Modals + Bottom Sheets

### Modal rules
- Center modal only for short dialogs/confirmation.
- Max height: **90dvh**.
- Internal body must scroll independently.
- Close affordances: top-right close + backdrop tap.

### Bottom sheet rules
- Preferred for creation/edit flows on iPhone.
- Default max height: **85dvh**.
- Include drag handle and swipe-to-dismiss.
- Sticky action area for primary CTA.

### Layering rules
- Use shared z-index tiers:
  - `z-modal-base`
  - `z-modal-sheet`
  - `z-dialog-critical`
  - `z-toast`
- Never open two same-tier overlays at once.

## 6) Safe Area + Fixed UI

- Fixed header and fixed bottom nav must include safe-area insets.
- Content bottom spacing must equal: `bottomNavHeight + safeAreaBottom + buffer`.
- Last actionable row must remain fully visible above home indicator.

## 7) Forms + Keyboard Behavior

- Inputs auto-scroll into view when keyboard opens.
- Primary action remains reachable (sticky footer preferred).
- Never place required final CTA below keyboard without auto-layout compensation.
- Show inline validation near field; avoid forcing user back to top.

## 8) Navigation and Flow

- Keep primary nav to 4–5 destinations; overflow into “More.”
- Back behavior should preserve context (tab, scroll, draft).
- Destructive actions require confirmation; reversible actions should prefer undo toast.

## 9) Redundant Content Policy

Always remove or defer text that:
- Repeats a visible metric.
- Explains obvious UI controls.
- Duplicates label + sublabel with same meaning.

Use alternatives:
- Empty-state only guidance.
- First-run coach marks.
- Contextual help icon/tooltips.

## 10) QA Checklist for New Mobile UI

1. No content hidden under notch/home indicator.
2. No critical CTA hidden by keyboard.
3. Modal content scrolls fully on iPhone viewport.
4. 44x44 tap targets verified.
5. Interaction feedback visible within 100–200ms.
6. No duplicate/conflicting helper copy.
7. One primary action per screen section.

