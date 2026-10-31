import { describe, expect, it, vi } from "vitest";
import { parseShareSettings, sharePostExportToken } from "./contract";
import { shareModule } from "./registry";
import { FORECAST_ADMITTED_NOTE, startSitModule, startSitResult, startSitRows, upcomingInventory, type StartSitData, type StartSitSettings } from "./startSit";
import { FIXTURE_INPUT, GOALIE_INVENTORY_FIXTURE, GOALIE_INVENTORY_FIXTURE_DETAIL } from "./shared/goalieInventory.fixture";
import { buildGoalieInventory, CONFIRMATION_CLOSED_REASON, FORECAST_CLOSED_REASON } from "./shared/goalieInventory.sources";

vi.mock("lib/supabase/public-client", () => ({ default: {} }));

const data = startSitResult(GOALIE_INVENTORY_FIXTURE_DETAIL).data as StartSitData;
const settings = (search: string): StartSitSettings => ({ days: 7, search });
const names = (search: string) => [...new Set(startSitRows(data, search).map(row => row.goalie.name))];

describe("Start/Sit (11.5)", () => {
  it("finds a goalie regardless of accents, through the frozen search", () => {
    expect(names("eric")).toEqual(["Éric Testeur"]);
    expect(names("sogaard")).toEqual(["Mikko Søgaard"]);
    expect(names("ŠIMEK")).toEqual(["Jonas Šimek"]);
  });
  it("finds a team's goalies by abbreviation or name", () => {
    expect(names("tor").sort()).toEqual(["Ana Split", "Lee Split"]);
    expect(names("maple leafs").sort()).toEqual(["Ana Split", "Lee Split"]);
    expect(names("new jersey")).toEqual(["Éric Testeur", "Sam Relief"]);
  });
  it("changes the export token with the search, and never refetches for it", () => {
    const snapshot = { id: "e", post: "start-sit" };
    expect(sharePostExportToken(startSitModule.fields, snapshot, settings("eric"))).not.toBe(sharePostExportToken(startSitModule.fields, snapshot, settings("")));
    expect(startSitModule.fields.find(field => field.id === "search")?.clientOnly).toBe(true);
    // The server scope refuses the key, so a search can never reach the loader.
    expect(() => parseShareSettings(startSitModule, { search: "eric" }, "server")).toThrow();
    expect(parseShareSettings(startSitModule, { search: "eric" }, "all")).toEqual({ days: 7, search: "eric" });
  });
  it("gives one row per goalie and game, in date order, with no export on an empty search", () => {
    const rows = startSitRows(data, "");
    expect(rows.map(row => row.key)).toEqual(expect.arrayContaining(["900010:7001", "900012:7001"]));
    expect(rows.map(row => row.game.date)).toEqual([...rows.map(row => row.game.date)].sort());
    expect(startSitModule.hasRows(data, settings("nobody"))).toBe(false);
    expect(startSitModule.hasRows(data, settings("eric"))).toBe(true);
  });
  it("keeps source status and forecast apart in every direction", () => {
    const row = (key: string) => startSitRows(data, "").find(item => item.key === key)!.game;
    expect([row("900010:7001").confirmation.state, row("900010:7001").forecast.state]).toEqual(["confirmed", "unavailable"]);
    expect([row("900010:7003").confirmation.state, row("900010:7003").forecast.state]).toEqual(["projected", "unavailable"]);
    expect([row("900011:7004").confirmation.state, row("900011:7004").forecast.state]).toEqual(["none", "qualified"]);
    expect([row("900011:7005").confirmation.state, row("900011:7005").forecast.state]).toEqual(["none", "unavailable"]);
  });
  it("still previews descriptive context with both sources closed, and says why", () => {
    const closed = startSitResult(buildGoalieInventory({ ...FIXTURE_INPUT, observations: null, forecasts: null }));
    expect(closed.state).toBe("ready");
    expect(closed.data!.confirmationNote).toBe(CONFIRMATION_CLOSED_REASON);
    expect(closed.data!.forecastNote).toBe(FORECAST_CLOSED_REASON);
    expect(startSitRows(closed.data!, "").every(row => row.game.confirmation.state === "none" && row.game.forecast.state === "unavailable")).toBe(true);
    expect(startSitRows(closed.data!, "").length).toBeGreaterThan(0);
  });
  it("does not call forecasts unavailable when admitted ones were read", () => {
    expect(data.forecastNote).toBe(FORECAST_ADMITTED_NOTE);
  });
  it("drops games already under way, and a goalie with none left", () => {
    const later = upcomingInventory({ ...GOALIE_INVENTORY_FIXTURE, generatedAt: "2026-11-05T00:00:00.000Z" });
    expect(later.goalies).toEqual([]);
  });
  it("is missing with no data when the inventory is", () => {
    expect(startSitResult({ coverage: null, inventory: { ...GOALIE_INVENTORY_FIXTURE, state: "missing", reasons: ["r"], goalies: [], sources: [] } })).toMatchObject({ state: "missing", data: null });
  });
  it("registers both posts as observed goalie posts", () => {
    for (const id of ["risky-starts", "start-sit"]) expect(shareModule(id)).toMatchObject({ group: "goalies", basis: "observed" });
  });
});
