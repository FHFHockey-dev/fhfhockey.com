# FORGE-QUAL tooling, v2

`check-readbacks.mjs` (v2) checks the Detailed RSO readbacks against the originally issued FORGE rows, settles them, and at a look computes each target's metrics and verdict. It implements the amended scope [`../SCOPE-AMENDED.json`](../SCOPE-AMENDED.json) (`forge-qual-scope-v2`, protocolHash `2acaff68…`), following the checker list in [`../SCOPE-AMENDMENT.md`](../SCOPE-AMENDMENT.md).

It is offline: it reads local JSON files and makes no network or database calls. It still loads `web/lib/projections/evidenceTime.ts` (read-only) for microsecond timestamps, as v1 did. v1 is unchanged in `rso-wave2-2026-10-25/FORGE-QUAL/tooling/`.

| File | What it is |
|---|---|
| `check-readbacks.mjs` | Scope reading, integrity, settlement, baseline, looks; the CLI |
| `metrics.mjs` | `targetMetrics`, `clusteredBootstrap`, the RNG, `quantile7`, `seasonRateBaseline`, `settledCounts`, `lookPlan` |
| `check-readbacks.test.mjs`, `metrics.test.mjs` | Self-tests on synthetic data |
| `reference_bootstrap.py` | An independent Python reading of `protocol.bootstrap`. It prints the cross-check goldens that `metrics.test.mjs` pins. It is a cross-check only |
| `fixtures/` | A pinned fixture scope (fictional identity, same protocol and protocolHash) and a clean two-game slate |

## Run

```bash
node --test tasks/artifacts/rso-review-scope-2026-11-21/tooling-v2/check-readbacks.test.mjs tasks/artifacts/rso-review-scope-2026-11-21/tooling-v2/metrics.test.mjs
```

```bash
python3 -I tasks/artifacts/rso-review-scope-2026-11-21/tooling-v2/reference_bootstrap.py
```

```bash
node tasks/artifacts/rso-review-scope-2026-11-21/tooling-v2/check-readbacks.mjs --issued issued.json --rso rso.json --settlement settlement.json --baseline baseline.json --scope scope.json --look final --out report.json
```

- **Exit codes:** 0 no findings, 1 findings, 2 bad input. Per-target verdicts are in `report.look.targets`, not in the exit code.
- **`--look 1|final`** needs `--scope`, `--settlement` and `--baseline`. Without `--look`, the report has the integrity checks, counts and slates only (a per-slate check).
- **`--scope`** is refused (exit 2) in these cases:
  - its `protocol` doesn't hash to `protocolHash`;
  - its bootstrap `baseSeedHex` doesn't re-derive from `preBootstrapProtocolHash`;
  - its identity is unpinned.

  **Unpinned** means status other than `pinned` (so `amended_awaiting_identity` counts), or any identity field that is null or a `PENDING…` string. Use `--allow-draft-scope true` for dry runs only.
- **A pinned identity** must have:
  - a 64-hex `codeVersion` (the producer closure);
  - a 64-hex `configurationHash`;
  - `servedValueSurfaceSha256` as the B7 surface map (see Identity below);
  - `artifactHash = sha256({codeVersion, configurationHash})`;
  - `modelIdentityVersion` exactly `forge-model-identity-v2`;
  - `participationLineage` exactly a method id such as `forge-rso-participation-overlay-v1:skater`;
  - `targets` equal to the protocol's.
- **`--start-chart` was removed (B2).** RSO is the only consumer.
- **`--sealed`** defaults to the scope's window and cannot differ from it.
- **`--tolerance`** defaults to the scope's `readback.tolerance` (0.0001) and cannot differ from it.
- **Dry runs:** `summary.scopeStatus` records the scope's status. With an unpinned scope, `look.dryRun` is true and the verdicts are never evidence.
  - Only literal pins are compared. Null, `PENDING…` and prose values (anything containing whitespace) are not compared.
  - So a dry run against the draft reports no reset, and the clean fixture passes against it (tested).
- **Determinism:** the report contains no clock or environment values, and the same inputs give a byte-identical report (tested through the CLI).
  - Row order doesn't change the summary, the metrics or the verdicts.
  - Findings are listed in input order.
  - Bootstrap replicates always come from `protocol.bootstrap.replicates` (10,000). Only the test seam in `checkReadbacks({ replicates })` changes that, and the CLI never does.
- **Self-tests:** 52/52 pass (37 checker, 15 metrics). Every finding code is exercised, and a coverage test enforces it.

## Normalized schema

