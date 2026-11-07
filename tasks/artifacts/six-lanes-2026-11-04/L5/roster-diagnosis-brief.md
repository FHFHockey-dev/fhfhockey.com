# Roster diagnosis — bounded slice brief

2026-11-04 · L5 proposal for Chef review; no implementation grant or product acceptance implied.

## Governing requirements and current state

Extend [Roster Autopsy PRD](../../../TASKS/prd-roster-autopsy.md), especially FR1–FR5, FR7 and §9; do not create a replacement PRD. [Foundation receipt](../../roster-autopsy-foundation-2026-10-29.md) and [usability receipt](../../roster-autopsy-usability-2026-10-29/REPORT.md) describe historical local checks, not checks rerun today. Current source already has `/roster-autopsy`, manual entry, principal-scoped local persistence, safe manual RSO import and `analyzeRoster` structural matching. “Roster Blueprint” is an unaccepted naming suggestion; retain the existing name/route during this slice.

## First implementation grant proposed

Make the existing page begin with **Strengths, Weaknesses, Next actions**, retaining roster/setup/coverage editing below. Deliver a useful structural diagnosis immediately; label its basis “Reviewed positions and starting slots.” A covered position means eligible coverage, never strong player quality or a tradable surplus. Preserve existing 100-player/40-active-slot limits and account/storage-conflict behavior.

- Strengths: reviewed positions whose dedicated slots have known coverage; show counts and an explicit structural label. Flex-only coverage remains a separate non-additive scenario. If none can be established, say why.
- Weaknesses: confirmed dedicated-position shortages and simultaneous unfilled-slot count. A C/LW player covering either slot cannot establish coverage of both. Reserve exclusions remain visible. Show unknown identity/eligibility and unreviewed setup as review needs, not weaknesses or empty slots.
- Next actions: deterministic order: resolve invalid/unreviewed inputs; address confirmed gaps; inspect simultaneous/flex congestion; then review quality when qualified evidence exists. Tie-break positions in existing C/LW/RW/D/G order. Each action states its evidence, affected slot/position and a local action that focuses the appropriate roster/setup/coverage section. Never recommend dropping a named player from counts alone.
- On incomplete inputs, show review actions plus any clearly qualified partial structural findings. With no roster or slots, show setup guidance; no “healthy roster” conclusion.

Acceptance example: one reviewed C/LW player and one C plus one LW starting slot yields one simultaneously fillable slot, an explicit congestion action, and no assertion that both positions are fully covered. Two reviewed eligible players for two dedicated slots can establish structural coverage; they cannot establish a quality grade.

This slice improves the existing foundation; it does **not** complete the PRD's required manual quality grades, peers, trade search or playoff intelligence.

## Dependent quality and league-impact slice

Once approved, attach a timestamped public reference universe and the PRD's reviewed method to show quality strengths/weaknesses and actual-scoring contributions. Retained RSO recent totals have unknown observation dates and cannot serve as that universe. Do not select grade thresholds, historical sample policy or category composite in this ticket. Unknown/nonfinite values must be excluded with coverage reasons before any matcher; its attribution fallback to zero must never create a grade.

Read L4's frozen value/roster-impact result when available; never implement a second valuation, VOR or roster optimizer. Keep four labeled concepts: player production/quality, league valuation, roster-specific marginal impact, and counterparty acceptance (unavailable). Each uses its own version, period, basis and coverage. Per-player next-N-team-game totals are not automatically a common-calendar roster total. No peers means no league rank; no market evidence means an unavailable context panel, with structural diagnosis still usable.

L4's concurrently created [offline contract proposal](../L4/contracts.ts) now supplies `Result<T>`, `Asset`, `Valuation` (`league-valuation-v1`) and `RosterImpact` (`roster-impact-v1`). Its `Result` currently has only available/unavailable states; preserve those states and reasons, with source freshness displayed separately. This is a proposal, not a frozen application import. `Valuation` is league valuation, not a public-pool quality grade; `RosterImpact` does not yet specify enough team/date/assignment detail for the full PRD result. The structural slice needs neither contract to calculate its findings.

## Exact proposed paths and gates

Modify `web/components/RosterAutopsy/RosterAutopsy.tsx`, its `.module.scss`, and existing `.test.tsx`; add `web/lib/rosterAutopsy/diagnosis.ts` and `diagnosis.test.ts` for derived priorities. Read `web/lib/rosterAutopsy/manual.ts` and its tests; no schema/persistence change in the first slice. No route, navigation, auth, RSO or L4 edits needed. All application paths await L1 custody and Chef grants.

Narrow verification: diagnosis cases, existing Autopsy model/component tests, then affected lint/types if warranted; local synthetic desktop/phone and keyboard focus check. No external data, full build or provider run. See [tasks](tasks-prd-roster-autopsy.md).

## Material product choices

Chef/TJ must accept the structural-first staging before implementation; it is narrower than full quality diagnosis. Final rename is optional and does not block this stage. Quality-method calibration/reference coverage and category priorities gate only numeric grades. Access/pricing, peer automation and pick/keeper valuation remain outside this slice.
