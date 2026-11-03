# BLSH retrospective tool: acceptance status (independent of forecasting)

**Status as of 2026-10-29.** This tracks the acceptance criteria in `RETROSPECTIVE-RECONCILIATION.md` §4. No forecast result gates any item here. Nothing in this list changes the frozen score, the complete-window rule or earlier outputs. No threshold is set.

| # | Criterion | Status | Evidence / blocker | Owner |
|---|---|---|---|---|
| 1 | Every score shows: actual vs expected per track, additive components, tier, personal games, window games and span, coverage reasons, stale-reference age | **Field contract v2 and provisional A + overlay candidate snapshot ready (CLAUDE-20261029-125); Codex integration of parser/UI pending** | Profiles carry every field (`dry-run-v3/PROFILES-*.jsonl`: `window.spanDays`, `reference.personalN`, `reference.ageDays`, `explanation.tracks`, `coverage`). The preview UI belongs to Codex's successor lease (`BuyLowSellHighPreview.tsx`, `BlshPlayerDetail.tsx`), so display changes need an exact handoff. | Codex successor; Claude can draft the field contract |
| 2 | Explanations pass integrity checks on real windows; independent re-review records no open blockers | **Mostly met** | v3.1 real-window integrity is clean across 2,900 profiles. The independent subagent re-review found no blockers, and its findings are fixed or recorded. Codex's re-review of v3.1 found 3 P2 issues (mixed-revision composition, ES/PP exposure checks, per-game validation); all are fixed in v3.2, and dry run v4 is clean with every score unchanged. **Pending:** Codex's re-review of v3.2 (CLAUDE-20261029-121; inputs frozen). | Codex reviewer |
| 3 | Wording fixed: "production above/below reference given current support", never luck, value, forecast or trade advice | **Met in research outputs** | Explanation claims are all false (luck, market, forecast, trusted); the reports use this wording. The UI copy is still under Codex's preview lease. | Claude (reports); Codex (UI) |
| 4 | Baseline policy and list-membership rule decided on cases and documented | **Open (decision needed)** | Options R1/R2/R3 are in `RETROSPECTIVE-RECONCILIATION.md` §3; the recommendation is R1 now, with R3 as a separately documented and tested estimator. List membership by evidence quantity needs its own documented method and case checks. No size-driven cutoff. | TJ decides; Claude drafts the method |
| 5 | Forecast comparison is an add-on, not a gate | **Met by design** | `FORECAST-PROPOSAL-v2.md`; the development runs (v1, then evaluator v2 after Codex's review) are exploratory and gate nothing here. | — |

## Proposed next retrospective steps (none started)

1. **Field contract for display (criterion 1).** A short, versioned list of profile fields, with their labels and an "unavailable because …" text for each coverage reason. Offer it to the Codex successor for the preview. No preview edits by Claude without an exact handoff.
2. **Tier wording (criterion 1/3).** Show "measured personal reference (n personal games)", so that 1–2 games is visibly thin. This is a label, not a score or rule change.
3. **R3 estimator (criterion 4), only if TJ selects it.** Write the method, add tests on synthetic and matched-evidence cases, and compare it with v1 in a new lease. It would never be a silent edit of v1.
4. **Evidence-quantity list method (criterion 4).** Draft a method defined by window games and personal-reference games. Check it on the fixed cases (Lyubushkin, Gaudette, Dowling, Mangiapane, Kovacevic, McDavid) without targeting any list size.
