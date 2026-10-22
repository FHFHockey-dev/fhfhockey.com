# Handoff diary: why FORGE/RSO skips regular skaters (2026-10-19 → 10-20)

## 1. Scope
- **Task** (from the parent session "Code handoff review and project recommendation", `local_08a0bf1c…`): find out why the RSO's interim FORGE daily bridge covers only about 12 skaters per team when FORGE targets 18. Propose a fix; don't implement it.
- **Why:** in TJ's 10-19 RSO snapshot only 356 of 901 skaters had projections. Regulars such as Dahlin, Faber, Hyman and Hellebuyck were missing, which hurts add/drop suggestions.
- **Assignment:** diagnosis only. No task IDs were given beyond this brief.

## 2. Where
- **Checkout:** `/Users/tim/Code/fhfhockey.com`, branch `octoberBranch` (HEAD at start: `8a6ac8adc`). Released master is `707f60e83` (R6c).
- **Repo files touched:** none. The only file I created is this diary.
- **Full write-up with all queries and results** (FINAL DIAGNOSIS section):
  `/Users/tim/Library/Application Support/Claude/side-session-notes/local_08a0bf1c-fda1-4d08-9f56-8ff961d00e41/forge-skater-pool-coverage-2026-10-19.md`
- **Code read:**
  - `web/lib/rosterScheduleData/forgeDailyBridge.ts`
  - `web/lib/projections/stages/skater-stage.ts`
  - `web/lib/projections/calculators/skater-adjustments.ts`
  - `web/lib/projections/queries/skater-queries.ts`
  - `web/lib/projections/queries/run-lifecycle-queries.ts`
  - `web/lib/projections/nativeGoalAccounting.ts`
  - `web/lib/rosterScheduleData/planningInputs.ts`

## 3. State
**Diagnosis is complete. No fix is implemented by me.**

**Production reads:** Q1–Q5, each read-only, run once on TJ's approval via Supabase `execute_sql`. No writes, route runs, deploys or commits.

**Findings (counts are skaters in the RSO list, 901 on teams playing 10-19 to 10-25):**
- **FORGE writes 17–18 skaters per team in every run** (568 in the teams' latest runs). The pool filters and recovery dropped nobody. Identity failures: 3.
- **~209 dropped by the bridge for blank goal/assist values.**
  - Commit `6e14053ff` (2026-10-11, on octoberBranch, **not in master**) leaves PP (and sometimes ES) goal/assist values null when there is no aligned NST pair (`skater-adjustments.ts:604`, :647).
  - `forgeDailyBridge.ts:215–217` returns null for such a row, and :334 skips it silently.
  - Q5: 648 of 1,807 rows are blank. 533 are PP-only, 112 PP+ES, 3 ES-only.
  - EDM kept only its 6 PP skaters.
- **54 dropped by the stale rule** (`forgeDailyBridge.ts:331`): each sat out his team's latest game.
- **~282 never projected by FORGE** (by design: not in the team's last-game lineup).
- **Run provenance:**
  - All 7 runs the RSO used (as_of 10-13 to 10-19) were created on 2026-10-19 between 18:04Z and 19:12Z.
  - All have `git_sha` null, and no SHA-stamped run exists for those dates.
  - Only octoberBranch code nulls heads, so these were produced outside the release path. Who ran them is not established.
- **Named players:**
  - All 12 skaters were outside their team's last-game lineup.
  - Dahlin, Johnston and Tavares are also stale; each missed one game.
  - Faber, Barzal, Nugent-Hopkins, Jarvis and Terry have 0 games this season.
  - Hyman, Sanderson, Marchand and Morrissey were last seen between 09-29 and 10-07.
  - Injuries are likely but not verified.
- **Ruled out:** the 2.5 MB byte trim (1.93 MB, no trim line) and team mismatches (0).

**Hand-offs:**
- I sent the parent Q5's results and per-team drops.
- The parent said it will fix `forgeDailyBridge.ts` itself: blank PP → 0 when ES is present.
- **I didn't run tests,** because I changed no code.

## 4. Next
- No task is planned for me.
- **Suggested first step for whoever continues:** review the parent's bridge change.
  - Check that rows with blank ES values (115) are counted in limitations, not silently dropped.
  - Check that PP = 0 is applied only when `proj_toi_pp_seconds` is about 0; otherwise the value should be unknown.

## 5. Blocked / needs TJ
- **FORGE blank-value policy (A-08 / commit `6e14053ff`):** keep withholding heads, or fall back to the shrunk prior rate tagged `prior_only` when no aligned pair exists. `skater-adjustments.ts` was also being edited by the hits/blocks session.
- **Run provenance:** stamp non-Vercel runs `local:unknown` so readers skip them. First verify that Vercel exposes `VERCEL_GIT_COMMIT_SHA` at runtime: Q5 found no SHA-stamped run for any of these dates. Also decide whether the 7 off-release runs should keep serving.
- **Stale rule:** keep a stale skater's line if he missed only one game and has no availability event.

## 6. Insights
- The "12 per team" isn't FORGE's pool. Check the bridge's per-player drops first: `skaterStats` null, the stale rule, identity.
- `forge_team_projections.uncertainty.native_roster_contributor_coverage.contributors[].selectionReason` gives the per-player reason FORGE did or didn't project him. It's the fastest way to diagnose this.
- The bridge and public readers exclude only `git_sha like 'local:%'`, while `run-lifecycle-queries.ts:226` writes null when no SHA env is set. So local runs that write to production are served to users.
- Commit `6e14053ff` is on octoberBranch, not in released master. I called it "uncommitted" at first; that was wrong.
- **Wrong turns:** I first suspected stale `players.team_id`, playoff/preseason recency, the identity filter, then the byte trim. Data ruled out each of them.
- NST gamelog coverage is about 26% for 2026-27 (see the hits/blocks note), so aligned-pair rules withhold a lot.
- TJ's RSO export is private league data. Keep it out of the repo.
