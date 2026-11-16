# Membership evidence inventory and exact handoff

Prepared locally on `octoberBranch`, HEAD `24b1cb4d3048a3dba8234cf92c62e8f2b72f877f`. **No SQL below has been executed. The three-query draft failed the subsequent execution-safety review and must not be run as written.** It remains below for review traceability, not authorization to read production, backfill, migrate, capture providers, or run forecasts.

The later Phase E continuation adds [BOUNDED-INVENTORY.md](BOUNDED-INVENTORY.md): a locally reviewed alternative using one already owner-pinned observation UUID, with direct primary-key/unique-identity lookups. It cannot discover unknown UUIDs, and remains gated on the missing source receipt, deployed access-plan evidence, tested transport and production authorization. The new pure `membershipInventory.ts` admits an already retained exact export without database/provider access. The old discovery SQL below remains held.

## Conditional inventory safety review, 2026-11-12

Execution stopped before query 1. The retained `$TMPDIR/strength-v2-slow/log.jsonl` records a successful production normalization of game `2026020269` at `18:19:31Z`, followed by a `preflight_wait` with `io_lock_waits: 1` at `18:20:31Z`. These are the production owner's existing observations, read from a local log; this lane did not inspect current database activity. They establish recent normalization activity and a pressure signal, sufficient to trigger the parent's stop condition. They do not establish the database's later state. The `15:51Z` mailbox entry saying the run was stopped is superseded by Chef's diary and these later runner records. No quiet-window clearance has been received.

The draft is response-bounded, **not independently proven safe for execution**:

- Local baseline schema has a unique partial NHL identity index (`20260716112908_production_schema_baseline.sql:34263`). The observations migration has `(season_id, fhfh_player_id, available_at DESC)` and `(season_id, nhl_player_id, available_at DESC)` indexes. This supports a potential cheap path; it does not verify deployed indexes or the planner's choice.
- Query 3's `OR`, second sort key and `created_at` filter can require visiting/sorting more records than its `LIMIT 33`. That limit bounds returned rows, not rows scanned, buffers read or I/O. No production plan or cardinality was inspected. Do not call this an indexed bounded read solely because indexes exist in local SQL.
- Query 1 counts only active sessions. It misses idle transactions holding locks, visibility restrictions, background I/O/checkpoints and pressure between probes. Chef's incident write-up explicitly says active-query counts missed I/O pressure. A zero result would not be permission or a sufficient safety check.
- Three 5-second `statement_timeout` values are nominal per-statement limits, not a hard 15-second end-to-end deadline or CPU/I/O cap. Connection setup, cancellation and rollback need their own bounded handling. The proposed transport has not been shown to guarantee cleanup after an error; no transaction was opened.
- The retained NHL/FHFH identity mapping still needs source-owner confirmation. An availability sample cannot establish full tenure, original source authenticity or a trade boundary.

The inspected user history authorizes Scout to coordinate the five lanes; no additional explicit approval for this production inventory was found there. Regardless of that permission question, the observed activity/pressure already blocks this attempt. Do not poll or retry. The smallest next step is the offline export below. If none exists, Chef must first clear a quiet production window, then the query owner must revise/review the exact access plan and transport limits before the user approves that concrete read. Any additional `EXPLAIN`/catalog query changes the three-query budget and requires an updated plan; no hidden preliminary query is included.

## Retained evidence checked

