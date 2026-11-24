# Release approval packet: Rankings daily publisher · Nov 21 2026, rebuilt Nov 22

> **Superseded Nov 22, 08:22 CST.** TJ merged `#464` (`c2c46ceae`, squash of `octoberBranch`), which put the whole publisher, the guard tests and the BLSH fix on master. Candidate `558ea2fb4` is obsolete; the migrations below are live.
>
> The production build of `c2c46ceae` (`dpl_FNseXHEz54ztvhSNKMu6imRf4Kbx`) **failed FORGE build admission**: master's closure `7ee3612e…` is unregistered. Production still serves `480bd5d71`. Master can't deploy until a registration for its final closure lands; FORGE Chef's WGO release, built on `c2c46ceae`, is the planned carrier.


**Rebuilt Nov 22 08:10 CST** after master moved to `480bd5d71` (FORGE acceptance route, Nov 21 records, auth-page styling). None of those files overlap the candidate. The publisher patch is identical (same patch-id), the FORGE closures are unchanged on both sides, and the registration was re-verified against the new commit. Every gate below was re-run on the rebuilt candidate.

**Candidate `558ea2fb4b8efc86b249179bbdb192fd242be809`**, three commits on production master `480bd5d710ce316e4cf5570eb32784e764910b7f`. It is local only, under `refs/candidates/rankings-daily-publisher`.

Nothing was pushed, deployed or migrated, and no production SQL ran. Production reads were Vercel deployment metadata only. The manual four-window SQL precheck stays in force until this guard is live.

| Commit | What it adds |
|---|---|
| `3a5e4a9d1` | Cherry-pick of `329e61dfe` (publisher route, two migrations, readiness receipts) and `42a1502ff` (nine guard tests). Three-way merge onto master with base `329e61dfe^`, no conflicts. 46 files. |
| `b6519f0ef` | FORGE registration of closure `7ee3612e…` with its verifier receipt and registry test line, following the `096b78b62` precedent. |
| `558ea2fb4` | One expected entry in the BLSH `vercel.json` functions-map test, which `octoberBranch` also needs. |

50 files differ from master, and none are outside these three commits. There are no diaries and no unrelated October changes. Production serves `480bd5d71` (`dpl_A6wXhPbxbrNJWGCThoe5bsouyHmG`, READY), and `origin/master` is the same commit.

**Valid only while `origin/master` is `480bd5d71`.** If master moves, rebuild the candidate and recompute the FORGE closure, its receipt and the release pin.

**No unreleased dependencies.** The import closure of the publisher route and both manual routes is 52 source files, all byte-identical to `octoberBranch` HEAD; 33 of them are unchanged from master. The FORGE verifier and closure scripts are identical on master, `octoberBranch` and the candidate.

## Guard retained

- **Same bytes everywhere.** Reconciled `octoberBranch` (`2ed3566b5`), `329e61dfe`/`42a1502ff` and the candidate all carry the same blobs:
  - `skaterCompositeWriter.ts` `b48b51faa`
  - `skaterCompositeWriter.test.ts` `e88bc1e14`
  - `rankingPublications.ts` `ad0d4cb80`
  - `dailyRankingPair.ts` `c8f39fe3d`
- **Scheduled path uses the guarded writer.** The route runs `runDailyRankingPublication`, then `prepareDailyRankingPair`, then `publishDailyRankingPair`. The pair preparation refuses unless exactly four windows are certified at the cutoff. Publishing first confirms all four Rankings windows, then calls `publishSkaterCompositeRatingRows` with `stopOnFailure: true`.
- **What the guarded writer checks.** Before writing composites, it requires each of the four Rankings markers to be complete, with the floors and the same player count. Each window's stored `points_per_60` player IDs must also equal the composite cohort.
- **The manual route** (`update-skater-composite-ratings`) calls the same function.
- **Manual routes now use the ledger.** Every non-dry-run 2026-27 5v5 manual Rankings or composite write first takes a `manual_rankings` or `manual_composites` claim through `claim_ranking_publication_dispatch`, so these routes **require the dispatch migration**.
  - While the cadence is off, a manual paired publish is still admitted.
  - A manual write that ends incomplete records `ambiguous`, which blocks every writer until an operator reconciles it.
- **The database layer agrees.** `latest_ranking_publication_cutoff` counts a date only when all four windows completed before the composite started (rehearsed below).

