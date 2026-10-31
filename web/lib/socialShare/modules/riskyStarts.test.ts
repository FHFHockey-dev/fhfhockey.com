import { describe, expect, it, vi } from "vitest";
import { sharePostExportToken } from "./contract";
import { RISKY_CORRELATION_NOTE, riskyFlags, riskyPairs, riskyRows, riskyRowsForLens, riskyStartsModule, riskyStartsResult, type RiskyRow, type RiskyStartsData, type RiskyStartsSettings } from "./riskyStarts";
import { gameSignals, buildTeamLenses, buildGoalieInventory } from "./shared/goalieInventory.sources";
import { FIXTURE_INPUT, FIXTURE_TEAMS, GOALIE_INVENTORY_FIXTURE, GOALIE_INVENTORY_FIXTURE_DETAIL } from "./shared/goalieInventory.fixture";

vi.mock("lib/supabase/public-client", () => ({ default: {} }));

const { lenses } = buildTeamLenses({ teamGames: FIXTURE_INPUT.teamGames, nst: FIXTURE_INPUT.nst, teams: FIXTURE_TEAMS, season: 20262027, cutoff: "2026-11-01" });
const data = riskyStartsResult(GOALIE_INVENTORY_FIXTURE_DETAIL).data as RiskyStartsData;
const settings = (lens: RiskyStartsSettings["lens"]): RiskyStartsSettings => ({ days: 7, lens });

describe("Risky Starts pairings (11.4)", () => {
  it("is symmetric: each game gives both sides, and each side's opponent rate is the other's own", () => {
    const rows = riskyRows(GOALIE_INVENTORY_FIXTURE).filter(row => row.gameId === 900010);
    expect(rows.map(row => row.team).sort()).toEqual(["NJD", "NYR"]);
    const njd = rows.find(row => row.team === "NJD")!, nyr = rows.find(row => row.team === "NYR")!;
    expect([njd.home, nyr.home]).toEqual([false, true]);
    expect(njd.lenses.volume[0].sides[0].metric).toEqual(lenses.get("NYR")!.shotsFor);
    expect(nyr.lenses.volume[0].sides[0].metric).toEqual(lenses.get("NJD")!.shotsFor);
    expect(njd.lenses.volume[0].sides[1].metric).toEqual(lenses.get("NJD")!.shotsAgainst);
    expect(nyr.lenses.volume[0].sides[1].metric).toEqual(lenses.get("NYR")!.shotsAgainst);
    expect(njd.lenses.win[0].sides[0].metric).toEqual(lenses.get("NJD")!.goalsFor);
    expect(nyr.lenses.win[0].sides[1].metric).toEqual(lenses.get("NJD")!.goalsAgainst);
  });
  it("mirrors pure: swapping the teams swaps every owner", () => {
    const pairs = riskyPairs("NJD", "NYR", gameSignals(lenses.get("NJD")!, lenses.get("NYR")!)), mirror = riskyPairs("NYR", "NJD", gameSignals(lenses.get("NYR")!, lenses.get("NJD")!));
    for (const lens of ["volume", "ratio", "win"] as const) pairs[lens].forEach((pair, index) => {
      expect(pair.sides.map(side => side.team === "NJD" ? "NYR" : "NJD")).toEqual(mirror[lens][index].sides.map(side => side.team));
      expect(pair.sides.map(side => side.label)).toEqual(mirror[lens][index].sides.map(side => side.label));
    });
  });
  it("flags a pairing only with both sides in the top third, and a weak PK from the bottom", () => {
    const row = data.rows.find(item => item.team === "NYR" && item.gameId === 900010)!;
    // NJD SF ranks 2 of 4 (top third is 2), NYR SA ties for 1.
    expect(row.lenses.volume[0].flagged).toBe(true);
    const other = data.rows.find(item => item.team === "NJD" && item.gameId === 900010)!;
    // NYR SF ranks 3.
    expect(other.lenses.volume[0].flagged).toBe(false);
    const special = riskyPairs("A", "B", { ...gameSignals(lenses.get("NJD")!, lenses.get("TOR")!), ratioExposure: { ...gameSignals(lenses.get("NJD")!, lenses.get("TOR")!).ratioExposure, opponentPowerPlayPct: { value: 30, unit: "%", window: "", sampleGames: 2, leagueRank: 1, leagueCohort: 32 }, teamPenaltyKillPct: { value: 70, unit: "%", window: "", sampleGames: 2, leagueRank: 32, leagueCohort: 32 } } });
    expect(special.ratio.find(pair => pair.id === "special-teams")?.flagged).toBe(true);
  });
  it("never flags without ranks: an incomplete league leaves no flagged pairing to publish", () => {
    const result = riskyStartsResult(buildGoalieInventory({ ...FIXTURE_INPUT, nst: FIXTURE_INPUT.nst.filter(row => row.team_abbreviation !== "TOR") }));
    expect(result.state).toBe("partial");
    expect(result.data!.rows.flatMap(row => [...row.lenses.volume, ...row.lenses.ratio])
      .every(pair => !pair.flagged || pair.id === "special-teams" || pair.id === "penalties")).toBe(true);
    expect(result.evidence.cohort).toContain("team-nights");
  });
  it("orders within one lens: another lens's flags never move a row, and nothing sums them", () => {
    const pair = (flagged: boolean) => ({ id: "p", label: "P", sides: [], flagged });
    const row = (team: string, volume: boolean[], ratio: boolean[]): RiskyRow => ({ gameId: 1, date: "2026-11-02", startTimeUtc: null, team, opponent: "X", home: true, teamSecondNight: false, opponentSecondNight: false, conflicting: false, goalies: [], lenses: { volume: volume.map(pair), ratio: ratio.map(pair), win: [] } });
    const rows = [row("A", [true], [true, true, true]), row("B", [true], [true]), row("C", [false], [true, true])];
    expect(riskyRowsForLens(rows, "ratio").map(item => item.team)).toEqual(["A", "C", "B"]);
    expect(riskyRowsForLens(rows, "volume").map(item => item.team)).toEqual(["A", "B"]);
    expect(riskyFlags(rows[0], "volume")).toBe(1);
    expect(JSON.stringify(data)).not.toMatch(/"(score|total|composite|odds|winProbability)"/);
  });
  it("carries the correlation note on the data and in the alt text, and promises no odds", () => {
    expect(data.correlationNote).toBe(RISKY_CORRELATION_NOTE);
    expect(RISKY_CORRELATION_NOTE).toMatch(/correlated/);
    expect(RISKY_CORRELATION_NOTE).toMatch(/no win or start odds/);
    expect(riskyStartsModule.altText({ evidence: { sample: "s" } } as never, data, settings("volume"))).toContain(RISKY_CORRELATION_NOTE);
  });
});

