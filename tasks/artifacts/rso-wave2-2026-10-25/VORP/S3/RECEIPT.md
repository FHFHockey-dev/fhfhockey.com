# VORP S3 receipt: later-impact scenario inputs (data side)

Lane `RSO-S3-SCENARIO` (Claude, session rso-s3-inputs, 2026-10-29). Stage S3 of `../ASSESSMENT.md`, built to `../S3-SCENARIO-CONTRACT.md` **v2** (sha256 `2f31491a6a63f52e2b6ec3f4eba6633928a14c1d4f6e625283eccf31fb7acca5`, checked at start, not edited), which Codex accepted for offline implementation (`CODEX-RSO-SCENARIO-CONTRACT-CLOSED-20261029`).

- **Done offline only:** local edits, fixtures and offline tests.
- **Not done:** commit, push, deploy, production or Yahoo access, migration or schema change, live capture, flag activation, `PROJECTIONS_*` read, or Next dev server.
- **Baselines:** all 12 tracked lease paths matched their `CLAUDE-LEASES.json` baselines (sha256) before any edit. The two new files and `S3/` were absent.
- **Read-only file:** `rosterScheduleOptimizer/planning.ts` was not touched.

## What S3 produces

S2's pure engine (`futureImpact.ts`) takes plain inputs. S3 makes them in a new module, `web/lib/rosterScheduleData/laterImpactInputs.ts`. They travel as a separate, versioned payload, `rso-later-impact-scenario-v1`. The payload is never a `GameForecast`, never a native revision and never a weekly input.

