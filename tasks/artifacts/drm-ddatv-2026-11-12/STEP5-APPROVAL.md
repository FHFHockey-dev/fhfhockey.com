# DRM step 5: proposed bounded repair

**Active run: TJ approved conditional 252/278 repairs, then unlimited health latency and back-to-back sequential games.** The approved scope and current progress are `production/step5/APPROVED-SCOPE.json` and `PROGRESS.json`. Scheduled-writer completion is verified. The original six-hour window started at 21:05:42Z. The current 894-RPC ceiling remains in force; the 924-attempt retry proposal is pending. No new deployment is authorized or needed. The original proposal below is historical; current explicit overrides are recorded in the approved scope.

## Exact population

Project: `fyhftlxokyjtpndbkfse`, production. Season20262027, regular season, through2026-11-11.

- **295 backlog games:** IDs2026020001 through2026020298, excluding the three pilot games252,278,296.
- **One additional previously repaired game:**2026020296 requires recapture/requalification because its PBP head changed from raw95809/v1 to97238/v2. Include its repair explicitly; do not conceal it within the295count.
- **Write ceiling:296games,888existing RPC calls.** Exact allowed IDs and order are in `production/STEP5-PROPOSED-SCOPE.json`:296first, then the295backlog IDs descending. Already-current, fully verified games need no write.
- **252 and 278: TJ's manifest decision is pending.** Option A permits new DRM input/relationship/per-game-derived manifests only if fresh qualification establishes a repair is necessary, raising the ceiling to 298 games / 894 write RPCs. Option B keeps them read-only, retaining the 296-game / 888-RPC ceiling and stopping if either requires a write. Neither option permits changing normalized-source manifests or raw sources. Unchanged raw heads alone do not authorize or require a replacement.

## What the handoff proves, and what remains unverified

Claude reports all298games normalized at strength v2/complete, no active Claude job, and step4 completed using summary-only writes. Player-summary writes advanced **landing** heads. PBP/shift heads remain as in the453-row `HEADS-CHANGED-2026-11-12.tsv`; its SHA-256 was verified locally as `b15ee495e68217417a1ad9b1fb3f4dbd0fc310e082552a75a5fc0fbbf1a5be5c`.

Landing-head changes do not invalidate DRM's PBP/shift-head receipts. `CLAUDE-FIX-SPRINT-STEP5-REVIEW-20261112` corrects the earlier claim that 252 was untouched: its normalized rows were rewritten at 18:01:15Z, normalization version 3, before our 19:03 pilot capture. Game 278's normalized rewrite at 19:12:03Z, version 2, followed our 19:08 capture. Their raw PBP/shift heads remain 93736/93737 and 94526/94529 respectively. Fresh normalized-dependency checks are required, but a version change alone does not establish that a DRM receipt is stale. Our derived preparation reads normalized shift-player identities, so those are recaptured rather than reused.

**Scheduled-writer gate:** do not start fresh qualification until the November 12 **20:51Z / 3:51 p.m. Eastern** `update-PbP?gameId=recent` run has demonstrably finished, including any continuing/delegated work. That route ingests November 11, which overlaps this scope. A passed clock time, successful pg_cron HTTP enqueue, or an empty activity sample is not completion evidence. Use an existing terminal application audit/job receipt (or an explicit operator handoff), and confirm no continuation remains. At most 6 bounded status/log reads are included after approval; if completion remains uncertain, stop. Do not invoke or disable the scheduled job. Capture November 11 sources again after that verified finish, allowing documented changes from this scheduled run rather than treating the older TSV as immutable current state. No completion check has been performed for this proposal.

Repair capture/preparation uses no live `skatersGameStats`, `goaliesGameStats` or `lineCombinations` inputs. The offline reader checks supply empty card-stat tables. The final local API smoke does read current game stats for cards, so those display values may change with the stats cron; they are separate from repaired ice-time and manifest acceptance. No line-combination table is read by this repair.

The21released source paths and all24loaded preparation/reader modules still match the verified pilot hashes. No current raw payload, roster, normalized identity set, materialization receipt or deployment has been fetched for this proposal. Therefore the296candidates are **not yet qualified for publication**. The old3/3VGK browser result is historical.

## Execution after approval

