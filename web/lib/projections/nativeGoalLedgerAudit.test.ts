// @vitest-environment node
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { goalHistoryFromOfficialFinal } from "../forecast-diagnostics/pairedInputs";
import { runNativeGoalLedgerAudit } from "../../scripts/audit-native-goal-ledger";
import { projectionInputHash } from "./inputCapture";
import { auditNativeGoalLedger, nativeEventClockSeconds } from "./nativeGoalLedgerAudit";

const parserSourceHash = createHash("sha256").update(new Uint8Array(readFileSync(resolve(__dirname, "../supabase/Upserts/nhlStrengthState.ts")))).digest("hex");
const digest = (body: string) => createHash("sha256").update(body).digest("hex");
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const count = (keys: string[]) => Object.fromEntries([...new Set(keys)].map(key => [key, keys.filter(value => value === key).length]));

function fixture(shootout = false) {
  const scope = { gameId: 2026020099, seasonId: 20262027, phase: 2, homeTeamId: 10, awayTeamId: 11,
    startAt: "2026-10-08T23:00:00Z", cutoffAt: "2026-10-08T22:00:00Z", horizonGames: 1 };
  const revisions: any[] = [];
  const makeSource = (revisionId: string, payload: any) => {
    const snapshot = clone(payload);
    const bodyUtf8 = JSON.stringify(snapshot);
    const source = { revisionId, payload: snapshot, bodyUtf8, rawBytesHash: digest(bodyUtf8) };
    const url = `https://example.test/retained/${revisionId}`;
    revisions.push({ ...clone(source), url, provenance: { revisionId, payloadHash: projectionInputHash(snapshot), source: url,
      firstReceivedAt: "2026-10-07T18:55:00.000Z", verifiedAt: "2026-10-07T18:55:00.010Z", publishedAt: null,
      availabilityBasis: "retained_capture", correctionOf: null } });
    return source;
  };
  const makeGame = (gameId: number, homeId: number, awayId: number, complex: boolean) => {
    const goal = (eventId: number, teamId: number, situationCode: string, periodType = "REG") => ({ eventId,
      typeDescKey: "goal", periodDescriptor: { number: periodType === "REG" ? 1 : periodType === "OT" ? 4 : 5, periodType },
      timeInPeriod: "03:21", situationCode, details: { eventOwnerTeamId: teamId, scoringPlayerId: teamId * 100 + 1,
        shotType: "wrist", goalieInNetId: situationCode[teamId === homeId ? 0 : 3] === "0" ? undefined : (teamId === homeId ? awayId : homeId) * 100 + 99 } });
    const plays: any[] = complex ? shootout
      ? [goal(1, homeId, "1551"), goal(2, awayId, "1551"), goal(3, homeId, "1551", "SO")]
      : [goal(1, homeId, "1541"), goal(2, homeId, "1560"), goal(3, homeId, "0651"), goal(4, homeId, "1331", "OT")]
      : [goal(1, homeId, "1551")];
    if (complex) plays.push({ eventId: 8, typeDescKey: "shot-on-goal", periodDescriptor: { number: 1, periodType: "REG" },
      timeInPeriod: "10:30", situationCode: "1451", details: { eventOwnerTeamId: homeId, shootingPlayerId: homeId * 100 + 1, goalieInNetId: awayId * 100 + 99 } });
    const periodDescriptor = { number: complex ? shootout ? 5 : 4 : 3, periodType: complex ? shootout ? "SO" : "OT" : "REG" };
    plays.push({ eventId: 99, typeDescKey: "game-end", periodDescriptor, timeInPeriod: "03:21" });
    const team = (teamId: number) => ({ id: teamId,
      score: plays.filter(row => row.typeDescKey === "goal" && row.details.eventOwnerTeamId === teamId && row.periodDescriptor.periodType !== "SO").length + (shootout && complex && teamId === homeId ? 1 : 0),
      sog: plays.filter(row => ["goal", "shot-on-goal"].includes(row.typeDescKey) && row.details.eventOwnerTeamId === teamId && row.periodDescriptor.periodType !== "SO").length });
    return { id: gameId, season: scope.seasonId, gameType: 2, gameState: "OFF", startTimeUTC: "2026-10-01T23:00:00Z",
      homeTeam: team(homeId), awayTeam: team(awayId), periodDescriptor, plays,
      rosterSpots: [homeId, awayId].flatMap(teamId => [{ teamId, playerId: teamId * 100 + 1, positionCode: "C" },
        { teamId, playerId: teamId * 100 + 99, positionCode: "G" }]) };
  };
  const retainedHistorySources = [makeSource("pbp-1", makeGame(2026020001, 10, 20, true)), makeSource("pbp-2", makeGame(2026020002, 11, 21, false))];
  const target = { id: scope.gameId, season: scope.seasonId, gameType: 2, gameState: "FUT", startTimeUTC: scope.startAt, homeTeam: { id: 10 }, awayTeam: { id: 11 } };
  const scheduleSources = retainedHistorySources.map((source, index) => makeSource(`schedule-${index + 1}`, { currentSeason: scope.seasonId, games: [source.payload, target] }));
  const history = retainedHistorySources.map((source, index) => goalHistoryFromOfficialFinal(source.payload, revisions[index].provenance).find(row => row.teamId === index + 10)!);
  const historyBundle = { scope, history, retainedHistorySources, scheduleSources,
    population: [10, 11].map((teamId, index) => ({ teamId, selectedGameIds: [2026020001 + index], incompleteGameIds: [] })),
    capturedAt: "2026-10-07T18:56:00.000Z", acceptanceEligible: false };
  return { historyBundle, revisions, parserSourceHash, attributeAudit: referenceAudit(historyBundle, revisions) };
}

