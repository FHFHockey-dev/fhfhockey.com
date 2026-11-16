# 2026-11-16 Claude: FORGE projection math lane (H4, M3, L1)

## Scope
Fix audit findings H4 (short skater pool gets the full team TOI and shots), M3 (dressed players without a `rosters`
row dropped with no counter) and L1 (`missing_pbp_games` counts the target game). Audit:
`tasks/artifacts/forge-projection-audit-2026-11-16/blind/AUDIT.md`.

## Where
- Worktree `/Users/tim/Code/fhfhockey-forge-math`, branch `chef/forge-projection-math` from octoberBranch `3dc9ae1ba`
  (TJ pop-up: isolated worktree). `web/node_modules` is a symlink to the canonical checkout's.
- Files: `calculators/scenario-blending.ts`, `stages/skater-stage.ts`, `run-forge-projections.ts` (L1),
  tests `runProjectionV2.test.ts`, `run-forge-projections.resume.test.ts` (fake gets `lt` + team `or`),
  new `run-forge-projections.projection-math.test.ts`. `reconcile.ts` unchanged (the stage passes capped targets).
- Untracked scratch probes (never commit, delete when done): `web/lib/projections/zz-scratch-forge-math-*.test.ts`.
- Evidence in the session scratchpad: probe dumps before/after, `fixture-before-after.md`, `utah/q1.csv`, `utah/q2.csv`.

## Decisions (TJ pop-ups, 17:45Z and 18:40Z)
- H4: TJ's own rule. Full pool unchanged. Incomplete pool: target = min(pool/18 x budget, own pre-allocation
  seconds), never scaled up; team-average shots are a ceiling (team x modeled share), not a target; same below 15.
  Team row, opposing goalie shots against, team goals, game forecast and reserve environment keep the full-team
  figure (modeled + unmodeled; goals at the pool's per-shot rates). Missing coverage reported in team uncertainty.
- M3: count and name only (`filtered_skater_not_on_team_current_roster` + `_ids`, warning).
- L1 (my call): check each slate team's previous game before min(target date, ET date of the cutoff).
- Oracle: the Chef re-records after the capture closes and TJ approves; I hand over candidate SHA + per-scenario diff.
- Lease: Chef recorded a carve-out for skater-stage.ts and run-forge-projections.ts (lease 36 stays active).
- Utah reads: TJ approved Q1 and Q2 once each. Q2 first failed on a round() cast (no data) and was rerun once fixed.

## Checks (18:00Z)
- `npx vitest run lib/projections`: 1916 passed, 23 failed = all oracle comparisons in pregameCapture parity (18)
  and computeOff (5). Collector-vs-writer reads still match; strict transport accepts the new reads.
- New test file 8/8; runProjectionV2 128/128; resume 20/20. typecheck exit 0; eslint on touched files exit 0.
- Fixture: team TOI/shots and goalie shots-against/saves/GA identical; team goals +-0.002, win prob +-0.0005
  (rounding). Reserve rows identical. Compute-off: same write tables, results and candidates.

## Gotchas
- Team goals cannot be byte-identical: they are sums of 3-decimal player rows, rescaled.
- Below 15 the team row TOI now shows the full 300 min (was the pool's own exposure); no reader uses team TOI.
- `skater_pool_emergency_toi_target_caps_applied` now counts every incomplete pool (name kept).
- Short pools are not scaled up while full pools are (~+5% today), by TJ's rule.

## Commits (branch chef/forge-projection-math, 18:15Z)
- `95711cd2c` L1, `ebfe8fb1d` M3, `fb833ddb2` H4, `d578bfe80` tests (uncapped H4 branch; L1 healthy path under the
  strict transport). Candidate = `d578bfe80f70ffd5dbd8227e3629b2d5f9ccaefe`. Worktree clean; probes moved out.
- Final run at d578bfe80: lib/projections 1918 passed, 23 failed (oracle comparisons only).
- Hand-over for the Chef (oracle expectation diff, fixture tables, Utah): side-session notes folder,
  `forge-math-lane-handover-2026-11-16.md`, `forge-math-fixture-per-player-2026-11-16.md`, `forge-math-probes/`.
- Healthy production path costs +7 reads per game (1 lookup + 3 PBP + 1 shift page per team); fixture shows +5.
- Uncapped branch (own minutes below ceiling): 17-pool keeps own 241.6 min while an 18-pool is still scaled up to
  300. Flagged to TJ as a consequence of "never scale up".

## Next
Chef: after capture close, bring candidate + diff to TJ, re-record oracle, rerun parity, then merge. Then this
worktree can be removed (`git worktree remove`), and the branch deleted once merged.

## Blockers
None. Merge to octoberBranch waits for capture close + TJ's oracle approval (Chef).
- Chef acknowledged d578bfe80 (~18:20Z): no more commits unless asked, keep the worktree, no push, probes stay out of
  the repo. The Chef messages this lane when the merge starts.
