# 2026-11-21 · claude · FORGE → Detailed RSO participation policy

## Scope
Implement TJ's participation policy (amends decisions 3/47 for Detailed RSO only) as a tested local candidate. No release.
Lane parent: Chef local_9996b7b8. Work only in detached worktree `/private/tmp/forge-participation-policy-20261121`
(HEAD 2236ecb7c = origin/master). `web/node_modules` there is an untracked symlink to the main checkout's (never commit).

## Design note (before coding)
**Root cause of live `missing_participation` (2026020359):** every FORGE skater row (lineup and reserve) carries
`uncertainty.availability` (forge-skater-coverage-v1). `boardSkaterForecast` (starterBoardScoring.ts) then treats the row
as `conditional_playing` and returns `expected = null` unless accepted same-day news confirms a lineup/out, so
`publicPlanningForecasts` (consumerRevisionAdmission.ts) excludes it as `missing_participation`.

**Files that change (all outside the producer closure 0446100e…):**
- `web/lib/projections/consumerRevisionAdmission.ts` — opt-in `participationPolicy: "rso_assumed_defaults"`; skater rows
  get a participation basis and stats per policy. Default (start chart, calendarCoverage, other callers) unchanged.
- `web/lib/rosterScheduleData/planning.ts` — pass the policy only when `consumer === "rso"`.
- `web/lib/projections/pregameCapture/hostedReaders.ts` — Detailed re-admission (exclusion attribution) uses the same policy.
- tests: `consumerRevisionAdmission.test.ts` (six cases + chain).
NOT changed: starterBoardScoring.ts, skaterCoverage.ts, planningTypes.ts, bridgeForecastWire.ts, rsoUsePolicy.ts (all in
the producer closure) → closure hash must stay 0446100e…; no new closure registration.

**Sources + freshness:**
- Roster/injury status = the issued revision's own run-time roster evidence: `availability.state` + `event_type`
  (producer roster events; DTD/INJURY_OUT/INJURY_IR/IR/LTIR = injured; SCRATCH/SUSPENSION/NON_ROSTER/SENDDOWN = confirmed
  exclusion; scratch only for its own game). Roster membership = issued roster row must match the player's current
  rosterRevision (else identity_conflict, as today).
- Confirmation = accepted same-day news scoped to game/team/player and the revision cutoff, re-derived by
  `boardSkaterForecast` (confirmed `ev` = confirmed lineup; confirmed `availability:out` = confirmed out). Unconfirmed
  lines, PP roles, return reports never confirm.
- Freshness (unchanged rules): revision expires at min(published+36h, puck drop); accepted news newer than the
  revision cutoff withdraws the whole revision (`stale_source`) until a new revision is issued; evidence after the cutoff
  or for another game is ignored. Stale/expired → nothing served, never an assumed row.

**Policy mapping (skater rows, RSO only):**
| evidence | basis | counts |
|---|---|---|
| confirmed lineup news | confirmed_playing | full line |
| confirmed out news / roster SCRATCH, SUSPENSION, NON_ROSTER, SENDDOWN | confirmed_out | 0 |
| injured (DTD, INJURY_OUT, INJURY_IR, IR, LTIR), no confirmation | assumed_out | 0 |
| active roster, no injury/exclusion (projected lineup, reserve, RETURN/CALLUP/BENCHING) | assumed_playing | full line |
| conflicting ev/availability reports | status default (assumed_*), note says reports conflict | per default |
Goalies unchanged (start probability path).

**Assumed vs confirmed carriage:** last limitation = a fixed participation note (exported `DETAILED_PARTICIPATION_NOTES`,
`detailedParticipationBasisOf(forecast)`); `appearanceProbability` 1/0 only when confirmed, null when assumed;
`conditionalStats` keeps the "if he plays" line. UI (RSO forecast evidence) and receipts carry the limitation text.
**Update chain:** a later confirmation arrives as accepted news → earlier revision withdrawn (`stale_source`), its row
never rewritten; the next issued revision (later issuedAt) replaces it in admission.
**Daily RSO:** unchanged code. Side effect only via planning.ts's `!admitted.length` bridge fallback (more Detailed rows
admitted can suppress the interim bridge when native serving is on) — flag to Chef, no change.

## State / checks
- Released closure: 0446100e09f468bc061dbc7049ddc1fddec54237a617d7e63ca4835a66b48223; candidate --print identical.
- Candidate commit 3f1138cb2 (amended; detached worktree, 5 files). Vitest 274 pass/1 skip (admission, planning, dailyDecisionReplay,
  start-chart API, hostedReaders); typecheck exit 0; eslint touched files exit 0.
