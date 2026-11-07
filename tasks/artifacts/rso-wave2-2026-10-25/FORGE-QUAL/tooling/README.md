# FORGE-QUAL tooling

`check-readbacks.mjs` compares originally issued forecast rows with what each consumer served, and with settled outcomes. It is offline: it reads local JSON files and makes no network or DB calls.

## Run

```bash
node --test tasks/artifacts/rso-wave2-2026-10-25/FORGE-QUAL/tooling/check-readbacks.test.mjs
```

```bash
node tasks/artifacts/rso-wave2-2026-10-25/FORGE-QUAL/tooling/check-readbacks.mjs --issued issued.json --rso rso.json --start-chart start-chart.json --settlement settlement.json --scope scope.json --out report.json
```

- Exit codes: 0 pass, 1 findings, 2 bad input.
- `--scope` takes the predeclared `../scope.json`. It is refused (exit 2) if its `protocol` doesn't hash to its `protocolHash`, or if its identity is still unpinned. Use `--allow-draft-scope true` for dry runs only.
- `--sealed` defaults to the scope's `protocol.sealed`, else the Release C block `2026-10-23..2026-10-30`.
- `--tolerance` defaults to `0.0001`, because RSO rounds to 4 decimals.
- Self-tests: 14/14 pass on the synthetic fixtures in `fixtures/`. The fixture ids are fictional. The fixture scope declares the same protocol (same `protocolHash`) with a fictional pinned identity.

## Normalized schema

Rows are keyed by `playerId|gameId|target`. Use the **NHL player id** in every file. RSO's `forecasts[].playerId` is FHFH's canonical id, so map it through `issuedContext.nhlPlayerId`.

**Issued row:**
- Required: `revisionId, playerId, gameId, target, method, codeVersion, configurationHash, artifactHash, cutoffAt, issuedAt, scheduledAt, gameDate, horizon, participationRevisionId, value{conditionalMean?, unconditionalMean}`.
- Optional: `scheduleRevision, catalogHeadId, sourcePayloadHash`.
- `configurationHash` and `artifactHash` are required on purpose. A revision issued before the FORGE-PROV producer change carries neither, so its rows fail `issued_incomplete`.

**Readback row:**
- `playerId, gameId, target, value{...}, observedAt`.
- Plus any identity fields the consumer exposes. Only fields that are present get compared, so a field a consumer doesn't expose is not counted as a mismatch.

**Settlement row:** `playerId, gameId, target, gameDate, actual, recordedAt`.

**Scope** (`../scope.json`, `forge-qual-scope-v1`):
- `identity` holds `target, method, codeVersion, configurationHash, artifactHash, horizon`. Every non-null field must equal each issued row's.
- `protocol` holds the claim (RSO may allow only `rsoUses`; an RSO readback allowing any other use fails `use_beyond_scope`), the sealed window, population, readback timing, settlement, baselines, metrics, thresholds, the two looks and the reset rule.
- `protocolHash` is the canonical sha256 of `protocol`. It was fixed on 2026-10-26 and doesn't change.
- `identity` is pinned once (status `pinned`) from the first released revision that carries `inputProvenance.modelIdentity`.

## Field paths for the extractors (to build in `web/`, after DECISIONS D3)

**Issued**, from the R1 RPC row, its `payload.players[]` row and the R3 snapshot:

| Field | Source |
|---|---|
| `revisionId` | `row.id` |
| `playerId` | `player.player_id` |
| `gameId` | `row.game_id` |
| `target` | `"SHOTS_ON_GOAL"` |
| `method` | `payload.modelMode` |
| `codeVersion` | `payload.codeVersion` |
| `configurationHash`, `artifactHash` | `payload.inputProvenance.modelIdentity.{configurationHash, artifactHash}` (written since FORGE-PROV; older revisions have none) |
| `cutoffAt` | `payload.inputCutoff ?? row.decision_as_of` |
| `issuedAt` | `row.published_at` |
| `scheduledAt` | `issuedContext.game.startTime` |
| `gameDate` | `row.slate_date` (= `issuedContext.game.date`) |
| `horizon` | `player.horizon_games` |
| `participationRevisionId` | `${row.id}:participation` |
| `sourcePayloadHash` | `payload.inputProvenance.capturedReads.hash` |
| `value.unconditionalMean` | the repo's admission output (`completeBoardSkaterStatsFromProjection` + `boardSkaterForecast`) at the issuing code, `.expected.SHOTS_ON_GOAL` |

**RSO readback**, from `data.data`:
- From each `forecasts[]` entry `f`:
  - `playerId` = `f.issuedContext.nhlPlayerId`
  - `gameId` = `f.gameId`
  - `revisionId` = `f.revisionId`
  - `cutoffAt` = `f.cutoffAt`
  - `codeVersion` = `f.modelVersion`
  - `value.unconditionalMean` = `f.stats.SHOTS_ON_GOAL`
- `observedAt` = `read.evaluatedAt ?? forecastManifest.asOf`.
- Keep `f.targetAllowedUses.SHOTS_ON_GOAL` for the use check.

**Start Chart readback:**
- From each `players[]` entry `p`:
  - `playerId` = `p.player_id`
  - `gameId` = `p.game_id`
  - `value.unconditionalMean` = `p.forecast.expected.SHOTS_ON_GOAL` (equal to `p.proj_shots`)
- Join `gameRevisions[]` on `gameId` for `revisionId`, `codeVersion` and `method` (= `modelMode`). The join is valid only when exactly one revision per game is present (GAPS G7).
- `observedAt` = capture time.

**Settlement**, from R6: `actual = shots_es + shots_pp + shots_pk` (null if any is null), `recordedAt = updated_at`.
