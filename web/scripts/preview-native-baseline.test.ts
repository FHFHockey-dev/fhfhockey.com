import { createHash } from "node:crypto";
import { nativeGoalieSummaryUrl } from "../lib/player-forecasts/nativeGoalieOutcomes";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { previewNativeBaseline, previewSeasonBaseline, runNativeBaselinePreview, type NativeBaselinePreviewScope, type NativeGoalieWinObservation } from "./preview-native-baseline";
import { FANTASY_PROJECTION_CONTRACT_VERSION, FANTASY_PROJECTION_CONTRACT_CHECKSUM } from "../lib/fantasy-projections/contracts";
import { NATIVE_GOALIE_WIN_POLICY_VERSION, nativeGoalieWinDefinitionHash, NATIVE_GOALIE_VOLUME_POLICY_VERSION, nativeGoalieVolumeDefinitionHash, NATIVE_GOALIE_SHUTOUT_POLICY_VERSION, nativeGoalieShutoutDefinitionHash } from "../lib/player-forecasts/goalieBaselineRates";
import { PRIOR_APPEARANCE_POLICY_VERSION, priorAppearanceDefinitionHash, CURRENT_APPEARANCE_POLICY_VERSION, currentAppearanceDefinitionHash } from "../lib/player-forecasts/baselineRates";
import type { NativeSkaterBaselineObservation } from "../lib/player-forecasts/baselineGeneration";
import { baselineDefinitionHash } from "../lib/player-forecasts/baselinePolicy";
import { baselineAppearanceFromBoxscore, baselineHistoricalSources, baselineHistoricalSourceLimitations } from "../lib/player-forecasts/baselineSourceLineage";
import { playerForecastSourcePayloadHash } from "../lib/player-forecasts/sourceSnapshot";

const now = new Date("2026-10-15T12:00:00Z"), cutoff = "2026-10-15T11:00:00Z", expiry = "2026-10-15T22:00:00Z";
const scope: NativeBaselinePreviewScope = { seasonId: 20262027, scheduleRevision: "synthetic-schedule",
  games: [{ gameId: 2026020112, scheduledAt: "2026-10-15T23:00:00Z" }],
  players: [{ playerId: 7, nhlPlayerId: 77, teamId: 1, rosterRevision: "synthetic-roster" }] };