## Gates on the exact candidate (clean `git archive` export)

| Check | Result |
|---|---|
| Full Vitest | 27 failed / 21,237 passed: the same 27 tests fail on master `480bd5d71`. On Nov 21, `lib/nst/requestBudget.test.ts` timed out once under full-suite load; it passes alone and the candidate changes nothing in `lib/nst`. |
| Typecheck (`npm run typecheck`) | exit 0 |
| ESLint, 43 changed TS files | exit 0 |
| CSS pure check | not applicable: no `.scss` changed |
| Readiness fixture | pass on PG 15 and 17 (UTC session) |
| Dispatch fixture | pass on PG 15 and 17 |
| In-order rehearsal ([script](rehearse-migrations.sh), [PG15](rehearse-pg15.log), [PG17](rehearse-pg17.log)) | pass on PG 15.19 and 17.11, UTC, one transaction per migration |

The rehearsal applied readiness, then dispatch. It then exercised Nov 14 and Nov 19 marker shapes:
- the served cutoff read Nov 19;
- one Nov 19 window set to writing made it fall back to Nov 14;
- a scheduled claim succeeded once and was refused on replay;
- empty sources came back blocked.

The rollback in reverse order restored the pre-migration `public` schema dump exactly, and both migrations re-applied.

Fixture caveat: the readiness fixture writes timestamps with no zone, so on this Mac (CST) it fails unless the session is UTC. Production is UTC.

## Migrations

| Order | Version | sha256 | git blob | Bytes |
|---|---|---|---|---:|
| 1 | `20261118151903_rankings_publication_readiness.sql` | `a553fbd65ffad72e71888f41b42372f0745fd6e95d49c7d86cd6537e8a96f8b3` | `e46cde94d` | 20,786 |
| 2 | `20261118160000_rankings_daily_dispatch.sql` | `f64cc60f468a8c7bcb65e0e3d05afe83957f738a9a1abd24e48bffe971aa8e11` | `b4bcd07c2` | 11,163 |

- **Readiness** adds one `security invoker` function, executable by `service_role` only. It takes no table locks.
- **Dispatch** adds:
  - the `ranking_publication_dispatches` ledger, with RLS on, no delete grant, and no timer or auto-takeover;
  - four functions;
  - a plain (non-concurrent) partial index `ranking_dispatch_existing_5v5_rows` on `entity_metric_rankings`. The index build takes a SHARE lock: reads continue, but Rankings writes wait until it finishes. Apply it when no publish is running.
- **Out of order.** Production already has later versions applied (through `20261122001000`). Apply these two **by exact version only**: `db push` is unsafe here (see Prechecks).

## FORGE fingerprint

- **Change.** Producer closure `0446100e09f468bc061dbc7049ddc1fddec54237a617d7e63ca4835a66b48223` (master, registered) becomes **`7ee3612e5965a7cb35b20ef6d65c68808c05c011001cdcc8b9dd15100924eccf`**. Recomputed on `558ea2fb4`: 243 modules, 0 findings.
- **Why it changes.** Six closure modules change: `withCronJobAudit.ts`, `fetchRollingPlayerAverages.ts` (shared rolling/support revision stamp), and the `update-games`, `update-nst-gamelog`, `update-rolling-player-averages` and `update-wgo-skaters` routes (readiness receipts).
- **Verifier.** `verify-forge-release-sha.ts 3a5e4a9d1…` returned VERIFIED: 0 findings, 25 dynamic table sites. Receipt sha256 is `4e59c9b7451fa370734a6d59d05a90d60d9c5de8dfb8a997550de59f1a1c0a6e`, stored in the candidate at `tasks/artifacts/rankings-daily-publisher-release-2026-11-21/3a5e4a9d1….json`.

## Registrations

