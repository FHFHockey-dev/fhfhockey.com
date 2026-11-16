# Shift-chart pipeline triage — 2026-11-12

## Result

The staged-null and interval-overlap causes were established in the initial audit below. **The subsequent PP/PK and ingestion repair is now implemented and mathematically validated locally; see MATH-AUDIT.md for the authoritative final state.** All 190 players match official total/ES/PP/PK clocks when the two identified source-disagreement games use complete official report snapshots. The approved cron schedules are applied live (`CRON-APPLIED.json`). No code deployment, production ingestion or historical rewrite has occurred.

The detailed initial findings below preserve chronology; their earlier versions and remaining-work statements are superseded by the final mathematical report and candidate manifest.

### 1. Input and relationship jobs run in the wrong order

At diagnosis, pg_cron job 16 (`update-shift-charts`) ran at 07:45 UTC, while job 363 (`ingest-projection-inputs`) ran at 09:45 UTC. The approved order is now 09:45 inputs → 09:55 relationships → 10:05 derived. On November 12 the first job completed seven November 10 games; the later input job ingested six November 11 games, leaving their relationships pending. All 229 player rows in games 2026020293–2026020298 have null `game_toi` and `game_length`.

This is expected staging made persistent by the schedule inversion. The installed input transaction writes strength totals and deliberately invalidates relationship-owned fields when inputs change. The separate relationship builder supplies game TOI, game length, shift arrays and pair relationships. DRM previously attempted to parse the staging nulls as complete relationship data and failed the entire selection.

Evidence: `EVIDENCE.json` (scope, sample, pending, jobs, runs); installed definitions in `LIVE-RPCS.sql`. Active Supabase project: `fyhftlxokyjtpndbkfse`. This evidence establishes real missing values; the original exception alone did not establish excessive TOI.

### 2. Overlapping physical intervals were counted more than once

The projection snapshot deduplicates source rows using metadata including shift number; distinct source rows can still describe the same occupied interval. Strength totals summed each interval independently. The relationship route also summed each duration and every pairwise intersection. Duplicate overtime shifts and nested same-player shifts therefore inflated both player TOI and pair totals.

Bounded live scan: October 1–November 11, 2026, 283 games / 10,784 player rows:

| Observation | Result |
| --- | --- |
| Relationship-complete games / rows | 277 / 10,555 |
| Pending games / rows | 6 / 229, all missing both relationship clocks |
| Complete games with missing or malformed clocks | 0 |
| Completed games with overlapping stored intervals | 86 |
| Affected player-games / overlapping intervals | 244 / 365 |
| Duplicated seconds across those player-games | 17,932 |
| Players whose TOI exceeds game length | 4 goalies |
| Directed pair observations checked | 190,572 |
| Pair observations exceeding either player's TOI | 126 across 16 games |
| Unknown pair partners / malformed pair clocks | 0 / 0 |

The 86-game affected set includes errors that remain below maximum-duration checks. Repairing only the four overlong goalies or the 16 impossible-pair games would leave incorrect totals behind.

### 3. Supported zero-end sentinels lost pair overlap

A valid `19:30–00:00`, duration `00:30` source shift was accepted by strength validation but intersected using raw end zero in the relationship route. A local regression demonstrates the missing 30-second overlap. No positive-duration zero-end sentinel was found in the audited live window. The shared normalization fixes this adjacent calculation defect without inventing missing clocks.

## Lineage and changes

1. NHL capture and `nhl_api_game_payloads_raw`: immutable source payloads and hashes preserved. Raw normalization v2 transaction writes roster/PBP/shift tables; it does not directly populate relationship clocks.
2. `web/lib/projections/ingest/shifts.ts`: new `buildCanonicalShiftIntervals` validates every original interval and final-PBP period bounds, resolves supported zero-end sentinels, and unions overlapping/touching intervals per player/team/period. It clones output, preserves gaps and original raw inputs, and rejects malformed or contradictory input before merging. Both strength totals and relationship strength segments use this union.
3. `web/pages/api/v1/db/shift-charts.ts`: the same intervals now drive game TOI, stored calculation shifts and pair intersections. Player/game and pair/player bounds are checked before persistence. Source fingerprints still describe the original source rows.
4. Input materializer is `projection-input-materializer-v2-interval-union`; relationship algorithm is `shift_relationship_materializer_v4_interval_union`. Default relationship queue selects current input materializations. Persistence rejects older input versions, preventing newly corrected relationships over inflated old strength totals. Existing RPC locking and input fingerprint/version comparisons guard concurrent changes.
5. Relationship upsert remains transactional and checks exact scope/counts, source binding and positional completeness. New calculations use its existing API; no schema migration was needed or applied.
6. DRM excludes all players/pairs/cards from an affected game and reports partial coverage. It retains strict identity and selected-scope validation. It never replaces missing TOI with zero.
7. Derived player/team strength reads `shift_charts` strength totals and must be rebuilt after affected input/relationship generations. The team-unit writer independently reads normalized raw shifts, so its schedule is outside this correction; the existing inventory's relationship timing note is not a runtime dependency.

