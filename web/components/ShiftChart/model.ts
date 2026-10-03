import getPowerPlayBlocks from "utils/getPowerPlayBlocks";
import type { PlayerData, TOIData, Mode } from "components/LinemateMatrix";

export type Interval = { start: number; end: number };
export type Period = {
  number: number;
  label: string;
  start: number;
  duration: number;
};
export type Team = {
  id: number;
  abbrev: string;
  name: string;
  logo: string;
  score: number;
};
export type Player = PlayerData & { shifts: Interval[]; order: number };
export type ReplayEvent = {
  id: number;
  time: number;
  teamId: number;
  playerId: number;
  goal: boolean;
};
export type PowerPlay = Interval & { teamId: number };
export type Game = {
  id: number;
  date: string;
  home: Team;
  away: Team;
  players: Player[];
  periods: Period[];
  duration: number;
  axisDuration: number;
  events: ReplayEvent[];
  powerPlays: PowerPlay[];
  shootout: boolean;
};
export type ScheduleGame = {
  id: number;
  date: string;
  home: string;
  away: string;
  state: string;
};
export type TimelineFilter = "all" | "active" | "F" | "D" | "G";
type JsonObject = Record<string, unknown>;
type Play = {
  eventId: number;
  typeDescKey: string;
  timeInPeriod: string;
  periodDescriptor: { number: number; periodType: string };
  details: JsonObject;
};

export class UnavailableGameError extends Error {
  constructor(
    message: string,
    public readonly date: string,
  ) {
    super(message);
  }
}

function object(value: unknown, label: string): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Missing or invalid ${label}.`);
  }
  return value as JsonObject;
}
function list(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`Missing or invalid ${label}.`);
  return value;
}
function number(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new Error(`Invalid ${label}.`);
  return value;
}
function text(value: unknown, label: string): string {
  if (typeof value !== "string" || !value) throw new Error(`Invalid ${label}.`);
  return value;
}
function localized(value: unknown, label: string): string {
  return text(object(value, label).default, label);
}
export function seconds(value: unknown): number {
  if (typeof value !== "string" || !/^\d+:\d{2}$/.test(value))
    throw new Error("Invalid game clock.");
  const [m, s] = value.split(":").map(Number);
  if (s >= 60) throw new Error("Invalid game clock.");
  return m * 60 + s;
}
export function formatClock(value: number): string {
  const rounded = Math.max(0, Math.floor(value));
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, "0")}`;
}
export function clampTime(time: number, duration: number): number {
  return Math.max(0, Math.min(duration, time));
}
function readTeam(value: unknown): Team {
  const team = object(value, "team");
  const abbrev = text(team.abbrev, "team abbreviation");
  return {
    id: number(team.id, "team ID"),
    abbrev,
    name: `${localized(team.placeName, "team place")} ${localized(team.commonName, "team name")}`,
    logo:
      typeof team.logo === "string"
        ? team.logo
        : `https://assets.nhle.com/logos/nhl/svg/${abbrev}_light.svg`,
    score: number(team.score, "team score"),
  };
}
function readPlay(value: unknown): Play {
  const play = object(value, "play");
  const descriptor = object(play.periodDescriptor, "play period");
  return {
    eventId: number(play.eventId, "event ID"),
    typeDescKey: text(play.typeDescKey, "event type"),
    timeInPeriod: text(play.timeInPeriod, "event clock"),
    periodDescriptor: {
      number: number(descriptor.number, "period number"),
      periodType: text(descriptor.periodType, "period type"),
    },
    details: play.details == null ? {} : object(play.details, "event details"),
  };
}

// Merge overlapping records before computing TOI, so duplicate shift rows cannot double-count time.
export function mergeIntervals(intervals: Interval[]): Interval[] {
  const result: Interval[] = [];
  for (const interval of [...intervals].sort((a, b) => a.start - b.start)) {
    const last = result[result.length - 1];
    if (last && interval.start <= last.end)
      last.end = Math.max(last.end, interval.end);
    else result.push({ ...interval });
  }
  return result;
}

