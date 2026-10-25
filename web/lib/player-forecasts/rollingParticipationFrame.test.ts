// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import type { HttpReceipt } from "./nativeDailyPipeline";
import { buildRosterObservationSkaterParticipationReceipt } from "./modeledSkaterParticipation";
import { buildRosterObservationGoalieParticipationReceipt, buildRosterObservationGoalieStartReceipt } from "./modeledGoalieParticipation";
import { targetRosterObservationFromReceipt } from "./targetRosterObservation";
import { buildRollingParticipationHistories, rollingHistoryBoxscoreUrls, rollingHistoryScheduleUrls,
  type RollingFramePlayer } from "./rollingParticipationFrame";
import { buildRollingWindowGoalieParticipationReceipt, buildRollingWindowGoalieStartReceipt,
  buildRollingWindowSkaterParticipationReceipt } from "./rollingWindowParticipation";
import { playerForecastSourcePayloadHash as hash } from "./sourceSnapshot";

const sha = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");
const receipt = (url: string, body: unknown, capturedAt: string): HttpReceipt => {
  const rawBody = typeof body === "string" ? body : JSON.stringify(body); return { url, capturedAt, bodySha256: sha(rawBody), rawBody };
};
const dates = (start: string) => Array.from({ length: 7 }, (_, i) => new Date(Date.parse(`${start}T12:00:00Z`) + i * 86400000).toISOString().slice(0, 10));
type Game = { id: number; date: string; start: string; home: number; away: number; state?: string; type?: number };
const scheduleGame = (game: Game) => ({ id: game.id, season: 20262027, gameType: game.type ?? 2, startTimeUTC: game.start,
  gameState: game.state ?? "OFF", gameScheduleState: "OK", homeTeam: { id: game.home, abbrev: game.home === 1 ? "TST" : "OPP" },
  awayTeam: { id: game.away, abbrev: game.away === 1 ? "TST" : "OPP" } });
const week = (start: string, games: Game[], capturedAt: string) => receipt(`https://api-web.nhle.com/v1/schedule/${start}`,
  { gameWeek: dates(start).map(date => ({ date, games: games.filter(game => game.date === date).map(scheduleGame) })) }, capturedAt);

const [A, B, C, G1, G2] = [101, 102, 103, 201, 202];
const nhl = (id: number) => 8470000 + id;
const players: RollingFramePlayer[] = [
  { playerId: A, nhlPlayerId: nhl(A), teamId: 1, playerClass: "skater" }, { playerId: B, nhlPlayerId: nhl(B), teamId: 1, playerClass: "skater" },
  { playerId: C, nhlPlayerId: nhl(C), teamId: 1, playerClass: "skater" }, { playerId: G1, nhlPlayerId: nhl(G1), teamId: 1, playerClass: "goalie" },
  { playerId: G2, nhlPlayerId: nhl(G2), teamId: 1, playerClass: "goalie" }];
/** Club lines per game: skater TOI (null = not listed) and goalie [starter, TOI]. */
type Line = { skaters: Record<number, string | null>; goalies: Record<number, [boolean, string] | null> };
function boxscore(game: Game, line: Line, capturedAt: string) {
  const ours = { forwards: Object.entries(line.skaters).filter(([, toi]) => toi !== null).map(([id, toi]) => ({ playerId: nhl(Number(id)), position: "C", toi })),
    defense: [], goalies: Object.entries(line.goalies).filter(([, row]) => row !== null)
      .map(([id, row]) => ({ playerId: nhl(Number(id)), position: "G", starter: row![0], toi: row![1] })) };
  const theirs = { forwards: [{ playerId: 9001, position: "C", toi: "15:00" }], defense: [],
    goalies: [{ playerId: 9901, position: "G", starter: true, toi: "60:00" }, { playerId: 9902, position: "G", starter: false, toi: "00:00" }] };
  return receipt(`https://api-web.nhle.com/v1/gamecenter/${game.id}/boxscore`, { id: game.id, season: 20262027, gameType: 2,
    gameDate: game.date, startTimeUTC: game.start, gameState: "OFF", homeTeam: { id: game.home }, awayTeam: { id: game.away },
    playerByGameStats: { homeTeam: game.home === 1 ? ours : theirs, awayTeam: game.home === 1 ? theirs : ours } }, capturedAt);
}

