# Math audit W1-4: team-ratings-power-ctpi-sos

- **Scope:** audit M-TEAM-001–056 (read-only). No code changes.
- **Where:** `octoberBranch`, commit `cdd8fb016` (audit file only, not pushed). Output: `tasks/artifacts/calculation-inventory-2026-11-10/master/audits/team-ratings-power-ctpi-sos.md`.
- **State:** done and handed to Chef. 19 sound, 16 mis-specified, 21 wrong, 0 undetermined.
- **Checks run:** bounded read-only SQL (catalog, one-date reads, aggregates; 0 active queries before each); offline recomputation with the production rating functions reproduced 12 of 12 stored ratings. No tests, builds or pages run.
- **Next (Chef / owner):** answer the eight owner questions in section 4 of the audit; confirm the Top Adds NaN in the running `/FORGE` page; hand the rating-noise note to the game-predictions audit and the landing PP%/PK% note (M-UST-033) to the underlying-stats audit.
- **Blockers / pending approvals:** intended definitions (power rating, early-season prior, pace, tiers, SOS, CTPI v2, legacy retirement) need owner approval before any fix.
- **Gotchas:**
  - Triage C21 (5v5 double count) is not live: the writer's 5v5 query filters `situation='all'` and matches 0 rows. Do not "fix" that filter alone, or games will be double-counted.
  - `nst_team_gamelogs_as_rates` and `nst_team_all` both mix season-total snapshot rows (`gp>1`) with single-game rows. Any reader without `gp = 1` is suspect.
  - `wgo_team_stats` is one row per game; its `power_play_pct` is a single game's value.
  - Node 22 runs `.mts` with `--experimental-strip-types`, so pure functions in `web/lib/power-ratings.ts` can be imported for offline recomputation.
  - The local export and scripts live in the session scratchpad, not the repo.
