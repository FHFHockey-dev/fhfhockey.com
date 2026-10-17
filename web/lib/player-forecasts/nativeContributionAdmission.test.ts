// @vitest-environment node
import { createHash } from "node:crypto";
import { nativeGoalieSummaryUrl } from "./nativeGoalieOutcomes";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildSkaterBaselineRates, PRIOR_APPEARANCE_POLICY_VERSION, priorAppearanceDefinitionHash, CURRENT_APPEARANCE_POLICY_VERSION, currentAppearanceDefinitionHash } from "./baselineRates";
import { buildGoalieBaselineRates, buildNativeGoalieWinRates, buildNativeGoalieSummaryWinRates, NATIVE_GOALIE_SUMMARY_WIN_POLICY_VERSION, nativeGoalieSummaryWinDefinitionHash, buildGoalieContributionBundle, NATIVE_GOALIE_WIN_POLICY_VERSION, nativeGoalieWinDefinitionHash, buildNativeGoalieVolumeRates, NATIVE_GOALIE_VOLUME_POLICY_VERSION, nativeGoalieVolumeDefinitionHash, buildNativeGoalieShutoutRates, NATIVE_GOALIE_SHUTOUT_POLICY_VERSION, nativeGoalieShutoutDefinitionHash } from "./goalieBaselineRates";
import { baselineAppearanceFromBoxscore } from "./baselineSourceLineage";
import { playerForecastSourcePayloadHash as hash } from "./sourceSnapshot";
import { loadNativeContributionBundle } from "./nativeContributionAdmission";
import type { ContributionSource } from "./contributions";
import * as nativeComposition from "./baselineGeneration";

const { approved } = vi.hoisted(() => ({ approved: vi.fn() }));
vi.mock("./contributionStore", async importOriginal => ({
  ...await importOriginal<typeof import("./contributionStore")>(), loadApprovedContributionBundle: approved,
}));