// Frozen Sep29–Oct12 frame: four club games, an unrelated club game, a preseason game and a game after the window.
const cutoffAt = "2026-10-13T11:00:00Z", captured = "2026-10-13T10:30:00Z";
const games: Game[] = [
  { id: 2026020003, date: "2026-09-29", start: "2026-09-29T23:00:00Z", home: 1, away: 2 },
  { id: 2026020010, date: "2026-10-02", start: "2026-10-02T23:30:00Z", home: 2, away: 1 },
  { id: 2026020020, date: "2026-10-06", start: "2026-10-07T00:00:00Z", home: 1, away: 3 },
  { id: 2026020030, date: "2026-10-12", start: "2026-10-13T02:00:00Z", home: 3, away: 1 },
  { id: 2026020031, date: "2026-10-12", start: "2026-10-12T23:00:00Z", home: 2, away: 3 },
  { id: 2026010001, date: "2026-10-01", start: "2026-10-01T23:00:00Z", home: 1, away: 2, type: 1 },
  { id: 2026020040, date: "2026-10-13", start: "2026-10-13T23:00:00Z", home: 1, away: 2, state: "FUT" }];
const lines: Record<number, Line> = {
  2026020003: { skaters: { [A]: "18:00", [B]: "12:00", [C]: "10:00" }, goalies: { [G1]: [true, "60:00"], [G2]: [false, "00:00"] } },
  2026020010: { skaters: { [A]: "17:00", [B]: "00:00", [C]: "09:00" }, goalies: { [G1]: [true, "60:00"], [G2]: [false, "00:00"] } },
  // G2 starts and G1 relieves: a positive-minute appearance that is not a start.
  2026020020: { skaters: { [A]: "19:00", [B]: "11:00", [C]: null }, goalies: { [G1]: [false, "20:00"], [G2]: [true, "40:00"] } },
  2026020030: { skaters: { [A]: "16:00", [B]: "13:00", [C]: "08:00" }, goalies: { [G1]: [true, "60:00"], [G2]: [false, "00:00"] } } };
const schedules = (at = captured, list = games) => [week("2026-09-29", list, at), week("2026-10-06", list, at), week("2026-10-13", list, at)];
const boxscores = (ids = [2026020003, 2026020010, 2026020020, 2026020030]) => ids.map(id => boxscore(games.find(game => game.id === id)!, lines[id], "2026-10-13T10:40:00Z"));
const frame = () => buildRollingParticipationHistories({ cutoffAt, seasonId: 20262027, players, scheduleReceipts: schedules(), boxscoreReceipts: boxscores() });

const rosterBody = JSON.stringify({ teamId: 1, seasonId: 20262027, forwards: [A, B, C].map(id => ({ id: nhl(id) })), defensemen: [],
  goalies: [G1, G2].map(id => ({ id: nhl(id) })) });
const futureSchedule = week("2026-10-13", games, captured);
function inputs(player: RollingFramePlayer, history: ReturnType<typeof frame>["histories"] extends Map<number, infer H> ? H : never) {
  const target = targetRosterObservationFromReceipt({ playerId: player.playerId, nhlPlayerId: player.nhlPlayerId, teamId: 1, seasonId: 20262027,
    teamAbbreviation: "TST", knownConflict: null, cutoffAt, receipt: { url: "https://api-web.nhle.com/v1/roster/TST/20262027",
      capturedAt: "2026-10-13T10:20:00Z", rawBody: rosterBody, bodySha256: sha(rosterBody) } });
  return { playerClass: player.playerClass, cutoffAt, targetRosterObservation: target, rosterEvidence: target.evidence,
    scheduleEvidence: { id: `http:${futureSchedule.bodySha256}`, hash: futureSchedule.bodySha256, availableAt: captured, capturedAt: captured },
    scope: { playerId: player.playerId, nhlPlayerId: player.nhlPlayerId, seasonId: 20262027, teamId: 1, gameId: 2026020040,
      scheduledAt: "2026-10-13T23:00:00Z", scheduleRevision: "schedule-a", rosterRevision: "roster-a" }, history };
}
const issuance = { issuedAt: "2026-10-13T12:00:00Z", expiresAt: "2026-10-13T22:00:00Z" };
const outcome = (value: { probability: number | null; reasons: string[]; numerator: number; denominator: number; selectedGameIds: number[];
  evidenceHashes: string[] }) => ({ probability: value.probability, reasons: value.reasons, numerator: value.numerator,
  denominator: value.denominator, selectedGameIds: value.selectedGameIds, evidenceHashes: value.evidenceHashes });

