# Validation Checklist

## Purpose

This checklist is the release gate for the NHL API ingestion, normalization, feature, and parity foundation.

Use it before:

- promoting the NHL API pipeline as the primary production source
- backfilling a large historical range
- publishing parity tables as NST replacements
- using the shot-feature layer for xG training inputs

This checklist is intentionally split into raw, normalized, feature, parity, and operational checks so failures can be isolated to the correct layer.

## Validation Metadata

Every validation run must record:

- validation date
- environment
- sampled game ids
- season range covered
- `parser_version`
- `strength_version`
- `feature_version` if derived features are involved
- `parity_version` if parity outputs are involved
- source code commit SHA
- pass or fail status
- open issues or approved exceptions

## 1. Raw Payload Parity

Goal:
- confirm the immutable raw archive matches the upstream payloads fetched for each game and endpoint

Required checks:
- `nhl_api_game_payloads_raw` contains one stored payload per intended game and endpoint fetch
- `play-by-play`, `boxscore`, `landing`, and `shiftcharts` payloads are present for each fully ingested validation game
- `payload_hash` is non-empty and stable for repeat fetches of unchanged upstream payloads
- `source_url` points to the correct endpoint shape for the stored payload
- replaying a fetch for an already archived payload does not mutate the archived row in place

Spot checks:
- open a sampled raw `play-by-play` payload and confirm `rosterSpots` and `plays` exist when expected
- open a sampled raw `shiftcharts` payload and confirm shift rows are present for both teams
- verify at least one OT game and one empty-net game were archived correctly

Failure conditions:
- missing raw endpoint for a game expected to be complete
- malformed or truncated payload JSON
- unexpected raw row mutation instead of append-only archival behavior

## 2. Normalized Event Count Sanity

Goal:
- confirm `nhl_api_pbp_events` is a faithful typed expansion of the raw `play-by-play` event stream

Required checks:
- one normalized event row exists for each upstream event intended to survive parser normalization
- `event_id` and `sort_order` are unique within a game
- event ordering by `sort_order` is deterministic and monotonic
- sampled games match raw event counts by event type after applying documented exclusions
- `type_code` and `type_desc_key` distributions match the raw payload
- `event_owner_team_id`, participant ids, `period_number`, and `period_seconds_elapsed` are populated when the upstream event shape supports them

Spot checks:
- regulation-only game
- overtime game
- heavy special-teams game
- low-event game
- high-event game
- goalie-pulled or empty-net game

Failure conditions:
- count drift between raw and normalized event sets
- duplicate event rows for the same `(game_id, event_id)` or ambiguous ordering
- parser drops supported fields without a documented version bump

## 3. Shot-Family Count Sanity

Goal:
- confirm shot-attempt families are reconstructed consistently from normalized events

Required checks:
- `goal`, `shot-on-goal`, `missed-shot`, and `blocked-shot` counts reconcile to raw event totals
- shot-on-goal totals treat `goal` as a shot on goal
- unblocked shot attempt totals include `goal`, `shot-on-goal`, and `missed-shot` only
- blocked-shot totals are excluded from unblocked shot counts
- feature-layer eligible shot rows reconcile to normalized exclusions:
  - shootouts excluded
  - penalty shots excluded
  - delayed-penalty events excluded from shot features
  - empty-net shots included and flagged

Derived-feature checks:
- normalized-coordinate rows exist when raw coordinates and side context exist
- rebound flags are internally consistent with prior-event timing
- rush flags honor the documented transition-source and break rules
- flurry sequence ids group only same-team, same-period eligible shot clusters
- miss-reason buckets are populated for missed shots with a known reason

Failure conditions:
- mismatch between normalized shot families and raw event types
- excluded shot classes leaking into feature outputs
- feature rows missing for standard eligible shot types without a documented reason

## 4. Score Progression Sanity

Goal:
- confirm normalized event progression does not break game-state reconstruction

Required checks:
- goal events move the score forward in the expected direction for sampled games
- home and away score fields never decrease as event order advances
- sampled final scores reconcile to upstream summary surfaces
- shootout and penalty-shot exclusions do not corrupt regulation or OT score progression

Spot checks:
- multi-goal game
- one-goal game
- overtime-decided game

Failure conditions:
- score regression within a game
- mismatch between normalized goal progression and published final score

## 5. Strength-State Sanity

Goal:
- confirm `situationCode` decoding and strength bucketing are stable and versioned correctly

Required checks:
- `strength_exact` matches the manpower encoded in `situationCode`
- `strength_state` follows the documented `EV`, `PP`, `SH`, `EN` rules
- owner-relative PP and SH classification is correct for both home-owned and away-owned events
- `EN` is set whenever either goalie digit is `0`
- OT `3v3` events remain `EV` with exact manpower preserved
- rare manpower states are retained and flagged rather than silently remapped

