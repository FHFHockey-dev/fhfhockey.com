# L9b reader contract: per-candidate goalie rows (forge_goalie_candidates_v1) — 2026-11-11

For L9a (opponent-goalie weights), L10 (ledger goalie heads), L11 (RSO bridge, provider override), L22 (game-prediction goalie blend), and the accuracy job (Codex).
Commits: 266794115 (credited-start labels), 4eab7347d (contract, API).

## Where
`forge_goalie_projections.uncertainty.goalie_candidates`, written by `web/lib/projections/stages/goalie-stage.ts` for every team-game from the next FORGE run on. Read it with `readGoalieCandidatesContract(uncertainty)` from `web/lib/projections/goalie/goalieCandidates.ts`: it returns null for older rows or anything that fails validation (duplicate ids, P outside [0,1], mass above 1 + n·5e-7). Null means unknown: never rebuild a partner as 1 − p(top).

## Shape (values are per single game, game_id below)
- `contract: "forge_goalie_candidates_v1"`, `population: "candidate_goalie_game"`, `values_per: "single_game"`, `game_id`, `team_id`
- `team_win_probability`, `team_win_source` ("moneyline_devig_proportional" | "poisson_race" | null): the team's win %, once. Not any goalie's Win.
- `relief_basis`: counts and shutout = "zero_relief_assumption"; credited_win = "modelled_decision_share" (decision 63, labelled).
- `start_probability_mass`, `unresolved_start_mass` (= max(0, 1 − mass); keep unresolved, never redistribute).
- `issuance`: run_id, as_of_date, issued_at, information_cutoff_at, starter_labels {source "wgo_goalie_stats.games_started", window_games, known_games, unknown_games}.
- `rows[]` sorted by start probability: `goalie_id`, `rank`, `start_probability` (unrounded to 6 dp), `start_probability_status` ("override" | "confirmed_evidence" | "uncalibrated_model"), `confirmation_evidence_ids`,
  - `if_starts`: shots_against, saves, goals_allowed, shutout_prob, modeled_save_pct, credited_win_prob (his own credited Win if he starts)
  - `unconditional`: P(start)·if_starts for counts and shutout; credited_win_prob = P(start)·credited_win_if_starts + his relief win share.

## Stored row (unchanged cardinality)
The stored `forge_goalie_projections` row stays one per team under the projected starter's id, now labelled `uncertainty.row_basis = "team_goalie_slot_mixture"`. Its proj_* are the team slot (start-weighted mixture), not that goalie's line (W2-8 PR5). From 4eab7347d `proj_win_prob` and `proj_shutout_prob` are per game (no horizon scalar); counts stay horizon totals (`uncertainty.value_basis`). Promoting candidates to stored rows (row cardinality change) is a later cross-lane migration step.

## Served API
`/api/v1/forge/goalies` now returns one row per candidate (`row_basis: "candidate_goalie_game"`, `conditioning: "if_starts"`): proj_* = his if-starts line, `proj_win_prob` = his credited Win if he starts, `team_win_prob` separate, `unconditional` nested. Pre-contract rows: `row_basis: "team_goalie_slot_legacy"`, `proj_win_prob: null`. No slot rescale.

## Start Chart
Legacy branch payload carries `goalieStartBasis: "l10_start_share"`; each goalie/player row carries `start_probability_basis`. Readers showing that number (SlateStripCard, FocusedSlateContext, FORGE.tsx, GoalieContextPanel) should label it "L10 start share", not a start probability.
