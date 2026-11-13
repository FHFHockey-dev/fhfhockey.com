import { readFileSync } from "node:fs";
import path from "node:path";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Decision 152 serving-review evidence (TJ's acceptance criterion 2), offline with real stored rows: with PP share
 * served, every surface agrees for a qualified team-game (2026020131 team 18) and shows "N/A" for a zero-PP
 * team-game (2026020038 team 55). Fixtures: __tests__/ppShare/fixtures/<game>.json (stored PBP, type-517 shift rows,
 * roster spots and official totals from the read-only export; no shift ingestion code is used).
 * The stored rows come from the stored-calculation writer (buildPowerPlayGameSet) on the same inputs.
 */
const { fromMock, useCurrentSeasonQueryMock } = vi.hoisted(() => ({ fromMock: vi.fn(), useCurrentSeasonQueryMock: vi.fn() }));
vi.mock("utils/adminOnlyMiddleware", () => ({ default: (handler: any) => handler }));
vi.mock("lib/cron/withCronJobAudit", () => ({ withCronJobAudit: (handler: any) => handler }));
vi.mock("lib/supabase/public-client", () => ({ default: { from: vi.fn() } }));
vi.mock("lib/NHL/server", () => ({ getCurrentSeason: vi.fn(), getPlayer: vi.fn() }));
vi.mock("lib/supabase/client", () => ({ default: { from: fromMock } }));
vi.mock("hooks/useCurrentSeason", () => ({ useCurrentSeasonQuery: useCurrentSeasonQueryMock }));

import { buildPowerPlayGameSet, type PowerPlayGameInputs } from "pages/api/v1/db/update-power-play-combinations/[gameId]";
import { buildToiSeries } from "pages/api/toi";
import { LinemateMatrixView, getTOIData, ppModeVerdicts } from "components/LinemateMatrix";
import { matrixData, mergeIntervals, normalizeGame, ppSecondsByTeam } from "components/ShiftChart/model";
import Replay from "components/ShiftChart/Replay";
import PowerPlayCombos from "components/PowerPlayCombos/PowerPlayCombos";
import { ppClockKey, type PpTeamGameClock } from "lib/ppShare/serving";

type Fixture = {
  gameId: number; date: string; homeTeamId: number; awayTeamId: number; gameType: number;
  events: Array<Array<string | number | null>>; shifts: number[][]; roster: Array<[number, number, string]>;
  teamGameStats: Array<[number, string, string]>;
};
const load = (gameId: number): Fixture =>
  JSON.parse(readFileSync(path.join(__dirname, "fixtures", `${gameId}.json`), "utf8"));
const clock = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

function writerInputs(f: Fixture): PowerPlayGameInputs {
  return {
    gameId: f.gameId, homeTeamId: f.homeTeamId, awayTeamId: f.awayTeamId, gameType: f.gameType,
    events: f.events.map((e) => ({
      event_id: e[0] as number, sort_order: e[1] as number, period_number: e[2] as number, period_type: e[3] as string,
      time_in_period: e[4] as string, time_remaining: e[5] as string, situation_code: e[6] as string,
      type_desc_key: e[7] as string, event_owner_team_id: e[8] as number | null, penalty_type_code: e[9] as string | null,
      penalty_desc_key: e[10] as string | null, penalty_duration_minutes: e[11] as number | null,
      committed_by_player_id: e[12] as number | null, served_by_player_id: e[13] as number | null
    })),
    shifts: f.shifts.map(([player_id, team_id, period, start_seconds, end_seconds]) => ({ player_id, team_id, period, start_seconds, end_seconds })),
    roster: f.roster.map(([player_id, team_id, position_code]) => ({ player_id, team_id, position_code })),
    teamGameStats: f.teamGameStats.map(([teamId, powerPlayToi, powerPlay]) => ({ teamId, powerPlayToi, powerPlay }))
  };
}

// The same stored rows in the shapes the live NHL feeds have (what LinemateMatrix and ShiftChart read today).
function nhlPlays(f: Fixture) {
  return f.events.map((e) => {
    const details: Record<string, unknown> = {};
    const set = (key: string, value: unknown) => { if (value != null) details[key] = value; };
    set("eventOwnerTeamId", e[8]); set("typeCode", e[9]); set("descKey", e[10]); set("duration", e[11]);
    set("committedByPlayerId", e[12]); set("servedByPlayerId", e[13]); set("scoringPlayerId", e[14]); set("shootingPlayerId", e[15]);
    return { eventId: e[0], sortOrder: e[1], periodDescriptor: { number: e[2], periodType: e[3] }, timeInPeriod: e[4],
      timeRemaining: e[5], situationCode: e[6], typeDescKey: e[7], details };
  });
}
function nhlShifts(f: Fixture) {
  return f.shifts.map(([playerId, teamId, period, start, end], i) => ({
    id: i + 1, gameId: f.gameId, playerId, teamId, period, startTime: clock(start), endTime: clock(end),
    duration: clock(end - start), firstName: "P", lastName: String(playerId), teamName: `Team ${teamId}`
  }));
}
const teamName = (id: number) => `Team ${id}`;
function skaterRoster(f: Fixture) {
  return Object.fromEntries(f.roster.filter(([, , pos]) => pos !== "G").map(([id, teamId, position]) =>
    [id, { id, teamId, position, sweaterNumber: 0, name: `Player ${id}` }]));
}
function box(f: Fixture) {
  const lastPeriod = Math.max(...f.events.map((e) => e[2] as number));
  const lastType = f.events.find((e) => e[2] === lastPeriod)?.[3] ?? "REG";
  const team = (id: number) => ({ id, abbrev: `T${id}`, placeName: { default: "Team" }, commonName: { default: String(id) }, score: 0 });
  const side = (teamId: number) => {
    const players = f.roster.filter(([, t]) => t === teamId).map(([playerId, , position]) =>
      ({ playerId, name: { default: `Player ${playerId}` }, position, sweaterNumber: 0 }));
    return { forwards: players.filter((p) => !["D", "G"].includes(p.position)), defense: players.filter((p) => p.position === "D"),
      goalies: players.filter((p) => p.position === "G") };
  };
  return { id: f.gameId, gameType: f.gameType, gameDate: f.date, gameState: "OFF", gameScheduleState: "OK",
    periodDescriptor: { number: lastPeriod, periodType: lastType }, clock: { secondsRemaining: 0 },
    homeTeam: team(f.homeTeamId), awayTeam: team(f.awayTeamId),
    playerByGameStats: { homeTeam: side(f.homeTeamId), awayTeam: side(f.awayTeamId) } };
}

const diagonal = (entries: Array<{ toi: number; p1: { id: number }; p2: { id: number } }>) =>
  Object.fromEntries(entries.filter((e) => e.p1.id === e.p2.id && e.toi > 0).map((e) => [e.p1.id, e.toi]));

function surfaces(gameId: number, teamId: number) {
  const f = load(gameId);
  const set = buildPowerPlayGameSet(writerInputs(f));
  const clocks: PpTeamGameClock[] = set.clockRows.map((row) => ({ gameId: row.game_id, teamId: row.team_id,
    availability: row.availability, clockSeconds: row.clock_seconds, unavailableReason: row.unavailable_reason, computedAt: "t" }));
  const stored = Object.fromEntries(set.playerRows.filter((r) => r.team_id === teamId).map((r) => [r.playerId, r]));
  const skaters = f.roster.filter(([, t, pos]) => t === teamId && pos !== "G").map(([id]) => id);
  // /api/toi, one point per skater of the team.
  const toi = Object.fromEntries(skaters.map((playerId) => {
    const [point] = buildToiSeries([{ toi: "20:00", date: f.date, gameId }], [{ game_id: gameId, team_id: teamId, toi_pp_seconds: null }], [],
      { clocks, ppRows: stored[playerId] ? [{ gameId, PPTOI: stored[playerId].PPTOI }] : [] });
    return [playerId, point];
  }));
  // LinemateMatrix PP mode on the same rows in the live-feed shape.
  const linemate = getTOIData([{ data: nhlShifts(f) }, { rostersMap: skaterRoster(f) as any,
    teams: [{ id: f.homeTeamId, name: teamName(f.homeTeamId) }, { id: f.awayTeamId, name: teamName(f.awayTeamId) }] },
  { plays: nhlPlays(f) }], "pp-toi");
  // Shift chart model.
  const game = normalizeGame(box(f), { data: nhlShifts(f) }, { plays: nhlPlays(f) });
  const shiftChart = matrixData(game, "pp-toi", true);
  const gate = { status: "on" as const, clocks: new Map(clocks.map((c) => [ppClockKey(c.gameId, c.teamId), c])) };
  return { f, set, clocks, stored, toi, linemate, game, shiftChart, gate,
    verdicts: {
      linemate: ppModeVerdicts(gate, gameId, [{ id: f.homeTeamId }, { id: f.awayTeamId }], linemate.ppSecondsByTeam),
      shiftChart: ppModeVerdicts(gate, gameId, [game.home, game.away], ppSecondsByTeam(game))
    } };
}

// PowerPlayCombos reads its stored rows through the browser Supabase client and its gate through fetch.
function renderPowerPlayCombos(s: ReturnType<typeof surfaces>, teamId: number) {
  const f = s.f;
  const results: Record<string, unknown[]> = {
    games: [{ id: f.gameId, startTime: `${f.date}T23:00:00Z`, seasonId: 20262027, homeTeamId: f.homeTeamId, awayTeamId: f.awayTeamId }, []],
    rosters: [f.roster.filter(([, t]) => t === teamId).map(([playerId]) => ({ playerId, sweaterNumber: 0 }))],
    powerPlayCombinations: [Object.values(s.stored).map((r) => ({ playerId: r.playerId, unit: r.unit, PPTOI: r.PPTOI,
      players: { fullName: `Player ${r.playerId}`, firstName: "Player", lastName: String(r.playerId), position: "C", sweater_number: 0 } }))],
    skatersGameStats: [[]], forge_player_game_strength: [[]]
  };
  fromMock.mockImplementation((table: string) => {
    const data = results[table]?.shift() ?? [];
    const result = Promise.resolve({ data, error: null });
    const q: any = {};
    for (const m of ["select", "eq", "in", "or", "neq", "order", "lt", "limit"]) q[m] = () => q;
    q.single = () => result;
    q.then = (res: any, rej: any) => result.then(res, rej);
    return q;
  });
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ servingEnabled: true,
    clocks: s.clocks.filter((c) => c.gameId === f.gameId) }) })));
  useCurrentSeasonQueryMock.mockReturnValue({ data: undefined, isError: true, isPending: false });
  render(<PowerPlayCombos teamId={teamId} gameId={f.gameId} seasonId={20262027} />);
}

