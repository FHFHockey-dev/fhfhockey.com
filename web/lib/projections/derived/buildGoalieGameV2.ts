import type {
  ProjectionDerivedGame,
  ProjectionDerivedPbpPlayRow,
} from "./buildStrengthTablesV2";
import { parseSituationDigits } from "./situation";

export type ProjectionGoalieGameRow = {
  game_id: number;
  goalie_id: number;
  team_id: number;
  opponent_team_id: number;
  game_date: string;
  shots_against: number;
  goals_allowed: number;
  saves: number;
  toi_seconds: null;
};

export type ProjectionGoalieOutcome = "complete" | "not_observed";

export type ProjectionGoalieJustification =
  | "completed_pbp_contains_no_countable_shot_events"
  | "completed_pbp_countable_events_are_all_empty_net";

export type PreparedGoalieGameV2 = {
  rows: ProjectionGoalieGameRow[];
  outcome: ProjectionGoalieOutcome;
  justification: ProjectionGoalieJustification | null;
  emptyNetEvents: number;
};

function isShotAgainstEvent(typeDescKey: string | null): boolean {
  return typeDescKey === "shot-on-goal" || typeDescKey === "goal";
}

function goalieExpectedForDefendingTeam(args: {
  shooterTeamId: number;
  game: ProjectionDerivedGame;
  situationCode: string | null;
}): boolean {
  const digits = parseSituationDigits(args.situationCode);
  if (digits == null) {
    throw new Error(
      `Countable goalie PBP event has invalid situation metadata for game ${args.game.id}`,
    );
  }
  if (args.shooterTeamId === args.game.homeTeamId) {
    return digits.awayGoalie === 1;
  }
  if (args.shooterTeamId === args.game.awayTeamId) {
    return digits.homeGoalie === 1;
  }
  throw new Error(
    `Countable goalie PBP event has an unscheduled team for game ${args.game.id}`,
  );
}

/**
 * Prepares the complete goalie scope for one game without mutating storage.
 * A zero-row result is only valid when every countable event is explicitly an
 * empty-net event (or the completed PBP contains no countable shot events).
 */
export function prepareGoalieGameV2(args: {
  game: ProjectionDerivedGame;
  plays: ProjectionDerivedPbpPlayRow[];
}): PreparedGoalieGameV2 {
  const { game, plays } = args;
  type GoalieAgg = { shotsAgainst: number; goalsAllowed: number };
  const byTeamGoalie = new Map<string, GoalieAgg>();
  let countableEvents = 0;
  let emptyNetEvents = 0;

  for (const play of plays) {
    if (!isShotAgainstEvent(play.typedesckey)) continue;
    countableEvents += 1;
    const shooterTeamId = play.eventownerteamid;
    if (
      shooterTeamId !== game.homeTeamId &&
      shooterTeamId !== game.awayTeamId
    ) {
      throw new Error(
        `Countable goalie PBP event has an unscheduled team for game ${game.id}`,
      );
    }
    const goalieExpected = goalieExpectedForDefendingTeam({
      shooterTeamId,
      game,
      situationCode: play.situationcode,
    });
    if (play.goalieinnetid == null) {
      if (goalieExpected) {
        throw new Error(
          `Countable non-empty-net PBP event is missing a goalie for game ${game.id}`,
        );
      }
      emptyNetEvents += 1;
      continue;
    }
    if (
      !goalieExpected ||
      !Number.isSafeInteger(play.goalieinnetid) ||
      play.goalieinnetid <= 0
    ) {
      throw new Error(
        `Countable goalie PBP event has contradictory goalie metadata for game ${game.id}`,
      );
    }

    const defendingTeamId =
      shooterTeamId === game.homeTeamId ? game.awayTeamId : game.homeTeamId;
    const key = `${defendingTeamId}:${play.goalieinnetid}`;
    const current = byTeamGoalie.get(key) ?? {
      shotsAgainst: 0,
      goalsAllowed: 0,
    };
    current.shotsAgainst += 1;
    if (play.typedesckey === "goal") current.goalsAllowed += 1;
    byTeamGoalie.set(key, current);
  }

  const rows = Array.from(byTeamGoalie.entries())
    .map(([key, aggregate]): ProjectionGoalieGameRow => {
      const [teamIdText, goalieIdText] = key.split(":");
      const teamId = Number(teamIdText);
      const goalieId = Number(goalieIdText);
      return {
        game_id: game.id,
        goalie_id: goalieId,
        team_id: teamId,
        opponent_team_id:
          teamId === game.homeTeamId ? game.awayTeamId : game.homeTeamId,
        game_date: game.date,
        shots_against: aggregate.shotsAgainst,
        goals_allowed: aggregate.goalsAllowed,
        saves: aggregate.shotsAgainst - aggregate.goalsAllowed,
        toi_seconds: null,
      };
    })
    .sort(
      (left, right) =>
        left.team_id - right.team_id || left.goalie_id - right.goalie_id,
    );

  if (rows.length > 4) {
    throw new Error(
      `Goalie scope exceeds four observed goalies for game ${game.id}`,
    );
  }
  if (rows.length > 0) {
    return {
      rows,
      outcome: "complete",
      justification: null,
      emptyNetEvents,
    };
  }

  const justification =
    countableEvents === 0
      ? "completed_pbp_contains_no_countable_shot_events"
      : "completed_pbp_countable_events_are_all_empty_net";
  return {
    rows: [],
    outcome: "not_observed",
    justification,
    emptyNetEvents,
  };
}