- Report + reader table: side-session-notes/local_091a3ca0…/participation-policy-REPORT.md.
- Design sent to parent local_091a3ca0 (Chef id local_9996b7b8 not found by SendMessage).

## Next step
Chef: integrate/release decision. Verified: RSO admission of assumed skaters suppresses the planning.ts
interim-bridge fallback for skater-only revisions (P07 design); release with a reviewed scope or an env gate. Open: empty RSO use-policy catalog (Detailed → use_not_approved), RETURN mapping,
healthy extras, UI chip follow-up.

## Blockers / approvals
None yet. Open questions flagged to Chef: healthy players outside projected lineup counted as assumed playing (literal
policy); BENCHING treated as healthy.

## Insights
- consumerRevisionAdmission/hostedReaders/planning.ts are outside the producer closure; starterBoardScoring is inside.

## Rev 2 (TJ answers via Chef, 11/21 afternoon)
- 3f1138cb2 is rev 1 (TJ rejected RETURN → assumed_playing and the stale_source withdrawal model).
- Rev 2 design sent before coding: side-session-notes/local_091a3ca0…/participation-policy-DESIGN-REV2.md. In it: a read-time
  availability overlay, an appearance fallback, bridge loads when nothing usable is admitted, no migration, closure unchanged,
  lineage forge-rso-participation-overlay-v1:skater@<rev>.
- Gotchas: RETURN events expire after 30h while INJURY_OUT never closes; possible/confirmed survive only in roster event payload.subcategory.
- Waiting on Chef: Q1 appearance source table, Q2 RETURN next-game rule, Q3 line-role trade-off. Then implement as a new commit on 3f1138cb2.
- Rev 2 committed fe2dafd64 (on 3f1138cb2): read-time overlay (rsoParticipationOverlay.ts), bridge-when-nothing-usable,
  overlay lineage. Touched tests 276 pass/1 skip; related RSO/Yahoo suites 636 pass; typecheck 0; eslint 0; closure 0446100e.
  Report: side-session-notes/…/participation-policy-REPORT-REV2.md; sent to Chef.
- Gotcha: evaluatePlan treats players without eligibilityVerified=true as value-unknown (planner fixtures need it).
- Next: Chef integration/release decision; review lane matches forge-rso-participation-overlay-v1:skater.
- Rev 3 committed ddcf2d078: ForecastEvidence shows basis + change lines (labels in pure rsoParticipationNotes.ts);
  receipts proven for transport, saved snapshot and planner inputs; the live readback receipt does not carry the basis
  (fix proposed, not done). Loader bounded: roster events within 365 days and still active; appearances only for injured.
  961 pass/1 skip; typecheck 0; eslint 0; closure 0446100e. The player detail panel was skipped (leased RSO file).
- Gotcha: AbortSignal.timeout is missing in the jsdom test env; loader tests need `// @vitest-environment node`.
- Rev 4 committed 47a1a2628: the Detailed HostedRsoReader carries participation {basis, flags, last 5 [at, sourceId]};
  worst-case readers jsonb is 1,574 B (limit 4000). 1045 pass/1 skip; typecheck 0; eslint 0; closure 0446100e.
  merge-tree against origin/master c922514df is clean. The player panel waits for the RSO lane to release RosterScheduleOptimizer.tsx.
- Candidate chain: 3f1138cb2 → fe2dafd64 → ddcf2d078 → 47a1a2628 (detached worktree, not pushed).

## PARKED (TJ via Chef, 2026-11-21)
- Status: parked. The candidate ships only together with the review-before-use scope for
  forge-rso-participation-overlay-v1:skater, as one release, once that scope is approved.
- Chain (detached worktree /private/tmp/forge-participation-policy-20261121, not pushed, not rebased):
  3f1138cb2 → fe2dafd64 → ddcf2d078 → 47a1a2628. Chef-verified; merge-tree onto origin/master c922514df is clean (487d72a2).
- Untracked web/node_modules in that worktree is a symlink to the main checkout's (never commit it).
- Open follow-up: the player-panel label (participationDisplay for the selected player's game rows) in
  RosterScheduleOptimizer.tsx, after the RSO-CUSTOMER-BUGS-1121 lane releases that file.
- Next: none until Chef messages.
