// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { playerForecastSourcePayloadHash } from "../lib/player-forecasts/sourceSnapshot";
import type { CurrentRosterInjuryEvidence } from "../lib/player-forecasts/currentRosterInjuryEvidence";
import { assembleCurrentRosterNativeInputs } from "../lib/player-forecasts/currentRosterNativeInputs";
import { previewNativeBaseline, previewNativeGoalieVolume, previewNativeGoalieWins } from "./preview-native-baseline";
import { runCurrentSeasonSogAssembly } from "./capture-current-season-sog-baseline";
import { CURRENT_SEASON_SOG_GAME_SCOPE_VERSION, CURRENT_SEASON_SOG_SCOPE,
  type CurrentSeasonSogGameScope } from "../lib/player-forecasts/currentSeasonSogBaseline";

afterEach(() => vi.useRealTimers());
describe("offline current-season SOG assembly entrypoint", () => {
  it("writes one exclusive private synthetic packet, with no transport/database access", () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-15T20:00:00Z"));
    const directory = mkdtempSync(join(tmpdir(), "forge-sog-synthetic-"));
    const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(() => { throw new Error("Network forbidden"); });
    try {
      const history = { id: 2026020001, season: 20262027, gameType: 2, gameDate: "2026-10-08",
        startTimeUTC: "2026-10-08T23:00:00Z", homeTeam: { id: 13 }, awayTeam: { id: 23 }, gameState: "OFF" };
      const capture = (payload: unknown, url: string) => {
        const rawBody = JSON.stringify(payload);
        return { rawBody, url, capturedAt: "2026-10-15T19:00:00Z", bodySha256: createHash("sha256").update(rawBody).digest("hex") };
      };
      const fixture = { schedule: capture({ games: [history, { ...history, id: 2026020112,
        gameDate: "2026-10-15", startTimeUTC: "2026-10-15T23:00:00Z", gameState: "FUT" }] },
      "https://api-web.nhle.com/v1/club-schedule-season/VAN/20262027"), boxscores: [capture({ ...history,
        playerByGameStats: { homeTeam: { forwards: [{ playerId: 1 }], defense: [], goalies: [{ playerId: 2 }] },
          awayTeam: { forwards: [{ playerId: 8478444, toi: "10:00", sog: 3 }], defense: [], goalies: [{ playerId: 3 }] } } },
      "https://api-web.nhle.com/v1/gamecenter/2026020001/boxscore")] };
      const input = join(directory, "synthetic-responses.json"), out = join(directory, "packet.json");
      writeFileSync(input, JSON.stringify(fixture));
      const args = ["--responses", input, "--out", out];
      expect(runCurrentSeasonSogAssembly(args)).toMatchObject({ sourceRequests: 0, databaseWrites: 0,
        localFilesWritten: 1, status: "unreleased_local", publicUsesApproved: false });
      expect(JSON.parse(readFileSync(out, "utf8")).target).toMatchObject({ mean: 3, sampleSize: 1 });
      expect(statSync(out).mode & 0o777).toBe(0o600);
      expect(() => runCurrentSeasonSogAssembly(args)).toThrow();
      expect(() => runCurrentSeasonSogAssembly([...args, "--collect", "true"])).toThrow();
      expect(() => runCurrentSeasonSogAssembly(["--responses", input, "--out", input])).toThrow();
      const link = join(directory, "link.json"); symlinkSync(input, link);
      expect(() => runCurrentSeasonSogAssembly(["--responses", link, "--out", join(directory, "other.json")])).toThrow();
      expect(fetch).not.toHaveBeenCalled();
    } finally { fetch.mockRestore(); rmSync(directory, { recursive: true, force: true }); }
  });
  it("accepts one explicit future scope offline and rejects scope-file/clock errors before creating output", () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-20T20:00:00.000Z"));
    const directory = mkdtempSync(join(tmpdir(), "forge-sog-future-synthetic-"));
    const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(() => { throw new Error("Network forbidden"); });
    try {
      const scope: CurrentSeasonSogGameScope = { ...CURRENT_SEASON_SOG_SCOPE, scopeVersion: CURRENT_SEASON_SOG_GAME_SCOPE_VERSION,
        targetGameId: 2026020200, targetGameDate: "2026-10-20", targetStartTimeUTC: "2026-10-20T23:00:00Z",
        isHome: false, cutoffAt: "2026-10-20T19:30:00.000Z", expiresAt: "2026-10-20T23:00:00Z" };
      const history = { id: 2026020001, season: 20262027, gameType: 2, gameDate: "2026-10-08",
        startTimeUTC: "2026-10-08T23:00:00Z", homeTeam: { id: 13 }, awayTeam: { id: 23 }, gameState: "OFF" };
      const capture = (payload: unknown, url: string) => { const rawBody = JSON.stringify(payload);
        return { rawBody, url, capturedAt: "2026-10-20T19:00:00Z", bodySha256: createHash("sha256").update(rawBody).digest("hex") }; };
      const receipts = { schedule: capture({ games: [history, { ...history, id: scope.targetGameId,
        gameDate: scope.targetGameDate, startTimeUTC: scope.targetStartTimeUTC, gameState: "FUT" }] },
      "https://api-web.nhle.com/v1/club-schedule-season/VAN/20262027"), boxscores: [capture({ ...history,
        playerByGameStats: { homeTeam: { forwards: [{ playerId: 1 }], defense: [], goalies: [{ playerId: 2 }] },
          awayTeam: { forwards: [{ playerId: scope.nhlPlayerId, toi: "10:00", sog: 3 }], defense: [], goalies: [{ playerId: 3 }] } } },
      "https://api-web.nhle.com/v1/gamecenter/2026020001/boxscore")] };
      const input = join(directory, "responses.json"), scopePath = join(directory, "scope.json"), out = join(directory, "packet.json");
      writeFileSync(input, JSON.stringify(receipts)); writeFileSync(scopePath, JSON.stringify(scope));
      const args = ["--responses", input, "--out", out, "--scope", scopePath];
      expect(runCurrentSeasonSogAssembly(args)).toMatchObject({ sourceRequests: 0, databaseWrites: 0, publicUsesApproved: false });
      const packet = JSON.parse(readFileSync(out, "utf8"));
      expect(packet.scope).toEqual(scope); expect(packet.target).toMatchObject({ mean: 3, sampleSize: 1 });
      expect(packet.cutoffAt).toBe(scope.cutoffAt); expect(packet.generatedAt).toBe("2026-10-20T20:00:00.000Z");
      expect(packet.participation).toBeNull();
      expect(statSync(out).mode & 0o777).toBe(0o600);
      expect(() => runCurrentSeasonSogAssembly(args)).toThrow();
      expect(() => runCurrentSeasonSogAssembly(["--responses", input, "--out", scopePath, "--scope", scopePath])).toThrow();
      const link = join(directory, "scope-link.json"); symlinkSync(scopePath, link);
      expect(() => runCurrentSeasonSogAssembly(["--responses", input, "--out", join(directory, "link-out.json"), "--scope", link])).toThrow();
      scope.cutoffAt = "2026-10-20T20:00:00.000001Z"; writeFileSync(scopePath, JSON.stringify(scope));
      const invalidOut = join(directory, "invalid.json");
      expect(() => runCurrentSeasonSogAssembly(["--responses", input, "--out", invalidOut, "--scope", scopePath])).toThrow();
      expect(() => statSync(invalidOut)).toThrow();
      expect(fetch).not.toHaveBeenCalled();
    } finally { fetch.mockRestore(); rmSync(directory, { recursive: true, force: true }); }
  });
});