- `/private/tmp/fhfh-goalie-bos-workload-20261112.json`: retained approved read capture, project `fyhftlxokyjtpndbkfse`, season `20262027`, captured `2026-11-12T12:56:13.639Z`. Contains 18 schedule rows, 17 finality events, 18 team rows and 18 goalie appearance rows. It contains no membership events, effective trade boundaries, original transaction captures or membership-coverage receipt. Its goalie ids are Jeremy Swayman `8480280` and Michael DiPietro `8480022`.
- `/private/tmp/fhfh-goalie-identity-diagnostic-20261112.json`: one game, one run and two selected goalie rows, no proof snapshots. Forecast selection is not tenure evidence.
- The documented `/private/tmp/fhfh-2026-27-official-transactions.json` is absent. A bounded filename search of retained `fhfh*transaction*`, `fhfh*roster*` and `fhfh*membership*` files found no source export. Membership matches were this lane's test/typecheck logs.
- `tasks/artifacts/goalie-workload-forge-2026-10-25/REPORT.md` and `tasks/artifacts/claude-lanes-2026-10-25/GS/RECEIPT.md` explicitly leave dated club/trade membership as a source gap. The retained workload tree consists of code patches and local test/review receipts, not authoritative membership captures.
- `tasks/artifacts/luna-reference-package-2026-10-31/omission-diagnosis/HANDOFF.md` describes a synthetic goalie case with membership absent. `tasks/artifacts/luna-hosted-adapter-2026-11-04/PROSPECTIVE-PLAN.md` requires future independently evidenced dated membership; it is not that evidence.

These findings apply to the inspected retained material, not every possible archive or production table. No original remote source was fetched. Public hockey records were inspected locally; no private league/account data was copied into this artifact.

## Original three-query draft — held, not executable

Prefer an owner-supplied retained export with the same scope. If unavailable, obtain separate current-task approval for **three sequential read-only SELECTs maximum**, concurrency one, project `fyhftlxokyjtpndbkfse`, one goalie and season, fixed historical cutoff. This checks whether useful stored evidence exists; it cannot prove complete tenure by itself.

Proposed sample: Swayman, retained source goalie id `8480280`, season `20262027`, cutoff `2026-11-12T12:56:13.639Z`. This is a source-availability sample, not a trade acceptance test. Query 2 resolves the FHFH/NHL identity bridge; do not substitute either identifier for a different namespace or use a name match. The source owner must confirm that the retained goalie id is in the NHL namespace before this plan is approved. If that mapping cannot be confirmed locally, choose an owner-pinned identity instead of guessing.

Each SELECT must run inside `BEGIN READ ONLY`, with `SET LOCAL statement_timeout = '5s'` and `SET LOCAL lock_timeout = '500ms'`, and end with `ROLLBACK`. Never leave the transaction open while awaiting approval. Run only after the production owner confirms the incident/re-normalization hold permits this bounded read. Do not execute through an application endpoint or invoke the roster-reconciliation/import scripts.

1. **Activity guard:** one aggregate row; stop if any other query is active or a long-running query is reported. No polling/retry.

```sql
SELECT count(*) AS active_queries,
       coalesce(bool_or(clock_timestamp() - query_start > interval '5 seconds'), false) AS long_running
FROM pg_stat_activity
WHERE state = 'active' AND pid <> pg_backend_pid();
```

2. **Identity bridge:** at most two rows, where the second is a conflict sentinel. Continue only with exactly one row, matching the owner-pinned NHL id, no oversize marker, and a positive FHFH id. No fuzzy matching.

```sql
SELECT id AS fhfh_player_id, nhl_player_id,
       CASE WHEN octet_length(canonical_name) <= 512 THEN canonical_name END AS canonical_name,
       octet_length(canonical_name) > 512 AS oversized
FROM public.fhfh_player_identities
WHERE nhl_player_id = 8480280
ORDER BY id
LIMIT 2;
```

3. **Raw historical observations:** use only the returned `:fhfh_player_id`. Read the table, not `latest_player_forecast_season_roster_observations`; retain predecessor observations. At most 32 usable rows plus one cap sentinel. No evidence JSON, article text, raw snapshots, names, joins to forecasts, or provider fetches.