Rows are keyed by `playerId|gameId|target`.
- Use the **NHL player id** and the NHL game id: positive integers, or digit strings. RSO's `forecasts[].playerId` is FHFH's canonical id, so map it through `issuedContext.nhlPlayerId`.
- The **slate** of a row is its `gameDate` (`row.slate_date`). Slates are numbered 1, 2, … over the ascending distinct `gameDate`s of the admitted issued rows.

**Issued row** (one per player, game and target):
- Required:
  - `revisionId, playerId, gameId, target, method, cutoffAt, issuedAt, acknowledgedAt, scheduledAt, gameDate, horizon`;
  - `modelIdentity{version, codeVersion, configurationHash, artifactHash}`;
  - `value{conditionalMean}`: the frozen "if he plays" line, or null.
- Optional: `releasePin` (= `payload.codeVersion`, the deploy SHA). It is recorded only.
- A v1, absent or 40-hex `modelIdentity` fails `identity_v1_or_missing`, and the row is not admitted. Its readback is then not counted again as `readback_unissued`.
- `acknowledgedAt` is the game's own pregame-capture acknowledgement time (its T−60 ack). It is required, so the "after the acknowledgement" check can actually fail.

**RSO readback row** (one read per distinct scheduled start, at that start's T−30):
- Required for served rows:
  - `playerId, gameId, target, revisionId, readId, startGroup, observedAt`;
  - `basis`: one of `confirmed_playing`, `confirmed_out`, `assumed_playing`, `assumed_out`;
  - `participationLineage` (`<method>@<revisionId>`), `conditioning`, `overlayChanges` (an array of `[at, sourceId]`);
  - `producerCodeVersion` (64-hex);
  - `servedValueSurfaceSha256`: the deployed surface map, `{ path: sha256 }`. A combined string fails `readback_incomplete`;
  - `value{unconditionalMean}`: the served stat.
- Optional:
  - `configurationHash, artifactHash, cutoffAt, component`, compared when present;
  - `conflict, lineRoleChanged`, recorded;
  - `allowedUses`, for the use check;
  - `releasePin`, listed in `summary.releasePinsSeen` and never compared.
- **Withheld rows** carry `withheld: "stale_source" | "incomplete_refresh" | "missing_target"` instead of a value. They still carry `readId, startGroup, observedAt`. They are counted per reason and never scored (B5).

**Settlement row:**
- `playerId, gameId, target, gameDate, actual, dressed, recordedAt`, and `settlementVersion` (default 1).
- Optional `penaltyShotExcluded`: the penalty-shot goals or shots left out of `actual`, summed in the report.
- **A skater who didn't dress still needs a row** (`actual: 0, dressed: false`). Once a game has any settlement row, every served row of it must have one, or it fails `settlement_missing`. Skipping him would condition the sample on dressing. A game with no settlement rows yet is counted as `unsettled`.
- **A repair is version 2, never an overwrite.** Version 2 must follow a version 1 with a later `recordedAt`, and version 2 is the row that gets scored.

**Baseline** (`--baseline`, B8):
- `{ players: [{playerId, gameId, target, cutoffAt, gamesPlayed, seasonTotal, positionGroup: "F"|"D"}], groups: [{gameId, positionGroup, target, cutoffAt, gamesPlayed, seasonTotal}] }`.
- Every entry is at that game's revision `cutoffAt`. This is checked as an identical string, so the extractor must copy the issued row's `cutoffAt` exactly.
- **Rate:** `seasonTotal / gamesPlayed`. With fewer than 5 GP, the player's F/D group rate is used instead. The extractor defines the group population (player-games of that group up to the cutoff).
- **Baseline value** = rate × the overlay indicator the row was served with (1 for `_playing`, 0 for `_out`).

## What is checked

**Overlay value (A6, A8):**
- Expected served value = frozen line × (basis ends `_playing` ? 1 : 0), within tolerance.
- A null line must be served as null. Such a row is counted (`nullValue`) and not scored. This is what `consumerRevisionAdmission.ts` does at `47a1a2628`.
- `summary.integrity` reports the protocol's integrity numbers: `integrityShare` (matched served values ÷ every served row), `identityMismatch` and `readbackUnissued`.

**Identity (A12, A13, B7):**
- The producer closure is read from `modelIdentity.codeVersion` (v2) on issued rows, and from `producerCodeVersion` on readbacks. It is never read from `payload.codeVersion`.
- A difference from the pin in any of these ends the scope:
  - the closure, `configurationHash` or `artifactHash` → `identity_changed`;
  - the participation method (`participationLineage` before `@`) → `identity_changed`;
  - the served-value surface → `surface_changed`, which lists the `added`, `removed` and `changed` paths.
- **The served-value surface (B7)** is not combined into one hash.
  - The pinned `identity.servedValueSurfaceSha256` maps each repo path to its sha256, sorted by path. It sits outside the protocol, so pinning doesn't re-hash anything.
  - The pin must name exactly `web/lib/projections/consumerRevisionAdmission.ts`, `rsoParticipationNotes.ts` and `rsoParticipationOverlay.ts`, each with a 64-hex sha256.
  - Each readback records the deployed map. It is compared path by path: any path added, removed or with a different sha256 raises `surface_changed`. Key order on a readback doesn't matter.

**Timing (B6):**
- `observedAt` must be in [start − 30 min, start), after the game's `acknowledgedAt`, and at or after `issuedAt`.
- `startGroup` must equal the game's `scheduledAt`. All rows of one `readId` share one start group and one `observedAt`.
- Every distinct scheduled start needs a read.

### Findings

| Class | Effect | Codes |
|---|---|---|
| integrity | One in slates 1–7 stops every target at look 1 (`stop_integrity`), and the final look carries the stop. One in a later slate up to the final look fails every target (`fail_integrity`) | `issued_empty`, `issued_incomplete`, `issued_duplicate`, `issued_out_of_scope`, `cutoff_after_issue`, `issued_after_puck_drop`, `identity_v1_or_missing`, `artifact_hash_mismatch`, `lineage_without_issuance`, `identity_mismatch`, `readback_out_of_scope`, `value_mismatch`, `readback_no_value`, `readback_incomplete`, `use_beyond_scope`, `readback_duplicate`, `readback_unissued`, `readback_missing`, `readback_capture_time_missing_or_invalid`, `readback_before_issue`, `readback_outside_window`, `readback_group_inconsistent`, `readback_group_missing`, `sealed_issued_present`, `sealed_readback_present`, `sealed_outcome_present` |
| reset | Ends the scope from that slate on: every target at a look that includes it is `scope_ended`, and `summary.scopeEnded` names the cause | `identity_changed`, `surface_changed` |
| target | Only that target can't pass at a look whose slates include the row (`inconclusive_data`) | `settlement_missing`, `settlement_before_game`, `settlement_not_numeric`, `settlement_duplicate`, `settlement_repair_invalid`, `baseline_missing`, `baseline_invalid` |

Each finding carries `slateDate`: its row's `gameDate`, or null when it belongs to no slate. A null-dated finding counts at every look, and a finding after the look's last slate doesn't count.

`readback_not_pregame` (v1) became `readback_outside_window`, with a `reason`: `at_or_after_start`, `before_t_minus_30`, `not_after_acknowledgement` or `no_acknowledgement`.

## Metrics, looks and the bootstrap

**Scored rows:** served, finding-free, settled rows with a baseline.
- Settled counts per target (B3) count scored rows only. Withheld rows are counted apart.
- A served row whose game has no settlement yet is counted as `unsettled` (per target and look). At the final look it makes that target `inconclusive_data`.

**Per target, on the look's rows** (`metrics.mjs` `targetMetrics`):
- bias = mean(predicted − actual) / mean(actual);
- calibration slope = the OLS slope of actual on predicted (two-pass about the means);
- MSE for FORGE and the baseline, and relative ΔMSE = (ΣF − ΣB) / ΣB;
- MAE (descriptive).

The report also stratifies these by basis and gives the basis-vs-dressed table. Both are descriptive.

**Bootstrap** (`clusteredBootstrap`), exactly per `protocol.bootstrap`:
- **Seeds:**
  - baseSeed = the first 16 hex of sha256(`forge-qual-bootstrap-v1:` + `preBootstrapProtocolHash`). That hash is the canonical hash of the protocol without its `bootstrap` block (tested).
  - Each (target, look) stream seed is the first 16 hex of sha256(`forge-qual-bootstrap-v1:<baseSeedHex>:<target>:<look1|final>`). It is reported per target as `streamSeedHex`.
- **RNG:** xoshiro256** with its state set from four splitmix64 outputs, in BigInt.
  - Index in [0, n): reject while x ≥ 2^64 − (2^64 mod n).
  - The threshold isn't masked, so n = 1, 2, 4, … never loops.
- **Draws:** each replicate draws G game indices, then P player indices, over the sorted distinct ids. A row's weight = game draws × player draws.
- **Statistic:** relative ΔMSE.
- **Non-finite rule:** a replicate whose baseline sum is 0 is non-finite, excluded and counted. More than 1% non-finite makes the target inconclusive at that look.
- **Interval:** type-7 percentiles at 0.025 and 0.975. The point estimate is the full-sample statistic.
- **Descriptive intervals:** bias and slope intervals come from the same draws.

**Arithmetic:** IEEE-754 doubles. Every sum runs over rows sorted by (gameId, playerId) ascending. Squared errors are written `w * (d * d)`, never `**` or `Math.pow`. The point estimate runs through the same code with w = 1.

**Anchors:**
- xoshiro256** from the raw state [1,2,3,4] and splitmix64 from 1234567 match the published reference vectors.
- The first four outputs for the base seed are pinned.
- Scripted-draw tests check the weights, the statistic, the 1% rule and type-7 by hand.
- 10,000 replicates match `reference_bootstrap.py` bit for bit.
- 10,000 replicates on about 4,000 rows take about 5 s per target and look.

**Looks** (`lookPlan`, B4):
- **Look 1** uses slates 1–7. It stops a target for harm if |bias| > `lookOneHarm.absBiasAbove`, or the ΔMSE lower bound > 0. Look 1 never declares success.
- **The final look** is the first slate ≥ 14 at which every target still running has reached its `minSettledRows`. Look 1 is recomputed to know which targets are still running. A running target still short at slate 28 ends `inconclusive_short`, and the final look is then slate 28.
- **Final gates:**
  - |bias| ≤ `absBiasMax`;
  - slope within `calibrationSlope` (inclusive);
  - ΔMSE upper 95% < `deltaMseRelUpper95Max` (strict, as in B1 "upper 95% < +3%");
  - rows ≥ `minSettledRows`;
  - no integrity findings.
- **Statuses:** `pass`, `fail` (with `failedGates`), `inconclusive`, `inconclusive_short`, `inconclusive_data`, `fail_integrity`, `stopped_at_look1` or `scope_ended`.

## Assumptions (Chef, 2026-11-21)

The surface rule is settled (see Identity above). Chef confirmed the points below.

- **Pinning writes literal values** for `modelIdentityVersion` and `participationLineage`. The draft carries prose there, and `readScope` refuses prose once the scope is pinned.
- **The ΔMSE gate is strict** (`< 0.03`), and the harm stops are strict (`>`).
- **Look 1 is recomputed at the final look** from the same evidence. A later version-2 repair inside slates 1–7 could therefore change the set of running targets; the report shows `lookOne` beside the final result.
- **`acknowledgedAt`** must come from the game's capture acknowledgement record.
- **The F/D group-rate population is the extractor's.**

## Extractor field paths (to build in `web/`; confirm at the identity-fix release)

**Issued**, from the revision row and its `payload.players[]`:
- `revisionId` = `row.id`; `gameId` = `row.game_id`; `playerId` = `player.player_id`.
- `method` = `payload.modelMode`.
- `modelIdentity` = `payload.inputProvenance.modelIdentity` (v2).
- `releasePin` = `payload.codeVersion`.
- `cutoffAt` = `payload.inputCutoff ?? row.decision_as_of`.
- `issuedAt` = `row.published_at`.
- `scheduledAt` = the game start; `gameDate` = `row.slate_date`.
- `horizon` = `player.horizon_games`.
- `value.conditionalMean` = the admission output's conditional line for the target.

**RSO readback**, from each `forecasts[]` entry `f` of the planning read:
- `playerId` = `f.issuedContext.nhlPlayerId`; `revisionId` = `f.revisionId`; `cutoffAt` = `f.cutoffAt`.
- `producerCodeVersion` = `f.producerCodeVersion`.
- `value.unconditionalMean` = `f.stats[target]`.
- `basis` = `detailedParticipationBasisOf(f)`.
- `component`, `conditioning` and `participationLineage` come from `f.rsoTargetBindings[target]`.
- `allowedUses` = `f.targetAllowedUses[target]`.
- `overlayChanges`, `conflict` and `lineRoleChanged` come from the read's participation receipt (`hostedReaders.ts` at `47a1a2628`).
- `servedValueSurfaceSha256` is the deployed `{ path: sha256 }` of the three B7 files, recorded with the read.
- `readId`, `startGroup` and `observedAt` describe the read itself.

**Settlement**, from `forge_player_game_strength`:
- `actual` per target as in A11 (null if any term is null).
- `dressed` = the strength row has toi > 0.
- `recordedAt` = `updated_at`.