describe("offline full-roster native input assembly", () => {
  function fixture() {
    const capturedAt = "2026-10-15T19:00:00Z", cutoffAt = "2026-10-15T20:00:00Z";
    const game = { id: 2026020001, seasonId: 20262027, date: "2026-10-08", type: 2 as const,
      startTime: "2026-10-08T23:00:00Z", homeTeamId: 1, awayTeamId: 2, endpoints: ["boxscore", "landing"] as Array<"boxscore" | "landing"> };
    const goalie = (playerId: number, ga: number, decision: string) => ({ playerId, position: "G", starter: true,
      decision, toi: "60:00", saves: 20, shotsAgainst: 20 + ga, goalsAgainst: ga, saveShotsAgainst: `20/${20 + ga}` });
    const common = { id: game.id, season: game.seasonId, gameDate: game.date, gameType: 2,
      startTimeUTC: game.startTime, gameState: "OFF", homeTeam: { id: 1, score: 1 }, awayTeam: { id: 2, score: 0 },
      periodDescriptor: { number: 3, periodType: "REG", maxRegulationPeriods: 3 } };
    const boxscore = { ...common, playerByGameStats: {
      homeTeam: { forwards: [{ playerId: 77, toi: "20:00", goals: 1, assists: 0, powerPlayGoals: 1, sog: 3, hits: 2, blockedShots: 1, pim: 0 }], defense: [], goalies: [goalie(99, 0, "W")] },
      awayTeam: { forwards: [{ playerId: 111, toi: "18:00", goals: 0, assists: 0, powerPlayGoals: 0 }], defense: [], goalies: [goalie(88, 1, "L")] } } };
    const landing = { ...common, summary: { scoring: [1, 2, 3].map(number => ({
      periodDescriptor: { number, periodType: "REG", maxRegulationPeriods: 3 },
      goals: number === 1 ? [{ eventId: 10, playerId: 77, isHome: true, strength: "pp", assists: [] }] : [] })) } };
    const receipt = (body: unknown, endpoint: string) => {
      const rawBody = ` ${JSON.stringify(body)}\n`; // Retain bytes distinct from canonical content hashing.
      return { url: `https://api-web.nhle.com/v1/gamecenter/${game.id}/${endpoint}`, capturedAt,
        rawBody, bodySha256: createHash("sha256").update(rawBody).digest("hex") };
    };
    return { seasonId: 20262027, cutoffAt, games: [game], roster: [
      { playerId: 7, nhlPlayerId: 77, teamId: 3, rosterRevision: "current-roster", playerClass: "skater" as const },
      { playerId: 8, nhlPlayerId: 88, teamId: 2, rosterRevision: "current-roster", playerClass: "goalie" as const },
      { playerId: 9, nhlPlayerId: 999, teamId: 3, rosterRevision: "current-roster", playerClass: "skater" as const }],
      receipts: [receipt(boxscore, "boxscore"), receipt(landing, "landing")] };
  }
  it("retains exact HTTP bytes and traded-player historical team, then reproduces denied skater/goalie preview inputs", async () => {
    const input = fixture(), before = JSON.stringify(input), now = new Date("2026-10-15T20:00:00Z");
    const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(() => { throw new Error("Network forbidden"); });
    try {
      const assembled = assembleCurrentRosterNativeInputs(input, now);
      expect(assembled).toMatchObject({ sourceRequests: 0, databaseWrites: 0, forecastIssued: false, publicUsesApproved: false,
        sourceReceiptCoverage: "complete_for_approved_urls", selectedHistoryCoverage: "unverified" });
      expect(assembled.coverage[0].games[0]).toMatchObject({ historicalTeamId: 1, status: "verified_positive_minutes" });
      expect(assembled.skaters[0].payload.teamId).toBe(3);
      const raw = assembled.skaters[0].payload.appearances[0].finalBoxscore as any;
      expect(raw.rawRow.id).toBe(`http:${input.receipts[0].bodySha256}`);
      expect(raw.rawRow.httpReceipt.rawBody).toBe(input.receipts[0].rawBody);
      expect(raw.contentHash).not.toBe(input.receipts[0].bodySha256);
      expect(assembled.coverage[2]).toMatchObject({ playerId: 9, observationEmitted: false, verifiedAppearances: 0 });
      expect(assembled.coverage[2].games[0].reasons).toContain("absent_from_selected_game");
      const scope = { seasonId: 20262027, scheduleRevision: "reviewed-schedule", games: [{ gameId: 2026020112, scheduledAt: "2026-10-15T23:00:00Z" }], players: [input.roster[0]] };
      const skater = await previewNativeBaseline(assembled.skaters, scope, "2026-10-15T22:00:00Z", now);
      expect(skater.bundle.sources.find(row => row.targetKey === "PP_POINTS")).toMatchObject({ mean: 1, released: false });
      expect(skater.bundle.sources.find(row => row.targetKey === "TIME_ON_ICE_PER_GAME")).toMatchObject({ mean: 20, unit: "minutes" });
      const goalieScope = { ...scope, players: [input.roster[1]] };
      const volume = await previewNativeGoalieVolume(assembled.goalieVolume, goalieScope, "2026-10-15T22:00:00Z", now);
      expect(volume.bundle.sources.find(row => row.targetKey === "SHOTS_AGAINST_GOALIE")?.mean).toBe(21);
      const wins = await previewNativeGoalieWins(assembled.goalieWins, goalieScope, "2026-10-15T22:00:00Z", now);
      expect(wins.bundle.sources[0]).toMatchObject({ targetKey: "WINS_GOALIE", mean: 0, basis: "per_appearance", released: false });
      expect(JSON.stringify(input)).toBe(before); expect(fetch).not.toHaveBeenCalled();
    } finally { fetch.mockRestore(); }
  });
  it("executes explicit full-roster CLI assembly with compact receipt and exclusive private output", () => {
    const input = fixture(), { receipts, ...scope } = input;
    vi.useFakeTimers(); vi.setSystemTime(new Date(input.cutoffAt));
    const directory = mkdtempSync(join(tmpdir(), "forge-roster-assembly-test-"));
    const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(() => { throw new Error("Network forbidden"); });
    try {
      const responses = join(directory, "responses.json"), scopePath = join(directory, "scope.json"), out = join(directory, "packet.json");
      writeFileSync(responses, JSON.stringify({ receipts, failures: [] })); writeFileSync(scopePath, JSON.stringify({ ...scope, injuryEvidence: [injuryReceipt("ifttt")] }));
      const argv = ["--responses", responses, "--out", out, "--roster-scope", scopePath];
      const result = runCurrentSeasonSogAssembly(argv);
      expect(result).toMatchObject({ status: "unreleased_roster_inputs", rosterPlayers: 3, skaterObservations: 1,
        goalieWinObservations: 1, goalieVolumeObservations: 1, playersWithoutVerifiedAppearances: 1,
        sourceRequests: 0, databaseWrites: 0, publicUsesApproved: false });
      expect(result).not.toHaveProperty("receipts"); expect(result).not.toHaveProperty("skaters");
      const packet = JSON.parse(readFileSync(out, "utf8"));
      expect(packet.skaters[0].payload.appearances[0].targets.GOALS).toBe(1);
      expect(packet.goalieWins[0].payload.appearances[0].goalsAgainst).toBe(1);
      expect(packet.goalieVolume[0].payload.appearances[0].saves).toBe(20);
      expect(packet.coverage[2]).toMatchObject({ missingHistoryContext: "injury_supported", seasonAppearanceAbsence: "unverified" });
      expect(statSync(out).mode & 0o777).toBe(0o600);
      expect(() => runCurrentSeasonSogAssembly(argv)).toThrow();
      expect(() => runCurrentSeasonSogAssembly([...argv, "--scope", scopePath])).toThrow();
      expect(fetch).not.toHaveBeenCalled();
    } finally { fetch.mockRestore(); rmSync(directory, { recursive: true, force: true }); }
  });
  function injuryReceipt(provider: "yahoo" | "ifttt"): CurrentRosterInjuryEvidence {
    const common = { playerId: 9, nhlPlayerId: 999, seasonId: 20262027, sourceId: "synthetic-injury-source",
      observedAt: "2026-10-15T18:00:00Z", capturedAt: "2026-10-15T19:00:00Z", expiresAt: "2026-10-16T18:00:00Z" };
    if (provider === "yahoo") {
      const payload = { player_key: "477.p.999", status: "IR", status_full: "Injured Reserve", injury_note: "Lower-body injury" };
      return { ...common, provider, sourceKind: "original_provider_payload", payload, contentHash: playerForecastSourcePayloadHash(payload) };
    }
    const text = "Synthetic Player remains out with a knee injury.";
    const payload = { text, event: { playerId: 9, playerName: "Synthetic Player", teamId: 3, kind: "injury" as const,
      state: "ongoing" as const, modality: "affirmative" as const, availability: "out" as const,
      availabilityScope: "unspecified" as const, timeline: null, timelines: [], evidence: { start: 0, end: text.length, text } } };
    return { ...common, provider, payload, contentHash: playerForecastSourcePayloadHash(payload) };
  }
  it.each(["yahoo", "ifttt"] as const)("labels a %s-supported finite-history gap separately from ability or complete season absence", provider => {
    const input = fixture(), injuryEvidence = [injuryReceipt(provider)];
    const scoped = { ...input, roster: input.roster.map(row => ({ ...row, yahooPlayerKey: "477.p.999" })), injuryEvidence };
    const original = JSON.stringify(scoped);
    const result = assembleCurrentRosterNativeInputs(scoped, new Date(input.cutoffAt));
    expect(result.coverage[2]).toMatchObject({ verifiedAppearances: 0, observationEmitted: false,
      historyStatus: "no_verified_appearances_in_selected_games", missingHistoryContext: "injury_supported",
      seasonAppearanceAbsence: "unverified", priorAbilityInference: "none" });
    expect(result.coverage[0].missingHistoryContext).toBe("not_applicable");
    expect(result.injuryEvidence).toEqual(injuryEvidence);
    expect(result).toMatchObject({ injuryClassification: "diagnostic_only", sourceRequests: 0, databaseWrites: 0, forecastIssued: false });
    expect(JSON.stringify(scoped)).toBe(original);
  });
  it.each(["merged Yahoo row", "generic note", "conflicting status", "stale", "identity", "hash", "future", "tentative IFTTT", "practice absence", "game scope", "opposing return"])("keeps %s injury evidence unknown", problem => {
    const input = fixture();
    const evidence = injuryReceipt(["tentative IFTTT", "practice absence", "game scope", "opposing return"].includes(problem) ? "ifttt" : "yahoo");
    if (evidence.provider === "yahoo") {
      if (problem === "merged Yahoo row") evidence.sourceKind = "merged_player_row";
      if (problem === "generic note") evidence.payload = { player_key: "477.p.999", injury_note: "News update" };
      if (problem === "conflicting status") evidence.payload.injury_note = "Healthy and cleared to play";
    } else {
      if (problem === "tentative IFTTT") evidence.payload.event.modality = "tentative";
      if (problem === "practice absence") evidence.payload.event.kind = "participation";
      if (problem === "game scope") evidence.payload.event.availabilityScope = "game";
      if (problem === "opposing return") { evidence.payload.event.state = "confirmed_return"; evidence.payload.event.availability = "available"; }
    }
    if (problem === "stale") evidence.observedAt = "2026-10-13T18:00:00Z";
    if (problem === "future") evidence.capturedAt = "2026-10-15T20:00:00.000001Z";
    if (problem === "identity") evidence.nhlPlayerId = 1234;
    evidence.contentHash = problem === "hash" ? "a".repeat(64) : playerForecastSourcePayloadHash(evidence.payload);
    const injuryEvidence = problem === "opposing return" ? [injuryReceipt("ifttt"), evidence] : [evidence];
    const result = assembleCurrentRosterNativeInputs({ ...input,
      roster: input.roster.map(row => ({ ...row, yahooPlayerKey: "477.p.999" })), injuryEvidence }, new Date(input.cutoffAt));
    expect(result.coverage[2].missingHistoryContext).toBe("unknown");
    expect(result.coverage[2].seasonAppearanceAbsence).toBe("unverified");
  });
  it("reports missing/failed receipts and never fabricates empty-history observations or PPP zero", () => {
    const input = fixture(), missingLanding = { ...input, receipts: input.receipts.slice(0, 1), failures: [{ url: input.receipts[1].url, reason: "capture_failed" }] };
    const partial = assembleCurrentRosterNativeInputs(missingLanding, new Date(input.cutoffAt));
    expect(partial.sourceReceiptCoverage).toBe("partial_for_approved_urls");
    expect(partial.skaters[0].payload.derivedPowerPlayPoints).toBeUndefined();
    expect(partial.skaters[0].payload.appearances[0].targets.PP_POINTS).toBeNull();
    const empty = assembleCurrentRosterNativeInputs({ ...input, receipts: [] }, new Date(input.cutoffAt));
    expect(empty.skaters).toEqual([]); expect(empty.goalieVolume).toEqual([]);
    expect(empty.coverage.every(row => !row.observationEmitted && row.games[0].status === "unavailable")).toBe(true);
  });
  it.each(["hash", "identity", "duplicate", "url", "future", "duplicate player"])("fails closed on %s source defects", problem => {
    const input = fixture();
    if (problem === "hash") input.receipts[0].rawBody += " ";
    if (problem === "url") input.receipts[0].url = input.receipts[0].url.replace("2026020001", "2026020002");
    if (problem === "future") input.receipts[0].capturedAt = "2026-10-15T20:00:01Z";
    if (problem === "duplicate") input.receipts.push(input.receipts[0]);
    if (problem === "identity" || problem === "duplicate player") {
      const body = JSON.parse(input.receipts[0].rawBody);
      if (problem === "identity") body.id++;
      else body.playerByGameStats.awayTeam.forwards[0].playerId = 77;
      input.receipts[0].rawBody = JSON.stringify(body);
      input.receipts[0].bodySha256 = createHash("sha256").update(input.receipts[0].rawBody).digest("hex");
    }
    expect(() => assembleCurrentRosterNativeInputs(input, new Date(input.cutoffAt))).toThrow();
  });
});