describe("rolling history frame from original receipts", () => {
  it("requests only the two covering weeks and the final club boxscores", () => {
    expect(rollingHistoryScheduleUrls(cutoffAt)).toEqual(["https://api-web.nhle.com/v1/schedule/2026-09-29",
      "https://api-web.nhle.com/v1/schedule/2026-10-06"]);
    expect(rollingHistoryBoxscoreUrls({ cutoffAt, seasonId: 20262027, clubIds: [1], scheduleReceipts: schedules() }))
      .toEqual([2026020003, 2026020010, 2026020020, 2026020030].map(id => `https://api-web.nhle.com/v1/gamecenter/${id}/boxscore`));
  });
  it("labels positive, explicit zero and unlisted rows without inferring negatives", () => {
    const result = frame(), a = result.histories.get(A)!, b = result.histories.get(B)!, c = result.histories.get(C)!;
    expect(result.window).toMatchObject({ startAt: "2026-09-29T04:00:00.000Z", endAt: "2026-10-13T04:00:00.000Z" });
    expect(a.games.map(game => game.gameId)).toEqual([2026020003, 2026020010, 2026020020, 2026020030]);
    expect(a.games.map(game => game.resolution)).toEqual(["positive_toi", "positive_toi", "positive_toi", "positive_toi"]);
    expect(b.games[1]).toMatchObject({ occurred: true, positiveMinutes: false, resolution: "explicit_zero_toi",
      eligibility: { eligible: true, scope: "listed_game_instant_only", effectiveFrom: "2026-10-02T23:30:00.000Z",
        effectiveUntil: "2026-10-02T23:30:00.001Z" } });
    expect(c.games[2]).toMatchObject({ occurred: true, eligibility: null, positiveMinutes: null, resolution: null, outcomeEvidence: null,
      reasons: ["not_listed_for_current_club_game_eligibility_unknown"] });
    expect(result.coverage.find(row => row.playerId === C)).toMatchObject({ games: 4, positive: 3, zero: 0, unknown: 1 });
    expect(a.scheduleEvidence).toEqual(result.evidence);
    expect(result.manifest).toMatchObject({ clubIds: [1], gameIds: [2026020003, 2026020010, 2026020020, 2026020030],
      unreadGameIds: [], historicalEligibilityInferred: false, observedThrough: captured });
  });
  it("derives goalie starter labels separately from relief appearances", () => {
    const result = frame(), g1 = result.histories.get(G1)!, g2 = result.histories.get(G2)!;
    expect(g1.games.map(game => [game.officialStarter, game.positiveMinutes])).toEqual([[true, true], [true, true], [false, true], [true, true]]);
    expect(g2.games.map(game => [game.officialStarter, game.positiveMinutes])).toEqual([[false, false], [false, false], [true, true], [false, false]]);
    expect(g1.games[2].starterEvidence).toEqual(g1.games[2].outcomeEvidence);
    expect(result.histories.get(A)!.games[0]).toMatchObject({ officialStarter: null, starterEvidence: null });
  });
  it("emits every materialization parent its evidence references", () => {
    const result = frame(), parents = new Map(result.parents.map(parent => [parent.hash, parent]));
    const referenced = [result.evidence, ...[...result.histories.values()].flatMap(history => history.games
      .flatMap(game => [game.eligibility?.evidence, game.outcomeEvidence, game.starterEvidence]))].filter(Boolean);
    for (const row of referenced) expect(parents.get(row!.hash)).toMatchObject({ id: row!.id, availableAt: row!.availableAt, capturedAt: row!.capturedAt });
    const manifest = parents.get(result.evidence.hash)!;
    expect(manifest.derived).toEqual({ payload: result.manifest, parentHashes: schedules().sort((x, y) => x.url.localeCompare(y.url)).map(row => row.bodySha256) });
    expect(hash(result.manifest)).toBe(result.evidence.hash);
    for (const parent of result.parents.filter(row => row.derived && row.id.startsWith("boxscore:"))) {
      expect(hash(parent.derived!.payload)).toBe(parent.hash);
      expect(parents.get(parent.derived!.parentHashes[0])?.original?.url).toMatch(/\/gamecenter\/\d+\/boxscore$/);
    }
  });
});

