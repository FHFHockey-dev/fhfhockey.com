# Fresh commitment findings

This is an audit handoff, not a new approved task register. Priorities below describe proposed triage. No code, provider acceptance or deployment is completed by this report. The final [Master Page](https://chatgpt.com/space/page_227f33dd9ed48191b1b2631bf6c4204c) read returned sequence 42. Its [status delta](LIVE-MASTER-DELTA.md) was reconciled before delivery. The specific blocks supporting these seven findings did not change. `MS41-*` labels refer to the retained normalized [master scope index](master-scope-index.json), not native Page block IDs.

## FRESH-01 — P1: lower-is-better radar percentiles run in the wrong direction

**Class:** concrete source defect; one narrow stats-owner assignment together with FRESH-02/03.

`web/components/PlayerStats/PlayerRadarChart.tsx:428–440` counts observations strictly lower than the player, uses that count for rank, and also uses it as the favorable percentile. For lower-is-better GAA, those observations are better, not worse. With `[2, 3, 4]`, the best value 2 receives rank 1 / percentile 0; the worst value 4 receives rank 3 / percentile 67. The component explicitly labels high percentiles “Elite” at line 1069. The direction is therefore inconsistent with both rank and the visible quality guide, independently of any tie convention.

The chart is mounted by `web/pages/stats/player/[playerId].tsx:349`. Current source equals local `master` for both files; [Git blob/hash evidence](source-to-git-master.json) records this without claiming deployed runtime behavior. [Arithmetic evidence](radar-arithmetic-demonstration.json) reproduces the inspected expression; it is not an application test run.

**Existing acceptance:** `tasks/TASKS/wigo-charts/tasks-prd-wigo-charts-optimization.md:110` closes NEW 7.0 for corrected generated-schema queries. `PlayerRadarChart.test.tsx:85` has two query-contract cases; neither exercises inverse percentile values. Keep that completed query fix closed. Prior `MISS-WIGO-RATINGS` concerns the WiGO rating/category-radar work in `tasks/tasks-README.md:74–78,126–131`; this reachable PlayerStats component is a distinct gap under the same stats ownership.

**Master trace:** nearest `MS41-071` / Page block `ff353747-248c-4110-a37a-412d96678900` (WiGO polish) and `MS41-057` (trust/provenance). Neither explicitly names this arithmetic regression. Propose one bounded child, not a new stats rewrite.

**Next assignment:** reproduce in the adjacent component test, apply the established percentile/tie policy in both directions, and assert rank/percentile quality agree for best/middle/worst, ties and missing values. Use synthetic cohorts and affected checks only. No production data or UI redesign is needed.

## FRESH-02 — P2: radar values and rankings refer to different scopes

**Class:** source-proven mixed-scope presentation; exact intended comparison policy needs reconciliation.

The player route resolves a selected historical season at `web/pages/stats/player/[playerId].tsx:921–995` and passes `filteredGameLog`/`playoffGameLog` to the radar at line 349, without a season prop. The radar uses `useCurrentSeason()` at line 254 and queries both the player's row and cohort using that current season at lines 324–337 and 380–399. Its percentile reads the current player row at line 364. Meanwhile, displayed chart averages use the selected regular/playoff log at line 512; the tooltip pairs those averages with the database percentile at lines 681–696. The header can say “Playoffs” at line 890.

There **is** a current-season ranking note at lines 1055–1060. Therefore this report does not claim current-season use is wholly undisclosed or that a particular alternate cohort is already approved. The concrete gap is that the same tooltip/axis can pair one scope's value with another scope's percentile; the breakdown may also show a different current-season value at lines 1013–1019. The existing two tests pin query field names/current-season filters, not historical/playoff scope coherence.

**Master trace:** same stats/trust owners as FRESH-01; no exact selected-season radar contract found in sequence 42 or the inspected completed query task. Current component/route are identical to local `master`.

**Next assignment:** establish whether the product promises selected-scope comparison or a separately identified current-season comparison. Then make value, percentile, cohort label, empty-state behavior and tooltip use that explicit contract. Extend the adjacent tests for historical season, playoff toggle and changed window. Do not silently broaden shared WiGO algorithms or claim a browser failure from this static review.

## FRESH-03 — P2: partial radar failures silently mix empirical and heuristic percentiles

**Class:** concrete provenance/error-state gap in the same component.

At `PlayerRadarChart.tsx:403–408`, a single failed metric query is skipped. Lines 468–472 set global `usingFallback=false` whenever any metric succeeds. `calculatePercentile` at lines 499–506 then uses a heuristic for each missing metric, including the generic 50 default at line 223. The warning at line 952 appears only when the global fallback flag is true. A partially failed chart can therefore show unmarked estimated percentiles while the current-season ranking note remains visible. A missing rank is rendered “Loading...” at line 1032 despite completed queries.

**Master trace:** refine the same proposed stats child and prior `MISS-WIGO-RATINGS` provenance principles; do not count each missing metric as another task.

**Next assignment:** add a two-metric fixture with one successful query and one failed/empty result. Use explicit per-metric availability/provenance or withhold unsupported percentiles; retain estimates only under an agreed, visible policy. Verify the final state does not indefinitely say “Loading...”. No live query is required.

## FRESH-04 — P2: AUDIT-TASK-001's open header contradicts its production closure

**Class:** stale task status, not a new security exposure claim.

`tasks/TASKS/repository-audit-remediation/tasks-repository-audit-remediation.md:22` and its task status at line 64 still say “In progress — rollout authorization.” Its own lines 128–139 explicitly close Task #1 / AUDIT-TASK-001 on October 2, with application and independent catalog/ledger checks, and link the exact retained receipt. `security-rpc-rollout-runbook.md:521` contains the corresponding closure; its scope leaves other remediation separate.

AUDIT-TASK-002.4 at line 186 remains unchecked. Do **not** close Task #2, rerun Task #1's production action, or turn an August historical observation into a present exposure claim. All Task #1 boxes are checked, so the prior 423-open-row adjudication did not surface this header contradiction.

**Master trace:** `MS41-074`, Page block `4e03807b-8b78-4b4c-bbf9-989bdf6265ae`, retains repository ACL/task-026 follow-ups and asks for closure-evidence reconciliation. Add a status correction under that existing owner, preserving the frozen audit evidence.

**Next assignment:** register/document owner reconciles only the live index and Task #1 status to its retained October 2 receipt, explicitly keeps #2/#4/task-026 unresolved where applicable, and links the closure. This audit did not requery current ACLs.

## FRESH-05 — P2: a concrete homepage planning brief is available but not carried into the master wording

**Class:** overlooked owner-approved planning scope; not blanket implementation authorization.

`web/prep-chef/home.md:3,47–89` records two explicit exceptions to “retain the homepage”: keep Slate right-hand Quick Links and replace the bottom links with Stats → Lines → News → Shift Chart; plan the compact standings selector with two columns of four teams per division, two divisions per row on narrow phones and four across when space permits. The final instruction is **plan only; do not implement or deploy**.

Current `web/pages/index.tsx:303` uses `<TeamStandingsChart compact />`. In the tablet-and-below compact styles, `TeamStandingsChart.module.scss:819` sets four outer columns and line 844 uses one column per division, rather than the brief's narrow layout. The current homepage games section does not expose the old Quick Links labels in the bounded source search, so its Slate part requires source/brief reconciliation before proposing restoration. No browser rendering was run.

**Master trace:** `MS41-078`, Page block `85b35985-7d81-412b-9b38-d0d03c0aa536`, asks for a concrete homepage/Slate brief; original 39 also asks to recover the exact brief. This file is a useful retained brief for those two named exceptions. It does **not** supply missing acceptance criteria for original 37's separate tables/sparklines/eligibility request.

**Next assignment:** existing homepage/navigation owner produces a scoped plan from this retained brief or cites a later explicit superseding decision. Keep the two narrow requests separate from original 37 and the broader navigation workshop. Confirm the live compact variant and all 32 selectable teams before a later authorized patch.

## FRESH-06 — P3: Draft tutorial status appendix predates completed local features

**Class:** stale editorial status; avoid duplicate implementation and unsupported launch claims.

`tasks/draft-dashboard-youtube-outline.md:331,366` describes Saved Drafts integration as pending and says scenarios/reports are queued, not implemented. `tasks/draft-pro/LEDGER.md:5,43–50` records W07–W10 local approval, with detailed Saved Drafts, scenario and report browser/API acceptance later in the ledger. The source/status files are present in local `master`; no new feature construction follows from the older outline.

The ledger itself contains chronological intermediate states and a stale “Current acceptance state” table; its dated/top-level completion and provider-specific evidence must be reconciled before public copy. Local implementation is not production availability, paid-patron qualification or a new release authorization.

**Master trace:** Section 8, especially `MS41-064–067`, already separates accepted local Draft work from real/live/paid/roster gates.

**Next assignment:** the existing Draft documentation owner refreshes only the current walkthrough/status appendix after confirming the intended published feature flags/candidate. Preserve historical diary entries as history. Do not reimplement Saved Drafts/scenarios/reports or convert deferred paid-provider checks into passes.

## FRESH-07 — P3: decide the exposed League Comparison placeholder's product status

**Class:** owner decision; no approved new feature inferred from “coming soon.”

`web/components/GameStateAnalysis/GameStateAnalysis.tsx:595–610` exposes the selectable League Comparison state and renders “League Comparisons Coming Soon.” It is reachable through `web/components/TeamTabNavigation/TeamTabNavigation.tsx:348` on `web/pages/stats/team/[teamAbbreviation].tsx:307`. These files match local `master`.

The inspected site-roadmap implementation map and current master retain Team HQ / Three Pillars work, but no exact approved scope for this particular comparison tab was found. This is not evidence that every team-comparison idea in old PRDs is approved.

**Master trace:** nearest Section 9 / `MS41-076` (Three Pillars); relation is broad/owner decision, not exact coverage.

**Next assignment:** existing team-stats owner chooses to retain an honest planned placeholder, retire/hide it, or define a bounded comparison requirement. Only an explicit selected disposition should create implementation work.

## Important exclusions from new work

- `web/pages/api/v1/db/shift-charts.ts:82` still has a TODO for home/away and opponent fields, but lines 809–811 already write all three. Stale comment; no unfinished integration task.
- `web/pages/api/v1/db/cron/update-stats-cron.ts:86–88` references an old disabled PBP call. The active bounded stats path follows below; do not reactivate the old fan-out from a TODO.
- `web/pages/api/v1/projections.ts:51` is an orphaned scaffold in the inspected caller search; Start Chart's canonical task 5.1/5.3/5.5 explicitly reconciles ownership to `/api/v1/start-chart`. Retain/retire policy may be reviewed under existing route ownership; do not implement a second projection engine.
- `web/pages/api/v1/rankings.ts:68` is a deprecated compatibility stub. `usePlayerStats.ts:102` has no literal source caller in the searched web tree. Neither is automatically new product scope.
- SKO's historical burn-down alternative, current authenticated 501 boundary and Sustainability's offline Python persistence stub have explicit dispositions. They are not instructions to restart abandoned pipelines.
- Matrix/time-option “not implemented” branches are unsupported-input guards; fixture `XXX` and display `TBD` strings are not backlog items.
- `goalie-stats-filter-semantics-audit.md` explicitly labels its findings historical and points to dedicated-route completion. Draft debug optimization ideas are expressly optional/evidence-gated. Neither should reopen completed work.

The complete marker-by-marker classifications and remaining prior obligations are in the companion inventory files; only this report directory was changed.
