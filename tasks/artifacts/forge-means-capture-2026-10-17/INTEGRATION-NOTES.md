# FORGE v2 `means` stage: integration notes (2026-10-17)

This stage captures fresh native means for the v2 daily pipeline. It is built in new files only; no frozen file was edited. Nothing is committed, and no network, database or Vercel action was taken.

## Files (new, untracked)

| File | Role |
|---|---|
| `web/lib/player-forecasts/nativeDailyMeansCapture.ts` | Pure logic: the capture plan, assembly through `assembleCurrentRosterNativeInputs`, policy assignment, materialization pieces, the coverage report and a parent merge helper |
| `web/lib/player-forecasts/nativeDailyMeansCapture.test.ts` | 10 focused tests |
| `web/scripts/native-means-capture.ts` | Bounded collector, previews and CLI (`plan`, `capture`, `assemble`) |
| `web/scripts/native-means-capture.test.ts` | 4 tests, using an injected transport and the plan-only CLI |
| `web/scripts/native-means-replay.ts` | Offline 2026-10-16 acceptance replay |

The replay report is at `~/Documents/FHFH-private/forge-rso-completion-20261016-v1/native-means-replay-20261017-v1/report.json`, sha256 `7e6c6daa4a3b9f1998acbeb3b09d59fd324957ee9ead27167728f751921b8ad4`.
- Its replay results still hold. Its budget section predates the game release; the current budget is below.
- The post-release rerun was written only to this session's scratchpad, which is not durable.

## Released walk-forward games (2026-10-17)

TJ released all 8 formerly sealed walk-forward games (2026020106, 2026020108–2026020111, 2026020114, 2026020116, 2026020117). The record is `FHFH-private/forge-walk-forward-20261014-v1/protocol/closure-amendment-20261017-v1.json` (sha256 `e2c5f491660f0004360d8eeb3a88d0414aac639300dc2322683d6816f323b364`), and it sets `stillSealedGameIds: []`.

- The stage now treats those games and their dates (Oct 14–15) as ordinary inputs: weekly schedules, boxscores, landings and goalie summaries. It has no module-level seal.
- The only exclusion mechanism is the generic `excludedGameIds` plan input, which is empty by default and tested.
- The replay passes the 2026-10-16 exclusion explicitly: the history cut before 2026-10-13 (`historyBefore`), plus that day's 52-game reservation register from `native-capture-allocation-v2.json` (`excludedGameIds`). So it still reproduces Oct 16 exactly.

## What the stage does

1. **Plan.** `planNativeMeansCapture({ seasonId, asOf, scheduleAnchor, universe, cache, excludedGameIds?, priorSeasonGames?, historyBefore? })` is pure.
   - It walks the weekly schedules newest-first on the grid from the anchor. A cached week is reused unless it is stale.
   - For each universe club it takes the latest 20 final regular-season games. It extends that window by the largest per-player appearance deficit, up to a cap of 40 club games.
   - It then requests each game's `boxscore` and `landing` once.
   - Goalie summaries are planned once a club's window is settled. Prior-season sources are planned only for skaters with zero current appearances whose current-season history is complete back to the anchor.
   - It returns `requests`, an estimate (requests and bytes by kind), per-club, per-player, summary and prior status, and an `assembly` block.
   - Re-run it after each collection round. It converges to `status: "complete"`.
2. **Collect.** `collectNativeMeansOriginals` is serial, with 1 s spacing and an 8 s timeout.
   - Byte caps: 1 MiB per body; 2 MiB in total by default.
   - No retries; `redirect: "error"`.
   - An exact allowlist (`nativeMeansUrlKind`), and a durable `request_intent` event before each request.
   - `capture --execute true` loops plan → collect for at most 5 rounds within one request/byte budget. It stops on a failure, on no progress or at the budget, and writes `ledger.jsonl`, `receipts.json`, `cache-next.json` and `plan-final.json`.
   - Defaults are 120 requests / 2 MiB. Raising them needs `--approval-ref`, with hard ceilings of 400 requests / 8 MiB.
3. **Assemble.** `assembleNativeDailyMeans` groups players by identical game set and calls the unchanged assembler within its bounds (≤50 roster, ≤60 games, ≤120 receipts per call).
4. **Assign policies** (PRD requirement 3):
   - Skaters → current-appearance.
   - Zero-appearance skaters with captured prior-season boxscores → prior-appearance.
   - Goalies → volume + win.
   - Goalies with a usable official summary → shutout.
   - A win withheld for a missing decision becomes summary-win only when the summary closes every gap; otherwise WINS stays missing, with a reason.
   - An optional policy (SO/SW) whose target is withheld is not selected.
5. **Emit** `nativeSelection`, `additionalNativeObservations`, and `parents`/`requiredParents`. For every boxscore/landing, the parents are an original (`hash` = body sha256) plus a content-hash derived parent (`hash` = `contentHash`). Summaries get an original parent.
   - The materializer's binding check is mirrored before hand-over.
   - It also emits a per-player/per-target coverage report with explicit missing reasons. No unknown becomes zero.
   - `previewNativeDailyMeans` (in the script) produces unreleased per-player previews with the existing producers, plus the summary-win builder with `dryRunGoalieContributionBundle`.