## Replay and independent comparison

Captured five live, manifest-bound PBP/shift payload pairs and replayed the actual local route/calculation/position/payload code offline with capture-only persistence. All 190 player rows and 3,420 directed pairs pass: positive bounded game TOI, TOI = ES + PP + PK, pair TOI bounded by both players, mirrored equality, immutable raw inputs/source hashes. Pending PIT/SJS produces 38 valid calculated rows offline.

| Game / goalie | Stored TOI | Corrected shift TOI | Captured NHL boxscore TOI |
| --- | --- | --- | --- |
| 2026020009 / Joseph Woll | 68:06 | 62:49 | 62:49 |
| 2026020115 / Juuse Saros | 67:48 | 62:48 | 62:48 |
| 2026020159 / Darcy Kuemper | 70:50 | 62:26 | 62:26 |
| 2026020205 / Sebastian Cossa | 66:34 | 63:07 | 63:07 |

The separate `goaliesGameStats` table holds 63:06 for Cossa while its captured NHL boxscore holds 63:07. The corrected shift calculation agrees with that boxscore; this audit did not modify the separate boxscore-stat writer or conceal the one-second cross-table discrepancy.

Replay command: `node tasks/artifacts/drm-pipeline-triage-2026-11-12/replay-shift-calculations.cjs` from repository root. See `LIVE-REPLAY-RESULTS.json` and `live-replay.json`. This harness blocks remote calls and does not certify a live write or CAS execution. Current local branch code is used; unrelated pre-existing local calculation changes are not attributed to this patch.

## Acceptance and checks

| Requirement | Evidence | Status |
| --- | --- | --- |
| Explain real null TOI | Live staging rows, manifests, cron schedules and actual run receipts | Verified |
| Explain real excessive TOI | Captured overlapping goalie shifts, matching source boxscore totals after union | Verified |
| Prevent duplicate/overlap counting | Regression-first tests, shared interval union, offline live replay | Locally verified |
| Preserve source evidence and reject malformed intervals | Raw immutability/hash checks and existing invalid-input tests | Locally verified |
| Keep strength and relationship versions consistent | Version guard regression, queue checks, existing RPC CAS inspection | Locally verified; new live write untested |
| Keep valid DRM games usable | 54 aggregation tests and 37 hook/view/page tests from initial containment fix | Locally verified |
| Verify raw capture / upsert contract | Ingestion audit, focused mocked tests, installed RPC inspection | Static/mock verified; no capture executed |
| Restore live freshness and historical totals | Exact 92-game scope and proposed schedule correction prepared | Awaiting approved release/repair |

Checks actually run (overlapping test files are not summed into a misleading unique total):

- Ingestion audit: 19 focused tests passed, 58 intentionally filtered out.
- Canonical intervals / stored snapshot / input persistence: 47 tests passed.
- Relationship route audit/transaction/queue: 21 tests passed.
- Version guard / input persistence / queue integration: 27 tests passed.
- Input-ingestion route and update-PbP delegation: 45 tests passed.
- Derived queue/persistence: 11 tests passed; derived route: 10 passed after updating its current-version fixture. Initial fixture failure correctly reflected the algorithm-version change.
- Whole-web TypeScript: `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit --incremental --tsBuildInfoFile /tmp/fhfh-drm-triage.tsbuildinfo` passed.
- Targeted ESLint and whitespace diff checks passed. Independent fresh-context review found no actionable defect in the assigned changes (`REVIEW.md`).

During the initial audit, no full production build, external NHL request, production application request, production write, migration, cron edit, push or deployment was performed. The later mathematical follow-up applied the two approved cron changes and read public NHL game summaries; see MATH-AUDIT.md for that separate accounting. Database reads were bounded to the source lineage, current-season October/November evidence, schedules/run records, installed RPC definitions and boxscore cross-checks. Supabase health advisor returned no notices. Earlier seasons, every historical boxscore, and every downstream forecasting consumer were not comprehensively requalified.

## Remaining execution

See `REPAIR-PLAN.md`, exact game list in `REPAIR-SCOPE.json`, proposed two-job transaction in `PROPOSED-SCHEDULE.sql`, and local-file pinning in `CANDIDATE.json`. Do not present this uncommitted candidate or a mocked/offline replay as production acceptance.
