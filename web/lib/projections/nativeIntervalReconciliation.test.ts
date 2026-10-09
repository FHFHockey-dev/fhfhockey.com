// @vitest-environment node
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runNativeIntervalReconciliation } from "../../scripts/reconcile-native-intervals";
import { projectionInputHash } from "./inputCapture";
import { intervalClockSeconds, reconcileNativeIntervalGame, verifyIntervalRevision } from "./nativeIntervalReconciliation";

const digest = (bytes: string | Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const clock = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
function fixture() {
  const team = (id: number) => ({ id, score: id === 6 ? 1 : 0, sog: id === 6 ? 2 : 0 });
  const roster = [6, 68].flatMap(teamId => [1, 2, 3, 9].map(index => ({ playerId: teamId * 100 + index, teamId, positionCode: index === 9 ? "G" : "C" })));
  const descriptor = { number: 4, periodType: "OT", maxRegulationPeriods: 3 };
  const play = (eventId: number, number: number, periodType: string, time: number, typeDescKey: string) => ({ eventId, typeDescKey,
    periodDescriptor: { number, periodType, maxRegulationPeriods: 3 }, timeInPeriod: clock(time), situationCode: "1331",
    details: { eventOwnerTeamId: 6, scoringPlayerId: 601, shootingPlayerId: 601, goalieInNetId: 6809 } });
  const pbp = { id: 2026020001, season: 20262027, gameType: 2, gameState: "OFF", startTimeUTC: "2026-10-01T23:00:00Z",
    homeTeam: team(6), awayTeam: team(68), periodDescriptor: descriptor, rosterSpots: roster,
    plays: [play(1, 1, "REG", 30, "goal"), play(2, 1, "REG", 60, "period-end"), play(3, 4, "OT", 10, "shot-on-goal"),
      play(4, 4, "OT", 20, "period-end"), play(5, 4, "OT", 20, "game-end")] };
  const stats = (teamId: number) => ({ forwards: roster.filter(row => row.teamId === teamId && row.positionCode !== "G")
    .map(row => ({ playerId: row.playerId, toi: "01:20" })), defense: [], goalies: [{ playerId: teamId * 100 + 9, toi: "01:20" }] });
  const box = { ...clone(pbp), playerByGameStats: { homeTeam: stats(6), awayTeam: stats(68) } };
  let id = 0;
  const rows = roster.flatMap(player => [1, 4].map(period => ({ id: ++id, gameId: pbp.id, playerId: player.playerId, teamId: player.teamId,
    period, startTime: "00:00", endTime: clock(period === 1 ? 60 : 20), duration: clock(period === 1 ? 60 : 20), typeCode: 517, shiftNumber: period, eventNumber: id })));
  return { playByPlay: pbp as any, boxscore: box as any, shiftPages: [{ revisionId: "shift-1", rows: rows as any[] }] };
}
const player = (result: ReturnType<typeof reconcileNativeIntervalGame>, id = 601) => result.players.find(row => row.playerId === id)!;
function setToi(input: ReturnType<typeof fixture>, id: number, seconds: number) {
  const groups = Object.values(input.boxscore.playerByGameStats) as any[];
  const rows: any[] = groups.flatMap(group => Object.values(group).flat());
  rows.find(row => row.playerId === id).toi = clock(seconds);
}
function revision(revisionId: string, url: string, payload: any) {
  const bodyUtf8 = JSON.stringify(payload);
  return { revisionId, url, payload, bodyUtf8, rawBytesHash: digest(bodyUtf8), provenance: {
    revisionId, source: url, payloadHash: projectionInputHash(payload), firstReceivedAt: "2026-10-07T21:00:00.001Z",
    verifiedAt: "2026-10-07T21:00:00.002Z", publishedAt: null, availabilityBasis: "retained_capture", correctionOf: null } };
}

describe("native retained interval mechanics", () => {
  it("uses strict seconds and disjoint REG/OT cells without predicting a rate", () => {
    expect(intervalClockSeconds("63:21")).toBe(3801);
    expect(["00:60", "1:2", "-1:00", 20, null].map(intervalClockSeconds)).toEqual([null, null, null, null, null]);
    const result = reconcileNativeIntervalGame(fixture());
    expect(result.totalClockSeconds).toBe(80);
    expect(result.reconciledStateClockSeconds).toBe(80);
    expect(result.quarantinedStateClockSeconds).toBe(0);
    expect(result.reconciledSkaterPresenceSeconds).toBe(480);
    expect(result.cellExposure).toContainEqual({ teamId: 6, cell: "REG:both_present:equal_skaters", clockSeconds: 60, skaterSeconds: 180 });
    expect(result.cellExposure).toContainEqual({ teamId: 6, cell: "OT:both_present:equal_skaters", clockSeconds: 20, skaterSeconds: 60 });
    expect(result.playerCellExposure.find(row => row.playerId === 601)).toMatchObject({
      historicalPositiveToiAppearance: true, completeJointCellClassification: true, unclassifiedPresenceSeconds: 0,
      cellSeconds: [{ cell: "OT:both_present:equal_skaters", seconds: 20 }, { cell: "REG:both_present:equal_skaters", seconds: 60 }],
    });
    expect(result.forecastEstimatorEligible).toBe(false);
  });
  it("retains exact duplicate rows and counts physical presence only once", () => {
    const input = fixture(), original = input.shiftPages[0].rows[0];
    input.shiftPages[0].rows.push({ ...original, id: 100 });
    const snapshot = clone(input), result = reconcileNativeIntervalGame(input);
    expect(input).toEqual(snapshot);
    expect(result.sourceRows).toHaveLength(17);
    expect(result.sourceRows.at(-1)!.original).toEqual({ ...original, id: 100 });
    expect(result.overlaps[0]).toMatchObject({ kind: "identical_presence_endpoints", overlapSeconds: 60 });
    expect(player(result).supportedPresenceSeconds).toBe(80);
  });
  it("unions partial overlaps while retaining both source records", () => {
    const input = fixture();
    input.shiftPages[0].rows.push({ ...input.shiftPages[0].rows[0], id: 100, startTime: "00:30", duration: "00:30" });
    const result = reconcileNativeIntervalGame(input);
    expect(result.overlaps[0]).toMatchObject({ kind: "partial_presence_overlap", overlapSeconds: 30 });
    expect(player(result).supportedPresenceSeconds).toBe(80);
    expect(result.sourceRows).toHaveLength(17);
  });
  it("does not delete different-period records sharing shift/event numbers to force a TOI match", () => {
    const input = fixture(), rows = input.shiftPages[0].rows;
    rows[1].shiftNumber = rows[0].shiftNumber; rows[1].eventNumber = rows[0].eventNumber;
    setToi(input, 601, 60);
    const result = reconcileNativeIntervalGame(input);
    expect(player(result)).toMatchObject({ endpointUnionSeconds: 80, supportedPresenceSeconds: null, status: "quarantined" });
    expect(player(result).reasons).toContain("presence_union_boxscore_toi_mismatch");
    expect(result.quarantinedStateClockSeconds).toBe(80);
    expect(result.unresolvedSkaterBoxToiSeconds).toBe(60);
    expect(result.playerCellExposure.find(row => row.playerId === 601)).toMatchObject({ cellSeconds: [], unclassifiedPresenceSeconds: null, completeJointCellClassification: false });
    expect(result.playerCellExposure.find(row => row.playerId === 602)).toMatchObject({ cellSeconds: [], unclassifiedPresenceSeconds: 80, completeJointCellClassification: false });
    expect(result.eventChecks.every(row => row.status === "joint_state_quarantined")).toBe(true);
    expect(result.sourceRows).toHaveLength(16);
  });
  it("keeps a goalie duration conflict but reconciles invariant presence supplied by another full OT row", () => {
    const input = fixture(), row = input.shiftPages[0].rows.find(row => row.playerId === 609 && row.period === 4)!;
    input.shiftPages[0].rows.push({ ...row, id: 100, duration: "00:15" });
    const result = reconcileNativeIntervalGame(input);
    expect(result.sourceRows.at(-1)).toMatchObject({ disposition: "duration_conflict", original: { duration: "00:15", endTime: "00:20" } });
    expect(player(result, 609)).toMatchObject({ distinctPresenceVariants: 1, boxMatchingPresenceVariants: 1, supportedPresenceSeconds: 80 });
  });
  it("records both conflict candidates and selects a unique box-TOI-matching presence", () => {
    const input = fixture();
    input.shiftPages[0].rows.find(row => row.playerId === 609 && row.period === 4)!.duration = "00:15";
    const result = reconcileNativeIntervalGame(input);
    expect(player(result, 609)).toMatchObject({ candidateUnionSeconds: [75, 80], distinctPresenceVariants: 2, boxMatchingPresenceVariants: 1, supportedPresenceSeconds: 80 });
    expect(result.sourceRows.find(row => row.disposition === "duration_conflict")!.candidates).toHaveLength(2);
  });
  it("quarantines different timelines even when both match the same total TOI", () => {
    const input = fixture(), rows = input.shiftPages[0].rows, row = rows[0];
    row.endTime = "00:10"; row.duration = "00:20";
    rows.push({ ...row, id: 100, startTime: "00:30", endTime: "00:40" }); setToi(input, 601, 50);
    const result = reconcileNativeIntervalGame(input);
    expect(player(result)).toMatchObject({ boxMatchingPresenceVariants: 2, supportedPresenceSeconds: null });
    expect(player(result).reasons).toContain("multiple_box_matching_presence_timelines");
  });
  it("keeps zero-duration event markers separate from elapsed exposure", () => {
    const input = fixture();
    input.shiftPages[0].rows.push({ ...input.shiftPages[0].rows[0], id: 100, typeCode: 505, startTime: "00:25", endTime: "00:25", duration: null, eventDescription: "EVG" });
    const result = reconcileNativeIntervalGame(input);
    expect(result.sourceRows.at(-1)!.disposition).toBe("event_marker");
    expect(player(result).supportedPresenceSeconds).toBe(80);
  });
  it.each(["invalid clock", "missing duration", "unknown type", "outside period", "conflicting row ID"])("quarantines %s and leaves unsupported seconds null", problem => {
    const input = fixture(), rows = input.shiftPages[0].rows;
    if (problem === "invalid clock") rows[0].startTime = "00:60";
    if (problem === "missing duration") rows[0].duration = null;
    if (problem === "unknown type") rows[0].typeCode = 999;
    if (problem === "outside period") { rows[0].endTime = "02:00"; rows[0].duration = "02:00"; }
    if (problem === "conflicting row ID") rows.push({ ...rows[0], duration: "00:30" });
    const result = reconcileNativeIntervalGame(input);
    expect(player(result).supportedPresenceSeconds).toBeNull();
    expect(result.sourceRows.some(row => row.disposition === "quarantined")).toBe(true);
    expect(result.reconciledStateClockSeconds).toBe(0);
  });
  it("blocks joint state when a source row cannot be bound to a historical player", () => {
    const input = fixture(); input.shiftPages[0].rows.push({ ...input.shiftPages[0].rows[0], id: 100, playerId: 999 });
    const result = reconcileNativeIntervalGame(input);
    expect(result.players.every(row => row.status === "reconciled")).toBe(true);
    expect(result.reconciledStateClockSeconds).toBe(0);
    expect(result.spans[0].reasons.some(reason => reason.startsWith("unmapped_source_row:"))).toBe(true);
  });
  it("retains malformed non-object source records in quarantine", () => {
    const input = fixture(); input.shiftPages[0].rows.push(null);
    const result = reconcileNativeIntervalGame(input);
    expect(result.sourceRows.at(-1)).toMatchObject({ original: null, disposition: "quarantined" });
    expect(result.reconciledStateClockSeconds).toBe(0);
  });
  it("does not repair an endpoint outside the proved period using a plausible duration", () => {
    const input = fixture(); input.shiftPages[0].rows[0].endTime = "02:00";
    const result = reconcileNativeIntervalGame(input);
    expect(result.sourceRows[0].reasons).toContain("source_row_endpoint_outside_retained_period_clock");
    expect(player(result).supportedPresenceSeconds).toBeNull();
  });
  it("does not manufacture a period end from elapsed shifts or a regulation constant", () => {
    const input = fixture(); input.playByPlay.plays = input.playByPlay.plays.filter((row: any) => row.eventId !== 2);
    const result = reconcileNativeIntervalGame(input);
    expect(result.totalClockSeconds).toBeNull();
    expect(result.quarantinedStateClockSeconds).toBeNull();
    expect(player(result).supportedPresenceSeconds).toBeNull();
  });
  it("excludes shootout records and keeps OT/net-state intersections disjoint", () => {
    const input = fixture();
    input.playByPlay.plays.push({ eventId: 6, typeDescKey: "goal", periodDescriptor: { number: 5, periodType: "SO" }, timeInPeriod: "00:00" });
    input.shiftPages[0].rows.push({ ...input.shiftPages[0].rows[0], id: 100, period: 5 });
    const goalie = input.shiftPages[0].rows.find(row => row.playerId === 6809 && row.period === 4)!;
    goalie.endTime = "00:15"; goalie.duration = "00:15"; setToi(input, 6809, 75);
    const result = reconcileNativeIntervalGame(input);
    expect(result.sourceRows.at(-1)!.disposition).toBe("excluded_shootout");
    expect(result.totalClockSeconds).toBe(80);
    expect(result.cellExposure).toContainEqual({ teamId: 6, cell: "OT:defending_absent:equal_skaters", clockSeconds: 5, skaterSeconds: 15 });
    expect(result.cellExposure.filter(row => row.teamId === 6).reduce((sum, row) => sum + row.clockSeconds, 0)).toBe(80);
    expect(result.eventChecks).toHaveLength(2);
  });
  it("retains boundary ambiguity and quarantines interior event-state contradictions", () => {
    const input = fixture(); input.playByPlay.plays[0].timeInPeriod = "01:00";
    expect(reconcileNativeIntervalGame(input).eventChecks[0].status).toBe("boundary_compatible_order_unproved");
    input.playByPlay.plays[0].timeInPeriod = "00:30"; input.playByPlay.plays[0].situationCode = "1341";
    const result = reconcileNativeIntervalGame(input);
    expect(result.eventChecks[0].status).toBe("interval_event_state_conflict");
    expect(result.quarantinedStateClockSeconds).toBe(60);
    expect(result.eventChecks.every(row => row.eventToExposureCellEligible === false)).toBe(true);
  });
  it("accepts observed zero-TOI backups without treating them as playing appearances", () => {
    const input = fixture();
    input.playByPlay.rosterSpots.push({ playerId: 610, teamId: 6, positionCode: "G" });
    input.boxscore.playerByGameStats.homeTeam.goalies.push({ playerId: 610, toi: "00:00" });
    expect(player(reconcileNativeIntervalGame(input), 610)).toMatchObject({ supportedPresenceSeconds: 0, boxToiSeconds: 0 });
  });
  it("quarantines events with unbound team/player credit instead of choosing the other side", () => {
    const input = fixture(); input.playByPlay.plays[0].details.eventOwnerTeamId = 99;
    const result = reconcileNativeIntervalGame(input);
    expect(result.eventChecks[0].status).toBe("event_player_or_team_unproved");
    expect(result.quarantinedStateClockSeconds).toBe(60);
  });
  it("quarantines physically conflicting simultaneous goalies despite matched individual TOI", () => {
    const input = fixture();
    input.playByPlay.rosterSpots.push({ playerId: 610, teamId: 6, positionCode: "G" });
    input.boxscore.playerByGameStats.homeTeam.goalies.push({ playerId: 610, toi: "01:20" });
    input.shiftPages[0].rows.push(...input.shiftPages[0].rows.filter(row => row.playerId === 609).map((row, index) => ({ ...row, id: 100 + index, playerId: 610 })));
    const result = reconcileNativeIntervalGame(input);
    expect(result.reconciledStateClockSeconds).toBe(0);
    expect(result.spans[0].reasons).toContain("multiple_goalies_on_one_team");
  });
  it("rejects historical identity drift rather than using a current roster", () => {
    const input = fixture(); input.boxscore.playerByGameStats.homeTeam.forwards[0].playerId = 999;
    expect(() => reconcileNativeIntervalGame(input)).toThrow("roster identity mismatch");
  });
});

describe("retained interval integrity and offline CLI", () => {
  it("rejects altered raw/canonical identity and receipts after the declared cutoff", () => {
    const source = revision("pbp-1", "https://example.test/retained", { id: 1 });
    expect(verifyIntervalRevision(source, "2026-10-08T22:00:00Z").revisionId).toBe("pbp-1");
    expect(() => verifyIntervalRevision({ ...source, payload: { id: 2 } }, "2026-10-08T22:00:00Z")).toThrow("canonical payload");
    expect(() => verifyIntervalRevision(source, "2026-10-07T20:00:00Z")).toThrow("unavailable");
  });
  it("replays retained files identically, leaves every input untouched and requires a new output", () => {
    const directory = mkdtempSync(join(tmpdir(), "native-interval-cli-"));
    try {
      const input = fixture(), gameId = input.playByPlay.id;
      const scope = { gameId: 2026020056, seasonId: 20262027, phase: 2, homeTeamId: 6, awayTeamId: 68, startAt: "2026-10-08T23:00:00Z", cutoffAt: "2026-10-08T22:00:00Z", horizonGames: 1 };
      const pbp = revision("pbp-1", `https://api-web.nhle.com/v1/gamecenter/${gameId}/play-by-play`, input.playByPlay);
      const box = { ...revision("box-1", `https://api-web.nhle.com/v1/gamecenter/${gameId}/boxscore`, input.boxscore), kind: "official_boxscore", gameId, requestedAt: "2026-10-07T21:00:00Z", httpStatus: 200 };
      const shifts = { ...revision("shift-1", `https://api.nhle.com/stats/rest/en/shiftcharts?cayenneExp=gameId=${gameId}&start=0&limit=1000`, { total: 16, data: input.shiftPages[0].rows }), kind: "official_shift_page", gameId, page: 0, requestedAt: box.requestedAt, httpStatus: 200 };
      const files = new Map<string, any>([["pbp-1.json", pbp], ["box-1.json", box], ["shift-1.json", shifts]]);
      const priorResult = { version: "native-goal-ledger-audit-v1", acceptanceEligible: false, scope, games: [{ gameId, revisionId: "pbp-1", rawBytesHash: pbp.rawBytesHash, canonicalPayloadHash: pbp.provenance.payloadHash }] };
      files.set("ledger.json", { version: "native-goal-ledger-local-receipt-v1", sourceDirty: false, resultHash: projectionInputHash(priorResult), result: priorResult,
        inputFiles: [{ sha256: digest(JSON.stringify(pbp)) }] });
      const manifest = { version: "official-supplemental-observations-v1", acceptanceEligible: false, prospectiveScope: scope, gameIds: [gameId],
        games: [{ gameId, boxscoreRevisionId: "box-1", shiftRevisionIds: ["shift-1"], declaredShiftTotal: 16, retainedShiftRows: 16 }] };
      files.set("manifest.json", manifest);
      for (const [name, value] of files) writeFileSync(join(directory, name), JSON.stringify(value));
      const before = [...files].map(([name]) => digest(new Uint8Array(readFileSync(join(directory, name)))));
      const args = (output: string) => ["--ledger", join(directory, "ledger.json"), "--pbp-revisions", directory, "--supplemental", directory, "--output", join(directory, output)];
      const first = runNativeIntervalReconciliation(args("a.json")), second = runNativeIntervalReconciliation(args("b.json"));
      expect(first).toEqual(second);
      expect(first.result.summary).toMatchObject({ retainedRowCount: 16, reconciledPlayerGames: 8, quarantinedPlayerGames: 0, reconciledStateClockSeconds: 80 });
      expect(first.result.games[0].availableBeforeHistoricalStart).toBe(false);
      expect(() => runNativeIntervalReconciliation(args("a.json"))).toThrow("EEXIST");
      expect([...files].map(([name]) => digest(new Uint8Array(readFileSync(join(directory, name)))))).toEqual(before);
      manifest.games[0].declaredShiftTotal = 17; writeFileSync(join(directory, "manifest.json"), JSON.stringify(manifest));
      expect(() => runNativeIntervalReconciliation(args("bad.json"))).toThrow("pagination");
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });
});