function observation(): NativeSkaterBaselineObservation {
  const game = { id: 2025020001, seasonId: 20252026, date: "2025-10-10", type: 2,
    startTime: "2025-10-10T01:00:00Z", homeTeamId: 1, awayTeamId: 2 };
  const raw = { id: 1, game_id: game.id, season_id: game.seasonId, payload_hash: "a".repeat(64), fetched_at: "2025-10-10T10:00:00Z",
    payload: { id: game.id, season: game.seasonId, gameDate: game.date, gameType: 2, gameState: "FINAL", homeTeam: { id: 1 }, awayTeam: { id: 2 },
      playerByGameStats: { homeTeam: { forwards: [{ playerId: 77, toi: "20:00", hits: 2, sog: 3 }], defense: [], goalies: [{ playerId: 99 }] },
        awayTeam: { forwards: [{ playerId: 100 }], defense: [], goalies: [{ playerId: 101 }] } } } };
  const appearance = baselineAppearanceFromBoxscore({ rawRow: raw, game, nhlPlayerId: 77, teamId: 1, cutoffAt: cutoff, population: "skater" })!;
  const historicalSources = baselineHistoricalSources([{ gameId: game.id, playerId: 77, games: game }],
    [{ game_id: game.id, player_id: 77, team_id: 1, season_id: game.seasonId, game_date: game.date,
      source_play_by_play_hash: "a".repeat(64), parser_version: 1 }], [], { nhlIds: [77], seasonId: 20262027, upperDate: cutoff.slice(0, 10) }, 77);
  const payload: NativeSkaterBaselineObservation["payload"] = { basis: "captured_current", capturedAt: cutoff,
    ...scope.players[0], definitionHash: baselineDefinitionHash("skater", 20262027), projections: [], appearances: [appearance],
    historicalSources, limitations: baselineHistoricalSourceLimitations(historicalSources) };
  return { provider: "fhfh", dataset_key: "baseline-inputs-v1", entity_kind: "player", entity_key: "20262027:7",
    available_at: cutoff, payload_hash: playerForecastSourcePayloadHash(payload), payload };
}
function currentObservation(): NativeSkaterBaselineObservation {
  const prior = observation(), old = prior.payload.appearances[0].finalBoxscore as any;
  const game = { ...old.game, id: 2026020001, seasonId: 20262027, date: "2026-10-10", startTime: "2026-10-10T01:00:00Z" };
  const rawRow = { ...old.rawRow, game_id: game.id, season_id: game.seasonId, fetched_at: "2026-10-10T10:00:00Z",
    payload: { ...old.rawRow.payload, id: game.id, season: game.seasonId, gameDate: game.date } };
  Object.assign(rawRow.payload.playerByGameStats.homeTeam.forwards[0], { goals: 1, assists: 2, pim: 0, blockedShots: 1 });
  const appearance = baselineAppearanceFromBoxscore({ rawRow, game, nhlPlayerId: 77, teamId: 1, cutoffAt: cutoff, population: "skater" })!;
  const payload: NativeSkaterBaselineObservation["payload"] = { ...prior.payload, policyVersion: CURRENT_APPEARANCE_POLICY_VERSION,
    definitionHash: currentAppearanceDefinitionHash(20262027), appearances: [appearance], historicalSources: undefined, limitations: [] };
  return { ...prior, payload, payload_hash: playerForecastSourcePayloadHash(payload) };
}
afterEach(() => vi.useRealTimers());
describe("native-only producer preview (synthetic receipts, no release qualification)", () => {
  it("previews a separately versioned prior TOI head while preserving legacy counts and denied permissions", async () => {
    const original = observation(), originalHash = playerForecastSourcePayloadHash(original);
    const legacy = await previewNativeBaseline([original], scope, expiry, now), prior = structuredClone(original);
    prior.payload.policyVersion = PRIOR_APPEARANCE_POLICY_VERSION;
    prior.payload.definitionHash = priorAppearanceDefinitionHash(scope.seasonId);
    prior.payload_hash = playerForecastSourcePayloadHash(prior.payload);
    const extended = await previewNativeBaseline([prior], scope, expiry, now);
    expect(extended.bundle.sources.filter(row => row.targetKey !== "TIME_ON_ICE_PER_GAME").map(row => [row.targetKey, row.mean]))
      .toEqual(legacy.bundle.sources.map(row => [row.targetKey, row.mean]));
    expect(extended.bundle.sources.find(row => row.targetKey === "TIME_ON_ICE_PER_GAME"))
      .toMatchObject({ mean: 20, unit: "minutes", basis: "per_appearance", released: false, participationIntegrated: false });
    expect(extended.bundle.sources.every(row => !row.released && !row.allowedUses)).toBe(true);
    expect(playerForecastSourcePayloadHash(original)).toBe(originalHash);
    expect(await previewNativeBaseline([original], scope, expiry, now)).toEqual(legacy);
  });
  it("accepts twenty scheduled games for the existing prior policy while rejecting twenty-one", async () => {
    const games = Array.from({ length: 20 }, (_, index) => ({ gameId: scope.games[0].gameId + index,
      scheduledAt: new Date(Date.parse(scope.games[0].scheduledAt) + index * 86400000).toISOString() }));
    const result = await previewNativeBaseline([observation()], { ...scope, games }, expiry, now);
    expect(result.scope.games).toHaveLength(20);
    expect(result.bundle.sources[0]).toMatchObject({ basis: "per_appearance", released: false });
    await expect(previewNativeBaseline([observation()], { ...scope, games: [...games, { gameId: 2026020999,
      scheduledAt: "2026-11-10T23:00:00Z" }] }, expiry, now)).rejects.toThrow(/1–20/);
  });
  it("produces whole-game native means and TOI from current appearances without prior or external projections", async () => {
    const input = currentObservation(), before = JSON.stringify(input);
    const result = await previewNativeBaseline([input], scope, expiry, now);
    const target = (key: string) => result.bundle.sources.find(row => row.targetKey === key);
    expect(result.bundle.manifest.policyVersion).toBe(CURRENT_APPEARANCE_POLICY_VERSION);
    expect(target("GOALS")).toMatchObject({ mean: 1, basis: "per_appearance", released: false });
    expect(target("ASSISTS")?.mean).toBe(2); expect(target("POINTS")?.mean).toBe(3);
    expect(target("SHOTS_ON_GOAL")?.mean).toBe(3); expect(target("HITS")?.mean).toBe(2);
    expect(target("BLOCKED_SHOTS")?.mean).toBe(1);
    expect(target("PENALTY_MINUTES")).toMatchObject({ mean: 0, unit: "minutes" });
    expect(target("TIME_ON_ICE_PER_GAME")).toMatchObject({ mean: 20, unit: "minutes" });
    expect(target("PP_POINTS")).toBeUndefined();
    expect(result.missingTargets).toEqual([{ playerId: 7, targetKeys: ["PP_POINTS"] }]);
    expect(result.publicUsesApproved).toBe(false); expect(result.participation).toBe("not_supplied");
    expect(JSON.stringify(input)).toBe(before);
    const unknown = structuredClone(input);
    Object.assign(unknown.payload, { playerId: 8, nhlPlayerId: 88, appearances: [] });
    unknown.entity_key = "20262027:8"; unknown.payload_hash = playerForecastSourcePayloadHash(unknown.payload);
    const partial = await previewNativeBaseline([input, unknown], { ...scope,
      players: [...scope.players, { ...scope.players[0], playerId: 8, nhlPlayerId: 88 }] }, expiry, now);
    expect(partial.missingTargets?.find(row => row.playerId === 8)?.targetKeys).toContain("GOALS");
    expect(partial.bundle.sources.some(row => row.playerId === 8)).toBe(false);
    const tampered = structuredClone(input); tampered.payload.appearances[0].targets.GOALS = 99;
    tampered.payload_hash = playerForecastSourcePayloadHash(tampered.payload);
    await expect(previewNativeBaseline([tampered], scope, expiry, now)).rejects.toThrow(/boxscore/);
  });
  it("reproduces supported native rates without database access and retains the input clock", async () => {
    const input = observation(), before = JSON.stringify(input);
    const result = await previewNativeBaseline([input], scope, expiry, now);
    expect(result.status).toBe("unreleased_preview"); expect(result.publicUsesApproved).toBe(false);
    expect(result.bundle.receipt).toMatchObject({ dryRun: true, snapshotId: null });
    expect(result.bundle.sources.find(row => row.targetKey === "HITS")).toMatchObject({ mean: 2, cutoffAt: cutoff, released: false, participationIntegrated: false });
    expect(result.bundle.sources.find(row => row.targetKey === "PP_POINTS")).toBeUndefined();
    expect(JSON.stringify(input)).toBe(before);
  });
  it.each(["external", "stale", "identity", "started", "expiry"])("rejects %s source/scope before any publication", async kind => {
    const input = observation(), changed = structuredClone(scope);
    if (kind === "external") { input.payload.projections = [{ sourceId: "ag_skaters" }] as never; input.payload_hash = playerForecastSourcePayloadHash(input.payload); }
    if (kind === "stale") input.available_at = "2026-10-13T00:00:00Z";
    if (kind === "identity") changed.players[0].nhlPlayerId = 88;
    if (kind === "started") changed.games[0].scheduledAt = now.toISOString();
    await expect(previewNativeBaseline([input], changed, kind === "expiry" ? "2026-10-16T00:00:00Z" : expiry, now)).rejects.toThrow();
  });
  it.each(["wins", "volume", "shutouts"])("runs native goalie preview through the CLI with denied uses mode=%s", async mode => {
    const volume = mode === "volume", shutouts = mode === "shutouts";
    vi.useFakeTimers(); vi.setSystemTime(now);
    const directory = mkdtempSync(join(tmpdir(), "forge-native-win-preview-test-"));
    try {
      const current = currentObservation(), receipt = current.payload.appearances[0].finalBoxscore as any;
      const rawRow = receipt.rawRow, game = receipt.game;
      rawRow.endpoint = "boxscore";
      Object.assign(rawRow.payload, { startTimeUTC: game.startTime, periodDescriptor: { number: 3, periodType: "REG", maxRegulationPeriods: 3 },
        homeTeam: { id: 1, score: 3 }, awayTeam: { id: 2, score: 2 } });
      const goalie = (playerId: number, goalsAgainst: number, decision: string) => ({ playerId, position: "G", starter: true,
        decision, toi: "60:00", saves: 28, shotsAgainst: 28 + goalsAgainst, goalsAgainst, saveShotsAgainst: `28/${28 + goalsAgainst}` });
      rawRow.payload.playerByGameStats.homeTeam.goalies = [goalie(88, 2, "W")];
      rawRow.payload.playerByGameStats.awayTeam.goalies = [goalie(1003, 3, "L")];
      const payload: NativeGoalieWinObservation["payload"] = { basis: "captured_current", capturedAt: cutoff,
        playerId: 7, nhlPlayerId: 88, teamId: 1, rosterRevision: scope.players[0].rosterRevision,
        policyVersion: shutouts ? NATIVE_GOALIE_SHUTOUT_POLICY_VERSION : volume ? NATIVE_GOALIE_VOLUME_POLICY_VERSION : NATIVE_GOALIE_WIN_POLICY_VERSION,
        definitionHash: shutouts ? nativeGoalieShutoutDefinitionHash(20262027) : volume ? nativeGoalieVolumeDefinitionHash(20262027) : nativeGoalieWinDefinitionHash(20262027), projections: [],
        appearances: [baselineAppearanceFromBoxscore({ rawRow, game, nhlPlayerId: 88, teamId: 1, cutoffAt: cutoff, population: "goalie" })!] };
      if (shutouts) {
        const summaryScope = { nhlPlayerId: 88, seasonId: 20262027, startDate: game.date, endDate: game.date, approvedGameIds: [game.id] };
        const rawBody = JSON.stringify({ total: 1, data: [{ playerId: 88, seasonId: 20262027, gameId: game.id, gameDate: game.date,
          gamesPlayed: 1, shutouts: 0, saves: 28, goalsAgainst: 2, shotsAgainst: 30, timeOnIce: 3600 }] });
        payload.shutoutSummary = { scope: summaryScope, receipts: [{ url: nativeGoalieSummaryUrl(summaryScope), rawBody,
          capturedAt: cutoff, bodySha256: createHash("sha256").update(rawBody).digest("hex") }] };
      }
      const observation: NativeGoalieWinObservation = { ...current, dataset_key: "goalie-baseline-inputs-v1", payload,
        payload_hash: playerForecastSourcePayloadHash(payload) };
      const inputs = join(directory, "inputs.json"), scopePath = join(directory, "scope.json"), out = join(directory, "preview.json");
      writeFileSync(inputs, JSON.stringify([observation]));
      writeFileSync(scopePath, JSON.stringify({ ...scope, players: [{ ...scope.players[0], nhlPlayerId: 88 }] }));
      const argv = ["--inputs", inputs, "--scope", scopePath, "--expires-at", expiry, "--out", out, shutouts ? "--goalie-shutouts" : volume ? "--goalie-volume" : "--goalie-wins", "true"];
      await runNativeBaselinePreview(argv);
      const result = JSON.parse(readFileSync(out, "utf8"));
      expect(result).toMatchObject({ status: "unreleased_preview", publicUsesApproved: false, participation: "not_supplied", databaseWrites: 0 });
      if (volume) {
        expect(result.bundle.sources).toHaveLength(4);
        expect(result.bundle.sources.find((row: { targetKey: string }) => row.targetKey === "GOALIE_MINUTES")).toMatchObject({ mean: 60, unit: "minutes", basis: "per_appearance", released: false });
      } else expect(result.bundle.sources).toEqual([expect.objectContaining({ targetKey: shutouts ? "SHUTOUTS_GOALIE" : "WINS_GOALIE", mean: shutouts ? 0 : 1, basis: "per_appearance", released: false })]);
      if (shutouts) expect(result.coverage[0].missingTargets).not.toContain("SHUTOUTS_GOALIE");
      else expect(result.coverage[0].missingTargets).toContain("SHUTOUTS_GOALIE");
      await expect(runNativeBaselinePreview([...argv, "--season-artifact", "unused.json"])).rejects.toThrow();
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });
  it("runs explicit recovered seasonal preparation through the existing CLI without granting publication", async () => {
    vi.useFakeTimers(); vi.setSystemTime(now);
    const directory = mkdtempSync(join(tmpdir(), "forge-season-preview-test-"));
    try {
      const inputs = join(directory, "bindings.json"), artifactPath = join(directory, "artifact.json"), scopePath = join(directory, "scope.json"), out = join(directory, "preview.json");
      const binding = { ...scope.players[0], seasonId: scope.seasonId, ...scope.games[0],
        scheduleRevision: scope.scheduleRevision, observedAt: cutoff, opponentTeamId: 2, isHome: true };
      const artifact = { schemaVersion: "player-forecast-season-artifact-v1", seasonId: 20262027,
        contractVersion: FANTASY_PROJECTION_CONTRACT_VERSION, contractChecksum: FANTASY_PROJECTION_CONTRACT_CHECKSUM,
        artifactVersion: "synthetic-v1", featureSchemaVersion: "synthetic-v1", codeVersion: "test", trainingCutoffAt: cutoff,
        teams: {}, players: { "7": { fhfhPlayerId: 7, nhlPlayerId: 77, teamId: 1, population: "forward", position: "L",
          playProbability: 0.5, conditionalRates: { SHOTS_ON_GOAL: 4 }, conditionalVariances: {}, ratings: {}, deployment: {} } } };
      const wrongEmbeddedIdentity = structuredClone(artifact);
      wrongEmbeddedIdentity.players["7"].fhfhPlayerId = 8;
      expect(() => previewSeasonBaseline(wrongEmbeddedIdentity as never, [binding], scope, expiry, now)).toThrow(/identity/);
      writeFileSync(inputs, JSON.stringify([binding])); writeFileSync(artifactPath, JSON.stringify(artifact)); writeFileSync(scopePath, JSON.stringify(scope));
      await runNativeBaselinePreview(["--inputs", inputs, "--scope", scopePath, "--expires-at", expiry, "--out", out, "--season-artifact", artifactPath]);
      const preview = JSON.parse(readFileSync(out, "utf8"));
      expect(preview).toMatchObject({ status: "unreleased_preview", databaseWrites: 0, publicUsesApproved: false });
      expect(preview.candidates[0].forecast).toMatchObject({ stats: { SHOTS_ON_GOAL: 2, PENALTY_MINUTES: null },
        conditionalStats: { SHOTS_ON_GOAL: 4 }, cutoffAt: cutoff, allowedUses: { totals: false } });
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });
  it("writes one exclusive local preview file and refuses overwrite/write flags", async () => {
    vi.useFakeTimers(); vi.setSystemTime(now);
    const directory = mkdtempSync(join(tmpdir(), "forge-native-preview-test-"));
    try {
      const inputs = join(directory, "inputs.json"), scopePath = join(directory, "scope.json"), out = join(directory, "preview.json");
      writeFileSync(inputs, JSON.stringify([observation()])); writeFileSync(scopePath, JSON.stringify(scope));
      const argv = ["--inputs", inputs, "--scope", scopePath, "--expires-at", expiry, "--out", out];
      expect(await runNativeBaselinePreview(argv)).toMatchObject({ status: "unreleased_preview", databaseWrites: 0, localFilesWritten: 1 });
      expect(JSON.parse(readFileSync(out, "utf8")).bundle.manifest.released).toBe(false);
      await expect(runNativeBaselinePreview(argv)).rejects.toThrow();
      await expect(runNativeBaselinePreview([...argv, "--write", "true"])).rejects.toThrow();
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });
});
