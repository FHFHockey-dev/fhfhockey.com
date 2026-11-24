# Scheduled FORGE reads standalone WGO: release candidate (2026-11-22)

**Status: local only. Nothing has been pushed, built, deployed or written to production, and no production data was read.**

**Candidate M′: `a86a998983876fd2e0b51c657688ab105e598f10`**, a detached commit in `/private/tmp/forge-wgo-handoff-20261122`.

- **Base:** Chef's `a9e08f854`, which is master `c2c46ceae` (#464) plus its `7ee3612e` registration. That commit is TJ-approved to push once E2-1 is done.
- **Commits:**
  - `4f362fed2`: writer.
  - `169718455`: gate.
  - `a86a99898`: provisional registration, appended after `7ee3612e` (needs TJ approval).
- **Closure:** `af8b8d11e6d4b77f620d4d356b8ee6d504a5e2d4cf9e08bd975e15a1b80e8723`; 244 modules, 0 findings.
- **Receipt:** `tasks/artifacts/wgo-handoff-fix-2026-11-22/16971845574240e139212e82a9b17ef12db66e34.json`, sha256 `656bc85a…bfb5`, for code commit `169718455`.
- **Production admission** on the exact SHA: PASS.
- **Merge:** origin/master `c2c46ceae` is an ancestor, so this is a fast-forward; `git merge-tree` is clean.
- **Release in two verifiable steps:** `a9e08f854` (#464 alone), then M′.

**Superseded** (do not release):
- cut M `1b80214d1`;
- cut R `52c102849` (dropped; #464 stays);
- earlier readiness cuts `3bb71b523`, `ea4739400`, `bcc2604c2`, `dfd197ca6`, `37c7e34f1`;
- pickup cuts `60373182a`, `97f45e29b`, `f6cd3a1c3`, `3d41aac03`, `2603c1271`, `1ce1b74ef`.

**Rankings migration status** (owner: Rankings lane `local_15e54587`; reported by Chef and Rankings, not checked by me):
- `20261122145409` (blob `a0398d65b`) is written and verified on PG15 and PG17.
- It is uncommitted in the shared checkout; Chef adds it by pathspec at gating.
- It is additive: the old `startDate` receipt still counts.
- Rollback: `tasks/artifacts/rankings-daily-publisher-release-2026-11-21/rollback-20261122145409.sql`.
- It is not in either cut.

## What changed

### 1. WGO writer (`update-wgo-skaters.ts`; in the producer closure)

- After an `action=all` run's writes and before its audit row, the writer calls `rpc('wgo_skater_date_digest', {p_date: D})` for each date in `datesProcessed` and not in `failedDates`.
- It stores the result unchanged at `details.context.sourceDigests[D]`, and also in the response.
- If the RPC returns an error, throws, or gives a malformed shape (for example when the migration is not yet applied), D is left out with a warning. The job's success and failure semantics are unchanged.
- The contract is confirmed with the Rankings lane: `rows` is a JSON number and `md5` is 32 lowercase hex.

### 2. Readiness gate in the scheduled run (`lib/forgeWgoReadiness.ts` and the pipeline route)

The resumable daily run no longer calls `update-wgo-skaters` or `update-wgo-totals`. `upstream_skater_sources` starts with a read-only `wgo-skater-readiness` step, before any NST request. It requires all of the following for the **exact source date** D:

1. **Finalized games.** `games` rows for D through `resolveGameFinality`.
   - A game is final only on its stored NHL state (`OFF` or `FINAL`).
   - PPD, SUSP and CNCL games are excluded.
   - Any other state is a `game_not_final` gap.
   - Only regular-season games (type 2) are required: the table constraint admits only type 2, and FORGE reads no playoff WGO table.
2. **Completed producer run.** The newest `update-all-wgo-skaters` audit row since D+1 00:00Z that touches D decides; this is the same rule as Rankings.
   - "Touches" means D appears in processed, failed or skipped dates, `startDate`, `rankingsSourceDate`, or the URL's `date` or `startDate`.
   - That row must be `success`, HTTP 200, with D processed, not failed and not skipped, 0 failed dates, and no persistence `not_confirmed`.
   - Its `run_time` is the **data cutoff**. It must not precede the last required start plus 3 h.
3. **Row proof.** The receipt's `sourceDigests[D]` must exist with at least 1 row, and must equal `wgo_skater_date_digest(D)` recomputed now (rows and md5).
   - Any later write to D, audited or not, defers the run.
   - Missing digest: `producer_digest_missing`.
   - Mismatch: `data_changed_since_receipt`.
   - RPC unavailable: `read_failed`.
4. **Coverage.** For each required game, rows are read by `game_id` (indexed), 10 games per read, failing closed at the 1,000-row cap.
   - Both the home and road sides need rows dated D.
   - Fewer than 16 skaters on a side is a `side_partial` gap. **This floor is a heuristic.**
   - A wrong-date row or a player listed twice is also a gap.

**Not ready:** the step is `partial`, the stage hands off with its stored NST cursor, and the termination is `continuation_required` with the first gaps in its detail. The next scheduled slot checks again. WGO is never rerun and nothing downstream runs.

**Ready:** NST runs as before, the stage completes with NST, and the run proceeds.

**Record.** A compact `wgoReadiness` block (receipt, both digests, cutoff, gaps with game, team and player ids) sits next to `failureSummary`, so the pipeline's 4,000-character audit preview keeps it. Full coverage is in the step summary.

**Off day.** No stored games means no WGO rows, no receipt and no digest are needed. NST's verified off-day check still decides, and an unverified empty schedule still blocks.

**Explicit-date runs (repairs)** still call WGO skaters and totals. Their writes carry digests too, so the next readiness check sees a consistent receipt.

### WGO totals: not a FORGE input (accepted)

- The producer-closure module list (`scripts/forge-producer-closure.ts --json`, 244 modules) was scanned for table names:
  - `wgo_skater_stats_totals` appears only in `pages/api/v1/db/update-wgo-totals.ts` (the writer), `lib/rollingForgePipeline.ts` (a `produces` label) and the generated types.
  - `wgo_skater_stats` is read by `fetchRollingPlayerAverages`, `run-forge-projections`, `skater-queries`, `team-context-queries` and `run-projection-accuracy`.
- **Totals readers outside the closure:** UI pages and hooks, social share, `lib/rosterScheduleData/forgeDailyBridge.ts` (RSO), and the percent-games SQL in migrations `20261111180800` and `20261113090100`.
- pg_cron job 14 (07:40) refreshes totals; production's 11-22 run succeeded with 786 players.

## Verification (local, both cuts)

**Pipeline tests.** `run-rolling-forge-pipeline.test.ts`: 114 passing on M′. The fixture uses the real job-9 shape (`?action=all`, no `startDate`, `skippedDates` on both sides of D, `sourceDigests`).

| Case | Result checked |
|---|---|
| Complete | One rolling run, one projection run, one NST call, zero WGO and totals calls; receipt, digests and cutoff in the response and in the pipeline audit preview |
| Partial | Exact game and team gaps; then exactly one downstream run once complete |
| Missing game | Gap |
| Stale | Gap, held across fires |
| Late | The 10:05 fire waits; the 10:15 fire runs once |
| Duplicate receipts (newest decides) | Cutoff is the newest |
| Newer failure | Waits |
| Newer skip | Waits |
| The date's own morning run | Ignored |
| Not-final game, postponed game | Gap and exclusion respectively |
| Wrong-date row, duplicate player | Gaps |
| **TJ's rewrite case** | 14 games, 504 rows matching the recorded digest are ready. A rewrite that commits 500 rows and dies unaudited, with all 504 keys present, gives `data_changed_since_receipt` across three fires with no NST, rolling, projection or WGO calls, even though coverage is full. The same rewrite with an audited failure gives `producer_receipt_failed`. |
| Receipt without a digest (today's real 07:32 row) | Defers |
| Digest RPC missing | Defers |
| Off-day control | Ready; reads only `games`; NST decides |
| Unverified empty schedule | Still blocks |
| Explicit-date control | Still calls WGO and totals |
| Explicit-path totals cutoff | Still applies |

**Exact new and changed tests.**

`describe("standalone WGO skater readiness (TJ, 2026-11-22)")`:
- consumes complete standalone inputs: one downstream run, zero WGO calls, receipt and cutoff recorded
- waits on partial inputs with exact game and team gaps, then runs once they are complete
- names a finalized game with no rows at all
- refuses stale inputs captured before every game could have ended
- waits for a late producer run, then runs once on the next slot
- takes the newest of duplicate producer receipts as the cutoff
- waits when the newest duplicate receipt for the date failed
- ignores the source date's own morning run, which can only skip it
- waits when a newer rerun skipped the date after an earlier green receipt
- waits while a game of the date is not final by its stored state, and excludes a postponed one
- names rows filed under another date and a player listed twice
- row proof (nested describe):
  - starts ready on the 504 rows job 9 recorded
  - defers a 504-row rewrite that commits 500 and then dies unaudited, with all 504 keys still present
  - defers the same rewrite when its failure is audited
  - defers a receipt that recorded no digest (job-9 rows written before the digest writer)
  - defers when the digest cannot be recomputed (the RPC is not there yet)
- off-day control: a date with no stored games needs no WGO rows, and NST still decides the off day
- an unverified empty schedule still blocks in NST

Changed or added elsewhere in the file:
- leaves WGO skaters and season totals to their standalone jobs (pg_cron 9 and 14)
- skips the optional WGO totals refresh late in an explicit-date run
- the explicit daily run still calls WGO and totals
- the scheduled tests now expect zero WGO calls and the readiness step first
- the child audit-persistence holds now use NST as the child

**Writer tests.** `update-wgo-skaters.types.test.ts`: digest stored unchanged; left out on error, rejection or malformed data.

**Other checks.**

| Check (on M′) | Result |
|---|---|
| Vitest, 48 files (pipeline, WGO writer, route-runner, runner UI, cron-report, `lib/cron`, pipeline-state, game finality, ingest, NST goalies) | 772 pass |
| Verified releases + build admission tests | 41 pass |
| `npm run typecheck` | Exit 0 |
| eslint on the touched files | Exit 0 |
| `git merge-tree` against origin/master | Clean; fast-forward |
| AI attribution in the commits | None |

**Not covered.** The Supabase reads and the digest RPC ran against mocks. The live shape is covered by the read-only checks below and by the Rankings lane's PG fixtures for the RPC.

## Combined rollout (Chef gates both together)

1. **Apply migration `20261122145409`** (Rankings; additive; the old receipt still counts).
2. **Web build** of the chosen cut, plus the migration file by pathspec. Usual footprint: 1 fhfhockey build, companions canceled.
   - **Deploy before 07:30Z**, so job 9's next run writes `sourceDigests`.
3. **The gap until that run:**
   - The coordinator no longer calls WGO.
   - Earlier job-9 rows have no digest, including today's 07:32 row.
   - So **both Rankings and scheduled FORGE defer** until the first job-9 run on the new build. FORGE defers with `producer_digest_missing`; it does not publish stale data.
   - If the deploy lands between 07:30 and 10:55Z, that whole day's scheduled FORGE and Rankings defer. Avoid that window.
4. **Verify the first natural run.** The 10:05 fire's `wgoReadiness` shows `ready: true` with job 9's 07:3x receipt as the cutoff, matching digests, and no WGO call. Then check Rankings readiness for the same date. Today's scoped recovery doesn't count as a natural pass.

**Before approval, read-only on two or three recent played dates D** (Chef runs these; job-9 rows already supplied):
1. **Game state.**
   ```sql
   select id, type, "startTime", game_state, game_schedule_state, game_state_observed_at
   from games where date = 'D';
   ```
2. **Per-side counts.**
   ```sql
   select game_id, home_road, count(*)
   from wgo_skater_stats where date = 'D'
   group by 1, 2 order by 3;
   ```
   `home_road` must be exactly `H` or `R`. Any side under 16 means the floor would have blocked that day.

Chef already supplied the job-9 rows, and they match the fixture shape.

**Operational notes:**
- **No auto-repair.** A partial or stale 07:30 capture is not repaired by the coordinator any more. The gate reports it every slot until job 9 or an explicit WGO repair rewrites the date.
- **No alert.** A never-ready day writes no failure row: each fire is "continued". It shows only in the 11:15 acceptance check, serving health, and the `wgoReadiness` gaps.

## Rollback

1. **Web first:** revert the cut's commits, or promote the previous production deployment. The scheduled run then calls WGO in-process again, and that call's audit row keeps the old `startDate` receipt Rankings still accepts. The readiness step writes nothing, and `sourceDigests` is an additive audit field.
2. **Then the migration rollback:** `tasks/artifacts/rankings-daily-publisher-release-2026-11-21/rollback-20261122145409.sql` (owned by Rankings).
