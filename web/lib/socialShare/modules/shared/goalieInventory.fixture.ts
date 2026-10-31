import { teamsInfo } from "lib/teamsInfo";
import type { GoalieAppearance } from "./goalieLedger";
import { buildGoalieInventory, type GoalieInventoryInput, type InventoryForecastInput, type InventoryNstRow, type InventoryObservationRow, type InventoryScheduleRow, type InventoryTeamGameRow } from "./goalieInventory.sources";

/**
 * Handoff fixture for `goalie-inventory-v1` (SS 11.6). Fictional goalies and invented numbers in a four-team league, run
 * through the real mapping so its shape cannot drift. It covers confirmed with no forecast, projected, no observation,
 * a qualified forecast, a raw probability refused as unavailable, a start split, relief and second nights.
 */
const SEASON = 20262027;
export const FIXTURE_TEAMS = ["MTL", "NJD", "NYR", "TOR"] as const;
export const FIXTURE_GENERATED_AT = "2026-11-02T15:00:00.000Z";
const id = (team: string) => teamsInfo[team].id;

type Side = { sf: number; xgf: number; scf: number; gf: number; ppo: number; ppg: number };
const PAST: readonly { gameId: number; date: string; home: string; away: string; homeSide: Side; awaySide: Side }[] = [
  { gameId: 900001, date: "2026-10-30", home: "NJD", away: "NYR", homeSide: { sf: 34, xgf: 3.2, scf: 31, gf: 4, ppo: 4, ppg: 2 }, awaySide: { sf: 25, xgf: 2.0, scf: 20, gf: 2, ppo: 2, ppg: 0 } },
  { gameId: 900002, date: "2026-10-30", home: "MTL", away: "TOR", homeSide: { sf: 22, xgf: 1.8, scf: 18, gf: 1, ppo: 3, ppg: 0 }, awaySide: { sf: 37, xgf: 3.9, scf: 36, gf: 5, ppo: 5, ppg: 2 } },
  { gameId: 900003, date: "2026-11-01", home: "NJD", away: "MTL", homeSide: { sf: 30, xgf: 2.7, scf: 28, gf: 3, ppo: 3, ppg: 1 }, awaySide: { sf: 28, xgf: 2.4, scf: 25, gf: 2, ppo: 4, ppg: 1 } },
  { gameId: 900004, date: "2026-11-01", home: "NYR", away: "TOR", homeSide: { sf: 27, xgf: 2.2, scf: 23, gf: 2, ppo: 1, ppg: 0 }, awaySide: { sf: 33, xgf: 3.1, scf: 30, gf: 3, ppo: 3, ppg: 1 } },
];
const teamRow = (team: string, opponent: string, gameId: number, date: string, own: Side, other: Side): InventoryTeamGameRow => ({ team_id: id(team), game_id: gameId, date, season_id: SEASON, opponent_id: id(opponent), goals_for: own.gf, goals_against: other.gf, pp_opportunities: own.ppo, power_play_goals_for: own.ppg, times_shorthanded: other.ppo, pp_goals_against: other.ppg });
const nstRow = (team: string, date: string, own: Side, other: Side): InventoryNstRow => ({ team_abbreviation: team, date, season_id: SEASON, situation: "all", sf: own.sf, sa: other.sf, xgf: own.xgf, xga: other.xgf, scf: own.scf, sca: other.scf, updated_at: "2026-11-02T09:55:05.317" });
const appearance = (goalieId: number, name: string, game: typeof PAST[number], team: string, started: boolean): GoalieAppearance => ({ goalieId, name, gameId: game.gameId, date: game.date, team, opponent: team === game.home ? game.away : game.home, home: team === game.home, started, wins: null, losses: null, otLosses: null, saves: null, shotsAgainst: null, goalsAgainst: null, toiSeconds: null, shutouts: null, qualityStart: null });
const observation = (gameId: number, team: string, goalieId: number, status: string, observedAt: string): InventoryObservationRow => ({ id: `obs-${gameId}-${goalieId}`, game_id: gameId, team_id: id(team), player_id: goalieId, observation_status: status, source_group: "fixture_source", source_url: "https://fixture.invalid/observation", observed_at: observedAt, available_at: observedAt, expires_at: null, supersedes_id: null, accepted: true });