Must-validate examples:
- `1331`
- `0651`
- `1560`

Failure conditions:
- contradictory `strength_exact` and decoded manpower
- PP or SH labels flipping incorrectly by owner side
- empty-net events misclassified as ordinary EV or PP states

## 6. Shift Overlap And TOI Sanity

Goal:
- confirm `nhl_api_shift_rows` can support TOI, stint reconstruction, and event-time on-ice attribution

Required checks:
- player coverage in `nhl_api_shift_rows` matches expected skaters and goalies for sampled games
- normalized shift intervals are non-negative after parser correction rules
- overlapping shifts produce sensible stint boundaries instead of duplicate active windows
- sampled player TOI from summed shift intervals is consistent with comparison baselines
- pulled-goalie and goalie-return windows do not break shift normalization
- event-time on-ice lookups produce stable player sets for sampled even-strength and special-teams events

Spot checks:
- standard regulation shift flow
- overlapping or back-to-back shift rows
- goalie-pulled game
- special-teams segment with manpower change

Failure conditions:
- negative or impossible shift durations after normalization
- event-time attribution returns the wrong team set or no set when shifts exist
- TOI drift exceeds accepted tolerance for the comparison baseline

## 7. Parity Output Sanity

Goal:
- confirm NST-replacement outputs are internally consistent before legacy comparison

Required checks:
- skater surfaces exist for `all`, `EV`, `PP`, and `PK`
- goalie surfaces exist for `all`, `EV`, `5v5`, `PP`, and `PK`
- count and rate families are both populated where expected
- on-ice outputs reconcile directionally with event-level CF, FF, SF, and GF aggregates
- penalty-shot and shootout exclusions do not leak into published parity totals
- strength-separated TOI aligns with event-segment overlap logic

Failure conditions:
- missing split families
- rates inconsistent with counts and TOI
- excluded events leaking into parity outputs

## 8. Legacy Comparison Readiness

Goal:
- ensure the sample is ready for NST-era comparison work in `7.3`

Required checks:
- overlap games with legacy `pbp_plays` are identified
- overlap games with usable `shift_charts` baselines are identified
- known approximation areas are listed before comparison:
  - rush
  - rebound
  - flurry
  - danger buckets
  - xG approximations
- any expected divergence is documented before calling a mismatch a bug

Failure conditions:
- running parity comparison without an overlap sample
- treating documented methodological differences as unexplained failures

## 9. Idempotency And Replay Sanity

Goal:
- confirm the same game can be reprocessed safely

Required checks:
- re-ingesting the same game does not create duplicate logical rows
- conflict targets preserve one logical normalized row per game/entity key
- raw snapshots remain append-only or hash-stable according to the archival contract
- replay under the same version tuple produces the same outputs
- replay under a newer version tuple is attributable to the new version metadata

Failure conditions:
- duplicate normalized or derived rows after rerun
- inability to identify which version produced a row set

## 10. Release Decision

A validation batch is release-ready only if all of the following are true:

- raw payload parity passed
- normalized event count sanity passed
- shot-family count sanity passed
- score progression sanity passed
- strength-state sanity passed
- shift overlap and TOI sanity passed
- parity output sanity passed
- any legacy divergence is documented and versioned

## 11. Training And Rollout Blockers

No model training run, training-dataset publication, or production rollout may proceed until all of the following are true:

- `tasks/event-dictionary.md` is current for the active parser version
- `tasks/strength-mapping.md` is current for the active strength version
- shift integration rules and on-ice attribution expectations are documented in:
  - `tasks/definitions-and-parity.md`
  - `tasks/manual-audit-requirements.md`
  - `tasks/data-contract-boundaries.md`
- automated raw-vs-normalized validation is passing for the intended release sample
- parity validation is passing for the intended release sample, with any approved approximation drift documented
- the latest manual audit artifact records a pass for representative EV, PP/PK, OT, and empty-net samples

Blocked actions until the above are satisfied:

- training or exporting a phase-1 xG dataset for model fitting
- switching production readers from legacy NST-derived surfaces to NHL-derived parity outputs
- large historical backfills intended to publish parity outputs as authoritative

If any blocker fails, the release status remains `not approved` even if ingestion itself succeeds.

Do not approve production rollout or xG-training use when any release-blocking section is still unresolved.

## Validation Result Template

Use this format for each validation run:

```md
# Validation Run

- Date:
- Environment:
- Commit:
- Parser version:
- Strength version:
- Feature version:
- Parity version:
- Games sampled:
- Result:

## Passed

- 

## Failed

- 

## Approved Exceptions

- 

## Next Actions

- 
```
