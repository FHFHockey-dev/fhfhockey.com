# Shift relationship calculation and transaction audit

Reviewed canonical `octoberBranch` HEAD `ca06cbf6c7ee6dcdb9e54e1f610ac109a8eb8de8`, 2026-11-12. The five named application/SQL files were unchanged in the working tree. Actual worker runtime was `gpt-6.1-sol` / `high`, verified from this worker's `turn_context`. Read-only application audit: no remote services, ingestion, deployment, database writes, or application edits.

**Subsequent local remediation:** Chef assigned route implementation after independently confirming four live overlong goalie cases. The findings and line/hash receipts below describe the initial audited revision. The route and existing audit test now have a local remediation diff; no remote mutation occurred. See the final section for actual implementation evidence.

## Material findings

### 1. Overlapping intervals can inflate both player and pair TOI — reproduced locally

`web/pages/api/v1/db/shift-charts.ts:846–864` sums each raw interval's duration. Its pair calculation at `:928–946` adds every Cartesian intersection without first making each player's intervals disjoint. The strict validation invoked at `:784–790` validates each interval, but does not reject same-player overlaps. Thus a valid clock on each row is insufficient to establish a valid player total.

Executed the actual private `upsertShiftChartData` function by appending an in-memory export and transpiling the current source, with the actual `buildShiftStrengthUpserts`, strength segmentation, position resolution, game length, and relationship payload functions. Remote-capable dependencies were blocked; relationship persistence was replaced with a capture-only stub. No source files were edited. Synthetic PBP contained complete 20-minute, even-strength timelines for three regulation periods and both teams.

| Home player 10's period-1 shifts | Home teammate 11's shift | Expected union / pair | Actual game_toi / pair | Actual strength total |
| --- | --- | --- | --- | --- |
| 00:00–00:30 twice, shift numbers 1 and 2 | 00:00–00:30 | 0:30 / 0:30 | 1:00 / 1:00 | 1:00 |
| 00:00–00:30 and 00:15–00:45 | 00:00–00:45 | 0:45 / 0:45 | 1:00 / 1:00 | 1:00 |

The away team supplied an ordinary interval so both-team validation was exercised. All cases passed the real strict strength validator. The companion ingestion audit independently demonstrated that overlapping intervals survive raw/projection normalization; exact equal intervals with different shift numbers also survive projection normalization. These are proven local acceptance/calculation defects, **not evidence that any live game currently contains overlapping rows or overlong TOI**.

Smallest safe repair: in the shared validated shift path, deduplicate semantically identical intervals independent of formatting/shift number, and reject remaining same-player/same-period overlaps before strength or relationship calculation. Rejection preserves honest uncertainty rather than inventing which conflicting interval is authoritative. If overlap reconciliation is a product requirement, use one shared union-normalization function for both producers. Add regression cases to the existing shifts tests, plus a route-level payload assertion. Bump the input/materializer and relationship algorithm versions when their output semantics change so existing complete games are deliberately reconsidered.

### 2. Accepted end-of-period sentinel loses relationship overlap — reproduced locally

`web/lib/projections/ingest/shifts.ts:664–678` intentionally accepts `endTime = "00:00"` when start plus duration equals the played period end. `buildShiftRelationshipStrengthSegments` normalizes that endpoint at `:825–828`. The route instead saves the original zero endpoint at `shift-charts.ts:856–864`, and its pair calculation parses it as zero at `:933–942`.

Executed synthetic period-1 shifts:

- Player 10: 19:30–00:00, duration 00:30.
- Same-team player 11 and away player 20: 19:30–20:00, duration 00:30.

The real validator accepted the source. Player 10's `game_toi` and ES strength total were `0:30`, but stored `time_spent_with[11]` was `0:00` instead of `0:30`; the final payload retained `end_times: ["00:00"]`. This affects relationship overlap, percentages, and potentially line/pair ranking. It does not explain null game TOI.

Smallest repair: after strict validation, normalize only the accepted sentinel to `start + duration` when constructing relationship `ShiftDetail` (or provide that normalized interval from the common validator). All overlap consumers must receive the normalized endpoint. Cover regulation and shortened overtime in an existing route calculation test; advance the relationship algorithm version to requeue old outputs.

## Null-field lineage and success semantics