describe("decision 152 cross-surface serving review (real stored rows)", () => {
  beforeEach(() => {
    vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("2026020131 team 18 (qualified, 120 s): every surface has the same clock, per-player PP seconds and shares", async () => {
    const s = surfaces(2026020131, 18);
    const writerClock = s.set.clockRows.find((row) => row.team_id === 18)!;
    expect(writerClock).toMatchObject({ availability: "available", clock_seconds: 120, reference_source: "teamGameStats" });

    const writerSeconds = Object.fromEntries(Object.values(s.stored).map((r) => [r.playerId, r.PPTOI]));
    const writerShares = Object.fromEntries(Object.values(s.stored).map((r) => [r.playerId, r.pp_share_of_team]));
    expect(writerSeconds).toEqual({ 8475158: 112, 8474564: 111, 8476539: 110, 8474600: 110, 8476887: 109,
      8476869: 11, 8480246: 10, 8477021: 10, 8484241: 9, 8479525: 8 });

    // /api/toi: same seconds; the share is the same fraction, as a percentage.
    const toiSeconds = Object.fromEntries(Object.entries(s.toi).filter(([, p]) => (p.powerPlayToi ?? 0) > 0)
      .map(([id, p]) => [id, Math.round(p.powerPlayToi! * 60)]));
    expect(toiSeconds).toEqual(Object.fromEntries(Object.entries(writerSeconds).map(([id, v]) => [id, v])));
    for (const [id, share] of Object.entries(writerShares)) {
      expect(s.toi[Number(id)].powerPlayToiShare! / 100).toBeCloseTo(share!, 6);
      expect(s.toi[Number(id)].powerPlayShareStatus).toEqual({ availability: "available", reason: null });
    }

    // LinemateMatrix PP mode and the shift chart model: same clock and the same per-player seconds.
    expect({ linemate: s.linemate.ppSecondsByTeam[18], shiftChart: ppSecondsByTeam(s.game)[18] }).toEqual({ linemate: 120, shiftChart: 120 });
    expect(diagonal(s.linemate.toi[18])).toEqual(writerSeconds);
    expect(diagonal(s.shiftChart.toi[18] as any)).toEqual(writerSeconds);
    expect((s.verdicts.linemate as any)[18]).toEqual({ status: "available", clockSeconds: 120, reason: null });
    expect((s.verdicts.shiftChart as any)[18]).toEqual({ status: "available", clockSeconds: 120, reason: null });
    // Units: the writer's PP1/PP2 (same pivot rule) and their averages, which the matrix's PP1-vs-PP2 bar shows.
    const unit = (n: number) => Object.values(s.stored).filter((r) => r.unit === n).map((r) => r.playerId).sort();
    expect(unit(1)).toEqual([8474564, 8474600, 8475158, 8476539, 8476887]);
    expect(unit(2)).toEqual([8476869, 8477021, 8479525, 8480246, 8484241]);
    // Today's replay bands (unchanged with serving off) come from plays without situation codes: 29 s for team 18,
    // the 11-01 clock's value. The served view uses the qualified intervals above.
    expect(mergeIntervals(s.game.powerPlays.filter((p) => p.teamId === 18)).reduce((n, i) => n + i.end - i.start, 0)).toBe(29);

    // Rendered: the matrix and the shift chart show team 18's grid; Lines shows its stored units.
    render(<LinemateMatrixView gameInfo={[{ id: 18, name: "Team 18" }]} rosters={s.linemate.rosters as any}
      toiData={s.linemate.toi} mode="pp-toi" onModeChanged={() => {}} ppVerdicts={s.verdicts.linemate} teamId={18} />);
    expect(screen.queryByText(/^Team 18:/)).toBeNull();
    expect(screen.getByText("Team 18")).toBeTruthy();
    // PP1 averages 110.4 s and PP2 9.6 s of the 120 s clock: a 92.0% / 8.0% split.
    expect(screen.getByText("92.0%")).toBeTruthy();
    expect(screen.getByText("8.0%")).toBeTruthy();
    cleanup();
    renderPowerPlayCombos(s, 18);
    expect(await screen.findByText("PP1")).toBeTruthy();
    expect(screen.queryByRole("status")).toBeNull();
    for (const id of unit(1)) expect(screen.getAllByText(String(id)).length).toBeGreaterThan(0);
  });

  it("2026020038 team 55 (no power play): every surface shows N/A, never 0% or 0:00 as a share", async () => {
    const s = surfaces(2026020038, 55);
    expect(s.set.clockRows.find((row) => row.team_id === 55)).toMatchObject({ availability: "not_applicable", clock_seconds: 0 });
    expect(Object.keys(s.stored)).toEqual([]);

    // /api/toi: no share, status N/A, for every skater of team 55.
    for (const point of Object.values(s.toi)) {
      expect(point.powerPlayToiShare).toBeNull();
      expect(point.powerPlayShareStatus).toEqual({ availability: "not_applicable", reason: null });
    }
    // The live views agree there was no team-55 power play, and the gate says N/A.
    expect(s.linemate.ppSecondsByTeam[55]).toBe(0);
    expect(ppSecondsByTeam(s.game)[55]).toBe(0);
    expect((s.verdicts.linemate as any)[55]).toEqual({ status: "not_applicable", clockSeconds: 0, reason: null });
    expect((s.verdicts.shiftChart as any)[55]).toEqual({ status: "not_applicable", clockSeconds: 0, reason: null });

    render(<LinemateMatrixView gameInfo={[{ id: 55, name: "Team 55" }]} rosters={s.linemate.rosters as any}
      toiData={s.linemate.toi} mode="pp-toi" onModeChanged={() => {}} ppVerdicts={s.verdicts.linemate} teamId={55} />);
    expect(screen.getByText("Team 55: N/A: no power play in this game.")).toBeTruthy();
    expect(screen.queryByText("0.0%")).toBeNull();
    cleanup();

    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ servingEnabled: true, clocks: s.clocks }) })));
    render(<Replay game={s.game} mode="pp-toi" onModeChanged={() => {}} selection={<div />} />);
    expect(await screen.findByText(`${s.game.home.name}: N/A: no power play in this game.`)).toBeTruthy();
    cleanup();

    renderPowerPlayCombos(s, 55);
    expect((await screen.findByRole("status")).textContent).toBe("N/A: no power play in this game.");
    expect(screen.queryByText("PP1")).toBeNull();
  });
});
