import { cleanup, render } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import RatioImpactCard from "components/SocialShare/modules/RatioImpactCard";
import { parseShareSettings, sharePostExportBlock, SharePostRequestError, UNKNOWN_EVIDENCE, type SharePostSnapshot } from "./contract";
import { addTotals, buildRatioImpact, formatGaaChange, formatRatioSavePct, formatSavePctChange, formatToi, goalieBase, lineTotals, manualBase, minutesToSeconds, RATIO_LEGEND, RATIO_NOTE, ratesOf, ratioImpact, ratioImpactModule, validateRatioSettings, type RatioImpactData, type RatioImpactSettings } from "./ratioImpact";
import { loadRatioImpact } from "./ratioImpact.sources";
import type { GoalieAppearance } from "./shared/goalieLedger";

const settings = (over: Partial<RatioImpactSettings> = {}): RatioImpactSettings => ({ baseGoalieId: null, baseShots: null, baseGoals: null, baseMinutes: null, scenarioShots: 30, scenarioGoals: 3, scenarioMinutes: 60, sensitivityGoalsFrom: 0, sensitivityGoalsTo: 6, ...over });
const withBase = settings({ baseShots: 1000, baseGoals: 80, baseMinutes: 2000 });
const appearance = (over: Partial<GoalieAppearance> = {}): GoalieAppearance => ({ goalieId: 8476945, name: "Fixture Goalie", gameId: 1, date: "2026-10-01", team: "NJD", opponent: "NYR", home: true, started: true, wins: 1, losses: 0, otLosses: 0, saves: 27, shotsAgainst: 30, goalsAgainst: 3, toiSeconds: 3600, shutouts: 0, qualityStart: 1, ...over });

afterEach(cleanup);

describe("pooled before and after", () => {
  it("pools saves over SA and GA over TOI, which differs from a mean of rates", () => {
    const data = ratioImpact(manualBase(withBase), settings({ ...withBase, scenarioShots: 30, scenarioGoals: 6, scenarioMinutes: 60 }));
    expect(data.before.savePct).toBeCloseTo(0.92);
    expect(data.lineRates.savePct).toBeCloseTo(0.8);
    expect(data.afterRates.savePct).toBeCloseTo((920 + 24) / 1030);
    const meanOfRates = (data.before.savePct! + data.lineRates.savePct!) / 2;
    expect(meanOfRates).toBeCloseTo(0.86);
    expect(Math.abs(data.afterRates.savePct! - meanOfRates)).toBeGreaterThan(0.05);
    expect(data.before.gaa).toBeCloseTo(2.4);
    expect(data.lineRates.gaa).toBeCloseTo(6);
    expect(data.afterRates.gaa).toBeCloseTo(86 * 3600 / (2060 * 60));
    expect(Math.abs(data.afterRates.gaa! - (2.4 + 6) / 2)).toBeGreaterThan(1);
  });
  it("converts entered minutes to seconds once, matching WGO's seconds", () => {
    expect(minutesToSeconds(60)).toBe(3600);
    expect(lineTotals(30, 3, 62.5)).toEqual({ saves: 27, shotsAgainst: 30, goalsAgainst: 3, toiSeconds: 3750 });
    const line = ratesOf(lineTotals(30, 3, 60));
    expect(line.gaa).toBe(3);
    const pooled = ratesOf(addTotals(goalieBase(1, [appearance()], "2026-10-30").totals, lineTotals(30, 3, 60)));
    expect(pooled).toEqual({ savePct: 54 / 60, gaa: 3 });
    expect(formatToi(3750)).toBe("62:30");
    expect(formatToi(59.6)).toBe("1:00");
    expect(formatToi(null)).toBe("—");
  });
  it("reports change only when both sides are known", () => {
    const data = ratioImpact(manualBase(withBase), withBase);
    expect(data.savePctChange).toBeCloseTo(data.afterRates.savePct! - data.before.savePct!);
    expect(formatSavePctChange(-0.0012)).toBe("−.001");
    expect(formatSavePctChange(0.012)).toBe("+.012");
    expect(formatGaaChange(0.01)).toBe("+0.01");
    expect(formatGaaChange(null)).toBe("—");
  });
});

