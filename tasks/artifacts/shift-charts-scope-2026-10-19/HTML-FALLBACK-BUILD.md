# HTML shift-report fallback: build

Date: 2026-10-19. TJ approved this build in this session: "Yes, I approve: continue building the HTML shift fallback here, including registering the migration in migration-authority.json and updating the counts."

It also follows TJ's acceptance points, relayed by Chef: "I would like to integrate the HTML fallback now, the migration should not break the current PbP/ShiftChart ingestion, instead it should accommodate the HTML results in addition and when needed."

Everything is uncommitted. No hosted database, API, cron or NHL call was made, and the migration is **not applied** anywhere.

## Acceptance points

1. **The migration is additive and backward compatible.**
   - `capture_projection_raw_source_snapshots_v1` keeps its name, its 9-argument signature (no new parameter), its return table, `SECURITY INVOKER`, its `search_path` and timeouts, and its grants. `create or replace` preserves the ACL, and the file has no grant statements.
   - The only SQL change is the envelope source test. It was `source is distinct from 'json-api'`; it is now `source is null or source not in ('json-api','htmlreports')`.
   - The JSON row-identity checks are byte-for-byte unchanged. The HTML envelope passes through the **same** checks: `gameId` must equal the game, `playerId`, `teamId`, `shiftNumber`, `period`, `startTime` and `endTime` must be present, and `typeCode` must be non-null. That works because the shared HTML rows now carry `gameId` and `typeCode: 517`. These are the HTML path's equivalent checks, enforced by the same statement.
   - The harness proves JSON captures are unchanged; see below.
2. **Deploy order: migration first, then code.** The new code also works against the old RPC:
   - **JSON games:** the projection JSON envelope is the same object, `{ total, data, source: "json-api" }`, in the same key order. Its hash and the RPC call are identical, and the existing JSON tests pass unchanged.
   - **HTML games before the migration:** the ingest capture is rejected with `INVALID_PROJECTION_RAW_SHIFT_PAYLOAD`. Nothing is written, so that game fails exactly as it does today, when an empty feed already fails the ingest.
   - **`update-shift-charts`:** it never captures. For such a game it finds that the fingerprint doesn't match the stored inputs and records `projection_inputs_stale`, so nothing is written.
   - **Gamecenter writer:** it inserts raw rows directly (`insertPayloadSnapshot`), not through this RPC, so the migration doesn't affect it.
3. **HTML only when the JSON is empty and the game is final, with provenance.**
   - `fetchAllNhleShiftChartsSnapshotForGame` falls back only when the JSON `total` is 0 and `isCompleteFinalPbpPayload(pbp)` holds.
   - Provenance is the envelope's `source: "htmlreports"`. It is the single value both writers store; I did not add an `"html-report"` alias, because the payloads must stay byte-identical.
   - The value surfaces as `snapshot.source` and as `shiftSource` in the `update-shift-charts` receipt (`processedGames[]`) and its audit `details.context`.
   - Existing JSON-path test expectations are unchanged, with three notes:
     - The Gamecenter HTML test's expectations gained `gameId`, `typeCode: 517` and padded clocks, because the shared HTML shape changed by design.
     - Two of this session's unreleased skip-isolation tests now expect PBP to be read first.
     - The queue test is restored to its original "PBP not final" expectation.
4. **Migration order:** authority order **86**, `pending`.
   - **IFTTT owner:** your planned SQL6–8 take authority orders 87–89 when they are added (orders must stay contiguous; `supportedBaselineMigration` checks `order = index + 1`).

## What changed

| File | Change |
|---|---|
| `supabase/migrations/20261019172842_accept_html_report_projection_shift_snapshots.sql` (new) | `create or replace` of the capture RPC with the widened source set. The rest of the body equals `20261011115124`. |
| `tasks/TASKS/repository-audit-remediation/migration-authority.json` | Order 86 entry: `pending`, sha256 `60039c29…8ccbb`. |
| `web/lib/supabase/supportedBaselineMigration.test.ts` | Counts: 86 rows and 86 files, 3 pending. |
| `tasks/TASKS/super-goal/super-goal-final-summary.md` | Migration-authority count line updated to 86 and 3 pending. |
| `web/lib/supabase/Upserts/nhlRawGamecenter.mjs` | See below. |
| `web/types/nhlRawGamecenter.d.ts` | Declarations for the two new exports, `HtmlShiftReportPayload`, and `gameId` on `ShiftChartRow`. |
| `web/lib/projections/ingest/rawSnapshotPersistence.ts` | The TypeScript guard accepts `htmlreports` as well as `json-api`. |
| `web/lib/projections/ingest/shifts.ts` | See below. |
| `web/pages/api/v1/db/shift-charts.ts` | See below. Also carries the earlier, still-unreleased skip isolation. |