```sql
SELECT id, season_id, fhfh_player_id, nhl_player_id,
       observation_kind, event_type, organization_team_id, roster_status,
       CASE WHEN octet_length(source_key) <= 512 THEN source_key END AS source_key,
       CASE WHEN octet_length(source_url) <= 512 THEN source_url END AS source_url,
       source_hash, observed_at, available_at, effective_at, created_at, supersedes_id,
       (octet_length(source_key) > 512 OR coalesce(octet_length(source_url) > 512, false)) AS oversized
FROM public.player_forecast_season_roster_observations
WHERE season_id = 20262027
  AND (fhfh_player_id = :fhfh_player_id OR nhl_player_id = 8480280)
  AND available_at <= '2026-11-12T12:56:13.639Z'::timestamptz
  AND created_at <= '2026-11-12T12:56:13.639Z'::timestamptz
ORDER BY available_at, id
LIMIT 33;
```

Stop on timeout, database error, busy guard, missing/ambiguous identity, empty observations, any oversize marker, row cap (33), or aggregate response above 128 KiB. The proposed response cap is 36 returned rows including guard/conflict/cap sentinels. The three nominal 5-second statement limits do not establish a hard aggregate execution/resource bound (see review above). Do not page, retry, broaden the date/player scope, or repair data. No source-effectiveness date filter is used: null/ambiguous dates must remain visible. Zero observations means no stored evidence in this sample, not zero membership.

If rows exist, retain the exact export outside the checkout and inspect it offline through the adapter. The next gate is still authentic old/new club interpretation, effective time and independently reconciled coverage. A source URL/hash is a reference, not original-byte verification. Do not promote `transactionCoverage.complete`, article date, `rosters.ended_at`, current roster, or an appearance into membership proof. No further live query is included in this budget.

## Offline alternative — exact source-owner handoff

Supply an **already retained** export; this request does not authorize creating one through a provider or database call. Pin project/source, export capture time, season, historical cutoff and SHA-256 of the exact retained bytes. For the proposed sample use season `20262027`, cutoff `2026-11-12T12:56:13.639Z`, and Swayman's owner-verified identity bridge; otherwise select a separately owner-pinned sample. Do not manufacture a missing FHFH id or copy the NHL id into it.

1. One explicit bridge `{goalieId, fhfhPlayerId, nhlPlayerId}` plus its existing provenance, and the canonical `{teamId, abbreviation}` mappings referenced by the rows. All numeric ids must be positive safe integers.
2. At most 32 complete raw observation projections, total retained export at most 128 KiB. Fields are exactly those selected by draft query 3, **without** the transport-only `oversized` marker. Preserve full source strings, source hashes, all four source clocks, null `effective_at`, identity columns and `supersedes_id`; do not truncate, choose only the latest record, page or silently discard predecessors. If the supplied scope is capped, incomplete or exceeds these limits, stop and retain that fact. A synthetic fixture is not an export.
3. Supply existing separate interpretation receipts only if available: `{resolutionId, revision, observationId, sourceHash, basis, fromTeamId, toTeamId, recordedAt}` with `basis: official_nhl_membership_boundary`. No inferred article-midnight boundary, inferred old club, or fabricated receipt. Missing receipts remain an empty `resolutions` array. Preserve source bytes/provenance separately from interpretation.
4. Offline transport admission now uses `readMembershipInventory(body, expected, resolutions)` from `membershipInventory.ts`, with the exact envelope and separately trusted selection pin described in BOUNDED-INVENTORY.md. It enforces bytes, exact row-set/hash/project/identity agreement and delegates semantics to `membershipEventsFromStoredObservations`. For the stated historical sample, the semantic `observedAt` is the pinned source cutoff, so later sources/resolutions remain inadmissible. A different read clock is an explicit different evaluation. The underlying parser reports unresolved/context-only records and always returns `coverage: null`, `membershipComplete: false`; do not interpret successful parsing as tenure completeness.

The current retained Boston appearance export cannot satisfy items 1–3. No authoritative membership rows were available to admit during this continuation, so no synthetic data was relabeled and no runtime contract changed. The existing fixture suite already covers the null-effective/unresolved producer, identity conflicts, predecessors, injury/affiliate uncertainty, precise clocks and the trade denominator. Physical persistence still needs a genuine separately scoped coverage receipt and an independently trusted snapshot-selection pin before `readMembershipSnapshot` can serve player-tenure history. Grid's team-window history remains a different denominator.