| Item | State |
|---|---|
| FORGE producer closure `7ee3612e…` | **Done in candidate** (`b6519f0ef`). Without it, FORGE runs from this build would stamp an unlisted producer and go unserved. |
| `vercel.json` function `rankings-daily-publication.ts` 180 s | In candidate. The BLSH functions-map test is updated to expect it (`558ea2fb4`). `octoberBranch` carries the same one-line test fix, uncommitted. |
| Supabase migration history | Two out-of-order versions; see Migrations. |
| Scheduler | **None registered** (no Vercel cron, no `pg_cron`). Without a caller, the route never runs. A canary needs one authenticated GET between 13:46:00 and 13:46:59 UTC. Recurring runs need a `vercel.json` cron (one more build) and a separate approval. |
| Production env | `RANKINGS_DAILY_PUBLICATION` is unset, which means disabled. A canary needs it set to one target date, plus `RANKINGS_DAILY_PUBLICATION_RELEASE=558ea2fb4b8efc86b249179bbdb192fd242be809`. Vercel env changes only reach a new deployment, so set them before the push or pay for another build. |
| Not required | `database-generated.types` (the code uses untyped RPCs; typecheck passes). `migration-authority.json` is already 11 entries behind on master, and its test fails there too. |

## Prechecks run Nov 22, 08:16 CST (TJ approved; read-only)

One `list_migrations` metadata call and three SELECTs, run in sequence with `statement_timeout = 15s`. Nothing was written.

- **Migration history.**
  - Production has applied everything through `20261122001000_luna_fxtwitter_empty_rollover`. That version is **not in master's tree**.
  - Master contains `20261120143000_blsh_official_pilot_redate_20261121`, which production has **not** applied. It belongs to another lane.
  - Therefore `supabase db push`, with or without `--include-all`, is unsafe here: it errors on the missing remote version, or it pushes the BLSH migration too. **Apply the two Rankings migrations by exact version only**, each in one transaction with its `schema_migrations` row.
- **Table and activity.**
  - `entity_metric_rankings` is 253 MB heap (337 MB with indexes), about 261k rows, so the index build should take seconds.
  - None of the new objects exist yet.
  - 0 non-complete markers; 0 active Rankings or composite queries.
  - The only Rankings or composite jobs in the last 24 h are this lane's Nov 21 dry runs and publish.
- **Cutoff rule, evaluated inline.** Both pairs qualify, so `latest_ranking_publication_cutoff` should return **2026-11-19** after migration.
  - Nov 14: 775 players; 4 of 4 windows finished at or before the composite start (20:30:59.934 ≤ 20:36:08.056 UTC).
  - Nov 19: 784 players; 4 of 4 (17:52:01.746 ≤ 17:53:44.258 UTC).
- **First-run blocker, now observed.** 0 of 432 (Nov 19) and 0 of 73 (Nov 21) 5v5 rolling rows share a stamp with their support row. The largest gaps are 0.77 s and 39.1 s.
- **Out of lane, flagged.** Nov 21 has only 73 5v5 rolling rows, written 08:15–08:18 UTC, against a 14-game slate (roughly 500 expected). Nov 21's rolling data looks incomplete as of 14:16 UTC.

## Migrations applied Nov 22 (TJ approved "Apply migrations now")

| UTC | Version | Result |
|---|---|---|
| 14:19:19 | `20261118151903_rankings_publication_readiness` | Applied in one transaction (`statement_timeout` 60 s, `lock_timeout` 5 s); sha256 `a553fbd6…` checked before applying. |
| 14:19:50 | `20261118160000_rankings_daily_dispatch` | Same; sha256 `f64cc60f…`. |

- **How it ran.** The files came from candidate `558ea2fb4`, applied with `psql \i` through the session pooler `aws-0-us-east-1.pooler.supabase.com:5432`. The direct host is IPv6-only and didn't resolve on this network.
- **History rows.** Each is recorded under its exact version with the whole file as one `statements` entry. The stored text lacks the file's final newline (md5 `a2fb0b14…` and `aac615bb…`), because `$(cat …)` strips it. The executed SQL was the exact file.
- **Readback, all as expected.**
  - `latest_ranking_publication_cutoff(20262027)` = **2026-11-19**.
  - The ledger is empty, has RLS on, and gives `service_role` select, insert and update but no delete.
  - `ranking_dispatch_existing_5v5_rows` is valid.
  - `anon` and `authenticated` have no execute on any new function; `service_role` can claim.
  - 0 non-complete markers; 0 lock waiters.
- **Effect on the live app.** `480bd5d71` never references these objects, so serving is unchanged. Rollout steps 1–3 below are done.

## Rollout order (each step needs its own approval)