export function normalizeGame(
  boxValue: unknown,
  shiftValue: unknown,
  pbpValue: unknown,
): Game {
  const box = object(boxValue, "boxscore");
  const date = text(box.gameDate, "game date");
  const state = text(box.gameState, "game status");
  if (state !== "OFF" && state !== "FINAL") {
    throw new UnavailableGameError(
      `Game status: ${state}. Replay is available after the game is completed.`,
      date,
    );
  }
  const pbp = object(pbpValue, "play-by-play");
  const plays = list(pbp.plays, "play-by-play events").map(readPlay);
  if (plays.length === 0)
    throw new UnavailableGameError(
      "Play-by-play data is not available for this game yet.",
      date,
    );
  const descriptor = object(box.periodDescriptor, "game period");
  const shootout = descriptor.periodType === "SO";
  const playoff = box.gameType === 3;
  const lastPeriod = shootout
    ? 4
    : Math.max(3, number(descriptor.number, "last period"));
  const periods: Period[] = [];
  let axisDuration = 0;
  for (let n = 1; n <= lastPeriod; n++) {
    const duration = n <= 3 || playoff ? 1200 : 300;
    periods.push({
      number: n,
      label:
        n <= 3
          ? `${n}${n === 1 ? "st" : n === 2 ? "nd" : "rd"} Period`
          : n === 4
            ? "Overtime"
            : `${n - 3}OT`,
      start: axisDuration,
      duration,
    });
    axisDuration += duration;
  }
  const finalPeriod = periods[periods.length - 1];
  const clock = object(box.clock, "game clock");
  const remaining = number(clock.secondsRemaining, "remaining time");
  const duration = shootout
    ? axisDuration
    : finalPeriod.start +
      clampTime(finalPeriod.duration - remaining, finalPeriod.duration);
  if (duration <= 0)
    throw new UnavailableGameError("Game time is not available yet.", date);
  const periodMap = new Map(periods.map((p) => [p.number, p]));
  const home = readTeam(box.homeTeam);
  const away = readTeam(box.awayTeam);
  const stats = object(box.playerByGameStats, "rosters");
  const players: Player[] = [];
  for (const [side, team] of [
    ["homeTeam", home],
    ["awayTeam", away],
  ] as const) {
    const roster = object(stats[side], `${side} roster`);
    for (const group of ["forwards", "defense", "goalies"]) {
      for (const value of list(roster[group], `${side} ${group}`)) {
        const p = object(value, "player");
        players.push({
          id: number(p.playerId, "player ID"),
          teamId: team.id,
          name: localized(p.name, "player name"),
          sweaterNumber: number(p.sweaterNumber, "jersey number"),
          position: group === "goalies" ? "G" : text(p.position, "position"),
          shifts: [],
          order: players.length,
        });
      }
    }
  }
  const playerMap = new Map(players.map((p) => [p.id, p]));
  const rows = list(object(shiftValue, "shift response").data, "shifts");
  for (const value of rows) {
    const shift = object(value, "shift");
    const player = playerMap.get(number(shift.playerId, "shift player"));
    const period = periodMap.get(number(shift.period, "shift period"));
    if (!player || !period || !shift.startTime || !shift.endTime) continue;
    if (typeof shift.firstName === "string" && typeof shift.lastName === "string") {
      player.fullName = `${shift.firstName} ${shift.lastName}`;
    }
    const start =
      period.start + clampTime(seconds(shift.startTime), period.duration);
    const end = Math.min(
      duration,
      period.start + clampTime(seconds(shift.endTime), period.duration),
    );
    if (end > start) player.shifts.push({ start, end });
  }
  for (const player of players) player.shifts = mergeIntervals(player.shifts);
  if (!players.some((p) => p.shifts.length))
    throw new UnavailableGameError(
      "Shift data is not available for this game yet.",
      date,
    );

  const events: ReplayEvent[] = [];
  const seenEvents = new Set<number>();
  for (const play of plays) {
    const period = periodMap.get(play.periodDescriptor.number);
    if (
      !period ||
      play.periodDescriptor.periodType === "SO" ||
      !["goal", "shot-on-goal"].includes(play.typeDescKey)
    )
      continue;
    if (seenEvents.has(play.eventId)) continue;
    seenEvents.add(play.eventId);
    const goal = play.typeDescKey === "goal";
    events.push({
      id: play.eventId,
      time: period.start + seconds(play.timeInPeriod),
      teamId: number(play.details.eventOwnerTeamId, "event team"),
      playerId: number(
        goal ? play.details.scoringPlayerId : play.details.shootingPlayerId,
        "event player",
      ),
      goal,
    });
  }
  events.sort((a, b) => a.time - b.time);
  // Keep the existing penalty interpretation, adapting its legacy period field at the boundary.
  const blocks = getPowerPlayBlocks(
    plays
      .filter((p) => p.periodDescriptor.periodType !== "SO")
      .map((p) => ({ ...p, period: p.periodDescriptor.number })),
  );
  const powerPlays: PowerPlay[] = [];
  for (const block of blocks) {
    const startPeriod = periodMap.get(block.start.period);
    const endPeriod = periodMap.get(block.end.period);
    if (!startPeriod) continue;
    const start = startPeriod.start + seconds(block.start.timeInPeriod);
    const end = Math.min(
      duration,
      endPeriod ? endPeriod.start + seconds(block.end.timeInPeriod) : duration,
    );
    if (end > start && (block.teamId === home.id || block.teamId === away.id))
      powerPlays.push({ start, end, teamId: block.teamId });
  }
  return {
    id: number(box.id, "game ID"),
    date,
    home,
    away,
    players,
    periods,
    duration,
    axisDuration,
    events,
    powerPlays,
    shootout,
  };
}