1. Record TJ's exact approval and 252/278 policy. Verify recent-game writer completion, then record the step-5 start time and serial window. Verify production retains the 21 writer source hashes from 866b90bc4; the owner reports production 4243bcd4e builds on that release, but fresh metadata verification remains required. No push/build. Confirm health and record checkpoint-counter/statistics-reset baselines before qualification.
2. Read and requalify 252/278; write only if the selected policy permits it and the fresh prepared-versus-stored comparison proves it necessary. Preserve original captures and receipts. For every candidate, take a new bounded capture of PBP/shift heads, retained raw payloads, historical roster, normalized shift-player identities, materialization status and exact affected-table exports. Ignore landing heads for DRM source admission. Captures must postdate verified scheduled-writer completion; stop on unexplained subsequent source changes.
3. Prepare offline using the existing writers and actual DRM reader. Require both teams to pass source identity, clock/interval, roster, count and current-version checks. Rebuild the exact-game player/team/goalie facts offline too. Eleven recovered OT games must pass individually; normalized v2 alone is insufficient. No new provider fetch or source replacement is included.
4. After a fresh health guard, compare heads, roster and manifest again. Publish only that game's inputs, relationships and dependent per-game facts through `persist_projection_game_inputs_v1`, `persist_shift_chart_relationships_v1`, and `persist_projection_game_derived_v1`, in that order. Input replacement invalidates/deletes that game's old derived facts; the third transaction restores the prepared facts. Preserve incomplete status if interrupted; never claim partial execution complete.
5. Read back all affected rows/receipts and compare counts, fields and fingerprints. Require both teams to pass the actual reader against stored receipts. Write a per-game journal and preserve before/after exports. No repeat mutation or automatic rollback after a failure; reconcile the committed stage first.
6. At completion, make one bounded status inventory and at most one read-only local API request for VGK54, season20262027, regularSeason,2026-11-05..2026-11-11: `/api/v1/drm?teamId=54&seasonId=20262027&seasonType=regularSeason&startDate=2026-11-05&endDate=2026-11-11`. Stop if coverage or values disagree. Post exact outcomes, exclusions, remaining work and DB-writes-stopped handback before Goalie H1 proceeds.

## Limits and stop conditions

| Resource | Ceiling |
| --- | --- |
| Concurrent games/requests |1|
| Game start spacing |At least60seconds; checked from journals|
| Runtime |Approximately5hours; no new game after the6-hour execution window|
| Capture |At most20GETs per game;5-second request timeout|
| Apply plus readback |At most 35 requests per write candidate, including at most 3 RPC POSTs; **5-second write timeout**, including the receipt body; 4MB maximum POST body|
| Total DB REST requests |16,320 if 252/278 stay read-only; 16,390 if conditional repairs are approved (298×55)|
| SQL |At most 600 health guards, including cooldown rechecks, plus 2 bounded inventories; **1-second health statement timeout and measured roundtrip ≤1 second including connection time**|
| Scheduled-writer completion |At most 6 bounded existing status/log reads; no ingestion endpoint call|
| Deployment metadata |At most3read-only requests;0builds/deployments|
| Application smoke |At most1sequential GET, the exact local DRM route above|
| Providers/raw source writes/migrations/global recomputes |0|

Require a health receipt less than 60 seconds old before writes: healthy project, zero I/O/lock waits, no active query older than 5 seconds, and a measured probe roundtrip ≤1 second including connection time. Read `pg_stat_bgwriter.checkpoints_req` and `stats_reset` with that probe. An increased forced-checkpoint counter pauses new work for at least 180 seconds; a fresh healthy probe and stable counter are required afterward. A statistics reset or missing baseline blocks execution until reconciled. Cooldown rechecks count toward the 600-probe ceiling; stop if it is exhausted. This pause does not retry any mutation.

Stop on the **first** write RPC reaching 5 seconds, or any failed request, changed head/roster, failed qualification, CAS failure, row/receipt mismatch or unhealthy guard. A client timeout does not prove the server rolled back: preserve the journal and reconcile the transaction before any further mutation. No automatic retries, overlapping jobs, trigger changes, summary sweep or rolling-model recompute. The next game cannot start until the preceding game is reconciled, the checkpoint hold has cleared and the 60-second spacing rule is satisfied.

Direct Supabase egress/WAL/billing cost is not established. The pilot used36REST requests per game; its write RPCs completed in under1second. Those measurements do not guarantee bulk-run timing. The wider repair is needed because source-code deployment cannot replace the older stored generations; the live inventory previously found295unfinished games.

## Local readiness checks

`production/STEP5-OFFLINE-CHECKS.json` records passing approval/window/scope refusal checks,60-second pacing boundaries, the historical296stored-row replay, and refusal of its changed PBP head. Network requests:0. Script syntax passed. No application source or dependency change, new build, provider request or production mutation was needed to prepare this plan.

The proposed scope remains `pending_explicit_step5_approval`, with an unresolved 252/278 policy, no verified scheduled-writer completion and no execution start time. It cannot run as written. Fresh stored-data qualification and deployment/health checks are authorized-run prerequisites, not completed evidence.

## Revised approval question

Approve step 5 only after verified completion of the November 12 3:51 p.m. Eastern recent-game writer, with one game at a time, at least 60 seconds apart, a six-hour execution window, a ≤1-second health probe, a 5-second RPC stop, and a three-minute forced-checkpoint hold?

1. **Approve conditional 252/278 repairs:** up to 298 games / 894 write RPCs; create new DRM/per-game-derived manifests for those two only if fresh qualification requires them.
2. **Approve 296 games; keep 252/278 read-only:** up to 888 write RPCs; stop if either needs a manifest repair.
3. **Keep the plan unexecuted.**