// The comparison fixture uses the existing coarse attribute format, not the new credit/strength ledger.
function referenceAudit(bundle: any, revisions: any[]) {
  const games = bundle.retainedHistorySources.map((source: any) => {
    const payload = source.payload;
    const revision = revisions.find(row => row.revisionId === source.revisionId);
    const events = payload.plays.filter((row: any) => row.typeDescKey === "goal" && row.periodDescriptor.periodType !== "SO").map((play: any) => {
      const home = play.details.eventOwnerTeamId === payload.homeTeam.id;
      const digits = [...play.situationCode].map(Number);
      const attackingGoalie = digits[home ? 3 : 0], defendingGoalie = digits[home ? 0 : 3];
      const attackingSkaters = digits[home ? 2 : 1], defendingSkaters = digits[home ? 1 : 2];
      const state = attackingGoalie ? defendingGoalie ? "both_present" : "defending_absent" : defendingGoalie ? "attacking_absent" : "both_absent";
      const relation = attackingSkaters === defendingSkaters ? "equal_skaters" : attackingSkaters > defendingSkaters ? "more_skaters" : "fewer_skaters";
      return { eventId: play.eventId, teamId: play.details.eventOwnerTeamId, scoringPlayerId: play.details.scoringPlayerId,
        period: play.periodDescriptor.periodType, rawSituationCode: play.situationCode, goalieInNetId: play.details.goalieInNetId ?? null,
        attackingGoalie, defendingGoalie, attackingSkaters, defendingSkaters,
        ledgerCell: `${play.periodDescriptor.periodType}:${state}:${state === "both_present" ? relation : "not_partitioned"}`, gaps: [] };
    });
    return { gameId: payload.id, revisionId: source.revisionId, rawBytesHash: source.rawBytesHash,
      firstReceivedAt: revision.provenance.firstReceivedAt, originalVerifiedAt: revision.provenance.verifiedAt,
      officialPlayGoalCount: events.length, ledgerCounts: count(events.map((row: any) => row.ledgerCell)), events,
      excludedGoals: payload.plays.filter((row: any) => row.typeDescKey === "goal" && row.periodDescriptor.periodType === "SO").map((row: any) => ({ eventId: row.eventId })) };
  });
  return { version: "retained-goal-attribute-audit-v1", codeCommit: "a".repeat(40), parserHash: parserSourceHash,
    prospectiveScope: bundle.scope, acceptanceEligible: false, goalCount: games.reduce((sum: number, row: any) => sum + row.officialPlayGoalCount, 0), games };
}

