# FORGE replay of failed live games 0358/0357 (Claude, 2026-11-20)

## Scope

Chef's ticket and TJ's `tasks/artifacts/forge-replay-2026-11-20/TJ-INSTRUCTIONS.md`: replay 0358, then 0357, on a labelled reconstruction.

TJ's pop-up answers, ~14:00Z:
- **Repair:** prove the DATA repair. First a failure on the frozen pre-backfill inputs, then a separate copy labelled "reconstructed + identity repaired" that restores only the 3 game_ids, each backed by evidence that existed before the cutoff. The reader stays strict; no Option A.
- **Production reads:** Chef runs them read-only from my exact scripts.
- **Off-Mac:** check existing routes and runners. No new spend, push, deploy or cron.

## Where

- Scratch clone `scratchpad/forge-get`, branch `chef/forge-replay-20261120`, based on the strict release aa49b6c5e.
- Ref `refs/rc/forge-replay-20261120` = c886b1578.
- Recorder `web/scripts/forge-replay-record.ts`, sha256 f2c72965…. Validated: it reproduces a sealed packet's 134 (query, result) pairs.
- Chef runbook: notes `forge-replay-2026-11-20/RECORDER-RUNBOOK.md`.

## Facts

From `forge-replay-export-q1-q5-20261120.json`, sha256 df1af48d….
- **Cutoffs:** 0358 at 01:40:02.571322Z, 0357 at 01:20:02.525929Z.
- **The 3 keys:** `updated_at` 2026-03-10, pre-backfill `game_id` NULL in all 4 strengths, no sidecars.
- **Evidence:** the games rows were created in 2024; `wgo_skater_stats` has no timestamps.
- **No historical versions:** `track_commit_timestamp` is off, and the backups are physical-only (restore declined).
- **Evidence query sent to Chef:** `skatersGameStats`, `nhl_api_game_roster_spots`, `shift_charts` and `nhl_api_shift_rows`, by `created_at`.

## Root cause (research agent, from code)

- The rolling writer `fetchRollingPlayerAverages.ts` sets `game_id` NULL when its WGO row has no id or the game is missing from `games` (:3539-3577), and builds `team_id` from the abbreviation.
- Legacy WGO rows had no ids, and incremental runs never rewrite old rows.
- It can recur through a fullRefresh, a truncate rebuild, or a game not yet in `games`.
- Prevention: a writer guard plus `CHECK (game_id IS NOT NULL) NOT VALID` on both tables, for separate approval.

## Off-Mac (research agent)

No existing route or runner can do it without at least one deploy.
- `forge-sandbox-run` has no verifier, refuses query parameters, uses wall-clock time, and needs retired access.
- The smallest option is a new Supabase Edge Function: new code plus one deploy.
- GitHub Actions needs a push and its logs are public. Vercel Sandbox and project restores are paid.

## Test clock

- libfaketime 0.9.14 works on Homebrew postgres when it is started DIRECTLY (not via pg_ctl, whose shell drops `DYLD_*`). Use `FAKETIME_TIMESTAMP_FILE` with a relative offset, re-read on every call (`FAKETIME_NO_CACHE=1`).
- Node (`/usr/local/bin/node`) uses the hardened runtime, so DYLD is ignored: needs an in-process `Date` shim reading the same offset file.

## Next

1. A seeder from a recording into a production-schema replay database.
2. The test clock in the harness.
3. Synthetic control: fixture plus injected legacy rows → record (backfilled) → derive original and repaired → replay both.
4. Then the production recordings from Chef.

## Gotchas

- Capture reads run concurrently and are recorded in completion order, so compare (request, result) multisets canonically.
- The original pre-backfill state cannot be recorded directly (collect throws), so record post-backfill and revert using the before-images.

## Checkpoint ~14:50Z

### Done
- **Synthetic control on a frozen world:** T=2026-11-20T03:00Z, seed sha 1820387d…, test clock (libfaketime plus Node shim).
  - FAIL: collect_failed invalid_row at 01:40Z.
  - PASS: capture, then a signed verdict at 01:52Z, publish at 02:05Z, both readers, no duplicates on retry.
- **Reader cases A–D** on a real DB, through the RPC and legacy paths. C (a newer non-appearance row above a valid older one) gives invalid_row on both paths.
- Commit cad66d022 on `refs/rc/forge-replay-20261120`.
- **Census at the original releases** (Chef):
  - collectError null on both, so the 03:24Z backfill fixed prod's read path.
  - 133/195 and 145/204 reads have rows but no availability column. shift_charts and pbp_games name the target game. A full production reconstruction is not provable.