| Boundary | Actual contract and evidence | Status |
| --- | --- | --- |
| Stored input → route | Stored shift snapshot is filtered to `typeCode === 517` at `shift-charts.ts:619–634`; source hash is calculated from all normalized rows. Stored PBP must be final and complete at `:1124–1138`. | Inspected; no live reads by this worker |
| Input transaction → staging rows | `persist_projection_game_inputs_v1` inserts/upserts strength-owned totals (`supabase/migrations/20260720105524_add_projection_materialization_transactions.sql:1812–1827`). After changed inputs it explicitly clears `game_toi`, `game_length`, shifts, positions, and relationships at `:1837–1859`, and resets relationship status to pending at `:1930–1954`. | Proven intentional staging behavior |
| Player total | Non-null `game_length` comes from final PBP at route `:784/:835`; `game_toi` starts `0:00` at `:836` and sums durations at `:848–854`. Missing/zero/malformed source duration fails earlier through strict strength validation, despite the route's permissive local fallback/sum helper. | Normal path inspected; overlap defect above |
| Period/game length | `gameLength.ts:44–63` handles 60-minute regulation, regular-season 5-minute overtime and shootout, and 20-minute playoff overtime periods; `:76–99` uses the unique final PBP `game-end` clock. Period equality prevents pair overlap across distinct periods (`shift-charts.ts:932`). | Existing game-length tests passed |
| Payload ownership | `shiftChartRelationshipPayload.ts:93–132` deterministically orders parallel arrays and carries both clocks; it intentionally does not write `total_es_toi/pp_toi/pk_toi`. | Existing payload tests passed |
| App freshness/CAS | `relationshipMaterialization.ts:233–278` requires complete input and verifies raw PBP hash and PBP/shift source hashes; `:285–325` passes input version/fingerprint and validates the returned exact count/identity receipt. | Existing mocked tests passed |
| SQL freshness/atomicity | RPC holds the same per-game advisory transaction lock and locks the status row (`migration:2266–2274`), compares input version/fingerprint (`:2284–2287`), checks current raw PBP/shift heads (`:2290–2317`), and validates schedule identity (`:2320–2340`). Clear/replace/prune/status completion occur inside the same function transaction (`:2556–2788`); exceptions roll back all statements. | Source/static tests inspected; no database execution |
| SQL shape/readiness | Payload requires matching shift-array cardinalities and clock-shaped non-null game TOI/length (`migration:2184–2204`), unique players and two teams (`:2250–2263`). It does **not** validate summed duration, non-overlap, TOI ≤ game length, or pair TOI ≤ either player's TOI. A success receipt attests exact persisted supplied rows, not correctness of the supplied math. | Important acceptance limit |
| Idempotency | SQL compares every relationship-owned field (`migration:2405–2474`) and completion identity/counts before an idempotent receipt (`:2476–2515`), protecting against a plain same-count replay mismatch. | Inspected |
| Queue/readiness | `relationshipMaterialization.ts:138–159` queues complete inputs with pending/mismatched algorithm/fingerprint, oldest first. It trusts completed status and does not reread clocks. Route skips unavailable/stale sources but can report success with zero processed and nonempty skip reasons (`shift-charts.ts:1216–1234`). | Existing queue/skip tests passed |

For game `2026020298`, the reported null `game_toi` and `game_length` are compatible with strength-only rows waiting for relationships. They cannot be produced by the inspected successful relationship payload/RPC without a later input invalidation or another writer. Chef separately established the live schedule ordering and pending status; this worker did not independently verify those remote facts.

## Verification and acceptance gaps

Passed: seven focused existing Vitest files, 51 tests:

```sh
cd /Users/tim/Code/fhfhockey.com/web
npm test -- --run lib/projections/gameLength.test.ts lib/projections/shiftChartRelationshipPayload.test.ts lib/projections/relationshipMaterialization.test.ts __tests__/pages/api/v1/db/shift-charts.audit.test.ts __tests__/pages/api/v1/db/shift-charts.queue.test.ts __tests__/pages/api/v1/db/shift-charts.transactional.test.ts lib/supabase/projectionMaterializationMigration.test.ts
```

The initial audit command was issued twice: the initial invocation's completion handle was accidentally omitted from orchestration output, so the second captured the final log and exit 0. Final captured result: 7 files / 51 tests passed, 1.63 seconds. The SQL migration test is source-based; it does not execute PostgreSQL transactions. Additional regression commands below were justified by the subsequent implementation assignment.

Passed: local arithmetic probe `node /tmp/drm-calculation-probe.cjs`; captured payloads at `/tmp/drm-calculation-probe-results.json`. This used actual code with blocked remote calls and capture-only persistence, so it establishes arithmetic output and strict validator acceptance, **not database acceptance or a real transaction rollback**.

Not run: live SQL queries, SQL integration/rollback/concurrency tests, application typecheck/lint/build, browser, deployments, ingestion, or historical repairs. No application code changed. New overlap/sentinel regressions remain needed before remediation can be accepted. No present evidence attributes the live null staging symptom to either arithmetic defect.

Inspected source SHA-256 receipts:

