# FORGE Full-NHL H1–H10: plan for one unattended shadow issuance

> **Superseded by `hosted-packet/PACKET.md`.** The shadow run is now a hosted route plus a proposed cron, not a local
> script. B1 (the `prospective_shadow` opt-in) and B2 (feature and training preparation) are built and proven locally.
> The capacity figures below are replaced by the packet's full-scale measurements.

Milestone 2. This is a plan only. Nothing here is wired, scheduled or run.

- Baseline: production master/alias `9ac6f4bcc`; producer closure `23af25d3…`, which this plan leaves unchanged.
- Code references are to the v2 modules as they stand at that baseline.

## 0. What blocks this today (read from the code)

| # | Blocker | Where |
|---|---|---|
| B1 | The v2 issuance path refuses prospective evidence. `validatePrepared` throws `development_pipeline_cannot_issue_prospective_or_public_evidence` unless `evidenceClass` is `fixture` or `retrospective_reconstruction`. A shadow run needs a reviewed change admitting `prospective_shadow` (decision D4). Labelling the run `retrospective_reconstruction` would be false and is not proposed. | `web/lib/forge-v2/pipeline.server.ts` `validatePrepared` |
| B2 | There is no feature reader and no training set. `runPreparedIssuance` needs a `PreparedIssuance` per key: accepted source records with features bound to them, a fitted `CandidateModel`, and episode and lock observations. `fitCandidate` needs `ModelExample[]` with outcomes. Nothing in the repo builds these from production tables; the lifecycle test fits on 5 synthetic rows. | `pipeline.server.ts`, `model.ts` `fitCandidate` |
| B3 | Goalies can't be stored. `forge_v2_vintages` has a CHECK pinning `targetVersion = 'nhl-official-skater-appearance-v1'`, and the means must hold the seven skater categories. | `supabase/migrations/20261029235656_forge_v2_immutable_history.sql` |
| B4 | There is no official transaction source. IR, LTIR and assignment status aren't parsed from the roster feed (§2). | — |
| B5 | Sources must be approved. `assertSource` rejects any source whose `use` isn't `approved`, so unapproved roster or schedule receipts resolve every player as `unverified_affiliation`. | `contracts.ts` `assertSource` |
| Q1 | A single queue is too large: 7.26 MB of state, rewritten on every save (§5). | `refresh.ts` / `runPreparedQueueBatch` |

## 1. What the run is (once B1–B5 are decided)

- **One cutoff.** One run at one cutoff `asOf`, building one frozen denominator with `buildDenominator`
  (`web/lib/forge-v2/denominator.ts`) and `evidenceClass: "prospective_shadow"`.
  - Every skater key is planned through `planScheduledRefresh(scopes, asOf)`, daily plans only.
  - Execution goes through `capturePreparedLedger`, `enqueueRefresh`, `runPreparedQueueBatch`, `runPreparedIssuance`
    and `PostgresHistoryStore.publishClaimed`.
- **What it writes.**
  - Production Postgres: only `forge_v2_private`, meaning vintages, receipts, records and work-queue rows.
  - Local disk: `FileArtifactStore` (`artifacts.server.ts`) writes joint-distribution and calibration artifacts to a
    pinned directory on TJ's machine. These are permanent manifests, with up to one joint artifact per published
    vintage that has a model.
- **What it doesn't touch.** RSO, Daily, pregame, Start Chart and every other consumer:
  - `pages/api/v2/forge/[operation].ts` stays `createForgeReadHandler({ enabled: false })`.
  - `RSO_V2_ADAPTER_ENABLED` stays `false`.
  - No v1 FORGE table, cron, route or producer-closure file is touched.
- **How it runs.** A local Node script runs it unattended, with no human step mid-run.
  - It is not a Vercel function: no build, deploy, Vercel runtime or cron change.
  - A Vercel route is the wrong host, because the run exceeds one 300 s invocation (§5).

## 2. Inputs (captured before the run, frozen, hashed)

