// @vitest-environment node
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { auditRetainedPlayerPpEvidence, runRetainedPlayerPpAudit } from "./audit-retained-player-pp-evidence";

const target = { playerId: 8478402, teamId: 22 };
const digest = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
const directories: string[] = [];
const terminal = () => ({ eventId: 90, typeDescKey: "game-end" });
const goal = (eventId = 1, overrides = {}) => ({
  eventId, typeDescKey: "goal", situationCode: "1451",
  periodDescriptor: { number: 1, periodType: "REG" },
  details: { eventOwnerTeamId: 22, scoringPlayerId: target.playerId, assist1PlayerId: 101 },
  ...overrides,
});
function payload(plays: readonly unknown[] = [goal(), terminal()]) {
  return {
    id: 2026020015, gameDate: "2026-10-03", season: 20262027, gameType: 2,
    gameState: "OFF", limitedScoring: false,
    awayTeam: { id: 23, abbrev: "SYN", score: 1 }, homeTeam: { id: 22, abbrev: "FIX", score: 2 },
    rosterSpots: [{ playerId: target.playerId, teamId: 22 }, { playerId: 101, teamId: 22 }, { playerId: 102, teamId: 22 }],
    plays,
  };
}
function source(value: unknown = payload(), revisionId = "synthetic-revision-1") {
  const bodyUtf8 = JSON.stringify(value);
  return { revisionId, payload: value, bodyUtf8, rawBytesHash: digest(bodyUtf8) };
}
function audit(sources: unknown[] = [source()]) {
  const bytes = Buffer.from(JSON.stringify({ evidenceKind: "synthetic_mechanics_only", retainedHistorySources: sources }));
  return auditRetainedPlayerPpEvidence(bytes, digest(bytes), target);
}
afterEach(() => { for (const path of directories.splice(0)) rmSync(path, { recursive: true }); vi.unstubAllGlobals(); });

