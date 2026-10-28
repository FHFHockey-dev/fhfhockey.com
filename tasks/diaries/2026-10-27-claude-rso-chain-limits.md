# RSO streaming chain limits (Claude, 2026-10-27)

## Scope
Lift the streaming-chain limits from STREAMING-CHAIN/RECEIPT.md. Started by Chef (local_88650158…).

## Where
octoberBranch, local commits only (no push):
- 1122b60ef: goalie minimum
- 1340c6543: Thu-start test
- 43af471c1: accept-risk fix
- e26058b06: blend + FPts-first
- c595e516d: all drop candidates
- 49b37bc7a: work bound
- d46eb63a9: waiver claims

Each limit has a section in RECEIPT.md.

## State
Done. On the final tree: RSO vitest in UTC and in America/New_York, 1486/1486 each; tsc exit 0; eslint clean.
Intermediate commits 1340c6543, c595e516d and 49b37bc7a were split in the index. Each was checked as part of the full tree, not tested on its own.

## TJ decisions (pop-up)
- Order: stars, drops, waivers.
- "Accept risk" must never push goalies up.
- Rank by the average of FORGE projected FPts and L10 FPts/G per game.
- Winning the week beats a one-game spot start.
- Asked for a FORGE accountability table: proposed as a separate session card (task_c87be39d).

## Next / follow-ups
- No-claim fallback legs when a waiver claim fails.
- Waiver budget spend for budget leagues.
- Time the chain on a production-size weekly pool. The work bound is deterministic, but the run was not timed.

## Gotchas
- Fixture goalieMinimum periods must be date strings. A zonedMidnight end leaves the window unverified.
- No production caller sets timeBudgetMs, so a time deadline alone does not bound the work.
- Under "outcome", a 0-AGP swap (weak player for a better one on the same days) is a valid FPts-first chain.