describe("equivalence through original receipts (rolling cutoff Oct13 = frozen Sep29–Oct13 frame)", () => {
  it.each([
    [A, 1, []], [B, 0.75, []], [C, null, ["unknown_eligibility_or_occurrence"]],
  ])("skater %i reproduces the frozen roster-observation outcome", (playerId, probability, reasons) => {
    const result = frame(), player = players.find(row => row.playerId === playerId)!, base = inputs(player, result.histories.get(playerId)!);
    const frozen = buildRosterObservationSkaterParticipationReceipt({ ...base, playerClass: "skater", version: "skater-roster-observation-participation-input-v1" }, issuance);
    const rolling = buildRollingWindowSkaterParticipationReceipt({ ...base, playerClass: "skater", version: "skater-rolling-14d-participation-input-v1" }, issuance);
    expect(outcome(rolling)).toEqual(outcome(frozen));
    expect(rolling).toMatchObject({ probability, reasons });
  });
  it.each([[G1, 1, 0.75], [G2, 0.25, 0.25]])("goalie %i reproduces frozen appearance %d and start %d", (playerId, appearance, start) => {
    const result = frame(), player = players.find(row => row.playerId === playerId)!, base = { ...inputs(player, result.histories.get(playerId)!), playerClass: "goalie" as const };
    const frozenAppearance = buildRosterObservationGoalieParticipationReceipt({ ...base, version: "goalie-roster-observation-participation-input-v1" }, issuance);
    const frozenStart = buildRosterObservationGoalieStartReceipt({ ...base, version: "goalie-roster-observation-start-input-v1" }, issuance);
    const rollingAppearance = buildRollingWindowGoalieParticipationReceipt({ ...base, version: "goalie-rolling-14d-participation-input-v1" }, issuance);
    const rollingStart = buildRollingWindowGoalieStartReceipt({ ...base, version: "goalie-rolling-14d-start-input-v1" }, issuance);
    expect(outcome(rollingAppearance)).toEqual(outcome(frozenAppearance));
    expect(outcome(rollingStart)).toEqual(outcome(frozenStart));
    expect([rollingAppearance.probability, rollingStart.probability]).toEqual([appearance, start]);
  });
});

describe("released walk-forward games", () => {
  // Oct 20 cutoff: window Oct 6–19 holds 2026020110 (Oct 14), released from the walk-forward seal on 2026-10-17.
  const later = "2026-10-20T11:00:00Z", at = "2026-10-20T10:30:00Z";
  const window: Game[] = [
    { id: 2026020020, date: "2026-10-06", start: "2026-10-07T00:00:00Z", home: 1, away: 3 },
    { id: 2026020030, date: "2026-10-12", start: "2026-10-13T02:00:00Z", home: 3, away: 1 },
    { id: 2026020110, date: "2026-10-14", start: "2026-10-14T23:00:00Z", home: 1, away: 2 },
    { id: 2026020150, date: "2026-10-18", start: "2026-10-18T23:00:00Z", home: 2, away: 1 }];
  const weeks = [week("2026-10-06", window, at), week("2026-10-13", window, at)];
  const box = (id: number) => boxscore(window.find(game => game.id === id)!, lines[id > 2026020100 ? 2026020003 : id], "2026-10-20T10:40:00Z");
  it("requests and labels a released game like any other game", () => {
    expect(rollingHistoryBoxscoreUrls({ cutoffAt: later, seasonId: 20262027, clubIds: [1], scheduleReceipts: weeks }))
      .toContain("https://api-web.nhle.com/v1/gamecenter/2026020110/boxscore");
    const result = buildRollingParticipationHistories({ cutoffAt: later, seasonId: 20262027, players: [players[0]], scheduleReceipts: weeks,
      boxscoreReceipts: [2026020020, 2026020030, 2026020110, 2026020150].map(box) });
    expect(result.histories.get(A)!.games.find(game => game.gameId === 2026020110)).toMatchObject({ occurred: true, positiveMinutes: true,
      resolution: "positive_toi", eligibility: { eligible: true, scope: "listed_game_instant_only" }, reasons: [] });
    expect(result.manifest).toMatchObject({ gameIds: [2026020020, 2026020030, 2026020110, 2026020150], unreadGameIds: [] });
    const base = { ...inputs(players[0], result.histories.get(A)!), cutoffAt: later,
      scope: { ...inputs(players[0], result.histories.get(A)!).scope, gameId: 2026020160, scheduledAt: "2026-10-21T23:00:00Z" } };
    base.targetRosterObservation = { ...base.targetRosterObservation, evidence: { ...base.targetRosterObservation.evidence,
      availableAt: "2026-10-20T10:20:00Z", capturedAt: "2026-10-20T10:20:00Z" } };
    base.rosterEvidence = base.targetRosterObservation.evidence;
    base.scheduleEvidence = { ...base.scheduleEvidence, availableAt: at, capturedAt: at };
    expect(buildRollingWindowSkaterParticipationReceipt({ ...base, playerClass: "skater", version: "skater-rolling-14d-participation-input-v1" },
      { issuedAt: "2026-10-20T12:00:00Z", expiresAt: "2026-10-20T22:00:00Z" })).toMatchObject({ probability: 1, reasons: [], denominator: 4,
      selectedGameIds: [2026020150, 2026020110, 2026020030, 2026020020] });
  });
});

