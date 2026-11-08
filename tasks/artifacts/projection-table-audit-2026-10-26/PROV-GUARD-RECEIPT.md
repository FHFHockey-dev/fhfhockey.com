# PROV-GUARD receipt: FORGE consumers refuse unproven external-input exclusion

**Lane** PROV-GUARD · **Checkout** `/Users/tim/Code/fhfhockey.com` on `octoberBranch`, base HEAD `5356dc6161d9a7ea68d6834e687f5423c8498b51` · **Not committed** (the orchestrator commits) · **No production, DB or network calls**: tests mock every client, and the checks ran with a socket/fetch blocker (`offline.cjs`).

## What "proven" means (shared helper)

New file `web/lib/projections/externalInputProof.ts`. A run counts as proven only when it has at least one FORGE run input snapshot and **every** snapshot for it is valid. A snapshot here is a `player_forecast_source_observations` row with `provider='forge'`, `dataset_key='forge-run-inputs-v1'` and `entity_key = run_id`. To be valid it must:

- carry `payload.version = forge-inputs-v1`;
- have `payload.runId = entity_key`;
- carry `payload.inputProvenance.external_fantasy_input_contract = excluded_from_native_inputs_v1`;
- have a valid `capturedReads` receipt (`forge-captured-reads-v1`, a 64-hex hash, `readCount >= 1`, `first <= last <= available_at`).

These are the same claim and receipt checks `consumerRevisionAdmission.ts:56/88` applies to revisions, which copy this inputProvenance verbatim (`publish_forge_game_revisions`).

- Absent, malformed or contradictory proof means not proven. A failed proof read throws, and every caller fails closed.
- `forge_runs.metrics.input_provenance` is **not** consulted, so clean runs aren't rejected.
- History check: before `7007a0527` the writer never set the claim (`git show` of every earlier writer revision), so legacy, possibly blended runs are unproven by construction.
- It reads only small JSON paths, never `payload` or its `reads`, in chunks of 100 ids. The `(provider, dataset_key, entity_key, available_at)` index covers the read.
- Historical rows are untouched. Nothing is deleted or rewritten.

## Before/after per consumer

**HEAD** means the new tests run against an unmodified `git archive HEAD web` tree in the scratchpad, with only the new tests, fixtures and helper overlaid. That run had 36 failures and 365 passes (`head-baseline.log`). **After** means the working tree.

| Consumer (audit ref) | Change | Unproven legacy run | Clean run, proof on snapshot only | Mixed window | HEAD → after |
|---|---|---|---|---|---|
| RSO bridge `forgeDailyBridge.ts` (F1 :569/:582, builder :275) | The loader loads proof for the lookback runs and picks, per date, the latest **proven** run. Newer unproven runs are passed on unread, only to be counted. The pure builder drops any run without `external_input_proven: true`. | Never enters the bridge. Its players get no forecast (unavailable, not 0), with a limitation naming how many runs were withheld. All unproven means schedule-only, with the reason given. | Served | Picks only proven runs; no row of an unproven run is read | 5 fail → 70/70 |
| RSO planning `planning.ts` (:195/:218) | No source change. Its only bridge entry is the guarded loader. A new planning test pins the behaviour: an unproven run keeps RSO schedule-only, `serving_disabled` is retained, `bridgeRevisionIds` stays `[]`, and no projection rows are read | Schedule-only, with limitation | Served (existing bridged test, now with proof) | n/a | 1 fail → 115/115 |
| Served-forecast ledger `forge-served-forecast-snapshot.ts` | Uses the guarded bridge, **and** re-checks proof at the durable write boundary. Forecasts from unproven runs are not recorded, and `bridgeLimitations` says how many. A failed proof read stops at stage `forge_bridge_proof` with no write | No bridge or run rows; naive controls only | Recorded | n/a | 2 fail → 10/10 |
| Start Chart legacy `fetchSlate` (F2 :907, :1479–1643) | Candidate run ids → proof → embedded rows of the latest proven run only. Eligibility comes from the snapshot proof, not run metrics. With no proven run: `projection.state = "missing"`, degraded reason `unproven_external_input_provenance`, message *"Unavailable: provenance unproven. …"*, and no skater row scored. A failed proof read gives `state = "error"` | Excluded, not scored | Served as `ready`, no `unverified_projection_provenance` flag. On HEAD this was `partial` because run metrics never carry the claim | Newer unproven runs passed over | 9 fail → 114/114 (+1 skipped as before) |
| `apiHelpers.ts` latest run (:41) | New `requireLatestExternalInputProvenRunId`: the 20 newest released h1 runs of the date, the first proven one wins, otherwise 404 with `details.reason = external_input_provenance_unproven`. `requireLatestSucceededRunId` is **unchanged** (see below) | 404 | Served | Older proven run wins | 4 fail (new API) → 31/31 |
| `/api/v1/forge/players` (:157–205, :251, :285, :310) | The latest run uses the proven lookup. Fallback candidates are filtered by proof before any row read | 404 when no proven run; no rows read | Served | Proven fallback chosen; unproven rows never read | 4 fail → 19/19 |
| `/api/v1/projections/players` (:64–72) | The default path uses the proven lookup. The explicit `runId` check moves from run metrics to snapshot proof (422 when unproven) | 404 | Served (explicit and latest). On HEAD an explicit clean run got 422 | Latest proven run | 3 + 8 fail → 42/42 (with `explicitRunAdmission`) |

Start Chart detail: 5 of its 9 HEAD failures are new or rewritten tests that replace the old *"serve unlabelled runs, flagged"* rule. Three are real-client tests (two `it.each` cases and the h1 test) whose fake fetch now answers two requests (candidate ids, then the proven run), with the same `git_sha`, horizon and status fences asserted on each. One is a fixture whose run metrics lacked the rolling contract, which is now verified from the snapshot's proof.