describe("retained PP auditor: synthetic mechanics only, no qualification evidence", () => {
  it("binds exact bytes, reports positive goals and assists deterministically, and leaves totals unknown", () => {
    const ppAssist = goal(2, { details: { eventOwnerTeamId: 22, scoringPlayerId: 101, assist1PlayerId: target.playerId, assist2PlayerId: 102 } });
    const sources = [source(payload([goal(), ppAssist, terminal()]))];
    const before = JSON.stringify(sources);
    const result = audit(sources);
    expect(audit(sources)).toEqual(result);
    expect(JSON.stringify(sources)).toBe(before);
    expect(result.inputBinding.status).toBe("matched");
    expect(result.sources[0]).toMatchObject({
      rawBinding: { hash: "matched", parsedPayload: "matched" },
      eventIds: { status: "valid" }, finalStructure: { status: "present", terminalCount: 1 },
      targetTeamPresence: "present", targetRosterPresence: "present",
      positiveRetainedPpCredits: { goals: 1, assists: 1, points: 2 }, observedPpTotals: null, issues: [],
    });
    expect(result.sources[0].goalEvents.map(event => event.targetCredit)).toEqual(["goal", "assist"]);
    expect(result.qualificationEligible).toBe(false);
    expect(Object.values(result.unresolvedEvidence).every(value => value === "unknown")).toBe(true);
    expect(result.sources[0].eventPopulation).toBe("unknown");
  });

  it("uses the scoring team's orientation for away PP credits and supports OT", () => {
    const game = payload([goal(1, { situationCode: "1541", periodDescriptor: { number: 4, periodType: "OT" } }), terminal()]);
    [game.homeTeam.id, game.awayTeam.id] = [23, 22];
    expect(audit([source(game)]).sources[0].positiveRetainedPpCredits).toEqual({ goals: 1, assists: null, points: 1 });
  });

  it.each([
    ["1551", "ev", "non_pp_goal"], ["1541", "pk", "non_pp_goal"],
    ["0651", "unknown", "unguarded_net_strength_ambiguous"],
    ["1450", "unknown", "unguarded_net_strength_ambiguous"],
    ["bad", "unknown", "invalid_situation_code"],
    ["1251", "unknown", "invalid_active_skater_count"],
  ] as const)("classifies situation %s without invented PP credit", (situationCode, strength, reason) => {
    const result = audit([source(payload([goal(1, { situationCode }), terminal()]))]).sources[0];
    expect(result.goalEvents[0].strength).toBe(strength);
    expect(result.goalEvents[0].reasons).toContain(reason);
    expect(result.positiveRetainedPpCredits.points).toBeNull();
  });

  it("excludes shootout goals", () => {
    const result = audit([source(payload([goal(1, { periodDescriptor: { number: 5, periodType: "SO" } }), terminal()]))]).sources[0];
    expect(result.goalEvents[0]).toMatchObject({ strength: "shootout", attribution: "excluded" });
    expect(result.positiveRetainedPpCredits.points).toBeNull();
  });

  it.each([
    ["missing_event", [{ typeDescKey: "goal" }, terminal()], "missing_or_invalid_event_id"],
    ["duplicate_event", [goal(), goal(), terminal()], "duplicate_event_id"],
    ["no_terminal", [goal()], "terminal_count_not_one"],
    ["multiple_terminal", [goal(), terminal(), { eventId: 91, typeDescKey: "game-end" }], "terminal_count_not_one"],
    ["terminal_only", [terminal()], "missing_nonterminal_events"],
  ] as const)("rejects %s as complete retained structure", (_name, plays, reason) => {
    const result = audit([source(payload(plays))]).sources[0];
    expect(result.issues).toContain(reason);
    expect(result.finalStructure.status).toBe("partial");
    expect(result.positiveRetainedPpCredits.points).toBeNull();
  });

  it.each([
    ["gameState", "LIVE", "missing_final_game_state"],
    ["limitedScoring", true, "limited_scoring_or_unknown_population_mode"],
    ["limitedScoring", undefined, "limited_scoring_or_unknown_population_mode"],
    ["gameDate", "2026-02-30", "invalid_game_metadata"],
    ["id", null, "missing_or_invalid_game_id"],
    ["id", 0, "missing_or_invalid_game_id"],
  ] as const)("leaves partial/invalid %s evidence unresolved", (key, value, reason) => {
    const game = { ...payload(), [key]: value };
    const result = audit([source(game)]).sources[0];
    expect(result.issues).toContain(reason);
    expect(result.positiveRetainedPpCredits.points).toBeNull();
  });

  it("allows equal event IDs in different games but invalidates every duplicate game or revision", () => {
    const first = source(), second = source({ ...payload(), id: 2026020004 }, "synthetic-revision-2");
    expect(audit([first, second]).sources.map(row => row.positiveRetainedPpCredits.points)).toEqual([1, 1]);
    expect(audit([first, source(payload(), "synthetic-revision-2")]).sources.every(row => row.issues.includes("duplicate_game_id") && row.positiveRetainedPpCredits.points === null)).toBe(true);
    expect(audit([first, { ...second, revisionId: first.revisionId }]).sources.every(row => row.issues.includes("duplicate_revision_id"))).toBe(true);
    expect(audit([{ ...first, revisionId: null }]).sources[0].issues).toContain("missing_revision_id");
  });

  it.each([
    ["hash_mismatch", { rawBytesHash: "0".repeat(64) }, "raw_body_hash_mismatched"],
    ["missing_body", { bodyUtf8: null }, "raw_body_hash_missing"],
    ["invalid_hash", { rawBytesHash: "wrong" }, "raw_body_hash_invalid"],
    ["payload_mismatch", { payload: { ...payload(), id: 2026020004 } }, "raw_body_payload_mismatched"],
    ["invalid_json", { bodyUtf8: "{", rawBytesHash: digest("{") }, "raw_body_payload_invalid"],
  ] as const)("withholds credit on %s", (_name, change, reason) => {
    const result = audit([{ ...source(), ...change }]).sources[0];
    expect(result.issues).toContain(reason);
    expect(result.positiveRetainedPpCredits.points).toBeNull();
  });

  it("compares parsed payloads independently of object key order", () => {
    const game = payload(), row = source(game);
    row.bodyUtf8 = JSON.stringify(Object.fromEntries(Object.entries(game).reverse()));
    row.rawBytesHash = digest(row.bodyUtf8);
    expect(audit([row]).sources[0].rawBinding.parsedPayload).toBe("matched");
  });

  it.each([
    [{ scoringPlayerId: null }, "missing_or_invalid_scorer"],
    [{ assist1PlayerId: -1 }, "invalid_assist_id"],
    [{ assist1PlayerId: target.playerId }, "contradictory_player_credit"],
    [{ assist1PlayerId: null, assist2PlayerId: 101 }, "second_assist_without_first"],
    [{ eventOwnerTeamId: 99 }, "invalid_goal_team"],
    [{ eventOwnerTeamId: 23 }, "target_credit_team_mismatch"],
    [{ assist1PlayerId: 999 }, "unverified_or_contradictory_credit_team"],
  ] as const)("withholds invalid or contradictory credit %j", (change, reason) => {
    const base = goal();
    const result = audit([source(payload([goal(1, { details: { ...base.details, ...change } }), terminal()]))]).sources[0];
    expect(result.goalEvents[0].attribution).toBe("unresolved");
    expect(result.goalEvents[0].reasons).toContain(reason);
    expect(result.positiveRetainedPpCredits.points).toBeNull();
  });

  it("does not turn no goal context, absent teams, absent players or missing rosters into observed zero", () => {
    const noGoal = payload([{ eventId: 1, typeDescKey: "faceoff" }, terminal()]);
    const noTeam = payload(); noTeam.homeTeam.id = 24;
    const noPlayer = payload(); noPlayer.rosterSpots = noPlayer.rosterSpots.filter(row => row.playerId !== target.playerId);
    const wrongTeam = payload(); wrongTeam.rosterSpots[0].teamId = 23;
    const results = [noGoal, noTeam, noPlayer, wrongTeam, { ...payload(), rosterSpots: null }].map(game => audit([source(game)]).sources[0]);
    expect(results.every(row => row.positiveRetainedPpCredits.points === null && row.observedPpTotals === null)).toBe(true);
    expect(results[1].targetTeamPresence).toBe("absent");
    expect(results[2].targetRosterPresence).toBe("absent");
    expect(results[3].targetRosterPresence).toBe("contradictory");
    expect(results[4].targetRosterPresence).toBe("unknown");
  });

  it("does not accept asserted population, exposure, timing, rights or participation as proof", () => {
    const row = { ...source(), populationComplete: true, publishedAt: "2026-10-03T00:00:00Z",
      rights: "allowed", exposure: 120, participation: "confirmed" };
    const result = audit([row]);
    expect(Object.values(result.unresolvedEvidence).every(value => value === "unknown")).toBe(true);
    expect(result.qualificationEligible).toBe(false);
    expect(result.sources[0].observedPpTotals).toBeNull();
  });

  it("fails closed before examining sources on input byte mismatch and invalid JSON", () => {
    const bytes = Buffer.from(JSON.stringify({ retainedHistorySources: [source()] }));
    expect(auditRetainedPlayerPpEvidence(bytes, "0".repeat(64), target)).toMatchObject({ sources: [], inputBinding: { status: "mismatched" } });
    expect(auditRetainedPlayerPpEvidence(bytes, "invalid", target).sources).toEqual([]);
    const invalid = Buffer.from("{");
    expect(auditRetainedPlayerPpEvidence(invalid, digest(invalid), target).issues).toContain("invalid_input_json_or_utf8");
    expect(audit([]).issues).toContain("empty_retained_history_sources");
    expect(audit([null]).sources[0].positiveRetainedPpCredits.points).toBeNull();
  });

  it("reads a synthetic local CLI input without fetching or mutating it and validates options", () => {
    const network = vi.fn(() => { throw new Error("Network forbidden"); }); vi.stubGlobal("fetch", network);
    const directory = mkdtempSync(join(tmpdir(), "synthetic-retained-pp-")); directories.push(directory);
    const path = join(directory, "inputs.json");
    const bytes = Buffer.from(JSON.stringify({ evidenceKind: "synthetic_mechanics_only", retainedHistorySources: [source()] }));
    writeFileSync(path, bytes);
    const args = ["--input", path, "--input-sha256", digest(bytes), "--player-id", "8478402", "--team-id", "22"];
    expect(runRetainedPlayerPpAudit(args).sources[0].positiveRetainedPpCredits.points).toBe(1);
    expect(readFileSync(path)).toEqual(bytes); expect(network).not.toHaveBeenCalled();
    expect(() => runRetainedPlayerPpAudit([...args, "--input", path])).toThrow("Use --input");
    expect(() => runRetainedPlayerPpAudit([...args.slice(0, 6), "--team-id", "0"])).toThrow("Use --input");
    expect(() => runRetainedPlayerPpAudit(["--input", path])).toThrow("Use --input");
    expect(() => auditRetainedPlayerPpEvidence(bytes, digest(bytes), { ...target, playerId: -1 })).toThrow("positive safe integers");
  });
});
