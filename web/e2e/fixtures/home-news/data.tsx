import React from "react";
import type { NewsFeedItem } from "lib/newsFeed";
import { teamsInfo } from "lib/teamsInfo";

const season = { seasonId: 20262027, numberOfGames: 82, regularSeasonStartDate: "2026-10-01", regularSeasonEndDate: "2027-04-30" };
export const useCurrentSeason = () => season;
export function Image({ src, alt, width, height, className, style, onError }: any) {
  const logo = src.match(/\/([A-Z]+)_light\.svg/)?.[1];
  const local = src.startsWith("https:") ? `/teamLogos/${!logo || logo === "NHL" ? "FHFH" : logo}.png` : src;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={local} alt={alt} width={width} height={height} className={className} style={{ maxWidth: "100%", height: "auto", ...style }} onError={onError} />;
}

const divisions = {
  Atlantic: ["BOS", "BUF", "DET", "FLA", "MTL", "OTT", "TBL", "TOR"],
  Metropolitan: ["CAR", "CBJ", "NJD", "NYI", "NYR", "PHI", "PIT", "WSH"],
  Central: ["CHI", "COL", "DAL", "MIN", "NSH", "STL", "UTA", "WPG"],
  Pacific: ["ANA", "CGY", "EDM", "LAK", "SEA", "SJS", "VAN", "VGK"],
};
const standings = Array.from({ length: 13 }, (_, gp) => Object.entries(divisions).flatMap(([division, teams]) =>
  teams.map((abbr, index) => ({ date: `2026-10-${String(gp + 1).padStart(2, "0")}`, team_name_default: teamsInfo[abbr].name,
    games_played: gp, point_pctg: 0.5, points: Math.max(0, gp + Math.round(gp * (index - 3) / 5)),
    goal_against: gp * 3, goal_for: gp * 3.2, conference_abbrev: ["Atlantic", "Metropolitan"].includes(division) ? "E" : "W", division_name: division })))).flat();
export const supabase = { from(table: string) {
  const query: any = {};
  for (const method of ["select", "gte", "lte", "order"]) query[method] = () => query;
  query.range = async (start: number, end: number) => ({ data: table === "nhl_standings_details" ? standings.slice(start, end + 1) : [], error: null });
  return query;
} };

/** A validated public lineup: interpreter units bound to the card's team (practice posts need no game). */
const lineup = (teamId: number, units: Array<[string, number, Array<string>, boolean?]>, context = "practice", gameId: number | null = null) => {
  const roster: string[] = [];
  let playerId = 0;
  const built = units.map(([situation, number, names, complete = true]) => ({ situation, number, group: null, complete,
    players: names.map((name) => { playerId++; roster.push(`${playerId}:${name}:${name}:${teamId}:C`); return { playerId, name }; }) }));
  return { newsLineup: { version: 1, binding: { teamId, gameId, sourceTweetId: "123" },
    interpretation: { context, certainty: "reported", rosterRevision: roster.join("|"), unresolved: [], units: built } } };
};

const base: NewsFeedItem = {
  id: "fixture", source_review_item_id: null, source_tweet_id: null, source_url: "https://x.com/ExampleReporter/status/123",
  tweet_url: null, source_label: "Example Reporter", source_account: "@ExampleReporter", team_id: 3,
  team_abbreviation: "NYR", headline: "NYR line combination update", blurb: "Captured practice lines for this synthetic article snapshot.",
  category: "LINE COMBINATION", subcategory: "PRACTICE LINES", card_status: "published", observed_at: "2026-10-19T14:55:00Z",
  published_at: "2026-10-19T15:00:00Z", created_at: "2026-10-19T15:00:00Z", updated_at: "2026-10-19T15:00:00Z", players: [],
  metadata: lineup(3, [
    ["es_forward", 1, ["Captured Left A", "Captured Centre A", "Captured Right A"]], ["es_forward", 2, ["Captured Left B", "Very Long Compound-Surname", "Captured Right B"]],
    ["es_forward", 3, ["Captured Left C", "Captured Centre C", "Captured Right C"]], ["es_forward", 4, ["Captured Left D", "Captured Centre D", "Captured Right D"]],
    ["es_defense", 1, ["Captured Defense A", "Captured Defense B"]], ["es_defense", 2, ["Captured Defense C", "Captured Defense D"]],
    ["es_defense", 3, ["Captured Defense E", "Captured Defense F"]],
  ]),
};
export const items: NewsFeedItem[] = [base, {
  ...base, id: "pp", team_id: 10, team_abbreviation: "TOR", headline: "TOR power-play update", subcategory: "POWER PLAY",
  metadata: lineup(10, [["pp", 1, ["Captured PP A", "Captured PP B", "Captured PP C", "Captured PP D", "Captured PP E"]]], "game", 2026020001),
}, {
  ...base, id: "unknown", team_id: 99, team_abbreviation: "ZZZ", headline: "Unknown-team partial snapshot", subcategory: "GAME ENTRY",
  metadata: lineup(99, [["es_forward", 2, ["Supplied Player", "Unresolved", "Other Supplied Player"], false], ["es_defense", 1, ["Only Supplied Defender", "Partner"]],
    ["goalie", 1, ["Supplied Goalie"]]], "game", 2026020002),
}, { ...base, id: "missing", team_id: 10, team_abbreviation: "TOR", metadata: null, headline: "TOR PP source report", subcategory: "POWER PLAY" }, {
  ...base, id: "ordinary", team_abbreviation: "MTL", category: "NEWS UPDATE", subcategory: null, headline: "Ordinary source report",
  blurb: "An ordinary article remains a source report without a lineup grid.", metadata: null,
}];