## Exact ownership and deliverables

| Owner | Files/resources | Handoff condition / next deliverable |
| --- | --- | --- |
| Goalie consolidation lane | `web/lib/projections/goalie/{membershipLineage,workloadContract,storedMembershipEvidence,membershipSnapshot,membershipInventory}.ts` and corresponding `.test.ts`; this artifact tree and its diary | Owns current pure contracts and fixes. Parent can review the local slice. Grid confirmed the new inventory paths are outside its edit scope. No DB/client/provider wiring is included. |
| Goalie consolidation lane, proposed next adapter | New `web/lib/projections/goalie/membershipHistoryReader.ts` and `.test.ts` (not created) | Requires the persistence owner's exact selected-snapshot query/receipt contract. At most one selected immutable body and a separately trusted selection pin; pass to `readMembershipSnapshot`, preserve unavailable results, never refresh on read. |
| Existing Goalie Grid thread `01a1cd01-1c99-70a1-b4e1-f1ed610da736` | `web/pages/api/v1/forge/goalies.ts`; `web/__tests__/pages/api/v1/forge/goalies.test.ts`; `web/lib/socialShare/modules/creaseShift.sources.ts` (`loadGoalieGridHistory`); `web/components/GameGrid/utils/{readGoalieSources,goalieWorkloadView}.ts` and existing tests | Exact seam confirmation requested in this review. No file handoff is inferred. Keep its team-window crease history unchanged; a separately scoped player-tenure payload cannot replace that denominator. Owner decides any endpoint/UI integration after evidence and persistence gates. |
| Migration/persistence owner (Claude Chef custody retained) | Future physical schema/migration under `supabase/migrations/`; `tasks/TASKS/repository-audit-remediation/migration-authority.json`; `web/lib/supabase/supportedBaselineMigration.test.ts`; `tasks/TASKS/super-goal/super-goal-final-summary.md` | Choose physical storage, immutable source/resolution/coverage revisions, atomic selection pin, permissions and rollback. Generate the migration using the established authority workflow. A schema/backfill application requires separate explicit scope/approval. None of these files changed here. |
| Source/identity owner assigned by parent | Existing raw observations and original official transaction/eligibility evidence; canonical identity/team bridge | Supply the pinned export and provenance, resolve NHL membership versus organization/affiliate semantics, and attest interval completeness. No source-authority claim can be delegated to the arithmetic. |

The future persistence interface must retain original observation coordinates, separate immutable interpretation receipts, a genuine coverage receipt, and the validated snapshot input plus canonical hash. Corrections select new revisions without deleting earlier events. The reader must not accept a self-supplied checksum as its own trust anchor or recompute a competing SQL share formula.

## Review findings and limits

The fresh adversarial review reproduced seven failing cases before correction: sub-millisecond effective-boundary rounding; future snapshot/read-clock rounding; future resolution-clock rounding; unsafe numeric ids in both source and snapshot admission; duplicate immutable source aliases; and orphan appearance rows. Corrections stay in the six owned admission/snapshot implementation/test files. Existing workload arithmetic and Grid-owned code were not changed.

Source/provenance/read clocks now retain PostgreSQL microsecond ordering using the existing `evidenceTime` helper. The existing workload arithmetic remains millisecond-based: an effective membership boundary with a nonzero sub-millisecond part is explicitly unknown, while scope/game boundaries with that precision are rejected. Trailing zero microseconds remain lossless and valid. This is an explicit precision limitation, not a rounded effective-time claim.

All historical denominators, uncertainty reasons, starts/appearances/relief and unavailable future probabilities remain separate. No retained sample proves a trade, complete membership source, served reader, live acceptance or forecast qualification. Final local test results are recorded in the companion handoff/diary.