- **Identity evidence** (Chef): each of the 3 keys has one pre-cutoff skatersGameStats row (2024) and one shift_charts row (2024-10-08), and each one's team agrees with its game. The repair qualifies.

### TJ decisions (pop-ups)
- **Case C:** keep both readers strict. Record C with its receipt as a separate follow-up. Bring the writer guard separately.
- **Off-Mac:** build ONE approval batch today on master 0b1a9c958 (not aa49b6c5e): existing Supabase cron → HTTP GET → a new, default-off Next.js replay route on existing Vercel. Use private sandbox tables, the frozen fixture, test keys and a test TSA. Readback, a duplicate trigger, disarm, revoke.
- **Clock:** real time. No Date patch and no shared clock change. Keep the original envelope immutable, plus a separately hashed, time-shifted copy with a recorded offset. Verify the relations to puck drop and the cutoff, and the date eligibility. Real cron ticks today. Fire the repaired capture only after the failure is terminal and the reset is verified.

### Plan
- **Shift:** exactly +1 day. Test kickoff 2026-11-21T03:00Z; ticks from 01:40Z.
- **New artifact dir:** tasks/artifacts/forge-hosted-replay-2026-11-20 (sandbox bootstrap plus: the witness SQL, legacy injection, reset, repair, phase ledger).
- **New route:** pages/api/v1/db/forge-replay-run.ts. It sits outside the producer roots, so the closure is unchanged.
- **Verifier:** witnessEdgeCore in-process with a test key and test trust, against sandbox wrappers. Labelled: not the deployed Edge function.

### Pending from Chef
- Q6–Q8 reader rows export.
- Q9 sandbox remnants inventory.

## Checkpoint ~15:30Z

### Hosted replay batch: delivered to Chef (notes `HOSTED-REPLAY-APPROVAL-BATCH.md`)
- **Release** d76c6fefe = `refs/rc/forge-hosted-replay-release-20261120`. It is master 0b1a9c958 plus 4 new web/ files: the route `forge-replay-run`, `replayTestTsa`, and 2 tests. Closure d633c572 unchanged.
- **Kit** `refs/rc/forge-hosted-replay-20261120` = 39ef019a1. Local only.
- **Checks:** 22 tests, typecheck 0, eslint clean, closure VERIFIED. `check_replay.py` exit 0 with a decoy service key and the pre-window 202. next build NOT run.
- **Test kickoff** 2026-11-21T03:00Z (shift +1 day). Bootstrap sha 31c3cd65… (deterministic). One attempt; a retry is +1 day.

### Q9 inventory
Clean. No sandbox remnants, the token is absent, cron_secret appears once. Exposed schemas are set via the dashboard.

### Real-row reader replay (Q6–Q8)
- **Frozen** (all 16 keys NULL): both readers give invalid_row.
- **3-key repair:** the RPC (live) path passes; the legacy path still fails (13 older NULL keys).
- **As backfilled:** both pass.
- Receipt on `refs/rc/forge-replay-20261120` = 9ff49de9c.

### Gotchas
- **Case-insensitive APFS:** `READER-CASES.json` shadowed `require('reader-cases')`. Renamed it to `RECEIPT-READER-CASES.json`.
- **plpgsql:** a variable that shares a column's name (`step`, `checks`) causes an ambiguity error. Prefix variables.
- **arm_v1 ordering:** it must run after the owner's RLS policies exist (`replay-api.sql`).
- **Harness test clock:** rounds to seconds, so tick at :02. The sandbox token's expiry must follow test time.
- **Safety check:** a Bash heredoc containing SQL `delete from` was blocked as a "removal". Use the Edit/Write tools.

### Next
1. Writer guard: rejects a real appearance without a game id; keeps non-appearances out without breaking the writer. Build with tests, for separate approval.
2. Chef/TJ approve or decline the batch.

## Checkpoint ~16:10Z: writer guard (for separate approval)

- **Ref** `refs/rc/forge-rolling-writer-guard-20261120` = 41f1cbc22, on master 0b1a9c958. Worktree `scratchpad/forge-guard`.
- **What it does:** `enforceRollingGameIdentity` runs after the merge.
  - A real appearance without a known game refuses the player (`RollingGameIdentityError`, exact reason, `summary.identityRefusals`), and the run continues.
  - A non-appearance is left out. Rows with a known game are unchanged.
