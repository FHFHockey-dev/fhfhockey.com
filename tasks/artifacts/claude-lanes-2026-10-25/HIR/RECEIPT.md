# HIR — RSO-HEALTHY-RESERVES (D2) receipt

Lane HIR, Claude, 2026-10-25. Base `ac98431aa`, octoberBranch. I ran no Git writes and set no GIT_DIR. There were no provider, DB or live calls.

## Pins
At start, all four leased files matched their CLAUDE-LEASES.json baselines (e1a203d3…, 394fc6de…, 793e2d27…, 159e3b49…).

## Changed paths (final sha256)
| Path | sha256 |
|---|---|
| web/lib/rosterScheduleOptimizer/healthyReserves.ts | 91b99377b80c1e363361d8504eee67c2ab62e2b905ab216932411112d34bba6c |
| web/lib/rosterScheduleOptimizer/healthyReserves.test.ts | d88f46862ef7a6bbcb6c3854f2c8993f87463f6f7bc34874f5dd500bffb4f603 |
| web/components/RosterScheduleOptimizer/HealthyReserveAlert.tsx | 985f698d5354b2010e3353966692819656449fa29b5b49f4f0d523b2593030bc |
| web/components/RosterScheduleOptimizer/HealthyReserveAlert.test.tsx | 20ff1db97054abcf6c89c3d95508fe2953e70e18cc1d5753393f07eb36ce63ad |
| web/components/RosterScheduleOptimizer/RosterScheduleOptimizer.tsx | a30eba6ce13deb6315575fb3822e9a56694e0a6372aff3024594a3aa2afe4d7c |

Patch: `hir.patch` (sha256 b65f0872024fbb27c15b3189b4339f39077fe71f5ae0c516b3e6ab2de5bc553b), 5 files, +55/−5.
The orchestrator granted the parent `RosterScheduleOptimizer.tsx` lease (drop-notice seam only), pinned at baseline 3d7e8ac4…. I rechecked the pin before editing and it matched HEAD.

## Clause reconciliation
| Clause | Finding | Disposition |
|---|---|---|
| Duplicate notice (R2 / CR-RSO-01) | **Reproduced.** In the 10-22 healthy-IR case, `lineupGapReport` blocks d with "in IR without verified IR eligibility … move him to an active or bench spot". The parent's "No drop suggested" notice shows that next to the alert's own illegal-lineup message and move. The row chip title does not repeat it, because a reserved player is never in `unprojectedDrops`. | Added the pure helper `withoutHealthyReserves()`. It drops only blockers that name a flagged healthy reserve and keeps injured-ineligible (DTD in IR+ with no eligibility), lineup-wide and manual/partial-roster rows. **Wiring needs the parent seam (pending).** |
| Gain shown when unknown | **Reproduced.** Both gains are null only when one of the two lineups fails the rule check, so "Gain unknown until projections cover the lineup" always named the wrong cause. For example, a weekly league with an unverified window gives null/null. | The text now reads "Gain unknown until the lineup passes the rule check". |
| Gain shown as zero | **Reproduced.** When points are unknown and there are 0 added active games, the alert said "No projected gain this week". But the player can still outscore the starter he replaces (fixture: 3 vs 1 pts/game, one forecast missing). | The text now reads "No added active games this week". "No projected gain" stays only for a known gain of ≤0. |
| Known healthy vs unknown injury | Already satisfied. Only `injury === null`, from a live and complete Yahoo read, is flagged. `undefined`, manual and partial reads are not flagged (existing tests). | Closed. No change. |
| DTD / O / IR / IR+ / NA | Already satisfied. DTD and O in IR+, and IR-LT in IR, are legally placed and not flagged. NA is out of scope by design. A DTD player in IR without eligibility is not flagged, and its injured-ineligible blocker is preserved (new test). | Closed. Policy question 1 below. |
| Incomplete provider data | Already satisfied (manual and partial evidence give no flags). | Closed. |
| Activation with and without space | Already satisfied: open spot, swap, or null with a drop message (existing tests). A second flagged player beyond the open spots gets null or a swap. | Closed. Policy question 2 below. |
| Weekly / locked controls | No defect on this surface. Today's started daily games are excluded: the gain counts only the remaining game (+3 pts, +1 game; new test). A weekly league with unverified windows stays unknown, never zero (new test). In a locked weekly window, the helper inherits the planner's rule that an unlocked empty slot can still be filled. | Closed for this surface. Policy question 3 below. |

## Checks (all run locally)
- Focused Vitest, both test files: **11/11 passed** (healthyReserves 9, alert 2).
- Original failure: the new alert test against the baseline alert (`git show HEAD:`) **fails** with "Unable to find … Gain unknown until the lineup passes the rule check" (`alert-baseline-failure.txt`). I then restored the new alert and checked its hash. The helper tests are new behavior (a new export), so they have no baseline run.
- Scoped `tsc` (temporary tsconfig limited to the 4 files plus ambient d.ts, then removed): **exit 0**.
- `eslint` on the 4 files: **exit 0**.
- Heavy checks ran under `/private/tmp/fhfh-heavy.lock` (mkdir, OWNER file), and the lock was released afterwards.
- Synthetic fixtures only. Nothing here qualifies live Yahoo rules.

## Parent seam (applied)
- `RosterScheduleOptimizer.tsx` has three changes: an import; `dropBlockers = withoutHealthyReserves(gapReport.projectionBlockers, healthyReserves)` right after `gapReport`; and the first drop notice now uses `dropBlockers`. `gapReport` is non-null only when `result` is, which is exactly when the alert renders. The notice hides only if nothing is left. Unchanged: the `unprojectedDrops` notice condition, the row chip `unprojectedReason`, and `lineupGaps.ts`.
- Regression tests (in `healthyReserves.test.ts`): the 10-22 duplicate (healthy d, removed), plus rows that must remain — DTD f in IR+ without eligibility, a lineup-wide null blocker, and a manual roster.
- Re-run after the seam: healthyReserves, alert and lineupGaps tests **21/21**; parent `RosterScheduleOptimizer.points.test.tsx` **13/13**. Scoped `tsc` including the parent: **exit 0**. `eslint` on all 5 files: **exit 0** with 0 errors; 6 older `react-hooks/exhaustive-deps` warnings in the parent at lines 297–667, none on changed lines. Run under the heavy lock.
- No browser/E2E run. The drop notice has no parent render test, so the wiring is verified by tsc and the helper tests, not by a rendered assertion.

## Policy questions (not implemented; no Yahoo rules invented)
1. Should a DTD player in IR+ get a game-day "may play, consider activating" note? This is product policy (ledger R3). The current behavior treats him as legally reserved and silent.
2. When two flagged players compete for one open spot or one swap partner, each notice is a correct no-other-move action on its own, but they cannot all be done at once. Should the alert rank them or say "one of"?
3. Yahoo weekly leagues: can a player be activated from IR into an empty slot after the week locks? This is set by the planning engine (read-only, `planning.ts` weekly windows), not by this surface.