## Verification (2026-10-17)

| Check | Result |
|---|---|
| `npx vitest --run` on the two new test files | 14/14 passed (rerun after the release change) |
| ESLint on the 5 new files | 0 errors, 0 warnings (rerun after the release change) |
| Scoped `tsc` (the 5 files and everything they import) | 0 errors (rerun after the release change) |
| Offline replay | 80/81 of the retained 2026-10-16 `nativeSelection` reproduced byte-identically (same `inputHash`); 0 network calls |
| Replay: the 81st entry | Fiala's prior-appearance policy is assigned, and every mean is identical. Byte identity is impossible by construction: on 2026-10-16 the inputs were database raw rows with April fetch clocks and PBP roster lineage, while the stage consumes HTTP receipts |
| Replay: policy assignment | Across all runs, the (player, policy) set equals the retained set, apart from Fiala's DB-row input above |
| Replay: previews | The existing producers on the 80 reproduced inputs give 573/573 sources with identical means **and** identical source IDs to the reviewed 2026-10-16 bundles |
| Replay: materializer | The unchanged `prepareNativeInputMaterialization` accepts the pieces with the retained acquisition: 203 rows, 359 parents, 80 expected items |
| Replay: plan | From the retained schedules, the plan picks exactly the 2026-10-16 game scopes: 60 owned-club games and 88 universe-club games. Assembling from the plan reproduces all 20 owned-batch selections |

The replay rows above were rerun after the release change, with identical results.