describe("history frame source gates", () => {
  it("keeps a missing final boxscore unknown", () => {
    const result = buildRollingParticipationHistories({ cutoffAt, seasonId: 20262027, players: [players[0]], scheduleReceipts: schedules(),
      boxscoreReceipts: boxscores([2026020003, 2026020010, 2026020030]) });
    expect(result.histories.get(A)!.games[2]).toMatchObject({ occurred: null, eligibility: null, reasons: ["missing_original_boxscore"] });
    expect(result.manifest.unreadGameIds).toEqual([2026020020]);
  });
  it("keeps a game that is not final in the schedule unknown", () => {
    const list = games.map(game => game.id === 2026020030 ? { ...game, state: "LIVE" } : game);
    const result = buildRollingParticipationHistories({ cutoffAt, seasonId: 20262027, players: [players[0]], scheduleReceipts: schedules(captured, list),
      boxscoreReceipts: boxscores([2026020003, 2026020010, 2026020020]) });
    expect(result.histories.get(A)!.games[3]).toMatchObject({ occurred: null, reasons: ["game_not_final_in_schedule:LIVE"] });
  });
  it.each([
    ["stale schedule", () => ({ scheduleReceipts: schedules("2026-10-12T10:59:59Z") }), "stale_history_schedule_receipt"],
    ["missing window date", () => ({ scheduleReceipts: schedules().slice(1) }), "history_window_not_fully_observed"],
    ["future receipt", () => ({ scheduleReceipts: schedules("2026-10-13T11:00:01Z") }), "invalid_original_receipt"],
    ["conflicting overlap", () => ({ scheduleReceipts: [...schedules().slice(0, 2), week("2026-10-12", games.map(game => game.id === 2026020030
      ? { ...game, start: "2026-10-13T01:00:00Z" } : game), captured)] }), "schedule_source_conflict"],
    ["unexpected boxscore", () => ({ boxscoreReceipts: [...boxscores(), boxscore(games[4], lines[2026020003], "2026-10-13T10:40:00Z")] }), "unexpected_boxscore_receipt"],
    ["duplicate boxscore", () => ({ boxscoreReceipts: [...boxscores(), ...boxscores([2026020003])] }), "unexpected_boxscore_receipt"],
    ["tampered boxscore", () => ({ boxscoreReceipts: boxscores().map((row, index) => index ? row : { ...row, bodySha256: "0".repeat(64) }) }), "invalid_original_receipt"],
  ])("fails closed on %s", (_kind, override, message) => {
    expect(() => buildRollingParticipationHistories({ cutoffAt, seasonId: 20262027, players, scheduleReceipts: schedules(),
      boxscoreReceipts: boxscores(), ...override() })).toThrow(message);
  });
});