| Input | Source | Requests | Notes |
|---|---|---|---|
| Roster snapshots | `api-web.nhle.com/v1/roster/{abbr}/20262027`, the URL `targetRosterObservationFromReceipt` already validates | 32 GETs | That parser reads only player ids from `forwards` / `defensemen` / `goalies`, which gives membership and class. Injury status isn't parsed, so whether IR/LTIR players appear on this endpoint is **unverified**; check one captured body. Assigned (AHL) players aren't listed, so they need B4. Each row becomes `roster_snapshot` evidence: `observedAt` = response `Date`, `firstReceivedAt` = receipt clock. |
| Official transactions | **B4: no approved source** | 0 | The contract is ready (`MembershipEvidence.kind="official_transaction"`, `transactionType`, `supersedesRevision`). |
| Schedule | `api-web.nhle.com/v1/club-schedule-season/{abbr}/20262027` | 32 GETs | Full season, so `scheduleComplete=true`: exact NHL game ids, start, home/away, state. There is no parser for this endpoint yet; it is new adapter code that needs review. |
| Features and training examples | **B2: tables not identified** | — | A bounded read-only reader is to be designed. No NST. |

- **External GETs.** 64, serial, all to `api-web.nhle.com`. Both sources need `use: "approved"` (B5).
- **NST: none.**
  - The run makes **zero** Natural Stat Trick requests.
  - Gate G3 aborts if any planned or received URL host is NST.
  - No NST admission slot is used, and the shared 40/1m, 80/5m, 100/15m, 180/1h budget is untouched.
  - If a later reader needs NST, it goes through the existing single-job NST admission (≥ 21 s spacing, one NST job
    at a time). That is a separate approval.

## 3. Skaters and goalies: what each key yields

- **The denominator** carries both classes. On Astra's receipt floor that is 731 skaters / 7,310 keys and
  73 goalies / 730 keys.
- **Skater keys go through `runPreparedIssuance`:**
  - **No prepared inputs** (`prepared: null`): one opportunity ledger record and result
    `unavailable: prepared_inputs_missing`. **No vintage is written.** The batch records an `unavailable` history
    event, plus `missing_refresh` once the job fails terminally. Coverage counts the key as missing.
  - **Prepared inputs but `model: null`:** a vintage is published with every mean
    `unavailable("conditional_model_unavailable")`. Coverage counts it as nonNumeric.
  - **Prepared inputs and a model:** a vintage with numeric means, plus a joint-distribution artifact when coherent.
    Coverage counts it only if every core field is finite.
- **Goalies (B3).**
  - **D3a, recommended for the first run:** goalie keys stay in the denominator and are reported as
    `missing: goalie_target_unsupported`. That is 730 explicit missing keys, never dropped.
  - **D3b:** a goalie target `nhl-goalie-if-starts-v1` with core SAVES/SHOTS_AGAINST/GOALS_ALLOWED/SHUTOUT_PROB. It
    needs an additive migration and a goalie numbers source. Reusing FORGE goalie-stage output touches the producer
    closure, so re-registration would be flagged.

## 4. Idempotency and retry dedupe (existing machinery, no new key format)

- **Issuance key.** `planScheduledRefresh(scopes, asOf)` yields `daily:<ET date of asOf>:<targetKey>`. The ET date
  comes from the pinned `asOf`, never the wall clock, so a re-invocation produces the same keys.
- **Vintage and job ids.** Vintage id = `vintage:sha256(issuanceKey)`, job id = `refresh:sha256(issuanceKey)`.
  `enqueueRefresh` dedupes the same key.
- **Retry dedupe.**
  - `forge_v2_vintages.issuance_key` is UNIQUE with `on conflict do nothing`, plus a readback hash check.
  - Same bytes give a no-op.
  - Different bytes (for example a trade changing `teamId` within one ET date) fail closed with
    `Idempotency conflict: issuance bytes changed` and are recorded as a failed attempt, never an overwrite.
  - A stored draft is re-published only if `sameIssuedScope` holds.
- **Claims.** Leased (`leaseMs ≤ 15 min`), fenced by queue `revision`; `publishClaimed` re-checks the live claim in
  the same statement. `maximumAttempts: 2`.
