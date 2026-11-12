# L9c → L11: FORGE skater row contract (if-plays line + availability state), 2026-11-12

Producer: `web/lib/projections/stages/skater-stage.ts` (+ `skaterCoverage.ts`, `timeAwayDecay.ts`). Decision 132.2–132.4, 31.

## Every skater row's line is his line IF HE PLAYS
- Lineup rows (`forge_player_projections`): the line is no longer scaled by the legacy DTD/benched multiplier (was ×0.55 for DTD at confidence .75 outside board mode) nor by the soft-stale recency decline (was 1 → 0.15 over 21–45 days). Both were unqualified and folded availability/time away into the line.
- Reserve rows (`forge_reserve_projections`, `conditioning = 'if_dressed'`): unchanged line builder (Codex's `reserveProjections.ts`); long absences (no ev/pp row in 365 d) now get a line from their last active games via a bounded 1,095-day read.

## Availability: `uncertainty->availability` (both tables)
`{ version: "forge-skater-coverage-v1", game_id, state, line_conditioning: "if_plays", expected_for_game: 0|null, participation_probability: null, participation_qualified: false, label, event_type, event_id }`
- `state = "projected_lineup"` (lineup rows): as today.
- `state = "confirmed_out"`: roster event INJURY_OUT/IR/LTIR/SUSPENSION/NON_ROSTER/SENDDOWN, or SCRATCH whose payload.game_id is this game. `expected_for_game: 0` for **that game_id only**; line kept. Label "scratched / not expected to dress" for SCRATCH.
- `state = "uncertain"` (DTD, BENCHING; can be on a LINEUP row): no qualified participation probability → unconditional is **unknown**; keep the line as the conditional ("if he plays") line.
- `state = "unknown"` (reserve with no evidence, or RETURN reported but not in lineup): unconditional unknown, never 0.
- Producer roster-event state is run-time evidence; L11's accepted-news states (confirmed lineup/out) may override per game as today.

## Time away: `uncertainty->time_away`
`{ version: "forge-time-away-v1", last_game_date, days_away, status: active|away|unknown, line_basis: "last_active_games", decay: { status: "unvalidated", applied: false, mean_ratio: null, dispersion_ratio: null, uncertainty: "widened_unquantified"|"none"|"unknown" } }`. Show "unvalidated" when status = away. No decay is applied until a held-out fit passes (`VALIDATED_TIME_AWAY_FIT` is null).

## Coverage: `forge_runs.metrics`
`data_quality.skater_coverage_{eligible,lineup,reserve,unknown}` totals; `skater_coverage[]` per team-game `{ game_id, team_id, eligible, lineup, reserve, unknown, unknown_by_reason, complete }`. Reasons: `reserve_pass_disabled`, `no_nhl_usage_in_window`, `team_lineup_unavailable`, `roster_team_conflict`, `missing_player_record`.

## What L11 needs (release together)
1. Select the state cheaply, e.g. `availability_state:uncertainty->availability->>state, availability_game_id:uncertainty->availability->>game_id` on both `SKATER_COLUMNS` and `RESERVE_COLUMNS` (no full jsonb read).
2. Lineup row with `uncertain` → unknown unconditional, conditional line kept (today it reads the line as unconditional; after L9c that would overstate DTD players).
3. Reserve/lineup `confirmed_out` for that game → 0.0, line kept. Missing `availability` (old runs) → today's behaviour.
