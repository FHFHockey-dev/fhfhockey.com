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

const base: NewsFeedItem = {
  id: "fixture", source_review_item_id: null, source_tweet_id: null, source_url: "https://x.com/ExampleReporter/status/123",
  tweet_url: null, source_label: "Example Reporter", source_account: "@ExampleReporter", team_id: null,
  team_abbreviation: "NYR", headline: "NYR line combination update", blurb: "Captured practice lines for this synthetic article snapshot.",
  category: "LINE COMBINATION", subcategory: "PRACTICE LINES", card_status: "published", observed_at: "2026-10-19T14:55:00Z",
  published_at: "2026-10-19T15:00:00Z", created_at: "2026-10-19T15:00:00Z", updated_at: "2026-10-19T15:00:00Z", players: [],
  metadata: { lineupCard: { forwards: [
    ["Captured Left A", "Captured Centre A", "Captured Right A"], ["Captured Left B", "Very Long Compound-Surname", "Captured Right B"],
    ["Captured Left C", "Captured Centre C", "Captured Right C"], ["Captured Left D", "Captured Centre D", "Captured Right D"],
  ], defensePairs: [["Captured Defense A", "Captured Defense B"], ["Captured Defense C", "Captured Defense D"], ["Captured Defense E", "Captured Defense F"]], goalies: [] } },
};
export const items: NewsFeedItem[] = [base, {
  ...base, id: "pp", team_abbreviation: "TOR", headline: "TOR power-play update", subcategory: "POWER PLAY",
  metadata: { interpretation: { context: "game", unresolved: [], units: [{ situation: "pp", number: 1, group: null, complete: true,
    players: ["Captured PP A", "Captured PP B", "Captured PP C", "Captured PP D", "Captured PP E"].map((name) => ({ name })) }] } },
}, {
  ...base, id: "unknown", team_abbreviation: "ZZZ", headline: "Unknown-team partial snapshot", subcategory: "GAME ENTRY",
  metadata: { lineupCard: { forwards: [[], ["Supplied Player", null, "Other Supplied Player"]], defensePairs: [["Only Supplied Defender"]], goalies: ["Supplied Goalie"] } },
}, { ...base, id: "missing", team_abbreviation: "TOR", headline: "TOR PP source report", subcategory: "POWER PLAY" }, {
  ...base, id: "ordinary", team_abbreviation: "MTL", category: "NEWS UPDATE", subcategory: null, headline: "Ordinary source report",
  blurb: "An ordinary article remains a source report without a lineup grid.", metadata: null,
}];
