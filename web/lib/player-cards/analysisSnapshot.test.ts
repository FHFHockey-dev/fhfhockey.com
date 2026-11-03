import { describe, expect, it } from "vitest";
import { analysisCaptureFromNhl, analysisDifference, buildAnalysisSnapshot, analysisRank, type AnalysisCapture, type AnalysisSettings } from "./analysisSnapshot";
import { captureFixture } from "./analysisFixtures";
import { buildCurrentNhlCard } from "./currentNhl";


const settings: AnalysisSettings = { period: { mode: "appearances", count: 5 }, baseline: "previous", basis: "per-game", visual: "bars" };
const get = (c: AnalysisCapture, metric: string, s = settings) => buildAnalysisSnapshot(c, s).recent.readings.find(r => r.metric === metric)!;

describe("card analysis capture", () => {
  it("pools BSH components on identical appearances and preserves measured zero", () => {
    const c = captureFixture();
    expect(get(c, "bsh").value).toBe(14); // SOG 7+8+9+10+11 = 45; blocks=10; hits=15 / 5
    expect(get(c, "ppPoints").value).toBe(0);
    c.games[10].values.hits = null;
    expect(get(c, "bsh")).toMatchObject({ value: null, state: "missing" });
    expect(get(c, "shots").value).toBe(9);
  });
  it("uses pooled exposure rather than averaging ratios and distinguishes ixG/on-ice xG", () => {
    const c = captureFixture();
    expect(get(c, "shots", { ...settings, basis: "per60" }).value).toBeCloseTo(45 * 3600 / 5700);
    expect(get(c, "ixg").value).toBe(0.5);
    expect(get(c, "xgf").value).toBe(2);
    expect(get(c, "xgPct").value).toBeCloseTo(200 / 3);
    c.games.forEach(g => { g.values.xgf = 0; g.values.xga = 0; });
    expect(get(c, "xgPct")).toMatchObject({ value: null, state: "undefined" });
  });
  it("rejects source/strength/unit/model mismatches without suppressing unrelated counts", () => {
    const c = captureFixture(); c.fields.toiSeconds!.unit = "count";
    expect(get(c, "shots", { ...settings, basis: "per60" }).state).toBe("missing");
    expect(get(c, "shots").value).toBe(9);
    c.fields.ixg!.strength = "pp";
    expect(get(c, "ixg").state).toBe("missing");
    c.fields.xga!.model = "different";
    expect(get(c, "xgPct").state).toBe("missing");
    c.games[11].values.ppToiSeconds = 3000;
    expect(get(c, "ppToiSeconds").state).toBe("missing");
  });
  it("keeps matched previous windows separate from explicit season overlap", () => {
    const c = captureFixture(), previous = buildAnalysisSnapshot(c, settings), season = buildAnalysisSnapshot(c, { ...settings, baseline: "season" });
    expect(previous.recent.gameIds).toHaveLength(5); expect(previous.baseline.gameIds).toHaveLength(5); expect(previous.overlap).toBe(0);
    expect(season.baseline.gp).toBe(12); expect(season.overlap).toBe(5); expect(season.disclosure).toContain("Season includes recent");
    expect(season.baseline.readings.find(r => r.metric === "shots")!.value).toBe(5.5);
    expect(buildAnalysisSnapshot(c, { ...settings, period: { mode: "appearances", count: 20 }, baseline: "season" }).baseline.reason).toContain("L5 or L10");
  });
  it("withholds an unequal-sample total delta but permits pooled rate comparisons", () => {
    const s = buildAnalysisSnapshot(captureFixture(), { ...settings, baseline: "season", basis: "total" });
    expect(analysisDifference(s, "shots").reason).toContain("unequal");
    expect(analysisDifference(s, "toiSeconds").value).not.toBeNull();
    const rates = buildAnalysisSnapshot(captureFixture(), { ...settings, baseline: "season" });
    expect(analysisDifference(rates, "shots").value).toBe(3.5);
  });
  it("distinguishes short verified seasons, incomplete history and no appearances", () => {
    const short = buildAnalysisSnapshot(captureFixture(3), settings);
    expect(short.recent.gp).toBe(3); expect(short.baseline.reason).toContain("Needs 10");
    expect(short.rankPolicy).toMatchObject({ status: "approved", ties: "competition", percentile: "midrank", shortSeason: "include-verified-complete", additionalQualifiers: "none" });
    expect(short.recent).toMatchObject({ requestedAppearances: 5, knownShort: true });
    expect(short.recent.sampleWarning).toContain("3 of 5 appearances");
    expect(short.baseline.knownShort).toBe(false);
    const season = buildAnalysisSnapshot(captureFixture(3), { ...settings, baseline: "season" }); expect(season.overlap).toBe(3); expect(season.baseline.reason).toBeNull();
    const c = captureFixture(); c.games.pop();
    expect(buildAnalysisSnapshot(c, settings).recent.reason).toContain("do not reconcile");
    expect(buildAnalysisSnapshot(c, settings).recent.knownShort).toBe(false);
    expect(get(captureFixture(0), "shots").state).toBe("undefined");
    const ten = buildAnalysisSnapshot(captureFixture(3), { ...settings, period: { mode: "appearances", count: 10 }, baseline: "season" });
    expect(ten.recent.gp).toBe(3); expect(ten.overlap).toBe(3); expect(ten.baseline.reason).toBeNull();
    expect(ten.recent.sampleWarning).toContain("3 of 10 appearances");
    expect(buildAnalysisSnapshot(captureFixture(3), { ...settings, period: { mode: "calendar", start: "2026-10-01", end: "2026-10-03" } }).recent).toMatchObject({ requestedAppearances: null, knownShort: false, sampleWarning: null });
  });
  it("checks duplicate identity, participation/finality, DNP, calendar boundaries and immutable selection", () => {
    const c = captureFixture(); c.games.push({ ...c.games[0] }); expect(buildAnalysisSnapshot(c, settings).recent.reason).toContain("Duplicate"); c.games.pop();
    c.games[0].played = null; expect(buildAnalysisSnapshot(c, settings).recent.reason).toContain("Participation");
    c.games[0].played = false; c.history.seasonAppearances = 11;
    const s = buildAnalysisSnapshot(c, { ...settings, period: { mode: "calendar", start: "2026-10-01", end: "2026-10-03" } });
    expect(s.recent.gp).toBe(2); expect(s.baseline.reason).toContain("requires an appearance");
    c.games[2].values.shots = 900; expect(s.capture.games[2].values.shots).toBe(2);
  });
  it("applies approved ties while keeping source-population admission separate", () => {
    const c = captureFixture(); c.games.forEach(g => { g.values.shots = 8; });
    const s = buildAnalysisSnapshot(c, settings), key = s.recent.readings.find(r => r.metric === "shots")!.definitionKey;
    const pool = [10, 8, 8, 2].map((value, i) => ({ playerId: String(i === 1 ? 8476453 : i), value, state: "valid" as const, definitionKey: key }));
    expect(analysisRank(s, "shots", pool, false).rank).toBeNull();
    expect(analysisRank(s, "shots", pool, true).rank).toMatchObject({ ordinal: 2, population: 4, percentile: 50, tied: true });
    expect(analysisRank(s, "shots", pool.map(p => ({ ...p, value: 9 })), true).reason).toContain("does not match");
    s.capture.source = "observed"; expect(analysisRank(s, "shots", pool, true).reason).toContain("source admission pending");
  });
  it("includes a verified short sample without accepting missing measurements or source rows", () => {
    const c = captureFixture(3); c.games.forEach(g => { g.values.shots = 8; });
    const s = buildAnalysisSnapshot(c, settings), key = s.recent.readings.find(r => r.metric === "shots")!.definitionKey;
    const pool = [10, 8, 8, 2].map((value, i) => ({ playerId: String(i === 1 ? c.player.id : i), value, state: "valid" as const, definitionKey: key }));
    expect(s.recent.sampleWarning).toContain("3 of 5 appearances");
    expect(analysisRank(s, "shots", pool, true).rank).toEqual({ ordinal: 2, population: 4, percentile: 50, tied: true });
    expect(analysisRank(s, "shots", pool, false).rank).toBeNull();
    c.games[0].values.shots = null;
    const missingMetric = buildAnalysisSnapshot(c, settings);
    expect(missingMetric.recent.knownShort).toBe(true); // The three appearances are verified; this metric is incomplete.
    expect(missingMetric.recent.readings.find(r => r.metric === "shots")!.state).toBe("missing");
    expect(analysisRank(missingMetric, "shots", pool, true).rank).toBeNull();
    c.games.pop();
    const missingRow = buildAnalysisSnapshot(c, settings);
    expect(missingRow.recent.knownShort).toBe(false); expect(missingRow.recent.sampleWarning).toBeNull();
    expect(analysisRank(missingRow, "shots", pool, true).rank).toBeNull();
  });
  it("never manufactures missing season data from a selected NHL window", () => {
    const card = buildCurrentNhlCard({ playerId: 8476453, season: 20262027, count: 5 }, { identity: { playerId: 8476453, firstName: { default: "Test" }, lastName: { default: "Player" }, currentTeamAbbrev: "TBL", position: "R" }, history: {}, schedule: {}, observedAt: "2026-10-31T12:00:00Z" });
    expect(analysisCaptureFromNhl(card).history.complete).toBe(false);
  });
});