Downstream: `/FORGE`, `/trends`, `/forge/team/[teamId]` and the dashboard cards read Start Chart and `/forge/players`, so they inherit the guard. The Yahoo RSO routes reach the bridge only through `loadPlanningData`.

## Kept unchanged on purpose

- **`run-projection-accuracy`** still calls `requireLatestSucceededRunId` and then its own `evaluateForgeCalibrationEligibility` 422 check, so its eligibility behaviour is unchanged, as the brief required.
- **Out of lease, not changed, follow-up:** `pages/api/v1/projections/goalies.ts`, `projections/teams.ts` and `forge/goalies.ts` still use the unguarded latest lookup, and their explicit-run check still reads run metrics (which never carry the claim). The audit found no external-prior path for goalie or team output (TRACE-NOTES §4). `consumerRevisionAdmission.ts` keeps its own copy of the receipt check; it could import `validCapturedReadReceipt`.

## Checks

The wider suites, tsc and eslint were run by the script in the scratchpad (`run-checks.sh`), under `/private/tmp/fhfh-heavy.lock` (noclobber, never stolen):

| Check | Scope | Result |
|---|---|---|
| Vitest (offline, TZ=UTC) | `lib/projections lib/player-forecasts lib/rosterScheduleData lib/rosterScheduleOptimizer __tests__/pages/api/v1 tests/api lib/dashboard lib/cron` | **passed**: 334 files, 5471 passed, 1 skipped (pre-existing skip) |
| Focused consumer suites | the 9 files in the table above | **passed**: 402 tests (HEAD baseline on the same files: 36 failed) |
| Whole-project tsc | `web/` `tsc --noEmit` | **passed**, exit 0, no diagnostics. The first attempt hit the 4 GB default heap (exit 134); it was re-run with `--max-old-space-size=12288` |
| eslint | the 17 changed or new files | **passed**, exit 0 |

The working tree also held other lanes' in-progress edits (RSO-YAHOO-DIET-P2 Yahoo/RSO files, draft-ranker discovery), which tsc and vitest compiled alongside mine. None of my files touch theirs.

## Hashes (sha256, working tree at receipt time)

- `ae2cf41585dcd3391b91161ee1858b87f6bfd3073cafde69c95327e556be49e1`  web/lib/projections/externalInputProof.ts
- `09873261296e6c0dd20646ba0757178d1cdf9ecfd7c11f0c6dd7b5703b9f53e5`  web/lib/projections/externalInputProof.fixtures.ts
- `d27128326bb185f15c5186db475c3e821e440b966b862e598ddb7e109feb2c94`  web/lib/projections/externalInputProof.test.ts
- `6768ae4c712f40b949f00fdbd5a05c74be81d487ad596f7d862b27907663d11a`  web/lib/projections/apiHelpers.ts
- `dcda9060416e9a830498519b0067085003da0366036e93a9c0c9421a4f1e4736`  web/lib/projections/apiHelpers.runAdmission.test.ts
- `d6be6b7338a2f8053913aae1221dc3c13931a7de9fba1bdfaa6befa19fcda43e`  web/lib/rosterScheduleData/forgeDailyBridge.ts
- `e55aa3a41e4bf89c8a92e21165cfeb509fd63973f20ee8cb47a63512e7938eeb`  web/lib/rosterScheduleData/forgeDailyBridge.test.ts
- `553d41b25bcd39ab9fadd21827822d9fd26c85d656f1a215ebc43d7f006a34c0`  web/lib/rosterScheduleData/planning.test.ts
- `6f9cc41d08a81ba9bed6f3a441df60e207f3292bb05fa0937802c9148ee5ba29`  web/pages/api/v1/db/forge-served-forecast-snapshot.ts
- `9e6ab6435d9710618f836b74a0b261c8550f6fd81fbcdd580f2fed3448d5b96e`  web/__tests__/pages/api/v1/db/forge-served-forecast-snapshot.test.ts
- `cfc0a794ad60087225218b68a399388662d5e90ec408f9d563a96c79715833a2`  web/pages/api/v1/start-chart.ts
- `0e20c3d426acbb62196e235f52b9f6fdb06ed700ef31b9e22dd580342f10c0b4`  web/__tests__/pages/api/v1/start-chart.test.ts
- `5e37d137d8992d40dfd8c94fbc0c88e37aca2be1c86e414d73b91d5ae4fac04f`  web/pages/api/v1/forge/players.ts
- `1403117ea812880c74d779b1b072d73ace76cac700df8146dc3cf87d564d02d4`  web/__tests__/pages/api/v1/forge/players.test.ts
- `d6da3f0b35a3452248c80844319015621bf2841f36e15138a2ac998a985a893b`  web/pages/api/v1/projections/players.ts
- `acee6edb5616b8b4338c0871caca01b2e7d8daffcc275135b98216d4be76c968`  web/__tests__/pages/api/v1/projections/players.test.ts
- `5fb01d75c3526775fc95e3c1c61320d5449c8327d23f7bd7dc207832826ba7bc`  web/__tests__/pages/api/v1/projections/explicitRunAdmission.test.ts
- `8c296ece00a5e0d221ee42239d77784203c8f0c70fa81185db8760e039d5dc7f`  tasks/artifacts/projection-table-audit-2026-10-26/PROD-READ-PLAN.md

## Production read plan

`PROD-READ-PLAN.md`: three bounded read-only queries, not run. **Release risk:** a run saves a snapshot only when both `STARTER_BOARD_CAPTURE_ENABLED` and `STARTER_BOARD_COMPUTE_ENABLED` resolve true. If production runs uncaptured, this guard withholds all FORGE skater output on RSO, Start Chart legacy and both player APIs. Q1 answers that question.