function nativeFixture(goalie = false) {
  const cutoffAt = "2026-09-28T12:00:00Z";
  const game = { id: 2025020001, seasonId: 20252026, date: "2026-04-01", type: 2,
    startTime: "2026-04-01T01:00:00Z", homeTeamId: 1, awayTeamId: 2 };
  const rawRow = { id: 1, game_id: game.id, season_id: game.seasonId, payload_hash: "a".repeat(64),
    fetched_at: "2026-04-01T10:00:00Z", payload: { id: game.id, season: game.seasonId, gameDate: game.date,
      gameType: 2, gameState: "FINAL", homeTeam: { id: 1 }, awayTeam: { id: 2 }, playerByGameStats: {
        homeTeam: { forwards: [{ playerId: 77, toi: "20:00", goals: 2, assists: 1, sog: 4 }], defense: [],
          goalies: [{ playerId: 88, toi: "60:00", saves: 28, shotsAgainst: 30, goalsAgainst: 2, saveShotsAgainst: "28/30" }] },
        awayTeam: { forwards: [{ playerId: 99 }], defense: [], goalies: [{ playerId: 100 }] } } } };
  const population = goalie ? "goalie" : "skater";
  const nhlPlayerId = goalie ? 88 : 77;
  const args = { rawRow, game, nhlPlayerId, teamId: 1, cutoffAt };
  const appearances = [goalie ? baselineAppearanceFromBoxscore({ ...args, population: "goalie" })!
    : baselineAppearanceFromBoxscore({ ...args, population: "skater" })!];
  const common = { playerId: 7, nhlPlayerId, seasonId: 20262027, cutoffAt, sourceWatermark: "pending",
    projections: [], appearances: appearances as any[] };
  const initial = goalie ? buildGoalieBaselineRates(common) : buildSkaterBaselineRates(common);
  const payload = { basis: "captured_current", capturedAt: cutoffAt, playerId: 7, nhlPlayerId,
    teamId: 1, rosterRevision: "roster", definitionHash: initial.definitionHash, projections: [], appearances };
  const sourceWatermark = hash(payload);
  const snapshot = goalie ? buildGoalieBaselineRates({ ...common, sourceWatermark }) : buildSkaterBaselineRates({ ...common, sourceWatermark });
  const targetKey = goalie ? "SAVES_GOALIE" : "GOALS";
  const target = snapshot.targets.find(row => row.targetKey === targetKey)!;
  const source: ContributionSource = { kind: "baseline", sourceId: `baseline:${hash({ snapshot, teamId: 1,
    rosterRevision: "roster", targetKey })}`, policyVersion: snapshot.policyVersion, released: true,
    allowedUses: { assignment: true, totals: true, comparison: true, conditionalTieBreak: true },
    playerId: 7, nhlPlayerId, seasonId: 20262027, teamId: 1, targetKey, unit: "count", basis: "per_appearance",
    mean: "rate" in target ? target.rate : target.ratePerAppearance, participationIntegrated: false,
    cutoffAt, issuedAt: "2026-09-28T13:00:00Z", expiresAt: "2026-10-01T00:00:00Z", sourceWatermark,
    scheduleRevision: "schedule", rosterRevision: "roster", limitations: snapshot.limitations };
  const receipt = { provider: "fhfh", dataset_key: goalie ? "goalie-baseline-inputs-v1" : "baseline-inputs-v1",
    entity_kind: "player", entity_key: "20262027:7", available_at: cutoffAt, payload_hash: sourceWatermark, payload };
  return { population, source, receipt };
}
function database(rows: unknown[], error: unknown = null) {
  const query: any = { select: () => query, eq: () => query, in: () => query, limit: () => query,
    then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: rows, error }).then(resolve) };
  return { from: vi.fn(() => query) } as any;
}
function derivedPPPFixture(captureAt?: string) {
  const { source, receipt } = nativeFixture(), payload = receipt.payload as any;
  const original = payload.appearances[0].finalBoxscore, box = original.rawRow.payload;
  box.playerByGameStats.homeTeam.forwards[0].powerPlayGoals = 1;
  box.playerByGameStats.homeTeam.forwards.push({ playerId: 66, toi: "15:00", goals: 1, assists: 2, powerPlayGoals: 1 });
  Object.assign(box.playerByGameStats.awayTeam.forwards[0], { goals: 0, assists: 0, powerPlayGoals: 0 });
  payload.appearances = [baselineAppearanceFromBoxscore({ rawRow: original.rawRow, game: original.game,
    nhlPlayerId: 77, teamId: 1, cutoffAt: source.cutoffAt, population: "skater" })!];
  const goal = (eventId: number, playerId: number, strength: string, assist: number) => ({
    eventId, playerId, strength, isHome: true, assists: [{ playerId: assist }] });
  const body = { id: original.game.id, season: original.game.seasonId, gameDate: original.game.date, gameType: 2,
    gameState: "OFF", startTimeUTC: original.game.startTime, homeTeam: { id: 1, score: 3 }, awayTeam: { id: 2, score: 0 },
    periodDescriptor: { number: 3, periodType: "REG" }, summary: { scoring: [1, 2, 3].map(number => ({
      periodDescriptor: { number, periodType: "REG", maxRegulationPeriods: 3 }, goals: [
        number === 1 ? goal(10, 77, "pp", 66) : number === 2 ? goal(20, 77, "ev", 66) : goal(30, 66, "pp", 77) ] })) } };
  payload.derivedPowerPlayPoints = { version: "native-power-play-points-inputs-v1", landings: [{
    rawRow: { id: 2, endpoint: "landing", game_id: body.id, season_id: body.season,
      fetched_at: "2026-04-01T10:01:00Z", payload_hash: "b".repeat(64), payload: body }, contentHash: hash(body) }] };
  if (captureAt) payload.capturedAt = receipt.available_at = source.cutoffAt = captureAt;
  receipt.payload_hash = hash(payload);
  const snapshot = nativeComposition.buildNativeSkaterBaselineSnapshot({ playerId: 7, nhlPlayerId: 77, seasonId: 20262027,
    cutoffAt: source.cutoffAt, sourceWatermark: receipt.payload_hash, projections: [], appearances: payload.appearances,
    derivedPowerPlayPoints: payload.derivedPowerPlayPoints });
  const sources: ContributionSource[] = ["GOALS", "PP_POINTS"].map(targetKey => ({ ...source, targetKey,
    sourceWatermark: receipt.payload_hash, mean: snapshot.targets.find(row => row.targetKey === targetKey)!.ratePerAppearance,
    sourceId: `baseline:${hash({ snapshot, teamId: 1, rosterRevision: "roster", targetKey })}` }));
  return { sources, receipt };
}
const now = new Date("2026-09-29T00:00:00Z");
describe("native baseline product admission", () => {
  beforeEach(() => approved.mockReset());
  it("accepts corrected legacy PIM minutes and rejects stored count-unit payloads without reinterpretation", async () => {
    const old = nativeFixture(), payload = old.receipt.payload as any, original = payload.appearances[0].finalBoxscore;
    original.rawRow.payload.playerByGameStats.homeTeam.forwards[0].pim = 2;
    payload.appearances = [baselineAppearanceFromBoxscore({ rawRow: original.rawRow, game: original.game,
      nhlPlayerId: 77, teamId: 1, cutoffAt: payload.capturedAt, population: "skater" })!];
    const sourceWatermark = hash(payload), snapshot = nativeComposition.buildNativeSkaterBaselineSnapshot({ ...payload,
      seasonId: 20262027, cutoffAt: payload.capturedAt, sourceWatermark });
    const bundle = nativeComposition.buildBaselineContributionBundle({ seasonId: 20262027, cutoffAt: payload.capturedAt,
      issuedAt: old.source.issuedAt, expiresAt: old.source.expiresAt, scheduleRevision: "schedule",
      snapshots: [{ snapshot, teamId: 1, rosterRevision: "roster" }] });
    const source = { ...bundle.sources.find(row => row.targetKey === "PENALTY_MINUTES")!, released: true, allowedUses: old.source.allowedUses };
    expect(source).toMatchObject({ mean: 2, unit: "minutes" });
    const receipt = { ...old.receipt, payload_hash: sourceWatermark, payload };
    approved.mockResolvedValue({ sources: [source], manifests: [], checksum: "synthetic-approval", limitations: [] });
    expect((await loadNativeContributionBundle(database([receipt]), 20262027, now)).sources).toEqual([source]);
    const invalidStoredSource = { ...source, unit: "count" as const };
    approved.mockResolvedValue({ sources: [invalidStoredSource], manifests: [], checksum: "synthetic-old-approval", limitations: [] });
    expect((await loadNativeContributionBundle(database([receipt]), 20262027, now)).sources).toEqual([]);
    expect(invalidStoredSource.unit).toBe("count");
  });
  it("replays prior native TOI with exact original seconds and rejects count units and altered receipts", async () => {
    const old = nativeFixture(), payload = old.receipt.payload as any;
    Object.assign(payload, { policyVersion: PRIOR_APPEARANCE_POLICY_VERSION, definitionHash: priorAppearanceDefinitionHash(20262027) });
    const sourceWatermark = hash(payload), snapshot = nativeComposition.buildNativeSkaterBaselineSnapshot({ ...payload,
      sourceWatermark, cutoffAt: payload.capturedAt, seasonId: 20262027 });
    const bundle = nativeComposition.buildBaselineContributionBundle({ seasonId: 20262027, cutoffAt: payload.capturedAt,
      issuedAt: old.source.issuedAt, expiresAt: old.source.expiresAt, scheduleRevision: "schedule", snapshots: [{ snapshot, teamId: 1, rosterRevision: "roster" }] });
    const source = { ...bundle.sources.find(row => row.targetKey === "TIME_ON_ICE_PER_GAME")!, released: true, allowedUses: old.source.allowedUses };
    expect(source).toMatchObject({ mean: 20, unit: "minutes", basis: "per_appearance", participationIntegrated: false });
    const receipt = { ...old.receipt, payload_hash: sourceWatermark, payload };
    approved.mockResolvedValue({ sources: [source], manifests: [], checksum: "synthetic-approval", limitations: [] });
    expect((await loadNativeContributionBundle(database([receipt]), 20262027, now)).sources).toEqual([source]);
    approved.mockResolvedValue({ sources: [{ ...source, unit: "count" }], manifests: [], checksum: "synthetic-approval", limitations: [] });
    expect((await loadNativeContributionBundle(database([receipt]), 20262027, now)).sources).toEqual([]);
    approved.mockResolvedValue({ sources: [source], manifests: [], checksum: "synthetic-approval", limitations: [] });
    payload.appearances[0].finalBoxscore.appearanceSeconds = 600;
    expect(() => nativeComposition.buildNativeSkaterBaselineSnapshot({ ...payload, sourceWatermark: hash(payload),
      cutoffAt: payload.capturedAt, seasonId: 20262027 })).toThrow("values do not match");
    expect((await loadNativeContributionBundle(database([receipt]), 20262027, now)).sources).toEqual([]);
  });
  it("reproduces explicitly approved current-only skater sources and verifies original receipt values and units", async () => {
    const old = nativeFixture(), payload = old.receipt.payload as any, original = payload.appearances[0].finalBoxscore;
    const currentCutoff = "2026-10-15T11:00:00Z", currentNow = new Date("2026-10-15T12:00:00Z");
    const game = { ...original.game, id: 2026020001, seasonId: 20262027, date: "2026-10-10", startTime: "2026-10-10T01:00:00Z" };
    const rawRow = { ...original.rawRow, game_id: game.id, season_id: game.seasonId, fetched_at: "2026-10-10T10:00:00Z",
      payload: { ...original.rawRow.payload, id: game.id, season: game.seasonId, gameDate: game.date } };
    Object.assign(rawRow.payload.playerByGameStats.homeTeam.forwards[0], { pim: 2, hits: 1, blockedShots: 0 });
    Object.assign(payload, { capturedAt: currentCutoff, policyVersion: CURRENT_APPEARANCE_POLICY_VERSION,
      definitionHash: currentAppearanceDefinitionHash(20262027), appearances: [baselineAppearanceFromBoxscore({ rawRow, game,
        nhlPlayerId: 77, teamId: 1, cutoffAt: currentCutoff, population: "skater" })!] });
    const sourceWatermark = hash(payload), snapshot = nativeComposition.buildNativeSkaterBaselineSnapshot({ ...payload,
      sourceWatermark, cutoffAt: currentCutoff, seasonId: 20262027 });
    const bundle = nativeComposition.buildBaselineContributionBundle({ seasonId: 20262027, cutoffAt: currentCutoff,
      issuedAt: currentCutoff, expiresAt: "2026-10-15T22:00:00Z", scheduleRevision: "schedule", snapshots: [{ snapshot, teamId: 1, rosterRevision: "roster" }] });
    const sources = bundle.sources.map(source => ({ ...source, released: true, allowedUses: { assignment: true, totals: true, comparison: true, conditionalTieBreak: true } }));
    const receipt = { ...old.receipt, available_at: currentCutoff, payload_hash: sourceWatermark, payload };
    approved.mockResolvedValue({ sources, manifests: [], checksum: "synthetic-approval", limitations: [] });
    expect((await loadNativeContributionBundle(database([receipt]), 20262027, currentNow)).sources).toEqual(sources);
    const minutes = sources.find(source => source.targetKey === "TIME_ON_ICE_PER_GAME")!;
    expect(minutes).toMatchObject({ unit: "minutes", mean: 20 });
    minutes.unit = "count";
    expect((await loadNativeContributionBundle(database([receipt]), 20262027, currentNow)).sources).not.toContainEqual(minutes);
    payload.appearances[0].targets.GOALS = 999;
    expect((await loadNativeContributionBundle(database([receipt]), 20262027, currentNow)).sources).toEqual([]);
  });
  it.each(["wins", "volume", "shutouts", "summary wins"])("reproduces explicit native appearance policy after existing approval mode=%s", async mode => {
    const volume = mode === "volume", shutouts = mode === "shutouts", summaryWins = mode === "summary wins";
    const old = nativeFixture(true), payload = old.receipt.payload as any, original = payload.appearances[0].finalBoxscore;
    const game = { ...original.game, id: 2026020001, seasonId: 20262027, date: "2026-09-25", startTime: "2026-09-25T01:00:00Z" };
    const rawRow = { ...original.rawRow, endpoint: "boxscore", game_id: game.id, season_id: game.seasonId,
      fetched_at: "2026-09-25T10:00:00Z", payload: { ...original.rawRow.payload, id: game.id, season: game.seasonId,
        gameDate: game.date, startTimeUTC: game.startTime, periodDescriptor: { number: 3, periodType: "REG", maxRegulationPeriods: 3 },
        homeTeam: { id: 1, score: 3 }, awayTeam: { id: 2, score: 2 } } };
    Object.assign(rawRow.payload.playerByGameStats.homeTeam.goalies[0], { position: "G", starter: true, decision: "W" });
    Object.assign(rawRow.payload.playerByGameStats.awayTeam.goalies[0], { position: "G", starter: true, decision: "L",
      toi: "60:00", saves: 27, shotsAgainst: 30, goalsAgainst: 3, saveShotsAgainst: "27/30" });
    Object.assign(payload, { policyVersion: summaryWins ? NATIVE_GOALIE_SUMMARY_WIN_POLICY_VERSION : shutouts ? NATIVE_GOALIE_SHUTOUT_POLICY_VERSION : volume ? NATIVE_GOALIE_VOLUME_POLICY_VERSION : NATIVE_GOALIE_WIN_POLICY_VERSION,
      definitionHash: summaryWins ? nativeGoalieSummaryWinDefinitionHash(20262027) : shutouts ? nativeGoalieShutoutDefinitionHash(20262027) : volume ? nativeGoalieVolumeDefinitionHash(20262027) : nativeGoalieWinDefinitionHash(20262027),
      appearances: [baselineAppearanceFromBoxscore({ rawRow, game, nhlPlayerId: 88, teamId: 1,
        cutoffAt: payload.capturedAt, population: "goalie" })!] });
    if (shutouts || summaryWins) {
      const scope = { nhlPlayerId: 88, seasonId: 20262027, startDate: game.date, endDate: game.date, approvedGameIds: [game.id] };
      const rawBody = JSON.stringify({ total: 1, data: [{ playerId: 88, seasonId: 20262027, gameId: game.id, gameDate: game.date,
        gamesPlayed: 1, shutouts: 0, wins: 1, losses: 0, otLosses: 0, saves: 28, goalsAgainst: 2, shotsAgainst: 30, timeOnIce: 3600 }] });
      payload[summaryWins ? "winSummary" : "shutoutSummary"] = { scope, receipts: [{ url: nativeGoalieSummaryUrl(scope), rawBody, capturedAt: payload.capturedAt,
        bodySha256: createHash("sha256").update(rawBody).digest("hex") }] };
    }
    const sourceWatermark = hash(payload), snapshot = (summaryWins ? buildNativeGoalieSummaryWinRates : shutouts ? buildNativeGoalieShutoutRates : volume ? buildNativeGoalieVolumeRates : buildNativeGoalieWinRates)({ ...payload, seasonId: 20262027, cutoffAt: payload.capturedAt, sourceWatermark });
    const bundle = buildGoalieContributionBundle({ seasonId: 20262027, cutoffAt: payload.capturedAt,
      issuedAt: "2026-09-28T13:00:00Z", expiresAt: "2026-10-01T00:00:00Z", scheduleRevision: "schedule",
      snapshots: [{ snapshot, teamId: 1, rosterRevision: "roster" }] });
    const sources = bundle.sources.map(source => ({ ...source, released: true, allowedUses: { assignment: true, totals: true, comparison: true, conditionalTieBreak: true } }));
    const receipt = { ...old.receipt, payload_hash: sourceWatermark, payload };
    approved.mockResolvedValue({ sources, manifests: [], checksum: "synthetic-approval", limitations: [] });
    expect(sources).toHaveLength(volume ? 4 : 1);
    if (volume) expect(Object.fromEntries(sources.map(source => [source.targetKey, source.mean]))).toEqual({ SAVES_GOALIE: 28, GOALS_AGAINST_GOALIE: 2, SHOTS_AGAINST_GOALIE: 30, GOALIE_MINUTES: 60 });
    else expect(sources[0]).toMatchObject({ targetKey: shutouts ? "SHUTOUTS_GOALIE" : "WINS_GOALIE", basis: "per_appearance", mean: shutouts ? 0 : 1 });
    expect((await loadNativeContributionBundle(database([receipt]), 20262027, now)).sources).toEqual(sources);
    delete payload.policyVersion;
    expect((await loadNativeContributionBundle(database([receipt]), 20262027, now)).sources).toEqual([]);
  });
  it.each([undefined, "2026-09-28T12:30:00Z"])("reproduces opt-in PPP and base heads with one calculation at capture=%s", async captureAt => {
    const { sources, receipt } = derivedPPPFixture(captureAt), before = JSON.stringify(receipt);
    expect(sources.map(row => [row.targetKey, row.mean])).toEqual([["GOALS", 2], ["PP_POINTS", 2]]);
    approved.mockResolvedValue({ sources, manifests: [], checksum: "fixture-approval", limitations: [] });
    const calculation = vi.spyOn(nativeComposition, "buildNativeSkaterBaselineSnapshot");
    try {
      const result = await loadNativeContributionBundle(database([receipt]), 20262027, now);
      expect(result.sources).toEqual(sources);
      expect(result.limitations).toEqual([]);
      expect(calculation).toHaveBeenCalledTimes(1);
      expect(JSON.stringify(receipt)).toBe(before);
    } finally { calculation.mockRestore(); }
  });

  it.each(["missing", "version", "duplicate", "misbound", "changed body", "future", "capture mismatch"])(
    "withholds all opt-in heads with %s PPP input proof", async problem => {
      const { sources, receipt } = derivedPPPFixture(), payload = receipt.payload as any;
      const derived = payload.derivedPowerPlayPoints;
      if (problem === "missing") delete payload.derivedPowerPlayPoints;
      if (problem === "version") derived.version = "unclassified";
      if (problem === "duplicate") derived.landings.push(derived.landings[0]);
      if (problem === "misbound") derived.landings[0].rawRow.game_id++;
      if (problem === "changed body") {
        derived.landings[0].rawRow.payload.summary.scoring[0].goals[0].strength = "ev";
        derived.landings[0].contentHash = hash(derived.landings[0].rawRow.payload);
      }
      if (problem === "future") derived.landings[0].rawRow.fetched_at = "2026-09-28T12:00:00.000001Z";
      if (problem === "capture mismatch") receipt.available_at = "2026-09-28T12:00:00.000001Z";
      receipt.payload_hash = hash(payload);
      for (const source of sources) source.sourceWatermark = receipt.payload_hash;
      approved.mockResolvedValue({ sources, manifests: [], checksum: "fixture-approval", limitations: [] });
      expect((await loadNativeContributionBundle(database([receipt]), 20262027, now)).sources).toEqual([]);
    });
  it.each([false, true])("retains independently supported native history rates for goalie=%s", async goalie => {
    const { source, receipt } = nativeFixture(goalie);
    approved.mockResolvedValue({ sources: [source], manifests: [], checksum: "approved", limitations: [] });
    const result = await loadNativeContributionBundle(database([receipt]), 20262027, now);
    expect(result.sources).toEqual([source]);
    expect(result.limitations).toEqual([]);
    expect(result.checksum).not.toBeNull();
  });
  it.each(["external", "missing", "duplicate", "changed mean", "changed identity", "query failure", "unclassified"])(
    "does not promote approved receipts with %s baseline provenance", async problem => {
      const { source, receipt } = nativeFixture();
      if (problem === "external") {
        (receipt.payload.projections as unknown[]).push({ sourceId: "external-provider", totals: { GOALS: 1000 } });
        receipt.payload_hash = source.sourceWatermark = hash(receipt.payload);
      }
      if (problem === "changed mean") source.mean = 1000;
      if (problem === "changed identity") receipt.entity_key = "20262027:8";
      if (problem === "unclassified") source.sourceWatermark = "legacy-rate-watermark";
      approved.mockResolvedValue({ sources: [source], manifests: [], checksum: "approved", limitations: [] });
      const result = await loadNativeContributionBundle(database(problem === "missing" ? []
        : problem === "duplicate" ? [receipt, receipt] : [receipt], problem === "query failure" ? {} : null), 20262027, now);
      expect(result.sources).toEqual([]);
      expect(result.checksum).toBeNull();
      expect(result.limitations).toContain(problem === "query failure" || problem === "unclassified"
        ? "baseline_provenance_unverified" : "baseline_external_or_unclassified_inputs_excluded");
    });
  it("keeps native fallback while explicitly excluding an unclassified companion", async () => {
    const { source, receipt } = nativeFixture();
    const external = { ...source, sourceId: "external", targetKey: "ASSISTS", sourceWatermark: "b".repeat(64) };
    approved.mockResolvedValue({ sources: [source, external], manifests: [], checksum: "approved", limitations: [] });
    const result = await loadNativeContributionBundle(database([receipt]), 20262027, now);
    expect(result.sources).toEqual([source]);
    expect(result.limitations).toContain("baseline_external_or_unclassified_inputs_excluded");
  });
});