describe("Risky Starts post", () => {
  it("drops games already started, and keeps goalies with their own status", () => {
    const rows = riskyRows({ ...GOALIE_INVENTORY_FIXTURE, generatedAt: "2026-11-02T23:15:00.000Z" });
    expect(rows.some(row => row.gameId === 900010)).toBe(false);
    expect(rows.some(row => row.gameId === 900011)).toBe(true);
    const njd = data.rows.find(row => row.team === "NJD" && row.gameId === 900010)!;
    expect(njd.goalies.map(goalie => [goalie.name, goalie.confirmation.state])).toEqual([["Éric Testeur", "confirmed"], ["Sam Relief", "none"]]);
  });
  it("marks a conflicting team-night and keeps it off the other side", () => {
    const row = (team: string, gameId: number) => data.rows.find(item => item.team === team && item.gameId === gameId)!;
    expect(row("TOR", 900012).conflicting).toBe(true);
    expect(row("NJD", 900012).conflicting).toBe(false);
  });
  it("has no rows, so no export, when the lens has nothing flagged", () => {
    expect(riskyStartsModule.hasRows({ ...data, rows: [] }, settings("ratio"))).toBe(false);
    expect(riskyStartsModule.hasRows(data, settings("volume"))).toBe(true);
  });
  it("is missing with no data when the inventory is, and keeps blocked sources out of its evidence", () => {
    const missing = riskyStartsResult({ coverage: null, conflicts: [], inventory: { ...GOALIE_INVENTORY_FIXTURE, state: "missing", goalies: [], sources: [], reasons: ["could not be read"] } });
    expect(missing).toMatchObject({ state: "missing", data: null, reasons: ["could not be read"] });
    const closed = riskyStartsResult(buildGoalieInventory({ ...FIXTURE_INPUT, confirmations: null, forecasts: null }));
    expect(closed.state).toBe("ready");
    expect(closed.evidence.sources.map(source => source.name)).not.toContain("Goalie start observations");
    expect(closed.data!.confirmationNote).toMatch(/could not be read/);
  });
  it("treats the lens as a browser setting the export token still covers", () => {
    const field = riskyStartsModule.fields.find(item => item.id === "lens")!;
    expect(field.clientOnly).toBe(true);
    const snapshot = { id: "e", post: "risky-starts" };
    expect(sharePostExportToken(riskyStartsModule.fields, snapshot, settings("ratio"))).not.toBe(sharePostExportToken(riskyStartsModule.fields, snapshot, settings("win")));
  });
});
