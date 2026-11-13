import { readFileSync } from "node:fs";
import path from "node:path";

import { normalizeGame, type Game } from "./model";

/**
 * Test support (decision 152): a replay Game built from the stored-row fixtures in __tests__/ppShare/fixtures
 * (stored PBP, type-517 shift rows, roster spots), put into the live feeds' shapes the replay reads.
 */
type Fixture = {
  gameId: number; date: string; homeTeamId: number; awayTeamId: number; gameType: number;
  events: Array<Array<string | number | null>>; shifts: number[][]; roster: Array<[number, number, string]>;
};

const clock = (seconds: number) =>
  `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

export function storedFixture(gameId: number): Fixture {
  return JSON.parse(readFileSync(path.join(__dirname, "../../__tests__/ppShare/fixtures", `${gameId}.json`), "utf8"));
}

export function storedFixtureGame(gameId: number): Game {
  const f = storedFixture(gameId);
  const plays = f.events.map((e) => {
    const details: Record<string, unknown> = {};
    const set = (key: string, value: unknown) => { if (value != null) details[key] = value; };
    set("eventOwnerTeamId", e[8]); set("typeCode", e[9]); set("descKey", e[10]); set("duration", e[11]);
    set("committedByPlayerId", e[12]); set("servedByPlayerId", e[13]); set("scoringPlayerId", e[14]); set("shootingPlayerId", e[15]);
    return { eventId: e[0], sortOrder: e[1], periodDescriptor: { number: e[2], periodType: e[3] }, timeInPeriod: e[4],
      timeRemaining: e[5], situationCode: e[6], typeDescKey: e[7], details };
  });
  const shifts = f.shifts.map(([playerId, teamId, period, start, end], i) => ({
    id: i + 1, gameId: f.gameId, playerId, teamId, period, startTime: clock(start), endTime: clock(end),
    duration: clock(end - start), firstName: "P", lastName: String(playerId), teamName: `Team ${teamId}`
  }));
  const lastPeriod = Math.max(...f.events.map((e) => e[2] as number));
  const lastType = f.events.find((e) => e[2] === lastPeriod)?.[3] ?? "REG";
  const team = (id: number) => ({ id, abbrev: `T${id}`, placeName: { default: "Team" }, commonName: { default: String(id) }, score: 0 });
  const side = (teamId: number) => {
    const players = f.roster.filter(([, t]) => t === teamId).map(([playerId, , position]) =>
      ({ playerId, name: { default: `Player ${playerId}` }, position, sweaterNumber: 0 }));
    return { forwards: players.filter((p) => !["D", "G"].includes(p.position)), defense: players.filter((p) => p.position === "D"),
      goalies: players.filter((p) => p.position === "G") };
  };
  const box = { id: f.gameId, gameType: f.gameType, gameDate: f.date, gameState: "OFF", gameScheduleState: "OK",
    periodDescriptor: { number: lastPeriod, periodType: lastType }, clock: { secondsRemaining: 0 },
    homeTeam: team(f.homeTeamId), awayTeam: team(f.awayTeamId),
    playerByGameStats: { homeTeam: side(f.homeTeamId), awayTeam: side(f.awayTeamId) } };
  return normalizeGame(box, { data: shifts }, { plays });
}