export function normalizeSchedule(value: unknown): ScheduleGame[] {
  return list(object(value, "schedule").gameWeek, "schedule days").flatMap(
    (value) => {
      const day = object(value, "schedule day");
      const date = text(day.date, "schedule date");
      return list(day.games, "scheduled games").map((value) => {
        const game = object(value, "scheduled game");
        return {
          id: number(game.id, "game ID"),
          date,
          state: text(game.gameState, "game status"),
          home: text(
            object(game.homeTeam, "home team").abbrev,
            "home abbreviation",
          ),
          away: text(
            object(game.awayTeam, "away team").abbrev,
            "away abbreviation",
          ),
        };
      });
    },
  );
}
export function isActive(player: Player, time: number): boolean {
  return player.shifts.some((s) => s.start <= time && time < s.end);
}
export function toiAt(player: Player, time: number): number {
  return player.shifts.reduce(
    (total, shift) =>
      total + Math.max(0, Math.min(time, shift.end) - shift.start),
    0,
  );
}
export function positionGroup(position: string): "F" | "D" | "G" {
  return position === "G" ? "G" : position === "D" ? "D" : "F";
}
export function sortedPlayers(
  players: Player[],
  active: Set<number>,
): Player[] {
  const rank = { F: 0, D: 1, G: 2 };
  return [...players].sort(
    (a, b) =>
      Number(active.has(b.id)) - Number(active.has(a.id)) ||
      rank[positionGroup(a.position)] - rank[positionGroup(b.position)] ||
      a.order - b.order,
  );
}
export function statsAt(game: Game, time: number) {
  const teams: Record<number, { goals: number; shots: number }> = {
    [game.home.id]: { goals: 0, shots: 0 },
    [game.away.id]: { goals: 0, shots: 0 },
  };
  const shots: Record<number, number> = {};
  for (const event of game.events) {
    if (event.time > time) break;
    const team = teams[event.teamId];
    if (!team) continue;
    team.shots++;
    if (event.goal) team.goals++;
    shots[event.playerId] = (shots[event.playerId] ?? 0) + 1;
  }
  return { teams, shots };
}
function overlap(a: Interval[], b: Interval[]): Interval[] {
  const result: Interval[] = [];
  let i = 0,
    j = 0;
  while (i < a.length && j < b.length) {
    const start = Math.max(a[i].start, b[j].start),
      end = Math.min(a[i].end, b[j].end);
    if (end > start) result.push({ start, end });
    if (a[i].end < b[j].end) i++;
    else j++;
  }
  return result;
}
// Same shared-seconds measure as the standalone matrix, using pre-normalized intervals.
export function matrixData(game: Game, mode: Mode) {
  const rosters: Record<number, PlayerData[]> = {};
  const toi: Record<number, TOIData[]> = {};
  for (const team of [game.home, game.away]) {
    const players = game.players.filter(
      (p) => p.teamId === team.id && p.position !== "G",
    );
    rosters[team.id] = players;
    toi[team.id] = [];
    const pp = mergeIntervals(
      game.powerPlays.filter((p) => p.teamId === team.id),
    );
    for (let i = 0; i < players.length; i++) {
      for (let j = i; j < players.length; j++) {
        let shared = overlap(players[i].shifts, players[j].shifts);
        if (mode === "pp-toi") shared = overlap(shared, pp);
        toi[team.id].push({
          p1: players[i],
          p2: players[j],
          toi: shared.reduce((sum, s) => sum + s.end - s.start, 0),
        });
      }
    }
  }
  return { rosters, toi };
}