**`nhlRawGamecenter.mjs`:**
- New exports: `buildHtmlShiftReportPayload` (pure) and `fetchHtmlShiftReportPayload`.
- HTML rows now carry `gameId` and `typeCode: 517`, with clocks padded to `MM:SS`.
- Strict mode refuses to guess. It throws on a missing team report, a team with no shifts, an unparseable heading, a heading matching several players, or a heading matching none.
- The lenient Gamecenter path uses the same builder and the same resolution order, so wherever strict mode succeeds, its payload equals the lenient one.

**`shifts.ts`:**
- `fetchAllNhleShiftChartsSnapshotForGame(gameId, { pbp? })` falls back for an empty final JSON feed through the strict shared builder.
- It returns `source` and `htmlFallbackError`.
- Without `pbp` it fetches the PBP once, and only on an empty JSON feed. The ingest therefore needs no edit, at the cost of one extra PBP request per HTML game.

**`shift-charts.ts`:**
- Reads the PBP first, then the snapshot with that PBP.
- Receipt adds `processedGames[{ gameId, shiftSource }]`.
- An empty JSON+HTML feed adds `detail` to the `shift_feed_unavailable` skip.

**`ingest-projection-inputs.ts`:** not edited. It picks up the fallback through `fetchAllNhleShiftChartsSnapshotForGame(gameId)`. Its receipt does not show `shiftSource`; that would need an edit there. Provenance stays in the raw snapshot's `source`, which the status's `shift_raw_payload_id` points to.

## Tests (in `web/`)

| Command | Result |
|---|---|
| `npm test -- lib/projections/ingest/shifts.htmlFallback.test.ts` (new, offline fixture TV/TH HTML) | **passed**: 10 tests |
| `npm test -- __tests__/pages/api/v1/db/shift-charts.audit.test.ts __tests__/pages/api/v1/db/shift-charts.queue.test.ts __tests__/pages/api/v1/db/shift-charts.transactional.test.ts lib/projections/ingest lib/supabase/Upserts/nhlRawGamecenter.test.ts lib/supabase/Upserts/nhlNormalizedLayer.test.ts lib/supabase/supportedBaselineMigration.test.ts lib/projections/relationshipMaterialization.test.ts lib/projections/relationshipPlayerPosition.test.ts lib/projections/shiftChartCompletenessServer.test.ts lib/projections/shiftChartCompleteness.test.ts __tests__/pages/api/v1/db/ingest-projection-inputs.test.ts __tests__/pages/api/v1/db/sweep-gamecenter-normalization.test.ts` | **passed**: 17 files, 253 tests. This includes the new file, the Gamecenter normaliser, the preflight completeness tests, the ingest route and the sweep. |
| `npx eslint` on the 10 changed code and test files | passed |
| `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit` under `/private/tmp/fhfh-heavy.lock` | **passed**: exit 0 |
| `python3 -I tasks/artifacts/shift-charts-scope-2026-10-19/html-fallback-migration-pg-verify.py v1` (disposable PostgreSQL 17.11 cluster, Unix socket only) | **passed**: 31 of 31 cases. Receipt: `html-fallback-migration-pg-result-v1.json` |

The new fixture tests cover:
- **Row mapping:** `gameId`, `typeCode: 517` and padded clocks, plus the envelope shape.
- **Only when needed:** no HTML request while the JSON has rows, and no fallback before the game is final.
- **Hash stability:** both the source hash and the raw hash.
- **Byte equality:** `JSON.stringify(projection envelope) === JSON.stringify(Gamecenter payload)`, with equal sha256.
- **Strict refusal:** an ambiguous name and an unmatched heading, while the lenient writer still produces a payload. Also a refusal when a team report is missing.
- **Same hash in both routes:** the ingest RPC payload's `shiftSourceHash` equals the `shift-charts` hash.
- **Capture guard:** an HTML envelope reaches the RPC, and other sources are refused.

New route tests check `processedGames[].shiftSource = "htmlreports"`, and the skip `detail` when both feeds are empty.