The full `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit` (whole web tree, including the other sessions' current edits) exited 0 with no errors in 51 s. It ran before the release change and was not rerun, because nothing imports these files and the scoped check covers them.

One disclosure: early on I also ran one full `npx tsc --noEmit` by mistake (default heap, no 8 GB flag), before most of this code existed. So two full typechecks ran this session, against the one-at-the-end limit. All other iteration used the scoped check.

## First-run and steady-state budget

These numbers are for the first scheduled run (2026-10-20 07:00 ET) on the same 69-player universe, with the retained 2026-10-16 receipts as the cache. Oct 14–15 are included.

| Case | Requests | Bytes (est.) | vs TJ's bound (≈120 / ≈2 MB) |
|---|---|---|---|
| First run, seeded cache | **111** | **≈1.64 MB** | within, narrowly |
| Same, plus Fiala's prior (20 prior-season boxscores; landings already retained) | 131 | ≈1.92 MB | **exceeds** on requests (bytes within) |
| Empty cache (no retained receipts) | 289 | ≈4.29 MB | **exceeds**: seed the cache, or ask TJ |
| Steady state, per day | ≈18 | ≈0.3 MB | within |

**Needs TJ's decision.** A first run that includes Fiala's prior-season boxscores (131 requests) exceeds TJ's ≈120-request bound. TJ must either approve the larger first run (`--approval-ref`, `--max-requests`) or defer Fiala's prior to a later run; until then his means stay unknown.

- **First run, seeded.**
  - Round 1 is 2 schedule weeks (≈190 KB): `/schedule/2026-10-20` and `/2026-10-13`.
  - Then 51 games, each with a boxscore and a landing: an estimated 29 played Oct 13–15 (from the gap in game IDs, including the 8 released games), plus 22 on Oct 16–19 from the retained schedules.
  - Then 7 goalie summaries, one per universe goalie.
- **Steady state.** About 7 league games a day, each with a boxscore and a landing, plus 1 schedule week (≈95 KB, the biggest item) and about 3 summaries.
- **Byte estimates** use mean retained body sizes: schedule 95 KB, boxscore and landing 14 KB each, summary 2.5 KB.

## Wiring into `forge-daily.ts` (after 2026-10-20 17:00 UTC; Chef)

1. **Order.** universe (`forge-daily-universe.ts`) → means `capture` (NHL GETs; may share the run's GET budget with v1 capture) → rolling participation → `inputs`.
2. **Universe mapping.** The Yahoo universe rows use `class`. Map with `{ playerId, nhlPlayerId, teamId, playerClass: row.class, rosterRevision, yahooPlayerKey }`.
3. **Cache.** Keep one cumulative private `{ receipts }` cache. Seed it with the retained originals:
   - `native-capture-v2/receipts.json`
   - `candidate-participation-capture-v1`
   - `candidate-conditional-capture-v1`
   - the summaries embedded in `goalie-shutout-*-v1/observation.json`
   - `fiala-prior-landings-v1`
   - the retained weekly schedules from the retained request's parents (Sep 29 and Oct 6 are settled)

   After each run, carry `cache-next.json` forward, pinned by sha256. Final bodies are reused from the earliest final capture.
4. **Plan arguments.** `--anchor 2026-09-29`, the season's first weekly-grid date, which matches the frozen-window weeks. `--as-of` is the run instant.
5. **Cutoff.** Pass `assemble --cutoff` as an instant at or after the last means capture. Observations carry it as `capturedAt`/`available_at`. The driver's `acquisition.cutoffAt` must be ≥ it.
6. **Request composition.**
   - `nativeSelection` and `additionalNativeObservations` come from `means.json`.
   - Build parents with `mergeNativeMaterializationParents(participationParents, means.parents)`, putting participation first: its evidence ids are checked exactly, while native observations bind by hash only. A goalie-starter label uses `boxscore:http:<sha>` for the same content hash.
   - `existingInputs` is empty, because every daily observation hash is new.
   - `acquisition` can stay the retained one or be a minimal ≤60-game/≤120-receipt subset. Its roster must list every selected player (≤100).
   - v1's `buildDailyMaterializationRequest` clones the retained additional observations and existing inputs, so v2 needs a new builder in a new file.
7. **Outputs path.** `prepareNativeCadenceOutputs` daily mode requires the reviewed plan's sources to reproduce exactly (`reproduced_source_changed`). Fresh means cannot pass it.
   - v2 needs a candidate-plan path: build new bundles from the selected inputs (the 2026-10-16 `native-publication-candidate-v1` route) and new pending review rows.
   - The policy versions and definition hashes are unchanged, so the standing approval applies once the independent reviewer approves the plan hash.
8. **Previews.** `assemble --bindings` takes `{ [playerId]: { gameId, scheduledAt, scheduleRevision } }`, the next bound game from the scope or participation stage. Previews need `now − cutoff ≤ 24 h` and a pregame expiry.

## Risks and decisions for TJ/Chef

1. **Materialization byte bound (blocker within about 1–2 weeks of v2).**
   - A selected observation embeds about 53 KB per appearance: boxscore and landing bodies, raw and parsed. Goalies carry them once per policy.
   - On the 80 reproduced inputs (avg ≈4.75 appearances) observations are 20.2 MB, and the request is 27.2 MB.
   - Projected observation bytes for the same 80 inputs: 10 appearances ≈42 MB, 15 ≈64 MB, 20 ≈85 MB. Parents and participation inputs come on top.
   - The materializer refuses a request over 64 MiB (`nativeInputMaterialization.ts`, frozen).
   - Expect about 9–10 appearances per player on 2026-10-20 (≈6 club games before Oct 13, plus ≈3.5 on Oct 13–19 now that Oct 14–15 count). That is ≈40 MB of observations, plus ≈8 MB of parents and ≈10 MB of participation inputs: ≈58 MB, under the bound.
   - The bound is crossed at about 12 appearances, around Oct 28–30.
   - Options:
     - (a) Split into several materializations/sourceKeys. `observeClosedNativeCadenceSources` already loops `requiredSources`, but `prepareNativeCadenceOutputs` binds one materialization.
     - (b) Raise the bound in the frozen file, with review.
     - (c) Change the observation format, which is a method/provenance change.
2. **Prior-season discovery needs an input.** The stage needs explicit prior-season game IDs per zero-appearance skater (`--prior-games`). On 2026-10-16 they came from FHFH historical rosters (Supabase). Options:
   - the scope stage supplies them;
   - TJ approves a new endpoint, `/v1/player/{id}/game-log/{prevSeason}/2`. Its response shape was not verified offline.

   Without them, the skater is reported `prior_season_games_not_supplied` and their targets stay unknown. Fiala's 2026-10-16 IDs are in the retained observation, and their landings are already cached. Supplying them on the first run takes it to 131 requests, over the bound (see the budget section).
3. **Summary URL form.** The stage uses `nativeGoalieSummaryUrl` (`start=0`, `factCayenneExp=gamesPlayed>=1`) because only that form passes the SO and summary-win validators. The variant quoted in the brief, from `capture-goalie-summaries.py`, would be refused.
4. **Known method limits (unchanged methods).**
   - The SO summary is limited to 60 days, so from about mid-December, goalies whose latest 20 appearances span more than 60 days will have SO withheld.
   - Club windows cover current-club games only; traded players' earlier-club games are absent, as stated in the observation limitations.
   - The lookback is capped at 40 club games, so a long-injured skater may fall short of 20 appearances; the coverage report flags `lookback_capped_at_40_club_games`.
5. **Bundled runs.** When bundling with esbuild, call `runNativeMeansReplay`/`runNativeMeansCapture` from a runner and pass `--define:require.main=null`. Otherwise the imported scripts' own CLI entry points also start. They stop at argument parsing; I checked that they had no side effects.

## Run commands (offline unless `--execute true`)

```bash
npx esbuild scripts/native-means-capture.ts --bundle --platform=node --format=cjs --outfile=/tmp/means.cjs
node /tmp/means.cjs capture --universe U.json --universe-sha256 H --cache C.json --cache-sha256 H --season 20262027 --as-of 2026-10-20T11:00:00Z --anchor 2026-09-29 --out NEW_DIR
node /tmp/means.cjs assemble --universe U.json --universe-sha256 H --cache NEXT.json --cache-sha256 H --plan NEW_DIR/plan-final.json --plan-sha256 H --cutoff ISO --bindings B.json --bindings-sha256 H --out NEW_DIR2
```

For a real capture, add `--execute true` to the first command (and the `require.main` caveat above applies to the bundle).