- **Crash recovery.** `runPreparedQueueBatch` recovers published drafts through `getDraft` / `get`.
- **Run id.** `shadow-h10:<denominatorSha256>`. Re-invoking with the same frozen denominator and `asOf` resumes the
  same queues and creates no new vintages (gate R5).
- **Denominator link.** Every vintage's `sourceManifest` gains a `SourceReference`
  (`id: "forge-h10-denominator"`, `sha256: <denominatorSha256>`, `use: "approved"`).

## 5. Capacity

**Measured locally.** M4 Max, synthetic full scale: 804 players including 73 goalies, 1,312-game season,
201 trades. `capacity-measure.ts` is in the notes folder.

| Step | Result |
|---|---|
| `buildDenominator` | 152 ms, 8,040 keys, 0 shortfalls |
| `serializeDenominator` | 36 ms, 3.31 MB |
| `planScheduledRefresh` (7,310 skater scopes) | 71 ms → 14,620 plans (7,310 daily) |
| `enqueueRefresh` (7,310 daily) | 196 ms |
| One queue's state JSON | **7.26 MB** (≈ 993 B per job) |
| `claimRefreshBatch` (batch 25) | 141 ms per batch on a single 7,310-job queue |
| Vintage payload | ≈ 1.96 KB |

**Derived from code.** This is an upper bound in which every skater key has prepared inputs and a model.

- **Ledger.** An opportunity record is written for every key, even without prepared inputs. Prepared keys add a
  horizon-episode record and a lock-epoch record. Each record is an insert plus a readback.
- **Issuance.** Per published key: 3 write statements (`nextval`, vintage insert, receipt insert with queue fence),
  ~3 reads (`getDraft`, readback, `get`), and `assertClaim` reads (one queue load each, about 5 per key).
- **Queue.** 1 load plus 1 `saveQueueWithRecords` per completion, and 1 load plus 1 save per claimed batch.
  `runPreparedQueueBatch` claims ≤ 100 jobs per call.

| Measure (7,310 skater keys) | Total |
|---|---|
| Ledger inserts | ≈ 14,789 (7,310 opportunities, 7,310 episodes, ≤ 169 locks) |
| Issuance write statements | ≈ 21,930 |
| Queue saves | ≈ 7,603 |
| **All write statements** | **≈ 44,300** |
| Reads | ≈ 80,000 (including about 36,500 claim checks) |
| Permanent rows | ≈ 29,400 + 320 queue rows: ≈ 7,310 vintages (≈ 14 MB payload) + 7,310 receipts + ≈ 14,789 records |

- **Q1, sharding.** A single queue rewrites its 7.26 MB state on each save, about 55 GB of state writes per run. Plan:
  one queue per team × horizon, 320 queues of about 23 jobs and about 23 KB each, about 175 MB in total.
  `queueId = shadow-h10:<denominatorSha256>:<teamId>:H<h>`. That is runner-side partitioning, with no change to
  `refresh.ts`.
- **Time.** Unmeasured against Postgres.
  - At an assumed 10 ms per round trip, about 124,000 serial statements take about 21 min.
  - Next local step, before any approval: run the whole batch against local Supabase with the v2 migration applied,
    and record rows, time and bytes. No production is involved.

## 6. Gates

**Before the run (all must pass, or the run does not start):**

- **G0.** Producer closure prints `23af25d3…`. No FORGE daily or acceptance file changed. Only the reviewed D4
  change exists in `pipeline.server.ts`.
- **G1.** One read-only query confirms that the five `forge_v2_private` relations and the issuance sequence exist,
  and records their row counts. If they are missing, the migration is unapplied: **stop**. Applying it is a
  separate ask.
- **G2. The denominator.**
  - 32 teams; every team has H1–H10.
  - `keys == players × 10`, `shortfallPlayers == 0`, `scheduleComplete`.
  - `unresolved` and `conflicts` are each listed, with every entry either reviewed by TJ or zero.
  - Rebuild from the same captures is byte-identical. `denominatorSha256` is recorded.
  - Player count is within ±3% of the 804 receipt floor, or explained.
