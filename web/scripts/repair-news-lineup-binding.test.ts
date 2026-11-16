import { describe, expect, it } from "vitest";
import { planNewsLineupRepair, type RepairItem, type RepairSource } from "./repair-news-lineup-binding";
import { interpretTweetUnits } from "../lib/sources/tweetInterpretation";

const ANA = 24, GAME = 2026020328, TWEET = "2122126809533923555";
const roster = [["Judd Caulfield", "R"], ["Leo Carlsson", "C"], ["Cutter Gauthier", "L"], ["Jackson LaCombe", "D"], ["Drew Helleson", "D"]]
  .map(([fullName, position], index) => ({ playerId: index + 1, fullName: fullName!, lastName: fullName!.split(" ").pop()!, position, teamId: ANA }));
const text = "RT @ZachCav: Anaheim Ducks warm-up line rushes 11/15 vs. #Flames:\n\nCaulfield-Carlsson-Gauthier\n\nLaCombe-Helleson";
const interpretation = interpretTweetUnits(text, roster);
// The published card's saved shape: text-split lineupCard, no newsLineup.
const item: RepairItem = { id: "flames-card", team_id: ANA, category: "LINE COMBINATION", published_at: "2026-11-16T04:00:11Z",
  original_tweet_id: TWEET, source_tweet_id: "relay", source_url: null,
  metadata: { lineupCard: { defensePairs: [["RT @ZachCav: Anaheim Ducks warm", "up line rushes 11/15 vs. #Flames:"]] } } };
const source = (overrides: Partial<RepairSource> = {}): RepairSource => ({ table: "line_source_snapshots", capture_key: "a", tweet_id: TWEET,
  quoted_tweet_id: null, team_id: ANA, game_id: GAME, interpretation, ...overrides });
const games = [{ id: GAME, date: "2026-11-15", homeTeamId: ANA, awayTeamId: 20 }];

describe("one-time News lineup binding repair (dry-run planner)", () => {
  it("binds the card to the retained report's single NHL game and previews only validated tiles", () => {
    const plan = planNewsLineupRepair({ item, sources: [source(), source({ table: "lines_ccc", capture_key: "b" })], games });
    expect(plan).toMatchObject({ status: "repairable", gameId: GAME, sources: ["line_source_snapshots:a", "lines_ccc:b"],
      tiles: [["F1", "Judd Caulfield-Leo Carlsson-Cutter Gauthier"], ["D1", "Jackson LaCombe-Drew Helleson"]] });
    expect(plan.newsLineup?.binding).toEqual({ teamId: ANA, gameId: GAME, sourceTweetId: TWEET });
    expect(JSON.stringify(plan.tiles)).not.toContain("ZachCav");
  });

  it("leaves the card source-only when the match is ambiguous or the game is wrong", () => {
    const reason = (sources: RepairSource[], gameRows = games, card = item) => planNewsLineupRepair({ item: card, sources, games: gameRows }).reason;
    expect(reason([source(), source({ capture_key: "b", game_id: GAME + 1 })])).toBe("retained reports name more than one game");
    expect(reason([source(), source({ capture_key: "b", interpretation: interpretTweetUnits("Caulfield-Carlsson-Gauthier", roster) })])).toBe("retained reports disagree on units");
    expect(reason([source({ game_id: null })])).toBe("retained reports carry no game id");
    expect(reason([source({ team_id: 20 })])).toBe("no retained report with units for this tweet and team");
    expect(reason([source()], [{ ...games[0]!, date: "2026-11-14" }])).toBe("game does not involve the team on the post's Eastern date");
    expect(reason([source()], [{ ...games[0]!, homeTeamId: 1, awayTeamId: 2 }])).toBe("game does not involve the team on the post's Eastern date");
    expect(planNewsLineupRepair({ item: { ...item, metadata: { newsLineup: {} } }, sources: [source()], games }).status).toBe("already_bound");
  });
});