describe("zero and missing safeguards", () => {
  it("treats zero denominators as unknown", () => {
    expect(ratesOf(lineTotals(0, 0, 0))).toEqual({ savePct: null, gaa: null });
    const zero = ratioImpact(manualBase(settings()), settings({ scenarioShots: 0, scenarioGoals: 0, scenarioMinutes: 0 }));
    expect(zero.afterRates).toEqual({ savePct: null, gaa: null });
    expect(ratioImpactModule.hasRows(zero, settings())).toBe(false);
  });
  it("keeps one rate when only the other denominator is zero", () => {
    expect(ratesOf(lineTotals(30, 3, 0))).toEqual({ savePct: 0.9, gaa: null });
    expect(ratesOf(lineTotals(0, 0, 60))).toEqual({ savePct: null, gaa: 0 });
  });
  it("adds the hypothetical line to an empty base", () => {
    const data = ratioImpact(manualBase(settings()), settings());
    expect(data.base.kind).toBe("none");
    expect(data.before).toEqual({ savePct: null, gaa: null });
    expect(data.after).toEqual(data.line);
    expect(data.afterRates).toEqual({ savePct: 0.9, gaa: 3 });
    expect(data.savePctChange).toBeNull();
    expect(data.gaaChange).toBeNull();
  });
  it("treats a stated zero base as known and adds to it", () => {
    const zero = settings({ baseShots: 0, baseGoals: 0, baseMinutes: 0 }), data = ratioImpact(manualBase(zero), zero);
    expect(data.base.kind).toBe("manual");
    expect(data.before).toEqual({ savePct: null, gaa: null });
    expect(data.afterRates).toEqual({ savePct: 0.9, gaa: 3 });
  });
  it("leaves a rate unknown when a base part is missing, and is partial", () => {
    const shotsOnly = settings({ baseShots: 100 }), result = buildRatioImpact(shotsOnly, manualBase(shotsOnly), null);
    expect(result.data!.afterRates).toEqual({ savePct: null, gaa: null });
    expect(result.state).toBe("partial");
    expect(result.reasons?.[0]).toMatch(/base total is missing/);
    const noMinutes = settings({ baseShots: 100, baseGoals: 5 });
    expect(ratioImpact(manualBase(noMinutes), noMinutes).afterRates.gaa).toBeNull();
    expect(ratioImpact(manualBase(noMinutes), noMinutes).afterRates.savePct).toBeCloseTo(122 / 130);
  });
  it("sums a goalie's rows and leaves a part with a null stat unknown", () => {
    const base = goalieBase(5, [appearance(), appearance({ gameId: 2, saves: 20, shotsAgainst: 22, goalsAgainst: 2, toiSeconds: 3000 })], "2026-10-30");
    expect(base).toMatchObject({ kind: "goalie", name: "Fixture Goalie", appearances: 2, totals: { saves: 47, shotsAgainst: 52, goalsAgainst: 5, toiSeconds: 6600 } });
    expect(goalieBase(5, [appearance(), appearance({ gameId: 2, saves: null })], "2026-10-30").totals).toMatchObject({ saves: null, shotsAgainst: 60 });
    expect(goalieBase(5, [], "2026-10-30").totals).toBeNull();
  });
  it("refuses contradictions and fractional counts", () => {
    for (const bad of [settings({ baseGoalieId: 1, baseShots: 10 }), settings({ baseShots: 5, baseGoals: 6 }), settings({ scenarioShots: 2, scenarioGoals: 3 }), settings({ sensitivityGoalsFrom: 5, sensitivityGoalsTo: 1 }), settings({ sensitivityGoalsFrom: 0, sensitivityGoalsTo: 12 }), settings({ scenarioShots: 30.5 })]) expect(validateRatioSettings(bad)).toBeTruthy();
    expect(validateRatioSettings(settings())).toBeNull();
    expect(() => parseShareSettings(ratioImpactModule, { scenarioShots: "2", scenarioGoals: "3" })).toThrow(SharePostRequestError);
  });
});