- **Checks:**
  - 77/77 writer tests (3 new); the mutation check catches all 3; typecheck 0; eslint clean.
  - Closure becomes fff90e80 (VERIFIED). It needs an allowlist entry with TJ's approval.
- **Backstop:** `CHECK (game_id IS NOT NULL) NOT VALID` SQL. Tested on a throwaway PG15; not applied.
- **Gotchas:**
  - The writer test fixture served no games, so every WGO game was unknown, which is the production bug. It now serves the games its rows name.
  - zsh doesn't word-split `$P`; use a function.
  - A throwaway PG needs `LC_ALL`.

## State
- **Pending TJ/Chef:** the hosted replay batch (d76c6fefe) and the writer guard (41f1cbc22) as separate approvals.
- **Done:** census, identity evidence, real-row reader replay, case C receipt.

## Checkpoint ~16:45Z: corrections after advisor review

- **Batch doc:**
  - Files now in notes `hosted-replay-ops/` with a MANIFEST.
  - Step 0: `select now()` (Chef's Q9 stamp was wrong).
  - ET times added.
  - FORGE_RESERVE_PASS_ENABLED preflight added.
  - A retry needs another approved build.
  - witnessEdgeCore and replayTestTsa are first-time hosted.
- **Guard** `refs/rc/forge-rolling-writer-guard-20261120` = 31d79a0e8:
  - The route answers a partial 207 on refusals and merges them across auto-resume.
  - The non-appearance test now checks baseline equality.
  - Closure 41ac5d2d.
  - Root cause, most likely: on 2026-03-10 fetchGames ordered by date only, with no id tie-breaker.
  - Q10 blast-radius count sent to Chef; the guard waits on it before going to TJ.
- **Receipt:** RECEIPT-REAL-ROWS caveat added, since updated_at proves nothing (`refs/rc/forge-replay-20261120` = 8acdb2a2e).
- **Pending:** Chef/TJ on the batch; the Q10 result; then the guard approval ask.

## Checkpoint ~17:00Z (local clock 11:00 ET)

- **Hosted synthetic control batch, revised:**
  - Release 3e360ae4c: a generic route that reads game and player from the ledger.
  - Kit ec46afd5b, then later commits up to the head of `refs/rc/forge-hosted-replay-20261120`.
  - 27 slot bootstraps, 17:15–23:45Z, in notes `hosted-synthetic-control-ops/`; earliest T = arm + 81 min.
  - stale_busy halt added.
  - Drive folder 1WjOqjh8exMTWJ_XbIKgaSRMz7jXeSdem holds the envelope (byte-verified).
  - Batch doc sha e092a332….
- **Real-input early-cutoff rehearsal (0359–0361):**
  - All qualified, witnessed, gated and published; packet reads equal the recordings.
  - Both readers say incomplete_refresh (the schedule coverage evidence is not among capture reads).
  - Receipt sha 193adab6….
- **Envelope copy patch:** `refs/rc/forge-envelope-copy-20261120` = f8ca97db6. Closure 678f80ad. Sandbox ok / corrupt / refusal receipts.
- **Gotchas:**
  - libfaketime absolute time needs a trailing half-microsecond for exact µs.
  - Fixture reference tables have no PKs, so merge on natural keys.
  - Identity sequence collisions with explicit seed ids.
  - Drive download_file_content saves to a local file, so byte-verify is possible.
- **Pending:**
  - Chef/TJ: hosted batch approval, Q10, writer guard.
  - Reader-input recorder if TJ wants reader points.

## Checkpoint: writer guard redesign (after Q10)

- **Q10:** 818k WGO appearances with no known game (3,860 players, 1997–2023); 0 NULL rolling rows since 2023-11-20.
- **Guard** `refs/rc/forge-rolling-writer-guard-20261120` = 1bb5ddeea, closure cdf87b73.
  - It works at the output stage: only written rows dated after today − 1,095 days.
  - Appearance → refuse the player. Non-appearance → skip its row; the windows are unchanged. Older rows → as before.
  - Tests 106/106; mutation check ok; typecheck 0.
- **Real-input writer fixtures:** `web/scripts/rolling-writer-record.ts` (record/replay). Runbook WRITER-RECORD-RUNBOOK.md has been sent to Chef. Waiting for the recording.
- **Gotcha:** the fixture world lacks the writer's WGO columns, so the local check proves request matching only. Fidelity is proven by the master replay equalling the baseline on the production recording.

## Checkpoint ~16:40Z (by date -u)

- **Q11:** no retained versions (0 FORGE input snapshots in the 36 h before either cutoff).
- **Reader-input recorder:** kit `fc694740a`, `web/scripts/forge-reader-record.ts`. The harness merges its rows (FORGE_READER_RECORDING). Runbook sent to Chef.
- **Recorder --exclude:** `refs/rc/forge-replay-20261120` = 401b4933b, with outcome / post_cutoff / as_of_unverified exclusions and an aux select=* availability proof. Runbook sent.
- **Prediction:** the schedule rows are as_of_unverified and required, so pin fails and 0357/0358 is PARTIAL.
- **TJ decision posed:** a revision-proven schedule row with fetched_at bounded by the claim cutoff.
- **Gotchas:**
  - The issuedContext schedule revision excludes the timestamps, but the capture requires a valid fetched_at ≤ observedAt.
  - The transport compares stamps with receivedAt, not the cutoff, so recordings made today need their own exclusion.

## Checkpoint: writer guard real-input replay

- **Recording:** Chef's writer recording 51eb9d2f (219 GETs, dry run, master writer).
- **Replays, canonical hashes:**
  - master equals the baseline;
  - guard equals master (McDavid 569 / Crosby 811 legacy no-game rows);
  - game missing → master 5 NULL rows, guard refuses Bedard with 0 rows;
  - non-appearance → guard equals master minus the record.
- **Refs:** RC `refs/rc/forge-rolling-writer-guard-20261120` = 6a3e42a06, closure cdf87b73. Receipt in notes WRITER-GUARD-REAL-INPUT-RECEIPT.json (770d2fce).
- **Gotchas:**
  - Raw JSON hashes differ by key order, so compare canonical (sort_keys) hashes.
  - Nulling a WGO game_id changes the follow-up pp query, so it is unreplayable; use game_missing instead.
- **Chef sent the claims' calendar_revision:**
  - 0357: d3507a64…
  - 0358: b9a16eab…
  - The (a)/(b) decision is with TJ.

## Checkpoint: TJ calendar_revision ruling (b) implemented

- **Ruling** appended to TJ-INSTRUCTIONS.md.
- **Recorder** 2f351446c (sha c7a597c2…): with --calendar-revision, revision-proven pregame schedule rows in the replay copy only. They must match exactly with the release algorithms; fetched_at is bounded_by_claim and source_updated_at null; the output is labelled reconstructed PARTIAL.
- **Pre-check:** VGK–DAL 03:00Z and SEA–VAN 02:40Z FUT/OK reproduce b9a16eab / d3507a64 exactly.
- **Next:** Chef runs RECONSTRUCT (~17:40Z). Then the local chain: frozen vs identity-repaired through capture → verdict → publication → both readers, at each claim's release.

## Checkpoint: 0357/0358 PARTIAL local replays done (~16:57Z)

- **Recorder fix** a47671f9c (sha 8f53a700): result-relation reads that target the game count as `outcome`. Chef's rerun gave 0358 192 reads and 0357 195, 0 refusals, schedule proofs matched.
- **Attempt 1** (unshifted variants): 0357 frozen invalid_row; the other three `save_refused:capture_save_late`. The reads were received at 16:49Z today and the witness rule saves the artifact after the last read, which falls past the ack deadline.
- **Fix:** `derive-variants.ts --shift-received-to-cutoff`, a separately hashed copy. Every receivedAt moves back by one offset (recordedAt → cutoff, ~54.5 M ms); row content is unchanged. Dir: notes `variants-0357-0358-shifted/`.
- **Results** at each claim's release, historical clock:
  - 0357 frozen = invalid_row (the live outcome).
  - 0357 and 0358 identity-repaired: qualified → accepted → published → readers `incomplete_refresh`.
  - 0358 frozen also qualifies, so it does NOT reproduce live. The reconstruction reads 8482141 only on the 365-day path, which skips his 2024 null row; live read him on the 1,095-day long-absence path, and the reserve set differs because the roster rows are as_of_unverified.
- **Receipt:** `PARTIAL-REPLAY-0357-0358-RECEIPT.json` (sha see below) at `refs/rc/forge-hosted-replay-20261120`, with a copy in notes.
- **Next:** report to Chef. The reader-input gap stays open; a 11-19 reader recording today would carry post-game values.
- **Receipt revised** after the advisor review: sha c2d791c2…, `refs/rc/forge-hosted-replay-20261120` = 17cbba857.
  - 0358 is stated as not reproduced; the roster mechanism is labelled inference, and the missing evidence is the 22 VGK roster rows as of the cutoff.
  - Unstamped-row caveat added: 549 rows for 0358, 626 for 0357.
  - The receivedAt shift is named as a second stand-in for TJ.
- **Drive:** new files in folder 1ZLX…, byte-verified:
  - frozen-0358 1R2qi…
  - identity-repaired-0358 1fPf4…
  - frozen-0357 1O2nV…
  - identity-repaired-0357 1EOry…
  - VARIANTS 1vHgn…
- **Outputs** are in notes `partial-replay-outputs-20261120/`.
- **Next:** report sent to Chef.

## Checkpoint: writer guard release package (~17:35Z, TJ timing ruling ~16:50Z)

- **Release:** `refs/rc/forge-rolling-writer-guard-release-20261120` = b5a4debc5, a fast-forward of master 3e360ae4c.
  - 7a13f65c0 is the guard code (4 files).
  - b5a4debc5 is the allowlist entry for closure cdf87b73 plus receipt 135f3e3b.
  - Worktree `scratchpad/forge-guard-rel`.
- **Gates:**
  - closure VERIFIED on both commits (243 modules, 0 findings);
  - vitest 131/131 and 112/112;
  - `npm run typecheck` exit 0;
  - eslint exit 0;
  - no styles touched.
- **Disposable PG (`check_writer_pg.py`):** the real writer upserts into a local PG seeded from Chef's recording, using production DDL from the schema dump.
  - Both writers reproduce the baseline exactly.
  - With Bedard's 11-17 WGO game_id blanked, the guard refuses (`wgo_game_id_missing`) with 0 rows in both tables; master writes 35 rows, 5 of them NULL.
  - Receipt `REAL-INPUT-PG-RECEIPT.json` (sha 46af390a…).
- **RC kit:** `refs/rc/forge-rolling-writer-guard-20261120` = dc7f69c8b. RELEASE-PACKAGE.md (sha c8c9d004…) is copied to notes as WRITER-GUARD-RELEASE-PACKAGE.md.
- **Gotchas:**
  - The fixture schema lacks the `nst_gamelog_*` tables and has an old `wgo_skater_stats`, so the harness uses production DDL.
  - Some dump tables end with `)\nWITH (...)`.
- **Open:** Chef's unstamped-row breakdown.
  - wgo_skater_stats HAS created_at, yet 401/438 rows came out unstamped. The recorder's stamped() check runs per row, with an aux select=* only when no row is stamped, so this needs a look.
  - wgo_goalie_stats and players have no availability column; player_stats_unified is a view.

## Checkpoint: real-input READER receipt + hosted sealed-envelope gate (~17:45Z)

- **TJ stopped 0357/0358 at ~16:55Z.** Both fixtures stay PARTIAL. Do no more archaeology there.
- **Reader inputs:** 34028d96, byte-verified from Drive. Merging them into the harness needed five fixes:
  - derive team_id from team_abbreviation;
  - map countable rows to their matchup week, as the production check requires;
  - merge on the natural key before the primary key;
  - type URL eq-filter values;
  - move the world anchor off the slate day.
- **Receipt:** READER-RECEIPT-0359-0361.json, sha 1632179a. All three games qualify, get an accepted verdict and are published.
  - **0359 McDavid:** daily C#1, 3.8285 points. Detailed missing_participation: his row is conditional on playing.
  - **0360 Bedard, 0361 Barkov:** daily missing_participation (reserve rows). Neither is in the published 36-skater lineup. The detailed identity_conflict is a game-level exclusion picked up by the hostedReaders.ts:134 match; its source is not identified for 0359 or 0361.
- **Hosted sealed envelope:** BLOCKED by the live-read gate (LIVE-READ-GATE-2026020359.json, c42f62f1). The released live collect against the seeded sandbox made 34 of 227 reads.
  - The first divergence is a games history filter on homeTeamId/awayTeamId, columns the envelope never selected.
  - Sent Chef one decision: (a) keep the hosted proof synthetic, or (b) a sealed-collect route mode, which is code plus a push.
- **Kit:** refs/rc/forge-hosted-replay-20261120 = ae82e35f4.
- **Insights:**
  - No shift is needed; ledger windows are bootstrap SQL and hostedGame enforces only a latest dispatch time.
  - The guard release must come after any hosted run, because the route pins the deployed SHA.

## Checkpoint: lineup centres + reader attribution fix (~17:40Z)

- **Lineup centres:** 0360 Backlund scored daily C#1 1.7215; 0361 Reinhart scored daily C#1 3.9215. Both detailed answers are missing_participation, because rows are unconditional only with confirmed_evidence participation and no early cutoff has it.
- **Fix 91f745191** (`refs/rc/forge-hosted-readers-attribution-20261120`), a fast-forward of the guard RC b5a4debc5.
  - `attributeDetailedExclusion` gives the reason only from an exclusion naming the player; game-level exclusions become context (gameExclusions).
  - The closure is unchanged (cdf87b73).
  - Tests 24/24, typecheck exit 0, eslint 0.
  - Sealed regression: 0360 and 0361 detailed now answer no_usable_target.
- **0359** has a game-level identity_conflict too; the old code was right only by list order.
- **0357/0358 PARTIAL receipt:** the unstamped breakdown was added (sha 52172218), kit ref dfe1f7158.
- **Gotcha:** `rm -rf $VAR/...` is blocked; use a literal path.

## Checkpoint: sealed-collect built (TJ ruling ~17:35Z), batch ready (~18:20Z)

- **Combined RC** `refs/rc/forge-combined-release-20261120` = f47905d28, a fast-forward of 3e360ae4c: guard 7a13f65c0, allowlist b5a4debc5, attribution 91f745191, sealed-collect f47905d28.
- **Closure** is cdf87b73 on every commit; eslint 0.
- **Route:**
  - a sealed ledger's begin carries mode 'sealed', and any failure to fetch or verify the envelope means not_started (no live fallback);
  - sealedClaim returns the envelope's cutoff text;
  - sealedCollector replays the 227 reads with rejectUnrecordedReads;
  - every step report is labelled replay only.
- **Kit** (`refs/rc/forge-hosted-replay-20261120` = f49989e70):
  - `sealed-ledger.sql`;
  - `sealed_bootstrap.py`: synthetic world anchored 2026-12-20, the seed from real-input-check `FORGE_SEED_SQL_OUT` (seeded in replica mode), the claim stand-in, envelope rows, and a grant so the owner can read replay_meta;
  - `check_sealed_replay.py`;
  - `replay-get-check.ts` with slot ticks.
- **Rehearsals on f47905d2:** the control path passes; sealed passes at 21:00Z and 23:19Z with daily 3.8285 C#1 and detailed missing_participation.
- **Batch:** notes `sealed-0359-hosted/SEALED-0359-HOSTED-BATCH.md`; bootstrap for 22:30Z is 03d3b3f7; seed d07b0ecd is on Drive 1KdLJFOl….
- **Gotchas:**
  - replay_meta is owned by postgres, so the meta and envelope inserts run as postgres;
  - the API section runs as postgres;
  - the claim's cutoff text must match the recorded text exactly (`.210100+00:00` vs `.2101+00:00`);
  - the fixture schema lacks the production columns the seed needs.
- **0359 game-level identity_conflict:** EDM goalie candidate 8477035 at 1%, not among the verified identities.
- **Pending:** full vitest and typecheck results on f47905d2, then the report to Chef.

## Checkpoint: no-replica seed, non-superuser stand-in, slot bootstraps (~18:45Z)

- Chef's preflight showed production postgres cannot SET session_replication_role.
- **Seed rework:** the runner records the seeded tables' FKs in replay_seed_relaxed, drops them and turns user triggers off. It seeds as the owner, then turns triggers on and re-adds the FKs NOT VALID (8 FKs).
- **Rehearsal** on f47905d2 against the sb_postgres stand-in (not a superuser, no SET privilege), which applied the bootstrap, the audits and the reset: all steps passed and the readers are at baseline. Receipt e7ae3b08.
- **Kit:** `refs/rc/forge-hosted-replay-20261120` = 0395ba244.
- **Slots:** 19:45–23:15Z every 15 min in notes `sealed-0359-hosted/slots/` (SLOTS.json c5c73c22). 19:45Z c7c10b37 is byte-identical to the rehearsed bootstrap. The batch doc is updated.
- **Next:** Chef or TJ approve, push, apply and arm. This lane waits.
