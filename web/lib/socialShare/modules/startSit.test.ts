import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import StartSitCard from "components/SocialShare/modules/StartSitCard";
import { resolveDailyBoardEvidence, type BoardGoalieEvidence } from "lib/projections/dailyBoardEvidence";
import { parseShareSettings, sharePostExportToken } from "./contract";
import { shareModule } from "./registry";
import { FORECAST_ADMITTED_NOTE, startSitConflicting, startSitModule, startSitResult, startSitRows, upcomingInventory, type StartSitData, type StartSitSettings } from "./startSit";
import { FIXTURE_GENERATED_AT, FIXTURE_INPUT, GOALIE_INVENTORY_FIXTURE, GOALIE_INVENTORY_FIXTURE_DETAIL } from "./shared/goalieInventory.fixture";
import { buildGoalieInventory, CONFIRMATION_CLOSED_REASON, CONFIRMATION_LINK_GAP, CONFIRMATION_REPORTER_GAP, FORECAST_CLOSED_REASON } from "./shared/goalieInventory.sources";

vi.mock("lib/supabase/public-client", () => ({ default: {} }));
vi.mock("lib/supabase/server", () => ({ default: { from: () => { throw new Error("No database reads in card tests."); } } }));

const data = startSitResult(GOALIE_INVENTORY_FIXTURE_DETAIL).data as StartSitData;
const settings = (search: string): StartSitSettings => ({ days: 7, search });
const names = (search: string) => [...new Set(startSitRows(data, search).map(row => row.goalie.name))];


const reporters = (team: number, gameId: number, first: number, second: number): BoardGoalieEvidence[] => [first, second].map((player_id, index) => ({ id: `obs-${index}`, game_id: gameId, team_id: team, player_id, observation_status: "confirmed", accepted: true, source_key: "validated_events", source_account: `reporter${index}`, source_url: null, observed_at: `2026-11-02T10:0${index * 5}:00Z`, available_at: `2026-11-02T10:0${index * 5}:30Z`, created_at: `2026-11-02T10:0${index * 5}:40Z`, expires_at: null }));
const throughResolver = (goalies: BoardGoalieEvidence[], gaps: string[] = []) => buildGoalieInventory({ ...FIXTURE_INPUT, confirmations: { evidence: resolveDailyBoardEvidence({ cutoff: FIXTURE_GENERATED_AT, lineups: [], goalies, conflicts: [] }), expiresAt: new Map(), gaps } });
const card = (result: ReturnType<typeof startSitResult>, search = "") => renderToStaticMarkup(createElement(StartSitCard, { snapshot: { generatedAt: FIXTURE_GENERATED_AT } as never, data: result.data as StartSitData, settings: settings(search), logos: {} }));

describe("Start/Sit card, through the real resolver", () => {
  it("keeps a resolver conflict between distinct reporters conflicting on the card", () => {
    const detail = throughResolver(reporters(1, 900010, 7001, 7002));
    expect(detail.conflicts).toEqual([{ gameId: 900010, team: "NJD" }]);
    const html = card(startSitResult(detail), "new jersey");
    expect(html).toContain("Conflicting reports");
    expect(html).toContain('data-state="conflicting"');
    expect(html).not.toContain("Source: confirmed");
    // The frozen shape is still unknown, with the reason in its source.
    expect(detail.inventory.goalies.find(goalie => goalie.goalieId === 7001)!.games[0].confirmation.state).toBe("none");
    expect(detail.inventory.sources.find(source => source.name === "Goalie start observations")!.reasons.join(" ")).toMatch(/conflicting start reports/);
  });
  it("marks only that team's game, and shows a resolved claim with its source and age", () => {
    const detail = throughResolver([{ ...reporters(1, 900010, 7001, 7002)[0], source_account: null }]);
    const html = card(startSitResult(detail), "new jersey");
    expect(html).not.toContain("Conflicting reports");
    expect(html).toContain("Source: confirmed");
    expect(html).toContain("Validated reports · 5h ago");
    expect(html).toContain("Unknown");
  });
  it("prints the gap in reader-facing words", () => {
    const html = card(startSitResult(throughResolver([], [CONFIRMATION_REPORTER_GAP, CONFIRMATION_LINK_GAP])));
    expect(html).toContain("conflicts between sources can&#x27;t be detected");
    expect(html).toContain("No source link or expiry exists");
  });
});

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
    const closed = startSitResult(buildGoalieInventory({ ...FIXTURE_INPUT, confirmations: null, forecasts: null }));
    expect(closed.state).toBe("ready");
    expect(closed.data!.confirmationNote).toBe(CONFIRMATION_CLOSED_REASON);
    expect(closed.data!.forecastNote).toBe(FORECAST_CLOSED_REASON);
    expect(startSitRows(closed.data!, "").every(row => row.game.confirmation.state === "none" && row.game.forecast.state === "unavailable")).toBe(true);
    expect(startSitRows(closed.data!, "").length).toBeGreaterThan(0);
  });
  it("marks conflicting reports for that team game alone, with v1 still unknown", () => {
    const tor = startSitRows(data, "").find(item => item.key === "900012:7005")!, njd = startSitRows(data, "").find(item => item.key === "900012:7001")!;
    expect(startSitConflicting(data, tor.game)).toBe(true);
    expect(tor.game.confirmation.state).toBe("none");
    expect(startSitConflicting(data, njd.game)).toBe(false);
    expect(startSitModule.altText({ evidence: { sample: "s" } } as never, data, settings("tor"))).toContain("Conflicting reports");
  });
  it("does not call forecasts unavailable when admitted ones were read", () => {
    expect(data.forecastNote).toBe(FORECAST_ADMITTED_NOTE);
  });
  it("drops games already under way, and a goalie with none left", () => {
    const later = upcomingInventory({ ...GOALIE_INVENTORY_FIXTURE, generatedAt: "2026-11-05T00:00:00.000Z" });
    expect(later.goalies).toEqual([]);
  });
  it("is missing with no data when the inventory is", () => {
    expect(startSitResult({ coverage: null, conflicts: [], inventory: { ...GOALIE_INVENTORY_FIXTURE, state: "missing", reasons: ["r"], goalies: [], sources: [] } })).toMatchObject({ state: "missing", data: null });
  });
  it("registers both posts as observed goalie posts", () => {
    for (const id of ["risky-starts", "start-sit"]) expect(shareModule(id)).toMatchObject({ group: "goalies", basis: "observed" });
  });
});