export const FIXTURE_SCHEDULE: readonly InventoryScheduleRow[] = [
  ...PAST.map(game => ({ id: game.gameId, date: game.date, startTime: `${game.date}T23:00:00Z`, homeTeamId: id(game.home), awayTeamId: id(game.away) })),
  { id: 900010, date: "2026-11-02", startTime: "2026-11-02T23:00:00Z", homeTeamId: id("NYR"), awayTeamId: id("NJD") },
  { id: 900011, date: "2026-11-02", startTime: "2026-11-02T23:30:00Z", homeTeamId: id("TOR"), awayTeamId: id("MTL") },
  { id: 900012, date: "2026-11-04", startTime: "2026-11-04T23:00:00Z", homeTeamId: id("NJD"), awayTeamId: id("TOR") },
];
export const FIXTURE_STUDIO_FORECASTS: readonly InventoryForecastInput[] = [
  // Qualified: a Start Chart participation that matches its row.
  { gameId: 900011, goalieId: 7004, startProbability: 0.62, startParticipation: { revisionId: "fixture-revision", basis: "start", probability: 0.62, cutoffAt: "2026-11-02T10:00:00.000Z", issuedAt: "2026-11-02T11:00:00.000Z", expiresAt: "2026-11-02T23:30:00.000Z", model: { version: "goalie-rolling-14d-start-frequency-v1", event: "official_starter", probabilityStatus: "uncalibrated_model", calibration: "unavailable", limitations: [], sampleSize: 14 } } as InventoryForecastInput["startParticipation"] },
  // Refused: a raw `goalie_start_projections.start_probability`.
  { gameId: 900011, goalieId: 7005, startProbability: 0.71 },
];
export const FIXTURE_INPUT: GoalieInventoryInput = {
  request: { season: SEASON, from: "2026-11-02", through: "2026-11-04", generatedAt: FIXTURE_GENERATED_AT }, teams: FIXTURE_TEAMS,
  schedule: FIXTURE_SCHEDULE, scheduleFrom: "2026-08-01",
  teamGames: PAST.flatMap(game => [teamRow(game.home, game.away, game.gameId, game.date, game.homeSide, game.awaySide), teamRow(game.away, game.home, game.gameId, game.date, game.awaySide, game.homeSide)]),
  nst: PAST.flatMap(game => [nstRow(game.home, game.date, game.homeSide, game.awaySide), nstRow(game.away, game.date, game.awaySide, game.homeSide)]),
  appearances: [
    appearance(7001, "Éric Testeur", PAST[0], "NJD", true), appearance(7001, "Éric Testeur", PAST[2], "NJD", true), appearance(7002, "Sam Relief", PAST[2], "NJD", false),
    appearance(7003, "Mikko Søgaard", PAST[0], "NYR", true), appearance(7003, "Mikko Søgaard", PAST[3], "NYR", true),
    appearance(7004, "Jonas Šimek", PAST[1], "MTL", true), appearance(7004, "Jonas Šimek", PAST[2], "MTL", true),
    appearance(7005, "Ana Split", PAST[1], "TOR", true), appearance(7006, "Lee Split", PAST[3], "TOR", true),
  ],
  observations: [observation(900010, "NJD", 7001, "confirmed", "2026-11-02T14:00:00.000Z"), observation(900010, "NYR", 7003, "projected", "2026-11-02T13:00:00.000Z")],
  forecasts: FIXTURE_STUDIO_FORECASTS,
};
export const GOALIE_INVENTORY_FIXTURE_DETAIL = buildGoalieInventory(FIXTURE_INPUT);
/** What Player Cards builds against. */
export const GOALIE_INVENTORY_FIXTURE = GOALIE_INVENTORY_FIXTURE_DETAIL.inventory;
