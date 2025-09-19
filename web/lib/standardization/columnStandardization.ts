// /Users/tim/Desktop/fhfhockey.com/web/lib/standardization/columnStandardization.ts
import { titleCase } from "./nameStandardization"; // <--- ADD THIS IMPORT

export const defaultCanonicalColumnMap: Record<string, string> = {
  // Player Info
  player: "Player_Name",
  name: "Player_Name",
  "player name": "Player_Name",
  player_id: "player_id",
  team: "Team_Abbreviation",
  pos: "Position",
  position: "Position",

  // Standard Stats
  gp: "Games_Played",
  games: "Games_Played",
  g: "Goals",
  goals: "Goals",
  a: "Assists",
  assists: "Assists",
  p: "Points", // from Steve Laidlaw files
  pts: "Points",
  points: "Points",
  "+/-": "Plus_Minus",
  "plus/minus": "Plus_Minus",
  plusminus: "Plus_Minus",
  pim: "Penalty_Minutes",
  sog: "Shots_on_Goal",
  shots: "Shots_on_Goal",
  s: "Shots_on_Goal", // from A&G Aggregate
  "shot %": "Shooting_Percentage",
  "sh%": "Shooting_Percentage",
  gwg: "Game_Winning_Goals",
  gtg: "Game_Tying_Goals",

  // Power Play
  ppg: "PP_Goals",
  ppa: "PP_Assists",
  ppp: "PP_Points",
  "pp pts": "PP_Points",
  pptoi: "PP_TOI", // Power Play Time On Ice

  // Shorthanded
  shg: "SH_Goals",
  sha: "SH_Assists",
  shp: "SH_Points",
  shtoi: "SH_TOI", // Shorthanded Time On Ice

  // Peripherals
  hit: "Hits",
  hits: "Hits",
  blk: "Blocked_Shots",
  blks: "Blocked_Shots",
  blocks: "Blocked_Shots",

  // Faceoffs
  "fo%": "Faceoff_Percentage",
  fow: "Faceoffs_Won",
  fol: "Faceoffs_Lost",

  // Time on Ice
  toi: "Time_on_Ice_Overall", // usually total minutes or M:SS
  "toi/g": "Time_on_Ice_Per_Game",
  atoi: "Time_on_Ice_Per_Game", // from A&G, skaters_cat

  // Goalie Stats
  gs: "Games_Started_Goalie",
  w: "Wins_Goalie",
  l: "Losses_Goalie",
  gaa: "Goals_Against_Average",
  "sv%": "Save_Percentage",
  svp: "Save_Percentage",
  sv: "Saves_Goalie",
  so: "Shutouts_Goalie",

  // From Bangers
  stp: "STP",
  gp_risk: "GP_Risk",
  off: "OFF_Rating",
  bang: "BANG_Rating",
  // From A&G
  fpts__total: "Fantasy_Points_Total",
  fpts_per_gp: "Fantasy_Points_Per_Game"
};

export function standardizeColumnName(
  rawHeader: string,
  customMap?: Record<string, string>
): string {
  const map = { ...defaultCanonicalColumnMap, ...customMap };
  const lowerHeader = rawHeader?.toLowerCase().trim() || ""; // Add null/undefined check

  if (map[lowerHeader]) {
    return map[lowerHeader];
  }
  // Simple fallback: Title Case and replace spaces/special chars with underscore
  return titleCase(rawHeader?.replace(/[^a-zA-Z0-9_ ]/g, "") || "").replace(
    /\s+/g,
    "_"
  );
}
