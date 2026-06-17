# HabitFlowAI Roadmap

Prioritized upcoming work. This file owns **future** direction; shipped functionality
lives in [`docs/FEATURES.md`](docs/FEATURES.md). When a roadmap item ships, move it out of
this file and document it in `FEATURES.md` (see
[Documentation Standards](docs/DOC_INDEX.md#documentation-standards)).

Status values: **Planned** · **In Progress** · **Needs Verification** · **Exploring**

---

## Near-term

| Item | Status | Area | Notes |
|---|---|---|---|
| Analytics page migration | In Progress | Analytics | Promote Analytics into primary nav (replacing Tasks). Plan in [`docs/audits/analytics_page_implementation_audit_2026-03-29.md`](docs/audits/analytics_page_implementation_audit_2026-03-29.md). |
| Historical linkage / archive remediation | In Progress | Data integrity | Finish correctness work so deletion/unlink flows can't erase archived meaning. See [`docs/audits/historical-linkage-archive-audit-2026-03-30.md`](docs/audits/historical-linkage-archive-audit-2026-03-30.md). |
| Path-based shareable URLs | Planned | Frontend | Move pages off query-string routing (`?view=...`) so all pages have clean shareable URLs. |

## Later

| Item | Status | Area | Notes |
|---|---|---|---|
| Multi-user household UI | Planned | Identity | Invites, shared habits, and per-user views on top of the existing household/user identity model. |
| Pluggable AI providers | Planned | AI | Anthropic / OpenAI providers alongside the current Gemini BYOK integration. |
| Journal questionnaire templates | Planned | Reflection | Guided check-ins built from reusable prompt sets, beyond the current persona templates. |
| Dictation journal mode | Planned | Reflection | Voice-first journaling workflow. |

## Backlog / Exploring

| Item | Status | Area | Notes |
|---|---|---|---|
| Native iOS/Android wrappers | Exploring | Platform | Real push notifications for routines and check-ins; currently responsive web only. |
| Skills / skill tree | Exploring | Engagement | Deferred from the V1 iOS prioritization. See [`docs/reference/iOS release V1/Feature_Prioritization.md`](docs/reference/iOS%20release%20V1/Feature_Prioritization.md). |
| Persona switching UX | Exploring | Personalization | Deferred from V1 prioritization. |
| Identity prompts & coaching | Exploring | Coaching | Deferred from V1 prioritization; preserved psychological-safety direction in [`docs/archive/PSYCHOLOGICAL_SAFETY_V0.md`](docs/archive/PSYCHOLOGICAL_SAFETY_V0.md). |

---

See also: [`docs/V1_PRODUCT_DIRECTION.md`](docs/V1_PRODUCT_DIRECTION.md) for current product
positioning and success criteria, and [`docs/reference/iOS release V1/Feature_Prioritization.md`](docs/reference/iOS%20release%20V1/Feature_Prioritization.md)
for the launch-blocking vs. deferred breakdown.