**Harness design:**
- Two databases. Each has the raw table, the snapshot-head triggers from `20260720105524`, the current capture body from `20261011115124`, and the `20260720` grants. Only `new_rpc` applies `20261019180000`.
- The same nine-case JSON sequence produces identical receipts, errors and final table and head state in both. The sequence is: capture, exact replay, changed payload, null `typeCode`, wrong game, total mismatch, empty, `json-api-empty` and a missing source.
- The RPC name, identity arguments, result, security, config and ACL are identical before and after.
- `htmlreports`: the old RPC rejects it; the new RPC accepts it, makes it the current head, and treats an exact replay as idempotent.
- HTML rows with a null `typeCode`, a missing or wrong `gameId`, or a null start are rejected with the same `INVALID_PROJECTION_RAW_SHIFT_ROWS`. An HTML total mismatch, an empty envelope and an unknown source (`html-report`) are rejected.

## Expected one-time effects after release

1. **Gamecenter HTML games re-normalise once.** The Gamecenter writer's HTML envelope changes (row `gameId`, `typeCode: 517`, `MM:SS` clocks), so its sha256 changes. The next Gamecenter capture of such a game inserts a new raw row and advances the `shiftcharts` head. The trigger marks the normalisation `stale`, and the normaliser rewrites `nhl_api_shift_rows`:
   - `type_code` changes from null to 517;
   - the `start_time`, `end_time` and `duration` text become padded;
   - the parsed seconds are unchanged.

   The R4 sweep or the next ingest completes any stale normalisation. No shift reader filters on `type_code`; the remaining `type_code` readers are PBP events.
2. **Games already ingested from JSON whose feed is now empty (0006–0053).**
   - When a Gamecenter writer next captures one of them, it stores the HTML envelope and moves the head ahead of the projection status. Relationships for that game then refuse `SHIFT_RELATIONSHIP_RAW_SNAPSHOT_STALE` until it is re-ingested.
   - In `update-shift-charts` they show as `projection_inputs_stale` until then.
   - A bounded `ingest-projection-inputs` re-run over their dates captures the identical HTML envelope and refreshes the inputs. `update-shift-charts` then matches and materialises them.
   - Cost: about 48 games × (1 JSON + 1 PBP + 2 HTML) requests for the ingest, and about 48 × (1 PBP + 1 JSON + 2 HTML) for shift-charts. That needs TJ's approval when planned.
3. **New games whose JSON is empty at ingest time** are ingested from HTML from the start.

## Option A (stored-snapshot relationships)

**No longer required for the backlog.** With the fallback, the backlog clears through the re-ingest in effect 2. Option A would still remove the NHL requests and the upstream-drift class from `update-shift-charts`, so it remains a worthwhile later improvement, not a blocker.

## Release list

Deploy in this order:

1. **Migration (applied to hosted 2026-10-19 by Chef at TJ's request, ledger `20261019172842`; the file was renamed from `20261019180000_…`, and the v1 harness receipt names the old path):** `supabase/migrations/20261019172842_accept_html_report_projection_shift_snapshots.sql`. Apply it alone. Then do a read-only check that the RPC's arguments and ACL are unchanged.
2. **Code** (safe on either RPC for JSON games):
   - `web/lib/supabase/Upserts/nhlRawGamecenter.mjs`
   - `web/types/nhlRawGamecenter.d.ts`
   - `web/lib/projections/ingest/rawSnapshotPersistence.ts`
   - `web/lib/projections/ingest/shifts.ts`
   - `web/pages/api/v1/db/shift-charts.ts` (it includes the skip isolation from `SKIP-ISOLATION.md`)
3. **Tests and records:**
   - `web/lib/projections/ingest/shifts.htmlFallback.test.ts`
   - `web/lib/supabase/Upserts/nhlRawGamecenter.test.ts`
   - `web/__tests__/pages/api/v1/db/shift-charts.audit.test.ts`
   - `web/__tests__/pages/api/v1/db/shift-charts.queue.test.ts`
   - `web/lib/supabase/supportedBaselineMigration.test.ts`
   - `tasks/TASKS/repository-audit-remediation/migration-authority.json`
   - `tasks/TASKS/super-goal/super-goal-final-summary.md`
   - this note, `html-fallback-migration-pg-verify.py`, `html-fallback-migration-pg-result-v1.json`

**Pre-release check:** the authority `sha256` matches the migration file today, and the migration-authority test checks it. If the migration file changes, the hash and the harness receipt must be redone.