| Input (contract §) | Source and rule |
| --- | --- |
| **Later period F (§2)** | Built from `yahoo_matchup_weeks` (the loader's existing read). The table has only a season-wide `game_key` and **no league key**. Under §2.1 that is not proof of the workspace's league, so such rows give **no actual period**, and F becomes the labelled 7-day fallback ("assumed period, not league-confirmed"). Rows that carry a single `league_key` count as actual periods for that league: an exact match gives an actual F, and any other league gives `league_identity_mismatch`. A caller may also pass league-confirmed `leaguePeriods` (exact identity). The engine's `resolveLaterPeriod` applies the bound: no clipping, and no fallback for a known ineligible period. The season span is the matchup weeks' first start to last end. With no weeks, the result is `season_bounds_unavailable`. |
| **F's schedule (§2.5)** | A **separate** read of `roster_optimizer_team_games` for every date F could take inside the bound: window end + 1 through today + `calendarDays`, padded ±1 day like the window read. The window's games are not touched. Each date is verified on its own with the existing source-day coverage witness (`hasScheduleCoverage`, which covers games and off days and requires reads fresher than 36 h). The slice is complete only if every F date is verified. A verified off day is not missing data. |
| **Membership (§2.5)** | Taken at decision time from the loader's current rosters. A player counts as verified only with a unique current team (`nhlTeamId`, `rosterRevision` and abbreviation). It is saved with its `asOf` and roster revision. A later roster never rebuilds it: a team change after the decision gives `team_mismatch`. |
| **Basis rows (§3–§4)** | **One row per player** from the admitted FORGE h1 rows the bridge read: the latest successful, released, public h1 run per slate, with external-input proof. A lineup line wins. Otherwise the player's reserve line plans a **labelled conservative zero**, and its conditional line is kept beside it. Within a kind, the newest wins by (`issuedAt`, `run_id`, basis `game_id`), never by slate order. Components come from the new `forgeNativeLine`: native per-game heads in league keys and native units (`TIME_ON_ICE_PER_GAME` in minutes). There are **no season-rate substitutes**: stats FORGE does not project stay null. For goalies, there is no `GAMES_STARTED` and no `GOALIE_MINUTES`. Conditioning is taken only from the source's own tag. **Today's FORGE lineup tables have no conditioning column, so real lineup rows are `conditioning_unknown` (unknown).** That is the honest state, and no unconditional basis is inferred. |
| **Timing (§3)** | `issuedAt` is `forge_runs.created_at`. The input cutoff and the replay classification come only from the run's captured input snapshot (`forge-run-inputs-v1`: `payload->>inputCutoff`, `metadata->>replayClassification`). A run with no snapshot (production capture is off), or with snapshots that disagree, keeps both unknown. It gets `missing_timestamp` plus the new `replay_classification_unknown`, and no timestamp is guessed. Reconstruction runs are excluded. |
| **Witness (§3, §7)** | `observed_capture`: the bridge's own server-side read of the admitted runs' output rows, timed by an optional `capture` callback that starts before the runs read and completes after the row reads. Its receipt lists every selected row's full identity (run, slate, basis game, player, horizon, component set) with per-row and set checksums. Its bindings are run succeeded, admission, identity, conditioning and proof. One receipt covers every row, so the set is coherent. `decisionAsOf` is fixed **after** every read, so after capture completion. Reload never substitutes "now". |

### Hashing scheme

`H(v)` is the existing `playerForecastSourcePayloadHash`: sha256 hex of `JSON.stringify` of `v`, with object keys sorted recursively.

- **Source-row hash** = `H(selected FORGE row exactly as read, every selected column)`.
- **Row identity** = `{ runId, slateDate, basisGameId, playerId, horizonGames, components: sorted keys }`.
- **Row checksum** = `H({ identity, components: native line served, sourceRowHash })`.
- **Set checksum** = `H(receipt rows as { identity, checksum }, ordered by H(identity))`.
- **Receipt id** = `"observed_capture:"` + the first 32 hex of `H({ startedAt, completedAt, setChecksum })`.

The converter recomputes every row checksum and the set checksum from the payload. Changed bytes therefore surface as `checksum_mismatch`, `row_checksum_changed:<id>`, or `set_checksum_mismatch` with `missing_set_checksum`.

## Flag behavior

**`RSO_LATER_IMPACT_SCENARIO`: on only when exactly `"on"`. Unset, or any other value, is off.**

- **Off (default).** `loadPlanningData` returns the same object as at `9d70700ab`: same keys, same order, same values. It makes **no extra reads**, and the bridge is called with its original seven arguments. Tested: the JSON, transport bytes and DB call sequence are identical for unset and `"off"`. The harness below also compares against the `9d70700ab` loader byte for byte.
- **On.**
  - The bridge gets the capture callback, which never changes its result.
  - After the loader's normal work, `loadLaterImpactScenario` does three things: it reads run timings (`player_forecast_source_observations`, chunk-free, ≤ 500 rows), reads F's schedule, and sets `decisionAsOf`.
  - The payload is fitted (§8) and attached as `laterImpactScenario` beside the data. Forecasts, games, evidence, manifest and proofs are unchanged.
  - Read failures become limitations or a withheld payload. They never fail planning.
- **No UI.** No component, route or engine file changed.
  - The data route and the Yahoo paths pass the field through: the transport accepts it, and the Yahoo snapshot spreads `data`, so it is saved with the snapshot.
  - Nothing renders it.
- **Engine gate unchanged.** `LATER_IMPACT_CONTRACT.accepted` stays `false`.
  - `laterImpactFromScenario()` without `offlineFixture` returns `scenario_contract_not_accepted` before reading any input, as S2's app path does.
  - Codex's disposition authorizes offline implementation only: no flag activation and no serving. So the app still shows nothing, and no number can reach it.
  - Tests run the engine with `{ offlineFixture: true }`.

### Feeding futureImpact

`laterImpactInputFromScenario(payload, snapshot, intent, steps, { leaguePeriods? })` rebuilds `LaterImpactInput` from the saved payload alone. `laterImpactFromScenario` runs the engine. The converter refuses, as `unknown`, a payload whose:

- window differs from the snapshot's (`window_mismatch`);
- season differs (`season_mismatch`);
- time zone differs (`time_zone_mismatch`);
- or that has no season bounds (`season_bounds_unavailable`).

An absent payload gives `scenario_unavailable`. A withheld payload gives its own reason. Converter reasons are kept beside the engine's.

`futureImpact.ts` input changes, the minimum needed:

- `timing.reconstruction` is now `boolean | null`, where `null` gives `unknown` with `replay_classification_unknown`;
- `blocked()` is exported for the unavailable result.

## Schema and storage (§8)

- **`laterImpactScenarioSchema`** (in `in-season/workspaceSchema.ts`) is a strict discriminated union:
  - `captured`;
  - `withheld` (`{ reasons, decisionAsOf }` only).
  Rows are bounded tuples (`basis.rows`: `[playerId, run, basisGameId, team, componentSet, values, conditioning, checksum, sourceRowHash, reserveZero]`; `capture.rows`: `[playerId, run, basisGameId, horizonGames, componentSet, checksum]`), with shared run and component-set tables, so a full catalog stays small.
- **`snapshotSchema`** gains an optional `laterImpactScenario`. Old snapshots stay valid, and later impact is then `unknown` (`scenario_unavailable`).
- **The planning transport** (`planningDataTransport.ts`) gains the same optional field. Old responses still decode.
- **Pack/unpack** leave it untouched, because it is not snapshot-shaped.

## Byte budgets (§8)

- **Scenario ceiling.** `LATER_IMPACT_SCENARIO_BYTE_BUDGET` = 900,000 bytes.
- **Envelope margin.** `LATER_IMPACT_SCENARIO_ENVELOPE_MARGIN` = 120,000 bytes, kept free for the route's own fields and a Yahoo snapshot's roster, rules and lineups.
- **Fitting rule.** `fitLaterImpactScenario` attaches the payload only if both hold:
  - it fits its ceiling;
  - (body with the **full, untrimmed** bridge wire) + field + payload + margin ≤ 4,000,000.
- **When it does not fit.** It sends `withheld` with `scenario_payload_truncated`: the truncation is disclosed and the number withheld. If even that notice cannot fit, nothing is attached and the result is unknown. **The scenario therefore never causes `fitBridgeWire` to trim a weekly bridge row.**

Measured (`laterImpactInputs.test.ts`, the production-shaped `forgeReservePayload.fixture` week: 32 teams × 34 players plus 58 teamless, the full bridge with the reserve pass, and a 14-day F schedule):

| Quantity | Bytes | Limit |
| --- | --- | --- |
| Scenario payload (1,088 basis rows, 1,088 receipt rows, 1,088 members, 188 F game sides) | **477,780** | 900,000 own ceiling |
| Bridge wire | 1,711,786 | 2,500,000 |
| Bridge expanded | 5,653,556 | 6,000,000 (unchanged by S3) |
| Response body without the scenario (transport + full wire) | 2,140,863 | |
| Combined body with the scenario | **2,618,666** (+120,000 margin = 2,738,666) | 4,000,000 |
| Packed snapshot (data + packed wire + scenario) | 2,618,560 (+ margin) | 3,996,000 workspace save |
| Unpacked snapshot (expanded + players + games + scenario) | 6,560,235 | 8 MiB preservation backup, asserted below 8 MiB − 1.5 MB headroom (6,888,608) |

Limitation: at the **budget** level (6 MB expanded, the full 900 KB scenario and the catalog), the unpacked snapshot would exceed the existing 1.5 MB headroom line, though it would still be under 8 MiB. The measured production-shaped week fits with room.

## Tests (fixtures only)

`laterImpactInputs.test.ts`: 32 tests.

- **Flag:** default off; only `"on"` turns it on.
- **App gate:** the path stays `scenario_contract_not_accepted`.
- **Checksums:** the documented formula; order independence; receipt binding (completion ≤ D; per-row and set).
- **§2:**
  - game-key-only weeks give the labelled fallback;
  - an exact league-keyed week gives an actual F (complete, with no assumption);
  - another league gives `league_identity_mismatch`;
  - mixed identities count as no league;
  - a known ineligible actual period is kept, not swapped;
  - a 14-day policy gives outside the bound, and 21 gives inside;
  - no season bounds; the season boundary;
  - window, time-zone and season binding.
- **§2.5:**
  - the window's games and the snapshot are untouched;
  - ΔF matches an independent oracle;
  - (a) within the bound and (b) scenario inputs complete, with `nativeForecasts: false` and the "rate scenario … not native F forecasts" label;
  - one unverified F date gives `schedule_incomplete`;
  - verified off days count as no-game, not missing;
  - an unreadable schedule; a stale schedule (> 36 h).
- **§3:**
  - pre-D capture with full provenance ("observed available by");
  - post-D capture → `capture_after_decision`, never backdated;
  - partial capture → `row_not_in_capture` + `set_checksum_mismatch`;
  - changed row bytes → `checksum_mismatch` + `row_checksum_changed`;
  - changed set checksum;
  - same-key overwrite → new checksum;
  - no capture;
  - several codes kept together (`capture_after_decision` + `input_age_exceeded`);
  - reconstruction excluded;
  - unrecorded classification or cutoff → `replay_classification_unknown` + `missing_timestamp`;
  - disagreeing snapshots → unknown;
  - selection by issue time, then run, then game (not slate order);
  - reload under two fake clocks is byte-identical.
- **§4–§5:**
  - untagged rows (today's real shape) → `conditioning_unknown`;
  - a trade (row team) and a team change since D → `team_mismatch`;
  - unverified membership;
  - reserve zero labelled, with the conditional line kept and ΔF exact;
  - a lineup line beats a reserve line;
  - a missing line is unknown, not zero;
  - goalies conditional, with no number and no start or minutes;
  - native units and nulls, with no season rates; a scored stat FORGE lacks → unknown.
- **§8:**
  - strict schema: rejects an extra key or a long tuple;
  - round-trips: withheld; old and new snapshot; JSON export; pack/unpack; `saveWorkspaceSchema`; transport encode/decode with and without the field; bad version rejected;
  - the payload contains no forecast or revision fields;
  - truncation is disclosed, the number withheld, nothing attached when there is no room, read failure → withheld;
  - the production-shaped measurement above.
- **Server build** (mock DB):
  - the schedule read starts after the window;
  - `decisionAsOf` is after capture completion and every read;
  - read failures leave honest gaps.

Other test files:

- `planning.test.ts`, +1 test. With the flag unset vs `"off"`: identical JSON, transport bytes and DB call sequence, with no `laterImpactScenario`. With it `"on"`: identical data and proofs once the field is removed. The scenario is captured, validates, covers the served row, is fixed after capture, and its schedule is a second, separate read. The transport carries it unchanged.
- `futureImpact.test.ts`, +1 test: an unrecorded replay classification gives `unknown`.

## Commands (from `web/`) and results

| Command | Result |
| --- | --- |
| `npx vitest run lib/rosterScheduleData/laterImpactInputs.test.ts` | passed, 32 tests |
| `npx vitest run lib/rosterScheduleData lib/in-season lib/rosterScheduleOptimizer/futureImpact.test.ts` | passed, 19 files, 767 tests |
| `npx vitest run lib/rosterScheduleOptimizer lib/rosterScheduleData lib/in-season components/RosterScheduleOptimizer __tests__/components/RosterScheduleOptimizer` | First run (18:12Z, alongside tsc): 1,852 of 1,853. The 1000-player 13-day planning test timed out under load; it passes alone and does not touch S3. Final run (alone): **passed, 64 files, 1,853 tests** |
| `npx eslint --max-warnings 0` on all 9 touched source and test files | passed, exit 0 |
| `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit` under `/private/tmp/fhfh-heavy.lock` | First run (lock 18:12:53–18:14:07Z): exit 2, with two type errors in `laterImpactInputs.test.ts`. After the fix (lock taken 18:15:13Z, released 18:16:29Z): **exit 0**. The earlier `lib/player-cards/currentNhl.test.ts` TS2775 error no longer appears; the other lane fixed it. |

## Isolation harness (baseline `9d70700ab`)

`run-isolation-harness.sh` (this folder) is adapted from `../S2/`. Usage: `run-isolation-harness.sh <empty scratch dir>`. It has two parts:

- **Weekly engine.** It wraps four entry points (`planRoster`, `evaluatePlan`, `candidatePlanMetrics`, `buildStreamingChains`) in the engine tests. **On** means `laterImpactFromScenario` (offline) first evaluates a payload built for that snapshot, which exercises S2's scenario hook, and the weekly call then runs on a copy that carries the payload.
- **Data side.** It wraps `loadPlanningData` (in `rosterScheduleData/planning.test.ts`) and `loadForgeDailyBridgeForecasts` (in `forgeDailyBridge.test.ts`). Each call runs the `9d70700ab` loader, the working tree with the flag unset, and the working tree with it `"on"`. These are compared as **JSON strings**, which is byte identity including key order: on is compared once `laterImpactScenario` is removed, and run proofs are compared too.

Final run (harness `testTimeout` 120 s):

| Entry point | Calls | Scenario exercised | Mismatches vs `9d70700ab`, off | Mismatches vs `9d70700ab`, on |
| --- | --- | --- | --- | --- |
| `planRoster` | 123 | 123 | **0** | **0** |
| `evaluatePlan` | 238 | 237 | **0** | **0** |
| `candidatePlanMetrics` | 74 | 73 | **0** | **0** |
| `buildStreamingChains` (direct) | 1 | 1 | **0** | **0** |
| `loadForgeDailyBridgeForecasts` (on = capture callback passed) | 11 | 9 | **0** | **0** |
| `loadPlanningData` (on = flag "on", scenario attached) | 140 | 111 | 1 | 1 |

**Where the one `loadPlanningData` mismatch comes from.** It is in "completes bounded accepted-news reads under backend caps". That test's mock DB counts pages across calls (`failPage`), so the **baseline itself differs from a second baseline run**. Self-check: `baseSelf` false, and off equals the second baseline run. It is an artifact of repeated invocation, not an S3 difference.

**Earlier runs.** Two runs at the default 5 s timeout gave 3 off and 3 on mismatches. All of them came after timed-out tests: their tripled loaders kept running in the background and toggled the flag env var under the next test. Run alone, those calls matched, and the baseline matched itself. Raising the harness timeout removed them.

**Test failures inside the harness (19).** These are expected from wrapping. Each loader runs 3 times, so tests that assert DB call counts or captured-proof counts see triples (for example `[["r-new"],["r-new"],…]`). The same tests pass in the normal suite.

## sha256 of touched files

```
fc5ace30870665850d3b550b1b3d15bcef1a2ec6f551f5f57ef57896b3564157  web/lib/rosterScheduleData/laterImpactInputs.ts            (new)
b2462a416455116a9dcd5ef5266e8ecf769f08fbabdb195a7b3038c38a83d2e6  web/lib/rosterScheduleData/laterImpactInputs.test.ts       (new)
c4df8dc999e7eac695949abbcc1a05109d046170fb6bd47ab493f60504b4262a  web/lib/rosterScheduleData/planning.ts                     (baseline 2e65ee72…)
36e0c84ec75104d9b963271ce8dfd73008816c737683835f868a9f6b2c018d34  web/lib/rosterScheduleData/planning.test.ts                (baseline b77bd596…)
de79f08c77e21b0b548894e63885cc1b481510a281f27eaa97f526101cbd3f55  web/lib/rosterScheduleData/forgeDailyBridge.ts             (baseline 744d37c2…)
8d92ae6d13e4b10947c189a10fe095a06e25e63974d64b41e2c38303992f3947  web/lib/rosterScheduleData/planningDataTransport.ts        (baseline 933d564d…)
50215ab34da3885fd6159c70524840f7f408c6ab1772c13449dbe32f22591006  web/lib/in-season/workspaceSchema.ts                      (baseline efff7eed…)
f6617aff3f2e59c4e3bf5e41cc91239e0a423c99953b3488369c9f7e0f88f3d4  web/lib/rosterScheduleOptimizer/futureImpact.ts            (baseline b67dcefe…)
461ab1f27cb4c716c90a9407e3077ebb0a70145710126ed7d5e84e89e48dc280  web/lib/rosterScheduleOptimizer/futureImpact.test.ts       (baseline f28d04be…)
531f6384e1e5677108755f999ad323735c5a2d293911320e510d6d8d34ea052d  tasks/artifacts/rso-wave2-2026-10-25/VORP/S3/run-isolation-harness.sh (new)
```

Leased but unchanged (equal to their baselines): `forgeDailyBridge.test.ts` 250023a5…, `bridgeForecastWire.ts` 61105e1a…, `planningInputs.ts` 8193aa5d…, `forgeReservePayload.test.ts` 4f61b21e…, `workspaceSchema.test.ts` 8bac5526…. Read-only `rosterScheduleOptimizer/planning.ts` is unchanged (a6f6dbb4…, S2's final hook).

This receipt and the diary `tasks/diaries/2026-10-29-claude-rso-s3-inputs.md` are written last, so their hashes are not listed.

## Limitations and notes for review

- **Real data today is unknown, by design.** Three things block a number:
  - FORGE lineup rows carry no conditioning tag;
  - runs without a captured input snapshot have no input cutoff or replay classification;
  - matchup weeks carry no league key, so F is always the assumed fallback.
  Each of these needs a source change, which is outside this lane and needs owner approval. No value is inferred.
- **Reserve rows** are the only positively tagged rows (`if_dressed`, `if_starts`). They plan the labelled conservative zero.
- **The membership `asOf`** is taken just after the loader's input reads complete. It is not a per-row roster timestamp.
- **The envelope margin (120 KB)** is an assumption sized for the route fields and a Yahoo snapshot's extras. The Yahoo provider route's own body was not measured here, because it is outside the lease.
- **`forgeReservePayload.test.ts` and `bridgeForecastWire.ts`** are leased but unchanged. The measurement lives with the new module.
