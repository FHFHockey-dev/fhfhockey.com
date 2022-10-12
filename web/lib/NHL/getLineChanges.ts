import supabase from "lib/supabase";
import { RowData, Team } from "pages/lines";
import { getTeamLogo } from "hooks/usePlayer";
import { fetchNHL } from "./NHL_API";

type Param = {
  forwards?: boolean;
  defensemen?: boolean;
  goalies?: boolean;
};

export default async function getLineChanges(
  { forwards = true, defensemen = true, goalies = true }: Param = {
    forwards: true,
    defensemen: true,
    goalies: true,
  }
) {
  const teams: Team[] = ((await fetchNHL("/teams")).teams as any[])
    .map((team) => ({
      name: team.name,
      abbreviation: team.abbreviation,
      logo: getTeamLogo(team.name),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const allTeamLineUps = (
    await Promise.all(
      teams.map(async (team) => {
        const { data: line_combinations } = await supabase
          .from("line_combinations")
          .select(
            "date, team_name, team_abbreviation, forwards, defensemen, goalies"
          )
          .eq("team_name", team.name)
          .order("date")
          .limit(2);
        return line_combinations;
      })
    )
  ).filter((el) => el?.length === 2) as [any, any][];

  const players: { [playerId: number]: RowData } = {};
  for (const [previous, current] of allTeamLineUps) {
    const parse = (type: "forwards" | "defensemen" | "goalies") => {
      for (const [line, playersOfLine] of Object.entries<any>(previous[type])) {
        const lineNumber = Number(line.charAt(line.length - 1));
        for (const player of playersOfLine) {
          players[player.playerId] = {
            playerName: player.playerName,
            abbreviation: previous.team_abbreviation,
            playerId: player.playerId,
            previousLine: lineNumber,
            currentLine: null,
            previousPowerPlayerUnit: null, // placeholder
            currentPowerPlayerUnit: null, // placeholder
          };
        }
      }

      for (const [line, playersOfLine] of Object.entries<any>(current[type])) {
        const lineNumber = Number(line.charAt(line.length - 1));
        for (const player of playersOfLine) {
          // a player who was in the previous lineup and still in the current lineup
          if (players[player.playerId]) {
            players[player.playerId] = {
              ...players[player.playerId],
              currentLine: lineNumber,
            };
          } else {
            // a player who was not in the previous lineup, and appears in the current lineup. e.g. new player
            players[player.playerId] = {
              playerName: player.playerName,
              abbreviation: previous.team_abbreviation,
              playerId: player.playerId,
              previousLine: null,
              currentLine: lineNumber,
              previousPowerPlayerUnit: null, // placeholder
              currentPowerPlayerUnit: null, // placeholder
            };
          }
        }
      }
    };

    forwards && parse("forwards");
    defensemen && parse("defensemen");
    goalies && parse("goalies");
  }

  const promotions: RowData[] = [];
  const demotions: RowData[] = [];

  for (const player of Object.values(players)) {
    // hide players who don't have line changes
    if (player.previousLine !== player.currentLine) {
      if (isPromotion(player.previousLine, player.currentLine)) {
        promotions.push(player);
      } else {
        demotions.push(player);
      }
    }
  }

  const {
    data: { date },
  } = await supabase
    .from("line_combinations")
    .select("date")
    .order("date", { ascending: false })
    .limit(1)
    .single();

  return {
    teams,
    promotions,
    demotions,
    lastUpdated: date,
  };
}

/**
 * Test if a player is in promotion.
 * @param previous previous line number
 * @param current current line number
 * @returns true if the player is in promotion, otherwise false
 */
export function isPromotion(previous: number | null, current: number | null) {
  if (current === null) {
    return false;
  } else if (previous === null) {
    return true;
  }
  // the smaller the better
  if (current < previous) {
    return true;
  } else if (current > previous) {
    return false;
  }
}