1. **Read-only prechecks.**
   - Production `list_migrations`: which later versions are applied.
   - `entity_metric_rankings` size, to estimate the index build.
   - No Rankings writer running.
   - Nov 19 markers: every Rankings `completed_at` ≤ the composite `started_at`. The receipts say yes (windows done 17:52:01 UTC, composite write began 17:53:24 UTC).
2. **Apply `20261118151903`**, then **`20261118160000`**, by exact version, one transaction each.
3. **Read back:**
   - `latest_ranking_publication_cutoff(20262027)` = `2026-11-19`;
   - the ledger is empty;
   - grants are `service_role` only.
4. **Push `558ea2fb4`** to master as a fast-forward of `480bd5d71`. Expected footprint: 1 fhfhockey build plus the usual cancels. Re-inventory first. With env unset, the route returns `{status: "disabled"}`.
5. **Watch the next FORGE run** (existing ~10:xx UTC schedule). It should stamp `7ee3612e…` and be served. Sync `octoberBranch` from master.
6. **Later, separately:** canary env, scheduler, then the first natural run.

The database **must** go first. Both migrations are additive and the current app never references them, but the candidate's manual Rankings and composite routes fail without the dispatch RPCs.

## Rollback order

1. Stop the caller and disable the setting, if either was enabled.
2. **Instant rollback** to `dpl_A6wXhPbxbrNJWGCThoe5bsouyHmG` (`480bd5d71`), with no build. Caveat: any FORGE run stamped `7ee3612e…` stops being served under the old registry; rerun FORGE on the rolled-back deployment if that matters.
3. Leave the database objects in place; the old app ignores them. Never drop them while the candidate is serving, because its manual routes need them. Drop them only after step 2 and only while `ranking_publication_dispatches` is empty, using the rehearsed reverse block: dispatch functions, then table, then index, then readiness function, then both version rows. Never drop the ledger once a scheduled row exists.

The served Nov 19 pair is untouched in every step.

## First natural run must show ([readback-first-run.sql](readback-first-run.sql))

For target D:
- One `scheduled` ledger row: `complete`, stage `readback`, `prior_cutoff` 2026-11-19 (or the newest served pair), `durableCutoff` = D.
- Four Rankings markers at D, all `complete`, each with `expected_entities = written_entities = N` and `db_written_rows = expected_rows = 17N`.
- **Every window `completed_at` ≤ the composite `started_at`.**
- The four windows' `points_per_60` ID-set md5s are identical and equal to the composite ID-set md5, with N rows.
- The season composite marker is complete at N.
- `latest_ranking_publication_cutoff` = D, and the live matrix serves D in all four windows.

A `blocked` result (`no_slate`, `source_incomplete`) with no markers or rows at D is a safe outcome: Nov 19 keeps serving.

**`failed` and `ambiguous`.**
- **`failed`** happens before any publication write. Nothing at D, and Nov 19 keeps serving.
- **`ambiguous`** means a publication write started and the run did not confirm the result. It holds the single-writer lock (scheduled and manual) until an operator reconciles it with `reconcile_ranking_publication_dispatch` after proving worker and database quiescence. The reader still serves the newest complete pair. Record `elapsedMs` and `dbRequestsBeforeReceipt` from the ledger evidence.

**Time budget, unverified on hosted runtime.**
- The app stops at 175 s inside a 180 s function cap, with at most 1,000 database requests.
- Today's manual writes from this Mac took 114.0 s (Rankings) plus 25.6 s (composites). The Nov 18 cost receipt recorded 109.1 s for the historical writes. The scheduled run also does two readiness reads and the in-memory build first.
- Function time on Vercel next to the database is unknown. An overrun during publishing ends `ambiguous`, not `complete`.

**Expected first-run blocker (inferred from the repo, not observed in production).** Readiness requires every played date after the last served pair to have rolling and support rows sharing one revision stamp. Only the candidate's writer stamps them that way. The current writer leaves `updated_at` to each table's `now()` default in separate upserts, and no migration in the repo adds a trigger on either table.
- Nov 21's rolling data (written about 10:10 UTC Nov 22) came from the current code, because the candidate was not deployed.
- So the first run will report `rolling_5v5_source_missing` for gap dates written before the deploy.
- Clearing it needs either a scoped whole-cohort rolling repair per gap date on the candidate, or one more manual paired publish (with the four-window precheck) to move the served pair forward.
- The gap must also stay within 14 days.