- **G3. Capture receipt.** 64 GETs, all 200; zero NST hosts; every source `use: "approved"`; inputs hashed.
- **G4. Prepared inputs.** The count of skater keys with prepared inputs, and with a fitted model, is recorded
  before the run starts.

**Readback after the run** (a separate read-only reader, before any claim of success):

- **R1.** Vintages naming the denominator sha = G4's prepared-key count.
- **R2.** Every skater key not in R1 has an opportunity record and an `unavailable` or `missing_refresh` history
  event with a reason. R1 + R2 = 7,310.
- **R3.** Every R1 vintage has a receipt with matching `output_hash`: join count = R1.
- **R4.** `measureCoverage` on readback rows.
  - Report numeric, nonNumeric and missing by horizon and class.
  - **Accept:** `stray == 0` (no row off-denominator or on the wrong team); every non-numeric row has a reason.
  - The numeric share is reported, not gated, because this is shadow evidence and nothing is qualified.
- **R5.** Re-invoke once with the same denominator and `asOf`: 0 new vintages, receipts and records, other than the
  attempt events.
- **R6.** Row counts of `forge_runs`, `forge_player_projections`, `forge_reserve_projections` and
  `forge_goalie_projections` are unchanged (counts only). No route or cron was invoked.
- **R7.** `api/v2/forge` is still `enabled: false`, and RSO, Daily and pregame code are unchanged (diff check).

## 7. Rollback

- **Rows are permanent.** Vintages, receipts, records and artifacts are append-only: triggers reject UPDATE, DELETE
  and TRUNCATE. Shadow rows can't be removed without a migration that drops those triggers, which is not proposed.
- **Rollback means stopping and withdrawing.**
  - Kill the script. Leases expire and nothing else claims the shadow queues.
  - Append one `history_event` record of kind `retraction` naming the run id and denominator sha.
- **Local artifacts** stay under their pinned directory.
- **No consumer reads any of it**, because the route and adapter are disabled, so there is no user-facing rollback.
  There is no deploy, so there is no code rollback.

## 8. Decisions and approval TJ would need

1. **D1 / B4, transactions.** Approve an official transaction source, or accept a snapshot-only first run with
   limitation `transactions_feed_absent` and no IR/LTIR/assigned status.
2. **D2 / B2, numbers.** Approve the design of a bounded read-only feature and training reader for the existing v2
   kernel-means model (`official-appearance-kernel-means-v1`, unqualified). It needs named tables and row caps. It
   leaves the producer closure and live FORGE untouched. Otherwise the first run publishes only opportunities and
   `prepared_inputs_missing` events, with 0 numeric coverage.
3. **D3 / B3, goalies.** D3a (explicit missing) or D3b (goalie target plus migration plus numbers source).
4. **D4 / B1.** A reviewed change admitting `evidenceClass: "prospective_shadow"` in `validatePrepared` and the
   stored-draft check in `runPreparedIssuance`. `lib/forge-v2/*` is outside the producer closure, so no
   re-registration is needed.
5. **B5.** Approve `api-web.nhle.com` roster and club-schedule receipts as `use: "approved"` sources for this
   shadow use.
6. **Q1.** Accept queue sharding per team × horizon.
7. **The write approval.** One bounded production write run:
   - To `forge_v2_private`: ≈ 44,300 write statements and ≈ 29,700 permanent rows (≈ 14 MB vintage payload,
     ≈ 175 MB queue-state writes).
   - Local permanent artifact files.
   - 64 serial `api-web.nhle.com` GETs, 0 NST requests.
   - Read-only feature SELECTs within D2's caps, plus the G1/R1–R6 readbacks.
   - Service-role credentials used from TJ's local env.
   - No deploy or build; no cron, route or migration (if G1 fails, a migration is a separate ask).

Prerequisites before asking for item 7: decisions D1–D4, B5 and Q1; the measured local-Supabase run (§5); a reviewed
runner script; and a G0–G4 dry run against captured inputs.
