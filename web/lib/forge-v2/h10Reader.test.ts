import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveMembership } from "./denominator";
import { h10InputsFromRows, H10InputRows, inferredLogReceipt } from "./h10Reader.server";
import { parseReceiptKeys } from "./denominatorReceipts";

/** Astra's 2026-11-23 receipts fed through the hosted reader. A rosters-only feed reproduces the audit failure:
 * the trade is invisible until the official roster updates, which is why an official transactions source is a
 * blocker for the hosted run (packet B4). */
const receipts = join(__dirname, "../../../tasks/artifacts/forge-full-nhl-h10-2026-11-23/astra-audit-receipts");
describe.runIf(existsSync(receipts))("hosted reader on the audit's roster state", () => {
  const rows = parseReceiptKeys(readFileSync(join(receipts, "player-game-keys.csv"), "utf8")).filter(row => row.horizon === 1);
  const asOf = "2026-11-23T10:05:00.000Z";
  const rosterRows = (otherSeen: string): H10InputRows["rosters"] => rows.map(row => ({ player_id: String(row.playerId), team_id: row.teamId,
    official_seen_at: row.basis === "official" ? "2026-11-23T09:30:00.000Z" : otherSeen, position: row.playerClass === "G" ? "G" : "C" }));
  const team = (otherSeen: string) => {
    const { evidence } = h10InputsFromRows({ games: [], rosters: rosterRows(otherSeen), logs: [] }, { asOf, seasonId: 20262027, logIngestUtcMinute: 450, gameHours: 3.5, rosterMaxAgeHours: 36 });
    const resolved = resolveMembership(evidence, asOf);
    return (playerId: number) => resolved.members.find(m => m.affiliation.playerId === playerId)?.affiliation.teamId
      ?? resolved.unresolved.find(u => u.playerId === playerId)?.reason ?? "absent";
  };
  it("infers a line's receipt as the next 07:30 UTC WGO ingest after the game ends", () => {
    expect(inferredLogReceipt("2026-11-23T00:00:00.000Z", 450, 3.5)).toBe("2026-11-23T07:30:00.000Z"); // 19:00 ET start
    expect(inferredLogReceipt("2026-11-23T03:30:00.000Z", 450, 3.5)).toBe("2026-11-23T07:30:00.000Z"); // 22:30 ET start
    expect(inferredLogReceipt("2026-11-23T05:00:00.000Z", 450, 3.5)).toBe("2026-11-24T07:30:00.000Z"); // ends after the run
  });
  it("keeps Dach and Montembeault on Montréal and Larkin on Detroit or unverified: the trade needs a transactions source", () => {
    const recent = team("2026-11-22T12:00:00.000Z"), stale = team("2026-11-10T12:00:00.000Z");
    expect([recent(8481523), recent(8478470), recent(8477946)]).toEqual([8, 8, 17]);
    expect([stale(8481523), stale(8478470), stale(8477946)]).toEqual([8, 8, "unverified_affiliation"]);
  });
});

/** The approved 2026-11-23 goalie read: `teams` lists UTA twice (Utah HC 59 and Utah Mammoth 68), so the abbreviation
 * join returned every Utah line twice. The schedule decides which club played; nothing is picked by position. */
describe("club mapping when an abbreviation names two clubs", () => {
  const options = { asOf: "2026-11-23T17:20:00.000Z", seasonId: 20262027, logIngestUtcMinute: 450, gameHours: 3.5, rosterMaxAgeHours: 36 };
  const game = (id: string, home: number, away: number, date: string) => ({ id, season_id: "20262027", type: 2, home_team_id: home, away_team_id: away, date,
    start_time: `${date}T23:00:00.000Z`, game_schedule_state: "OK", game_state: "OFF", observed_at: "2026-11-23T10:05:00.000Z" });
  const games = [game("2026020100", 68, 8, "2026-10-20"), game("2026020101", 17, 68, "2026-10-22"), game("2026020102", 10, 13, "2026-10-22"), game("2026020103", 10, 22, "2026-10-22")];
  const skater = (player: number, gameId: string, team: number, opponent: number) => ({ player_id: player, game_id: gameId, season_id: 20262027, team_id: team, opponent_id: opponent,
    home_road: team === games.find(g => g.id === gameId)!.home_team_id ? "H" : "R", goals: 1, assists: 0, pp_points: 0, shots: 3, hits: 1, blocked_shots: 0, penalty_minutes: 0, start_time: `${games.find(g => g.id === gameId)!.date}T23:00:00.000Z` });
  const goalie = (player: number, date: string, team: number) => ({ player_id: player, date, season_id: 20262027, team_id: team, games_played: 1, games_started: 1, wins: 1, saves: 25,
    goals_against: 2, shots_against: 27, shutouts: 0 });

  it("keeps the copy whose club played, and names every dropped copy", () => {
    const { logs, goalieLogs, dropped } = h10InputsFromRows({ games, rosters: [], logs: [
      skater(1, "2026020100", 59, 8), skater(1, "2026020100", 68, 8), // Utah skater, both UTA clubs
      skater(2, "2026020100", 8, 59), skater(2, "2026020100", 8, 68), // Montréal skater against both UTA clubs
    ], goalieLogs: [goalie(10, "2026-10-20", 59), goalie(10, "2026-10-20", 68), goalie(11, "2026-10-22", 17)] }, options);
    expect(logs.map(l => [l.playerId, l.teamId, l.opponentId])).toEqual([[1, 68, 8], [2, 8, 68]]);
    expect(goalieLogs.map(l => [l.playerId, l.gameId, l.teamId, l.opponentId, l.home])).toEqual([[10, 2026020100, 68, 8, true], [11, 2026020101, 17, 68, true]]);
    expect(dropped).toEqual({ log_club_not_in_game: 2, goalie_line_alias_club_without_game: 1 });
  });

  it("drops lines it cannot place, whole, instead of guessing", () => {
    const { logs, goalieLogs, dropped } = h10InputsFromRows({ games, rosters: [], logs: [
      skater(3, "2026020100", 68, 8), skater(3, "2026020100", 68, 8), // the same player/game listed twice
      { ...skater(4, "2026020100", 68, 8), game_id: "2026029999" }, // a game outside the schedule
    ], goalieLogs: [
      goalie(12, "2026-10-21", 68), // no game that date
      goalie(13, "2026-10-22", 17), goalie(13, "2026-10-22", 68), // both clubs played that day (each other): not placeable
      goalie(14, "2026-10-22", 10), // Toronto is listed in two games that date
    ] }, options);
    expect(logs).toEqual([]);
    expect(goalieLogs).toEqual([]);
    expect(dropped).toEqual({ log_game_not_in_schedule: 1, log_player_game_listed_twice: 2, goalie_line_without_game: 1, goalie_line_several_clubs_played: 2, goalie_line_club_several_games_on_date: 1 });
  });
});