function rewriteSource(input: ReturnType<typeof fixture>, revisionId: string, mutate: (payload: any) => void) {
  const source = [...input.historyBundle.retainedHistorySources, ...input.historyBundle.scheduleSources].find(row => row.revisionId === revisionId)!;
  mutate(source.payload);
  source.bodyUtf8 = JSON.stringify(source.payload);
  source.rawBytesHash = digest(source.bodyUtf8);
  const revision = input.revisions.find(row => row.revisionId === revisionId);
  Object.assign(revision, clone(source));
  revision.provenance.payloadHash = projectionInputHash(source.payload);
  for (const row of input.historyBundle.history.filter(row => row.provenance.revisionId === revisionId)) row.provenance = clone(revision.provenance);
  input.attributeAudit = referenceAudit(input.historyBundle, input.revisions);
}

describe("retained native official-play ledger audit", () => {
  it("replays disjoint REG/OT/net/strength cells without inventing exposure or rates", () => {
    const result = auditNativeGoalLedger(fixture());
    expect(result).toMatchObject({ goalCount: 5, candidateSogCount: 6, defendingGoalieAbsentGoalCount: 1,
      attackingOnlyGoalieAbsentGoalCount: 1, acceptanceEligible: false, priorAttributeAudit: { parityVerified: true },
      exposureAudit: { status: "unsupported", futurePkDecisionEligible: false } });
    const events = result.games[0].events;
    expect(events.find(row => row.eventId === 1)).toMatchObject({ ordinaryRegStrength: "PK", attackingSkaters: 4, defendingSkaters: 5 });
    expect(events.find(row => row.eventId === 2)).toMatchObject({ netState: "attacking_absent", defendingGoalie: 1, goalieInNetId: 2099, ordinaryRegStrength: null });
    expect(events.find(row => row.eventId === 3)).toMatchObject({ netState: "defending_absent", goalieInNetId: null, ordinaryRegStrength: null });
    expect(events.find(row => row.eventId === 4)).toMatchObject({ period: "OT", elapsedSeconds: 201, ordinaryRegStrength: null });
    expect(result.windows[0].pkObservedInputs.find(row => row.nhlPlayerId === 1001)).toMatchObject({ ordinaryRegPkObservedGoalCount: 1,
      ordinaryRegPkCandidateSogCount: 1, positiveTotalToiAppearanceCount: null, ordinaryRegPkExposureSeconds: null,
      secondsPerPlayingAppearance: null, sogPer60PkMinutes: null, goalsPerPkSog: null });
    expect(result.windows[0]).toMatchObject({ retainedFinalTeamGameCount: 1, nativeTenRowWindowProved: false });
    expect(result.games.every(row => row.availableAtProspectiveCutoff && !row.availableBeforeHistoricalStart)).toBe(true);
  });

  it("is deterministic across independent replays and unordered retained records", () => {
    const first = fixture();
    const permuted = clone(first);
    permuted.revisions.reverse(); permuted.historyBundle.history.reverse(); permuted.historyBundle.retainedHistorySources.reverse();
    permuted.historyBundle.scheduleSources.reverse(); permuted.historyBundle.population.reverse(); permuted.attributeAudit.games.reverse();
    expect(projectionInputHash(auditNativeGoalLedger(first))).toBe(projectionInputHash(auditNativeGoalLedger(permuted)));
  });

  it("excludes shootout goals and its standings adjustment", () => {
    const result = auditNativeGoalLedger(fixture(true));
    expect(result.goalCount).toBe(3);
    expect(result.excludedShootoutGoalCount).toBe(1);
    expect(result.games[0].teams.find(row => row.teamId === 10)).toMatchObject({ observedOfficialPlayGoals: 1, finalScore: 2, shootoutStandingsAdjustment: 1 });
    expect(result.games[0].events.every(row => row.period !== ("SO" as string))).toBe(true);
  });

  it("preserves OT and pulled-net intersections as one cell", () => {
    const input = fixture();
    rewriteSource(input, "pbp-1", payload => { payload.plays.find((row: any) => row.eventId === 4).situationCode = "0660";
      delete payload.plays.find((row: any) => row.eventId === 4).details.goalieInNetId; });
    const result = auditNativeGoalLedger(input);
    expect(result.games[0].events.find(row => row.eventId === 4)).toMatchObject({ period: "OT", netState: "both_absent", ordinaryRegStrength: null });
    expect(result.goalCount).toBe(5);
    expect(Object.values(result.goalLedgerCounts).reduce((sum, value) => sum + value, 0)).toBe(5);
  });

  it("retains exceptional goals while withholding their SOG credit", () => {
    const input = fixture();
    rewriteSource(input, "pbp-1", payload => { delete payload.plays[0].details.shotType; });
    const result = auditNativeGoalLedger(input);
    expect(result.goalCount).toBe(5);
    expect(result.games[0].events[0].creditClass).toBe("goal_shot_credit_unproved");
    expect(result.gaps).toContainEqual(expect.objectContaining({ code: "event_goal_sog_credit_unproved", gameId: 2026020001, eventId: 1 }));
  });

  it("reports point-clock, player identity and team SOG gaps without zero-filling", () => {
    const input = fixture();
    rewriteSource(input, "pbp-1", payload => { payload.plays[0].timeInPeriod = "03:99"; payload.plays[0].details.scoringPlayerId = 999999; payload.homeTeam.sog += 1; });
    const result = auditNativeGoalLedger(input);
    expect(result.games[0].events[0].elapsedSeconds).toBeNull();
    expect(result.gaps.map(row => row.code)).toEqual(expect.arrayContaining(["event_clock_unproved", "event_player_roster_identity_unproved", "team_sog_event_parity_unproved"]));
    expect(result.acceptanceEligible).toBe(false);
  });

  it("marks future-cutoff availability missing when receipts come too late", () => {
    const input = fixture();
    const revision = input.revisions[0];
    revision.provenance.firstReceivedAt = "2026-10-08T22:00:00.000Z";
    revision.provenance.verifiedAt = "2026-10-08T22:00:00.001Z";
    input.historyBundle.history[0].provenance = clone(revision.provenance);
    input.historyBundle.history[0].completedAt = revision.provenance.firstReceivedAt;
    input.historyBundle.capturedAt = "2026-10-08T22:01:00.000Z";
    input.attributeAudit = referenceAudit(input.historyBundle, input.revisions);
    const result = auditNativeGoalLedger(input);
    expect(result.games[0].availableAtProspectiveCutoff).toBe(false);
    expect(result.gaps).toContainEqual(expect.objectContaining({ code: "source_unavailable_at_prospective_cutoff", gameId: 2026020001 }));
  });

  it("rejects raw-byte corruption even when JSON facts remain unchanged", () => {
    const input = fixture(); input.historyBundle.retainedHistorySources[0].bodyUtf8 += " ";
    expect(() => auditNativeGoalLedger(input)).toThrow("raw bytes");
  });
  it("rejects a separately retained revision substituted with equivalent JSON bytes", () => {
    const input = fixture(); input.revisions[0].bodyUtf8 += " "; input.revisions[0].rawBytesHash = digest(input.revisions[0].bodyUtf8);
    expect(() => auditNativeGoalLedger(input)).toThrow("separately retained raw revision");
  });
  it("rejects parsed payload or historical-fact tampering", () => {
    const payload = fixture(); payload.historyBundle.retainedHistorySources[0].payload.homeTeam.score += 1;
    expect(() => auditNativeGoalLedger(payload)).toThrow("canonical payload");
    const facts = fixture(); facts.historyBundle.history[0].goalsFor += 1;
    expect(() => auditNativeGoalLedger(facts)).toThrow("Historical facts");
  });
  it("rejects duplicated events/revisions and nonterminal final responses", () => {
    const duplicate = fixture(); rewriteSource(duplicate, "pbp-1", payload => { payload.plays[1].eventId = payload.plays[0].eventId; });
    expect(() => auditNativeGoalLedger(duplicate)).toThrow("event identity");
    const missing = fixture(); missing.revisions.pop();
    expect(() => auditNativeGoalLedger(missing)).toThrow("revisions");
    const terminal = fixture(); rewriteSource(terminal, "pbp-1", payload => { payload.plays.pop(); });
    expect(() => auditNativeGoalLedger(terminal)).toThrow("terminal game-end");
    const period = fixture(); rewriteSource(period, "pbp-1", payload => { payload.plays[0].periodDescriptor.number = "1"; });
    expect(() => auditNativeGoalLedger(period)).toThrow("event period number");
  });
  it("rejects changed window, prior attributes and parser versions", () => {
    const window = fixture(); window.historyBundle.population[0].selectedGameIds = [2026020002];
    expect(() => auditNativeGoalLedger(window)).toThrow("schedule");
    const prior = fixture(); prior.attributeAudit.games[0].events[0].defendingGoalie = 0;
    expect(() => auditNativeGoalLedger(prior)).toThrow("differs from raw replay");
    const parser = fixture(); parser.attributeAudit.parserHash = "b".repeat(64);
    expect(() => auditNativeGoalLedger(parser)).toThrow("parser/version");
  });
  it("rejects a prospective scope that disagrees with retained schedules", () => {
    const input = fixture();
    rewriteSource(input, "schedule-1", payload => { payload.games[1].startTimeUTC = "2026-10-09T23:00:00Z"; });
    expect(() => auditNativeGoalLedger(input)).toThrow("Prospective scope");
  });
  it("keeps unobserved roster members distinct from measured nonuse", () => {
    const result = auditNativeGoalLedger(fixture());
    const goalie = result.windows[0].pkObservedInputs.find(row => row.nhlPlayerId === 1099)!;
    expect(goalie.ordinaryRegPkObservedGoalCount).toBe(0);
    expect(goalie.ordinaryRegPkExposureSeconds).toBeNull();
    expect(goalie.positiveTotalToiAppearanceCount).toBeNull();
    expect(result.gaps.map(row => row.code)).toEqual(expect.arrayContaining(["shift_exposure_unavailable", "playing_appearance_denominator_unavailable", "native_window_lineage_unproved", "historical_pregame_availability_unproved"]));
  });
  it("converts minute:second clocks without interpreting them as TOI", () => {
    expect(nativeEventClockSeconds("10:30")).toBe(630);
    expect(nativeEventClockSeconds("00:00")).toBe(0);
    expect(nativeEventClockSeconds("03:60")).toBeNull();
    expect(nativeEventClockSeconds(630)).toBeNull();
  });
});

