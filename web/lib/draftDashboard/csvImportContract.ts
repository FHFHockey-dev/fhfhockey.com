import type { StatDefinition } from "lib/projectionsConfig/statsMasterList";

export const CSV_IDENTITY_COLUMNS = [
  "Player_Name",
  "Team_Abbreviation",
  "Position"
] as const;

export const MINIMUM_SKATER_CSV_STATS: ReadonlyArray<{
  key: StatDefinition["key"];
  column: string;
}> = [
  { key: "GAMES_PLAYED", column: "Games_Played" },
  { key: "GOALS", column: "Goals" },
  { key: "ASSISTS", column: "Assists" },
  { key: "POINTS", column: "Points" },
  { key: "PP_POINTS", column: "PP_Points" },
  { key: "SHOTS_ON_GOAL", column: "Shots_on_Goal" },
  { key: "HITS", column: "Hits" },
  { key: "BLOCKED_SHOTS", column: "Blocked_Shots" }
];

export const MINIMUM_GOALIE_CSV_STATS: ReadonlyArray<{
  key: StatDefinition["key"];
  column: string;
}> = [
  { key: "GAMES_PLAYED", column: "Games_Started_Goalie" },
  { key: "WINS_GOALIE", column: "Wins_Goalie" },
  { key: "GOALS_AGAINST_AVERAGE", column: "Goals_Against_Average" },
  { key: "SAVE_PERCENTAGE", column: "Save_Percentage" },
  { key: "SHUTOUTS_GOALIE", column: "Shutouts_Goalie" }
];

export function getRequiredCsvColumns(playerType: "skater" | "goalie") {
  const stats =
    playerType === "goalie"
      ? MINIMUM_GOALIE_CSV_STATS
      : MINIMUM_SKATER_CSV_STATS;
  return [...CSV_IDENTITY_COLUMNS, ...stats.map((stat) => stat.column)];
}
