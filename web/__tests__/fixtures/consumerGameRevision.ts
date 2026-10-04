import type { ForgeGameRevision } from "lib/projections/gameRevisions";
import { forgeRosterRevision, forgeScheduleRevision, type ForgeIssuedContextV1 } from "lib/projections/issuedContext";
import type { PlanningPlayer } from "lib/rosterScheduleOptimizer/planningTypes";

/** Synthetic shared consumer scope; no account or hosted source data. */
export function consumerGameRevisionFixture() {
  const date = "2026-02-07", seasonId = 20252026, gameId = 1001;
  const now = new Date("2026-02-07T17:00:00Z");
  const startTime = "2026-02-07T23:00:00Z";
  const membershipCreatedAt = ["2025-09-01T00:00:00Z"];
  const members = [
    { canonicalId: 7, nhlId: 8478402, seasonId, teamId: 8, membershipCreatedAt, identityUpdatedAt: null },
    { canonicalId: 8, nhlId: 8478403, seasonId, teamId: 8, membershipCreatedAt, identityUpdatedAt: null },
  ].map(row => ({ ...row, revision: forgeRosterRevision(row) }));
  const scheduleRows = [8, 10].map((teamId, index) => ({
    id: index + 1, source_game_id: gameId, source_season_id: seasonId, game_type: 2,
    game_date: date, start_time: startTime, team_id: teamId, opponent_team_id: teamId === 8 ? 10 : 8,
    team_abbreviation: teamId === 8 ? "MTL" : "TOR", opponent_abbreviation: teamId === 8 ? "TOR" : "MTL",
    home_away: teamId === 8 ? "away" : "home", game_status: "FUT", schedule_status: "OK",
    fetched_at: "2026-02-07T11:00:00Z", source_updated_at: null, is_countable: true,
  }));
  const game = { id: gameId, date, seasonId, startTime, homeTeamId: 10, awayTeamId: 8 };
  const issued: ForgeIssuedContextV1 = {
    version: "forge-issued-context-v1", game, observedAt: "2026-02-07T12:00:00Z",
    schedule: scheduleRows.map(row => ({
      gameKey: "nhl", season: "2025", sourceSeasonId: seasonId, teamId: row.team_id,
      opponentTeamId: row.opponent_team_id, teamAbbreviation: row.team_abbreviation,
      opponentAbbreviation: row.opponent_abbreviation, startTime, gameStatus: "FUT", scheduleStatus: "OK",
      sourceUpdatedAt: null, fetchedAt: row.fetched_at, revision: forgeScheduleRevision(row),
    })), roster: members,
  };
  const players: PlanningPlayer[] = members.map((row, index) => ({
    id: String(row.canonicalId), nhlId: row.nhlId, nhlTeamId: row.teamId, rosterRevision: row.revision,
    name: index ? "Fixture goalie" : "Fixture skater", playerClass: index ? "goalie" : "skater",
    teamAbbreviation: "MTL", eligiblePositions: index ? ["G"] : ["C"], eligibilityVerified: false,
    availability: "unknown", ownership: null, canDrop: null, holdValue: null, reserveEligibility: [],
  }));
  const projection = {
    run_id: "published-run", as_of_date: date, horizon_games: 1, game_id: gameId, player_id: 8478402,
    team_id: 8, opponent_team_id: 10, proj_goals_es: 0.4, proj_goals_pp: 0.2, proj_goals_pk: 0,
    proj_assists_es: 0.5, proj_assists_pp: 0.1, proj_assists_pk: 0, proj_shots_es: 2.7,
    proj_shots_pp: 0.8, proj_shots_pk: 0, proj_hits: 0.6, proj_blocks: 0.4, proj_pim: 0.1,
    uncertainty: { model: { skater_selection: { production_conditioning: "conditional_playing",
      participation: { version: "skater-participation-v1", probability: 1,
        status: "confirmed_evidence", evidenceIds: ["synthetic-lineup"] } } } },
  };
  const revision: ForgeGameRevision = {
    id: "revision-1", run_id: "published-run", game_id: gameId,
    decision_as_of: "2026-02-07T12:00:00Z", published_at: "2026-02-07T12:01:00Z",
    payload: {
      players: [projection], teams: [], goalies: [], goalieStarts: [], codeVersion: "commit-123", modelMode: "baseline",
      inputCutoff: "2026-02-07T11:59:00Z", calculatedAt: "2026-02-07T12:00:30Z",
      inputProvenance: {
        rolling_player_history_contract: "full_selected_scope_through_end_date_v1",
        capturedReads: { version: "forge-captured-reads-v1", hash: "a".repeat(64), readCount: 2,
          firstReceivedAt: "2026-02-07T11:59:00Z", lastReceivedAt: "2026-02-07T12:00:00Z" },
        issuedContexts: [issued],
      },
    },
  };
  return { date, seasonId, gameId, now, game, players, scheduleRows, issued, revision };
}