describe("sensitivity", () => {
  it("runs the stated goals range at the entered shots and minutes", () => {
    const { sensitivity } = ratioImpact(manualBase(withBase), withBase);
    expect(sensitivity.map(row => row.goals)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(sensitivity[0].saves).toBe(30);
    expect(sensitivity[0].after.savePct).toBeCloseTo(950 / 1030);
    expect(sensitivity[6].after.savePct).toBeCloseTo(944 / 1030);
    expect(sensitivity[3].after).toEqual(ratioImpact(manualBase(withBase), withBase).afterRates);
    expect(sensitivity[6].gaaChange).toBeGreaterThan(sensitivity[0].gaaChange!);
  });
  it("stops at the entered shots and never prints negative saves", () => {
    const small = settings({ scenarioShots: 2, scenarioGoals: 0, sensitivityGoalsFrom: 0, sensitivityGoalsTo: 6 });
    expect(ratioImpact(manualBase(small), small).sensitivity.map(row => [row.goals, row.saves])).toEqual([[0, 2], [1, 1], [2, 0]]);
  });
  it("shows unknown throughout a zero-minute range", () => {
    const zero = settings({ scenarioMinutes: 0 });
    expect(ratioImpact(manualBase(zero), zero).sensitivity.every(row => row.after.gaa === null)).toBe(true);
  });
});

describe("loader", () => {
  it("reads nothing without a goalie id and still has its source label", async () => {
    const client = { from: vi.fn() };
    const result = await loadRatioImpact({ client, generatedAt: "2026-10-31T12:00:00Z" }, settings());
    expect(client.from).not.toHaveBeenCalled();
    expect(result.state).toBe("ready");
    expect(result.evidence.sources.map(source => source.name)).toEqual(["Entered hypothetical inputs"]);
    const snap = { schemaVersion: 1 as const, id: "e", post: "ratio-impact", state: result.state, reasons: [], generatedAt: "2026-10-31T12:00:00Z", expiresAt: "2026-10-31T12:15:00Z", timeZone: "America/New_York" as const, settings: settings(), evidence: result.evidence, data: result.data, teams: [], fixture: false };
    expect(sharePostExportBlock(ratioImpactModule, snap, settings(), Date.parse("2026-10-31T12:05:00Z"))).toBeNull();
  });
  it("reads one goalie's season, through yesterday, when an id is given", async () => {
    const calls: { table: string; filters: unknown[][] }[] = [];
    const rows = [{ goalie_id: 8476945, goalie_name: "Fixture Goalie", date: "2026-10-02", season_id: 20262027, game_id: 7, team_abbreviation: "NJD", opponent_team_abbrev: "NYR", home_road: "H", games_played: 1, games_started: 1, wins: 1, losses: 0, ot_losses: 0, saves: 27, shots_against: 30, goals_against: 3, time_on_ice: 3600, shutouts: 0, quality_start: 1 }];
    const client = { from: (table: string) => {
      const call = { table, filters: [] as unknown[][] }; calls.push(call);
      const chain: Record<string, unknown> = { select: () => chain, order: () => chain, eq: (...args: unknown[]) => { call.filters.push(["eq", ...args]); return chain; }, gte: (...args: unknown[]) => { call.filters.push(["gte", ...args]); return chain; }, lte: (...args: unknown[]) => { call.filters.push(["lte", ...args]); return chain; }, in: (...args: unknown[]) => { call.filters.push(["in", ...args]); return chain; }, range: async () => ({ data: rows, error: null, count: 1 }) };
      return chain;
    } };
    const active = settings({ baseGoalieId: 8476945 }), result = await loadRatioImpact({ client, generatedAt: "2026-10-31T12:00:00Z" }, active);
    expect(calls.map(call => call.table)).toEqual(["wgo_goalie_stats"]);
    expect(calls[0].filters).toEqual([["eq", "season_id", 20262027], ["gte", "date", "2026-08-01"], ["lte", "date", "2026-10-30"], ["in", "goalie_id", [8476945]]]);
    expect(result.data!.base).toMatchObject({ kind: "goalie", name: "Fixture Goalie", appearances: 1, through: "2026-10-30" });
    expect(result.data!.afterRates).toEqual({ savePct: 0.9, gaa: 3 });
    expect(result.evidence.sources.map(source => source.tables)).toEqual([[], ["wgo_goalie_stats"]]);
  });
  it("is partial, with no invented base, for a goalie with no appearances", () => {
    const active = settings({ baseGoalieId: 1 }), result = buildRatioImpact(active, goalieBase(1, [], "2026-10-30"), null);
    expect(result.state).toBe("partial");
    expect(result.reasons?.[0]).toMatch(/no appearances/);
    expect(result.data!.after).toEqual(result.data!.line);
  });
});

const snapshot = (data: RatioImpactData, active: RatioImpactSettings): SharePostSnapshot<RatioImpactSettings, RatioImpactData> => ({ schemaVersion: 1, id: "e", post: "ratio-impact", state: "ready", reasons: [], generatedAt: "2026-10-31T12:00:00Z", expiresAt: null, timeZone: "America/New_York", settings: active, evidence: UNKNOWN_EVIDENCE, data, teams: [], fixture: true });
const renderDom = (active: RatioImpactSettings) => { const data = ratioImpact(manualBase(active), active); return render(createElement(RatioImpactCard, { snapshot: snapshot(data, active), data, settings: active, logos: {} })).container; };
const renderCard = (active: RatioImpactSettings) => renderDom(active).textContent!;
/** A hypothetical must not read as a prediction or a roster move. */
const FORBIDDEN = /forecast|project(ed|ion)|expected|likely|odds|will (start|win|save)|\btrade\b|transaction|add\/drop|\bdrop\b|pickup|waiver|recommend/i;

describe("ratio impact card", () => {
  it("has the hypothetical basis, and shows denominators, units and sensitivity", () => {
    expect(ratioImpactModule.basis).toBe("hypothetical");
    const text = renderCard(withBase);
    for (const label of ["Before: Entered base", RATIO_LEGEND, "After, pooled", "920 SV ÷ 1000 SA", "80 GA in 2000:00 TOI", "83 GA in 2060:00 TOI", "27 SV ÷ 30 SA = .900", "3 GA in 60:00 TOI = 3.00", ".920", "2.40", "Sensitivity at 30 SA and 60:00 TOI", "HYPOTHETICAL GA"]) expect(text).toContain(label);
    const { sample } = buildRatioImpact(withBase, manualBase(withBase), null).evidence;
    for (const label of [RATIO_NOTE, "SV% = saves ÷ SA", "GAA = GA × 3600 ÷ TOI seconds"]) expect(sample).toContain(label);
    expect(formatRatioSavePct(0.92)).toBe(".920");
  });
  it("uses no forecast or transaction wording anywhere", () => {
    const data = ratioImpact(manualBase(withBase), withBase), built = buildRatioImpact(withBase, manualBase(withBase), null);
    for (const text of [renderCard(withBase), RATIO_LEGEND, RATIO_NOTE, ratioImpactModule.summary, ratioImpactModule.title, JSON.stringify(ratioImpactModule.fields), built.evidence.sample, ratioImpactModule.altText({ ...snapshot(data, withBase), evidence: built.evidence }, data, withBase)]) expect(text).not.toMatch(FORBIDDEN);
    expect(ratioImpactModule).not.toHaveProperty("suggestedUse");
  });
  it("shows an empty base as unknown rather than zero", () => {
    const container = renderDom(settings());
    expect(container.textContent).toContain("Before: No base entered.");
    const before = [...container.querySelectorAll("[data-tile='before']")];
    expect(before.map(tile => tile.querySelector("b")!.textContent)).toEqual(["—", "—"]);
    expect(before.map(tile => tile.textContent)).toEqual(["Before—", "Before—"]);
    expect([...container.querySelectorAll("[data-tile='after'] b")].map(value => value.textContent)).toEqual([".900", "3.00"]);
  });
  it("draws no change without a base, and a tile change with one", () => {
    expect(renderDom(settings()).querySelectorAll("[data-testid='ratio-change']")).toHaveLength(0);
    cleanup();
    const data = ratioImpact(manualBase(withBase), withBase), changes = [...renderDom(withBase).querySelectorAll("[data-testid='ratio-change']")];
    expect(changes.map(change => change.textContent)).toEqual([formatSavePctChange(data.savePctChange), formatGaaChange(data.gaaChange)]);
  });
  it("draws no reference line and no sensitivity change without a base", () => {
    const container = renderDom(settings());
    expect(container.querySelectorAll("[data-before-line]")).toHaveLength(0);
    expect([...container.querySelectorAll("[data-row='savePctChange']")].every(cell => cell.textContent === "—")).toBe(true);
    cleanup();
    expect(renderDom(withBase).querySelectorAll("[data-before-line]")).toHaveLength(2);
  });
  const points = (container: HTMLElement, chart: string) => [...container.querySelectorAll<SVGCircleElement>(`svg[data-chart="${chart}"] circle`)];
  const cellsOf = (container: HTMLElement, row: string) => [...container.querySelectorAll(`[data-row="${row}"]`)].map(cell => cell.textContent);
  it("plots the same values the table prints, one point per goal count, in its columns", () => {
    const container = renderDom(withBase), { sensitivity } = ratioImpact(manualBase(withBase), withBase);
    expect(cellsOf(container, "goals")).toEqual(["0", "1", "2", "3", "4", "5", "6"]);
    expect(cellsOf(container, "saves")).toEqual(["30", "29", "28", "27", "26", "25", "24"]);
    for (const [chart, format, pick] of [["savePct", formatRatioSavePct, (row: typeof sensitivity[0]) => row.after.savePct], ["gaa", (value: number | null) => value!.toFixed(2), (row: typeof sensitivity[0]) => row.after.gaa]] as const) {
      const drawn = points(container, chart);
      expect(drawn.map(point => Number(point.dataset.goals))).toEqual(sensitivity.map(row => row.goals));
      expect(drawn.map(point => Number(point.dataset.value))).toEqual(sensitivity.map(pick));
      expect(drawn.map(point => format(Number(point.dataset.value)))).toEqual(cellsOf(container, chart));
      expect(drawn.map(point => Number(point.getAttribute("cx")))).toEqual(sensitivity.map((_, index) => Number(((index + 0.5) * 880 / 7).toFixed(1))));
    }
    const heights = (chart: string) => points(container, chart).map(point => Number(point.getAttribute("cy")));
    expect(heights("savePct")[0]).toBeLessThan(heights("savePct")[6]);
    expect(heights("gaa")[0]).toBeGreaterThan(heights("gaa")[6]);
  });
  it("marks the entered line in both charts and its table column", () => {
    const container = renderDom(withBase);
    for (const chart of ["savePct", "gaa"]) {
      const marked = points(container, chart).filter(point => point.hasAttribute("data-entered"));
      expect(marked.map(point => point.dataset.goals)).toEqual(["3"]);
      expect(container.querySelector(`svg[data-chart="${chart}"] [data-entered-band]`)).toBeTruthy();
    }
    expect([...container.querySelectorAll("[data-row='goals'][data-entered]")].map(cell => cell.textContent)).toEqual(["3"]);
    cleanup();
    const outside = settings({ ...withBase, sensitivityGoalsFrom: 5, sensitivityGoalsTo: 6 }), away = renderDom(outside);
    expect(away.querySelectorAll("[data-entered]")).toHaveLength(0);
    expect(away.textContent).toContain("Entered 3 GA is outside this range");
  });
  it("leaves a gap, never a zero point, for a zero denominator", () => {
    const zero = settings({ scenarioMinutes: 0 }), container = renderDom(zero);
    expect(points(container, "gaa")).toHaveLength(0);
    expect(container.querySelectorAll('svg[data-chart="gaa"] [data-gap]')).toHaveLength(7);
    expect(container.querySelectorAll('svg[data-chart="gaa"] [data-segment]')).toHaveLength(0);
    expect(new Set(cellsOf(container, "gaa"))).toEqual(new Set(["—"]));
    expect(points(container, "savePct")).toHaveLength(7);
    expect(container.querySelectorAll('svg[data-chart="savePct"] [data-segment]')).toHaveLength(6);
    cleanup();
    const noShots = renderDom(settings({ scenarioShots: 0, scenarioGoals: 0, sensitivityGoalsFrom: 0, sensitivityGoalsTo: 0 }));
    expect(noShots.querySelectorAll('svg[data-chart="savePct"] [data-gap]')).toHaveLength(1);
    expect(points(noShots, "savePct")).toHaveLength(0);
  });
  it("sets every chart colour as an attribute, because PNG capture drops stylesheet fills", () => {
    const container = renderDom(withBase);
    const marks = [...container.querySelectorAll("svg[data-chart] *, svg[data-testid='ratio-arrow'] *")];
    expect(marks.length).toBeGreaterThan(20);
    for (const mark of marks) {
      expect(mark.hasAttribute("class")).toBe(false);
      expect(mark.hasAttribute("fill") || mark.hasAttribute("stroke")).toBe(true);
    }
  });
  it("says so when the stated range holds no goal count", () => {
    const text = renderCard(settings({ scenarioShots: 2, scenarioGoals: 0, sensitivityGoalsFrom: 5, sensitivityGoalsTo: 6 }));
    expect(text).toContain("No goal count in this range fits the entered shots");
  });
  it("names the charted values in the alt text", () => {
    const data = ratioImpact(manualBase(withBase), withBase), built = buildRatioImpact(withBase, manualBase(withBase), null);
    expect(ratioImpactModule.altText({ ...snapshot(data, withBase), evidence: built.evidence }, data, withBase)).toContain(`3: SV% ${formatRatioSavePct(data.afterRates.savePct)}, GAA ${data.afterRates.gaa!.toFixed(2)}`);
  });
  it("says why both rates are unknown, with no filler", () => {
    expect(renderCard(settings({ scenarioShots: 0, scenarioGoals: 0, scenarioMinutes: 0 }))).toBe("These inputs leave both SV% and GAA unknown");
  });
  it("defaults every input visibly and leaves the base optional", () => {
    expect(parseShareSettings(ratioImpactModule, {})).toEqual(settings());
    expect(parseShareSettings(ratioImpactModule, { baseGoalieId: "8476945" })).toMatchObject({ baseGoalieId: 8476945 });
  });
});
