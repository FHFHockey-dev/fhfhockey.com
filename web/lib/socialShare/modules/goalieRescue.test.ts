import { cleanup, render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import GoalieRescueCard from "components/SocialShare/modules/GoalieRescueCard";
import { parseShareSettings, UNKNOWN_EVIDENCE, type SharePostSnapshot } from "./contract";
import { buildGoalieRescue, cellShade, goalieAvailability, goalieRescueModule, RESCUE_GROUPS, RESCUE_NOTE, type GoalieAvailability, type GoalieRescueSettings, type RescueData, type ScheduledGame } from "./goalieRescue";
import { gameLeft, scheduledGames, teamGamesLeft } from "./goalieRescue.sources";
import { ownershipOf } from "./shared/definitions";
import type { CompletedTeamGame, GoalieAppearance } from "./shared/goalieLedger";

vi.mock("lib/NHL/server", () => ({ getSchedule: vi.fn() }));

const date = (day: number) => `2026-10-${String(day).padStart(2, "0")}`;
const appearance = (over: Partial<GoalieAppearance> & { goalieId: number; gameId: number; date: string }): GoalieAppearance => ({ name: `G${over.goalieId}`, team: "NJD", opponent: "NYR", home: true, started: true, wins: 0, losses: 1, otLosses: 0, saves: 27, shotsAgainst: 30, goalsAgainst: 3, toiSeconds: 3600, shutouts: 0, qualityStart: 0, ...over });
/** Three starts for each goalie, built so each category picks a different leader. */
const three = (goalieId: number, team: string, game: Partial<GoalieAppearance>) => [1, 2, 3].map(day => appearance({ goalieId, team, gameId: goalieId * 100 + day, date: date(day), ...game }));
const rows = [
  ...three(1, "NJD", { wins: 1, saves: 20, shotsAgainst: 24, goalsAgainst: 4 }), // Most wins, lowest SV%.
  ...three(2, "NYR", { saves: 40, shotsAgainst: 44, goalsAgainst: 4 }), // Most saves.
  ...three(3, "PHI", { saves: 19, shotsAgainst: 20, goalsAgainst: 1, toiSeconds: 3000 }), // Best SV%.
  ...three(4, "BOS", { saves: 19, shotsAgainst: 20, goalsAgainst: 1 }), // Same SV% as G3 with lower GAA.
];
const own = (entries: Record<number, number | null>, status: Record<number, string> = {}) => new Map<number, GoalieAvailability>(Object.entries(entries).map(([id, pct]) => [Number(id), { ownership: ownershipOf(pct, "2026-10-31"), status: status[Number(id)] ?? "" }]));
const settings = (over: Partial<GoalieRescueSettings> = {}): GoalieRescueSettings => ({ category: "wins", window: "l10", ownershipCeiling: 50, includeUnknown: "off", minStarts: 3, ...over });
const build = (over: Partial<Parameters<typeof buildGoalieRescue>[0]> = {}) => buildGoalieRescue({ settings: settings(), appearances: rows, teamGames: [], scheduledDates: [], availability: own({ 1: 10, 2: 20, 3: 30, 4: 40 }), teamGamesLeft: new Map([["NJD", 2], ["NYR", 3]]), scheduleReasons: [], through: date(30), weekEnd: "2026-11-01", ...over });
const ids = (result: ReturnType<typeof build>) => result.data!.rows.map(row => row.goalieId);

afterEach(cleanup);

describe("goalie category rescue", () => {
  it("keeps wins, saves, SA and ratios as separate columns, pooled from sums", () => {
    const row = build().data!.rows.find(entry => entry.goalieId === 1)!;
    expect(row).toMatchObject({ wins: 3, saves: 60, shotsAgainst: 72, goalsAgainst: 12, toiSeconds: 10800, starts: 3, relief: 0, teamGamesLeft: 2 });
    expect(row.savePct).toBeCloseTo(60 / 72);
    expect(row.gaa).toBeCloseTo(4);
  });
  it("has no combined score, and each category orders on its own", () => {
    const first = (category: GoalieRescueSettings["category"]) => build({ settings: settings({ category }) }).data!.rows[0].goalieId;
    expect([first("wins"), first("saves"), first("savePct"), first("gaa")]).toEqual([1, 2, 3, 4]);
    expect(Object.keys(build().data!.rows[0]).filter(key => /score|index|composite|blend|total|overall/i.test(key))).toEqual([]);
    expect(goalieRescueModule.fields.map(field => field.id)).toEqual(["category", "window", "ownershipCeiling", "includeUnknown", "minStarts"]);
    expect(JSON.stringify(goalieRescueModule.fields)).not.toMatch(/score|composite/i);
  });
  it("gives GAA the low direction and shares tied ranks", () => {
    const pct = build({ settings: settings({ category: "savePct" }) }).data!.rows;
    expect(pct.slice(0, 2).map(row => [row.goalieId, row.rank])).toEqual([[3, 1], [4, 1]]);
    expect(pct[2].rank).toBe(3);
    expect(build({ settings: settings({ category: "gaa" }) }).data!.rows.map(row => [row.goalieId, row.rank])).toEqual([[4, 1], [3, 2], [1, 3], [2, 3]]);
  });
  it("counts relief apart while pooling its totals", () => {
    const result = build({ appearances: [...three(5, "NJD", { wins: 0 }), appearance({ goalieId: 5, gameId: 599, date: date(4), started: false, saves: 10, shotsAgainst: 10, goalsAgainst: 0, toiSeconds: 1200 })], availability: own({ 5: 10 }) });
    expect(result.data!.rows[0]).toMatchObject({ starts: 3, relief: 1, saves: 91, shotsAgainst: 100, appearances: 4, short: true });
  });
  it("leaves a missing value unranked, never a smaller total, and is partial", () => {
    const result = build({ appearances: [...three(1, "NJD", { wins: 1 }), appearance({ goalieId: 2, gameId: 21, date: date(1), wins: null }), appearance({ goalieId: 2, gameId: 22, date: date(2) }), appearance({ goalieId: 2, gameId: 23, date: date(3) })] });
    expect(ids(result)).toEqual([1]);
    expect(result.state).toBe("partial");
    expect(result.data!.unranked).toBe(1);
    expect(result.reasons?.[0]).toMatch(/1 candidates have no recorded value/);
  });
});

describe("ownership states", () => {
  it("includes the ceiling itself and excludes above it", () => {
    const result = build({ availability: own({ 1: 50, 2: 51, 3: 0, 4: 100 }) });
    expect(ids(result)).toEqual([1, 3]);
    expect(result.data!.aboveCeiling).toBe(2);
  });
  it("keeps a stated 0 known and shows it as 0%", () => {
    expect(build({ availability: own({ 1: 0 }) }).data!.rows[0].ownership).toEqual({ state: "known", pct: 0, asOf: "2026-10-31" });
  });
  it("excludes unknown unless the visible setting includes it, and counts both", () => {
    const off = build({ availability: own({ 1: null, 2: 10 }) });
    expect(ids(off)).toEqual([2]);
    expect(off.data!.unknownExcluded).toBe(3);
    expect(off.evidence.cohort).toContain("3 unknown ownership excluded");
    const on = build({ settings: settings({ includeUnknown: "on" }), availability: own({ 1: null, 2: 10 }) });
    expect(ids(on)).toEqual([1, 2, 3, 4]);
    expect(on.data!.rows[0].ownership.state).toBe("unknown");
    expect(on.evidence.cohort).toContain("unknown ownership included");
  });
  it("drops unavailable Yahoo statuses but keeps day to day", () => {
    const result = build({ availability: own({ 1: 10, 2: 10, 3: 10, 4: 10 }, { 1: "IR", 2: "O", 3: "DTD", 4: "NA" }) });
    expect(ids(result)).toEqual([3]);
    expect(result.data!.unavailableStatus).toBe(3);
  });
  it("joins only through the map and drops an ambiguous id to unknown", () => {
    const yahoo = (key: string, id: string, pct: number | null) => ({ player_key: key, player_id: id, percent_ownership: pct, status: null, last_updated: "2026-10-31 08:40:21" });
    const map = goalieAvailability(
      [yahoo("477.p.1", "1", 10), yahoo("477.p.2", "2", 20), yahoo("477.p.3", "3", 30), yahoo("477.p.4", "4", 40), yahoo("477.p.5", "5", 50), yahoo("477.p.6", "6", null)],
      [{ yahoo_player_id: "477.p.1", nhl_player_id: "8000001" }, { yahoo_player_id: "2", nhl_player_id: "8000002" }, { yahoo_player_id: "477.p.3", nhl_player_id: "8000003" }, { yahoo_player_id: "3", nhl_player_id: "8000033" }, { yahoo_player_id: "477.p.4", nhl_player_id: "8000004" }, { yahoo_player_id: "477.p.5", nhl_player_id: "8000004" }, { yahoo_player_id: "477.p.6", nhl_player_id: "8000006" }],
      "2026-10-30",
    );
    expect(map.get(8000001)?.ownership).toEqual({ state: "known", pct: 10, asOf: "2026-10-31" });
    expect(map.get(8000002)?.ownership.state).toBe("known");
    expect(map.has(8000003)).toBe(false);
    expect(map.has(8000033)).toBe(false);
    expect(map.has(8000004)).toBe(false);
    expect(map.get(8000006)?.ownership).toEqual({ state: "unknown", pct: null, asOf: null });
  });
  const yahooRow = (id: number, pct: number | null, lastUpdated: string | null) => ({ player_key: `477.p.${id}`, player_id: String(id), percent_ownership: pct, status: null, last_updated: lastUpdated });
  const mapRow = (id: number) => ({ yahoo_player_id: `477.p.${id}`, nhl_player_id: String(id) });
  it("judges each goalie's own date, so one fresh row can't vouch for a stale one", () => {
    const availability = goalieAvailability([yahooRow(1, 1, "2026-10-01 08:00:00"), yahooRow(2, 90, "2026-11-01 08:00:00"), yahooRow(3, 5, null), yahooRow(4, null, "2026-10-01 08:00:00")], [1, 2, 3, 4].map(mapRow), "2026-10-31");
    expect(availability.get(1)).toEqual({ ownership: { state: "unknown", pct: null, asOf: null }, status: "", stale: { lastObserved: "2026-10-01" } });
    expect(availability.get(2)?.ownership).toEqual({ state: "known", pct: 90, asOf: "2026-11-01" });
    expect(availability.get(3)?.stale).toEqual({ lastObserved: null });
    expect(availability.get(4)?.stale).toBeUndefined();
    const result = build({ availability, through: "2026-10-31" });
    expect(ids(result)).toEqual([]);
    expect(result.data!).toMatchObject({ aboveCeiling: 1, unknownExcluded: 3 });
    expect(result.state).toBe("partial");
    expect(result.reasons).toContain("2 goalies' Yahoo ownership is older than 2026-10-31, the oldest from 2026-10-01: treated as unknown and excluded.");
    expect(result.evidence.sources[1].state).toBe("stale");
  });
  it("lists a stale goalie as unknown, never at the old percentage, when the setting includes unknown", () => {
    const availability = goalieAvailability([yahooRow(1, 1, "2026-10-01 08:00:00"), yahooRow(2, 20, "2026-10-31 08:00:00")], [1, 2].map(mapRow), "2026-10-31");
    const result = build({ settings: settings({ includeUnknown: "on" }), availability, through: "2026-10-31" });
    expect(result.data!.rows.find(row => row.goalieId === 1)!.ownership.state).toBe("unknown");
    expect(result.reasons).toContain("1 goalie's Yahoo ownership is older than 2026-10-31, the oldest from 2026-10-01: treated as unknown and shown as a dash.");
  });
  it("gives the oldest listed ownership date as the evidence date, not the newest", () => {
    const availability = goalieAvailability([yahooRow(1, 10, "2026-10-31 08:00:00"), yahooRow(2, 20, "2026-11-01 08:00:00")], [1, 2].map(mapRow), "2026-10-31");
    const result = build({ availability, through: "2026-10-31" }), yahoo = result.evidence.sources[1];
    expect(result.state).toBe("ready");
    expect([yahoo.state, yahoo.asOf]).toEqual(["ready", "2026-10-31"]);
    expect(yahoo.reasons).toContain("Listed ownership was last observed 2026-10-31 at the oldest, 2026-11-01 at the newest.");
  });
  it("is partial and stale when no ownership could be read", () => {
    const result = build({ availability: new Map() });
    expect(result.state).toBe("partial");
    expect(result.reasons).toContain("No Yahoo goalie ownership could be read.");
    expect(result.evidence.sources[1]).toMatchObject({ state: "stale", asOf: null });
  });
});

describe("pool and schedule", () => {
  it("keeps an empty pool empty and not exportable", () => {
    const active = settings({ ownershipCeiling: 0 }), result = build({ settings: active });
    expect(result.data!.rows).toEqual([]);
    expect(goalieRescueModule.hasRows(result.data!, active)).toBe(false);
  });
  it("requires official starts in the window, not appearances", () => {
    const relief = [1, 2, 3].map(day => appearance({ goalieId: 7, gameId: 700 + day, date: date(day), started: false }));
    expect(build({ appearances: relief, availability: own({ 7: 10 }) }).data!.qualified).toBe(0);
  });
  it("is partial when team games are unresolved", () => {
    const teamGames: CompletedTeamGame[] = [{ gameId: 1, date: date(1), team: "NJD" }];
    expect(build({ teamGames, scheduledDates: [date(1)] }).state).toBe("partial");
  });
  const SUNDAY = "2026-11-01", EVENING = "2026-11-02T01:30:00Z";
  const game = (over: Partial<ScheduledGame> = {}): ScheduledGame => ({ id: 1, date: SUNDAY, gameType: 2, startTimeUtc: "2026-11-01T23:00:00Z", state: "OFF", scheduleState: "OK", homeTeamId: 1, awayTeamId: 3, ...over });
  it("gives 0 on Sunday evening after a team's final game", () => {
    const { left, unresolved } = teamGamesLeft([game()], SUNDAY, EVENING);
    expect([left.get("NJD"), left.get("NYI"), unresolved]).toEqual([0, 0, 0]);
  });
  it("counts games not yet started or in progress, and no finished, postponed or cancelled game", () => {
    const left = (over: Partial<ScheduledGame>) => gameLeft(game(over), SUNDAY, EVENING);
    expect([left({ state: "FUT", startTimeUtc: "2026-11-02T02:00:00Z" }), left({ state: "PRE" }), left({ state: "LIVE" }), left({ state: "CRIT" })]).toEqual([true, true, true, true]);
    expect([left({ state: "FINAL" }), left({ state: "OFF" }), left({ state: "FUT", scheduleState: "PPD" }), left({ state: "FUT", scheduleState: "CNCL" })]).toEqual([false, false, false, false]);
  });
  it("keeps a game running past midnight, and drops anything else from an earlier date", () => {
    expect(gameLeft(game({ date: "2026-10-31", state: "LIVE" }), SUNDAY, EVENING)).toBe(true);
    expect(gameLeft(game({ date: "2026-10-31", state: "FUT" }), SUNDAY, EVENING)).toBe(false);
  });
  it("lets the state decide when the start time is null, and calls the game unknown when there is no state either", () => {
    expect(gameLeft(game({ startTimeUtc: null, state: "FUT" }), SUNDAY, EVENING)).toBe(true);
    expect(gameLeft(game({ startTimeUtc: null, state: "OFF" }), SUNDAY, EVENING)).toBe(false);
    expect(gameLeft(game({ startTimeUtc: null, state: null }), SUNDAY, EVENING)).toBeNull();
  });
  it("uses the start time only when the state is unusable", () => {
    expect(gameLeft(game({ state: null, startTimeUtc: "2026-11-02T03:00:00Z" }), SUNDAY, EVENING)).toBe(true);
    expect(gameLeft(game({ state: null, startTimeUtc: "2026-11-01T23:00:00Z" }), SUNDAY, EVENING)).toBeNull();
  });
  it("prints an unknown count rather than a smaller number, for both teams, in any order", () => {
    const { left, unresolved } = teamGamesLeft([game({ id: 1, state: "FUT" }), game({ id: 2, state: null, startTimeUtc: null }), game({ id: 3, state: "FUT", awayTeamId: 2 })], SUNDAY, EVENING);
    expect([left.get("NJD"), left.get("NYR"), left.get("NYI"), left.get("PHI"), unresolved]).toEqual([null, null, 1, 0, 1]);
  });
  it("counts regular season games only, each once though the feed lists it per team", () => {
    const record = { id: 9, season: 20262027, gameDate: SUNDAY, gameType: 2, gameState: "FUT", gameScheduleState: "OK", startTimeUTC: "2026-11-02T02:00:00Z", homeTeam: { id: 1 }, awayTeam: { id: 3 } };
    const games = scheduledGames({ data: { 1: { SUN: record }, 3: { SUN: record } } } as never);
    expect(games).toEqual([{ id: 9, date: SUNDAY, gameType: 2, startTimeUtc: "2026-11-02T02:00:00Z", state: "FUT", scheduleState: "OK", homeTeamId: 1, awayTeamId: 3 }]);
    expect(teamGamesLeft(games, SUNDAY, EVENING).left.get("NJD")).toBe(1);
    expect(teamGamesLeft([game({ gameType: 1, state: "FUT" })], SUNDAY, EVENING).left.get("NJD")).toBe(0);
  });
  it("is partial when the schedule can't say, and states the counting rule", () => {
    const result = build({ scheduleReasons: ["The NHL schedule could not be read, so GMS LEFT prints a dash."] });
    expect(result.state).toBe("partial");
    expect(result.evidence.sources[2].state).toBe("partial");
    expect(build().evidence.sample).toContain("count games not yet started or in progress at generation; a finished game drops out.");
  });
  it("defaults to the contract's settings", () => {
    expect(parseShareSettings(goalieRescueModule, {})).toEqual({ category: "wins", window: "l10", ownershipCeiling: 50, includeUnknown: "off", minStarts: 3 });
    expect(goalieRescueModule).toMatchObject({ basis: "observed", suggestedUse: "Works for a Thursday or Friday post." });
    expect(goalieRescueModule).not.toHaveProperty("schedule");
  });
});

const snapshot = (data: RescueData, active: GoalieRescueSettings): SharePostSnapshot<GoalieRescueSettings, RescueData> => ({ schemaVersion: 1, id: "e", post: "goalie-rescue", state: "ready", reasons: [], generatedAt: "2026-10-31T12:00:00Z", expiresAt: null, timeZone: "America/New_York", settings: active, evidence: UNKNOWN_EVIDENCE, data, teams: [], fixture: true });
const renderCard = (data: RescueData, active: GoalieRescueSettings) => render(createElement(GoalieRescueCard, { snapshot: snapshot(data, active), data, settings: active, logos: {} })).container.textContent!;

describe("goalie rescue card", () => {
  it("sizes the name column to its text and gives the spare width to the stat columns", () => {
    const scss = readFileSync(resolve(process.cwd(), "components/SocialShare/modules/GoalieRescueCard.module.scss"), "utf8");
    expect(scss).toContain("grid-template-columns: max-content minmax(0, max-content) repeat(10, auto);");
    expect(scss).not.toMatch(/justify-content: (start|center|end)/);
    const named = rows.map(row => row.goalieId === 1 ? { ...row, name: "Dennis Hildeby" } : row);
    expect(renderCard(build({ appearances: named, availability: own({ 1: 10, 2: 20, 3: 30, 4: 40 }, { 1: "DTD" }) }).data!, settings())).toContain("Dennis HildebyDTD");
  });
  it("prints the separate lenses, ownership states and the limits of rostered %", () => {
    const active = settings({ includeUnknown: "on" }), data = build({ settings: active, availability: own({ 1: 10, 2: null, 3: 0, 4: 40 }) }).data!, text = renderCard(data, active);
    for (const label of ["OWN", "W", "SV", "SA", "SV%", "GA", "GAA", "RELIEF", "GMS LEFT", RESCUE_NOTE, "10%", "0%", "—", ".833", "4.00"]) expect(text).toContain(label);
    expect(text).not.toMatch(/\bscore\b|start odds|will start/i);
  });
  it("keeps the card to one legend line and moves the explainers to the printed evidence", () => {
    const active = settings(), result = build({ settings: active });
    expect(render(createElement(GoalieRescueCard, { snapshot: snapshot(result.data!, active), data: result.data!, settings: active, logos: {} })).container.querySelectorAll("p")).toHaveLength(1);
    for (const label of ["Win support: W", "Volume: SV", "Ratio exposure: SV%", "run through 2026-11-01"]) expect(result.evidence.sample).toContain(label);
    for (const label of ["0 above the ceiling", "0 excluded by Yahoo status"]) expect(result.evidence.cohort).toContain(label);
  });
  it("lists up to its size, and caps a tie that would clip the card", () => {
    const pool = (count: number) => Array.from({ length: count }, (_, index) => index + 10).flatMap(id => three(id, "PHI", {}));
    const everyone = (count: number) => own(Object.fromEntries(Array.from({ length: count }, (_, index) => [index + 10, 10])));
    expect(build({ appearances: pool(25), availability: everyone(25) }).data!.rows).toHaveLength(25);
    const tied = build({ appearances: pool(34), availability: everyone(34) });
    expect(tied.data!.rows).toHaveLength(28);
    expect(tied.evidence.sample).toContain("6 more tied goalies are not listed.");
    const distinct = Array.from({ length: 25 }, (_, index) => index + 10).flatMap(id => three(id, "PHI", { saves: id }));
    expect(build({ settings: settings({ category: "saves" }), appearances: distinct, availability: everyone(25) }).data!.rows).toHaveLength(20);
  });
  const column = (id: string) => RESCUE_GROUPS.flatMap(group => group.columns).find(entry => entry.id === id)!;
  const cells = (container: HTMLElement, id: string) => [...container.querySelectorAll<HTMLElement>(`[data-column="${id}"]:not([data-head])`)];
  const rendered = (active: GoalieRescueSettings) => render(createElement(GoalieRescueCard, { snapshot: snapshot(build({ settings: active }).data!, active), data: build({ settings: active }).data!, settings: active, logos: {} })).container;
  it("groups the columns under Wins, Volume and Ratios", () => {
    const container = rendered(settings());
    expect([...container.querySelectorAll("[data-group-head]")].map(head => head.textContent)).toEqual(["Wins", "Volume", "Ratios"]);
    expect(RESCUE_GROUPS.map(group => group.columns.map(entry => entry.label))).toEqual([["W"], ["SV", "SA"], ["SV%", "GA", "GAA"]]);
    expect(container.querySelector('[data-head][data-column="gaa"]')!.getAttribute("data-group")).toBe("ratios");
  });
  it("reads better the same way in every column: low GAA and GA like high SV% and W", () => {
    const { rows: listed } = build().data!;
    expect(cellShade(2, listed, column("gaa"))).toMatchObject({ tone: "better" });
    expect(cellShade(0, listed, column("gaa")).goodness).toBeGreaterThan(cellShade(4, listed, column("gaa")).goodness!);
    expect(cellShade(4, listed, column("gaa"))).toMatchObject({ tone: "worse", goodness: 0 });
    const container = rendered(settings()), tone = (id: string, goalie: number) => { const index = listed.findIndex(row => row.goalieId === goalie); return cells(container, id)[index].dataset.tone; };
    // G1 has the worst ratios and the most wins; G4 the lowest GAA of the group.
    expect([tone("gaa", 1), tone("savePct", 1), tone("wins", 1), tone("gaa", 4), tone("savePct", 4)]).toEqual(["worse", "worse", "better", "better", "better"]);
    expect(cells(container, "gaa")[listed.findIndex(row => row.goalieId === 4)].style.background.replace(/\s/g, "")).toMatch(/^rgba\(0,255,153,/);
    expect(cells(container, "gaa")[listed.findIndex(row => row.goalieId === 1)].style.background.replace(/\s/g, "")).toMatch(/^rgba\(255,99,132,/);
  });
  it("scales each column on its own and leaves SA and missing values unshaded, with every value printed", () => {
    const { rows: listed } = build().data!;
    expect(cellShade(30, listed, column("shotsAgainst"))).toEqual({ tone: "none", goodness: null, alpha: 0 });
    expect(cellShade(null, listed, column("gaa"))).toEqual({ tone: "none", goodness: null, alpha: 0 });
    const same = build({ availability: own({ 1: 10 }) }).data!.rows;
    expect(cellShade(same[0].gaa, same, column("gaa"))).toEqual({ tone: "level", goodness: 0.5, alpha: 0 });
    const container = rendered(settings());
    expect(cells(container, "shotsAgainst").every(cell => cell.dataset.tone === "none" && !cell.style.background)).toBe(true);
    expect(cells(container, "shotsAgainst").map(cell => cell.textContent)).toEqual(listed.map(row => String(row.shotsAgainst)));
    expect(cells(container, "gaa").map(cell => cell.textContent)).toEqual(listed.map(row => row.gaa!.toFixed(2)));
  });
  it("highlights the selected category's column and no other", () => {
    for (const category of ["wins", "saves", "savePct", "gaa"] as const) {
      const container = rendered(settings({ category }));
      expect([...new Set([...container.querySelectorAll<HTMLElement>("[data-selected]")].map(cell => cell.dataset.column))]).toEqual([category]);
      expect(container.querySelector(`[data-head][data-column="${category}"]`)!.hasAttribute("data-selected")).toBe(true);
      expect(cells(container, category).every(cell => cell.hasAttribute("data-selected") && cell.querySelector("b"))).toBe(true);
      cleanup();
    }
  });
  it("shows team games left as one dot per game beside the number, and unknown as a dash", () => {
    const { rows: listed } = build().data!, container = rendered(settings());
    const left = cells(container, "left");
    expect(left.map(cell => cell.querySelectorAll("[data-dot]").length)).toEqual(listed.map(row => row.teamGamesLeft ?? 0));
    expect(left.map(cell => cell.textContent)).toEqual(listed.map(row => String(row.teamGamesLeft ?? "—")));
    expect(listed.some(row => row.teamGamesLeft === null) && listed.some(row => row.teamGamesLeft === 3)).toBe(true);
  });
  it("adds no score: shades are worked out on the card and never stored", () => {
    const data = build().data!, container = rendered(settings());
    expect(JSON.stringify(data)).not.toMatch(/score|composite|goodness|shade|tone/i);
    expect(container.textContent).not.toMatch(/score|composite|overall/i);
  });
  it("says why an empty pool is empty, with no filler", () => {
    const active = settings({ ownershipCeiling: 0 });
    expect(renderCard(build({ settings: active }).data!, active)).toBe("No goalie with 3 official starts is at or under 0% rostered in this window");
  });
  it("alt text names the category, value and ownership", () => {
    const active = settings({ category: "savePct" }), data = build({ settings: active }).data!;
    expect(goalieRescueModule.altText(snapshot(data, active), data, active)).toContain("by SV%, Last 10 appearances");
    expect(goalieRescueModule.altText(snapshot(data, active), data, active)).toContain("G3 (PHI): .950, 30% rostered");
  });
});