describe("local audit CLI", () => {
  it("writes reproducible receipts, never calls fetch and refuses to overwrite inputs", () => {
    const input = fixture();
    const folder = mkdtempSync(join(tmpdir(), "native-goal-ledger-test-"));
    const fetch = vi.fn(() => { throw new Error("Network forbidden in local audit"); });
    vi.stubGlobal("fetch", fetch);
    try {
      const history = join(folder, "history.json"), prior = join(folder, "prior.json");
      writeFileSync(history, JSON.stringify(input.historyBundle)); writeFileSync(prior, JSON.stringify(input.attributeAudit));
      for (const revision of input.revisions) writeFileSync(join(folder, `${revision.revisionId}.json`), JSON.stringify(revision));
      const args = ["--history", history, "--revisions", folder, "--attribute-audit", prior, "--output"];
      const first = runNativeGoalLedgerAudit([...args, join(folder, "first.json")]);
      const second = runNativeGoalLedgerAudit([...args, join(folder, "second.json")]);
      expect(first.resultHash).toBe(second.resultHash);
      expect(readFileSync(join(folder, "first.json"), "utf8")).toBe(readFileSync(join(folder, "second.json"), "utf8"));
      expect(first.inputFiles).toHaveLength(6);
      expect(() => runNativeGoalLedgerAudit([...args, history])).toThrow("EEXIST");
      expect(JSON.parse(readFileSync(history, "utf8"))).toEqual(input.historyBundle);
      expect(fetch).not.toHaveBeenCalled();
    } finally { vi.unstubAllGlobals(); rmSync(folder, { recursive: true, force: true }); }
  });
  it("rejects missing arguments and traversal revision IDs", () => {
    expect(() => runNativeGoalLedgerAudit([])).toThrow("--history");
    expect(() => runNativeGoalLedgerAudit(["--history", "fixture", "--history", "fixture"])).toThrow("--history");
    const input = fixture(), folder = mkdtempSync(join(tmpdir(), "native-goal-ledger-invalid-"));
    try {
      input.historyBundle.retainedHistorySources[0].revisionId = "../unrelated";
      const history = join(folder, "history.json"), prior = join(folder, "prior.json");
      writeFileSync(history, JSON.stringify(input.historyBundle)); writeFileSync(prior, JSON.stringify(input.attributeAudit));
      expect(() => runNativeGoalLedgerAudit(["--history", history, "--revisions", folder, "--attribute-audit", prior, "--output", join(folder, "result.json")])).toThrow("Unsafe retained revision filename");
    } finally { rmSync(folder, { recursive: true, force: true }); }
  });
});