```text
43545034cff1d37d034255fc166c95c802f0e02da20f67f6a965490e001ff53c  web/pages/api/v1/db/shift-charts.ts
f43f61088ab49327aa85271f0fd2f020db728a420ec9c5ac02edff90efc9e14e  web/lib/projections/gameLength.ts
dffd72bcf8735d9f483b76d5f015129bc3b7588ea656b54daa7036878cf155b5  web/lib/projections/shiftChartRelationshipPayload.ts
4aab79bce790deb1ba3c21b11e9a30f44409d62e864849405f69fcc3940501c4  web/lib/projections/relationshipMaterialization.ts
04806d4ba5c2d2a832081c41ae599bd0e8617cf22167a4719e4be7878267ffe2  supabase/migrations/20260720105524_add_projection_materialization_transactions.sql
```

## Subsequent local route implementation

Owned edits: `web/pages/api/v1/db/shift-charts.ts` and existing `web/__tests__/pages/api/v1/db/shift-charts.audit.test.ts`. The ingestion worker separately owns the shared helper and its strength consumers; Chef separately owns materializer version changes, schedule repair and live evidence.

- Route calls `buildCanonicalShiftIntervals(gameId, pbp, sourceRows)` before grouping. Stored shifts, total game TOI, relationship strength arrays and pair overlaps all consume canonical intervals. Source fingerprints continue to come from the original immutable snapshot.
- Route blocks nonpositive/noninteger totals and total player TOI exceeding PBP-derived game length. It also blocks pair overlap exceeding either participating player's TOI before persistence.
- Four existing-file route regressions cover duplicate intervals, partial overlaps, the zero-end sentinel and a deliberately impossible canonical total. All four failed before the route patch, then passed. These route tests mock the shared helper boundary; the separate integrated probe below exercises the real helper.

Checks actually completed after implementation:

```sh
# Red: 4 failed before patch.
npm test -- --run __tests__/pages/api/v1/db/shift-charts.audit.test.ts -t 'uses canonical intervals'
# Green: 3 files / 21 tests passed, including the new 4 cases.
npm test -- --run __tests__/pages/api/v1/db/shift-charts.audit.test.ts __tests__/pages/api/v1/db/shift-charts.queue.test.ts __tests__/pages/api/v1/db/shift-charts.transactional.test.ts
# Passed, no output.
npx eslint pages/api/v1/db/shift-charts.ts __tests__/pages/api/v1/db/shift-charts.audit.test.ts
# Passed using actual new helper, actual route, strict validator and capture-only persistence.
node /tmp/drm-calculation-probe.cjs
```

The integrated probe's post-fix payloads were: duplicate different-number interval → player/pair/ES `0:30`; partial overlap → player/pair/ES `0:45`; sentinel → player/pair/ES `0:30`, stored end `20:00`. No remote calls or database writes. Global typecheck and actual database transaction tests were not run by this worker. Historical data repair and release remain outside this local implementation.

## Captured live-input offline replay

At Chef's request, `replay-shift-calculations.cjs` replays the five captured games in `live-replay.json` through the actual current route's private upsert function, shared canonical intervals, strength classifier, game length, position resolver, relationship payload builder and source hash builders. All remote-capable dependencies throw if called; the persistence boundary only captures the proposed rows. Roster rows come from each exact captured PBP's `rosterSpots`, bound to its captured `pbp_hash`; empty Yahoo positions deliberately exercise the real NHL roster fallback. This does not emulate a live RPC/CAS transaction or revalidate the original raw-JSON serialization hash.

```sh
node tasks/artifacts/drm-pipeline-triage-2026-11-12/replay-shift-calculations.cjs
```

Result: `LIVE-REPLAY-RESULTS.json`, all checks passed for **190 player rows and 3,420 directed relationship entries**.

| Game | Goalie | Stored TOI | Corrected TOI | PBP game length |
| --- | --- | --- | --- | --- |
| 2026020009 | Joseph Woll | 68:06 | 62:49 | 63:23 |
| 2026020115 | Juuse Saros | 67:48 | 62:48 | 65:00 |
| 2026020159 | Darcy Kuemper | 70:50 | 62:26 | 62:43 |
| 2026020205 | Sebastian Cossa | 66:34 | 63:07 | 63:27 |
| 2026020298 | Yaroslav Askarov | null | 65:00 | 65:00 |
| 2026020298 | Sergei Murashov | null | 65:00 | 65:00 |

Each game produced 38 relationship and 38 strength rows. For every computed player, game TOI was positive, at most game length, and exactly equal to ES + PP + PK. Every pair was at most both players' totals and equal in the reverse direction. Raw payloads and normalized source hashes remained unchanged, and captured route persistence arguments retained the original source hashes. The previously pending PIT/SJS game computed all 38 valid rows offline. These results establish the proposed local calculation against captured live inputs; no live rows were changed.
