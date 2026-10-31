import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import StartSitCard from "components/SocialShare/modules/StartSitCard";
import { resolveDailyBoardEvidence, type BoardGoalieEvidence } from "lib/projections/dailyBoardEvidence";
import { parseShareSettings, sharePostExportToken } from "./contract";
import { shareModule } from "./registry";
import { FORECAST_ADMITTED_NOTE, START_SIT_LENS_NOTE, startSitConflicting, startSitModule, startSitResult, startSitRows, upcomingInventory, type StartSitData, type StartSitSettings } from "./startSit";
import { FIXTURE_GENERATED_AT, FIXTURE_INPUT, GOALIE_INVENTORY_FIXTURE, GOALIE_INVENTORY_FIXTURE_DETAIL } from "./shared/goalieInventory.fixture";
import { buildGoalieInventory, CONFIRMATION_CLOSED_REASON, CONFIRMATION_LINK_GAP, CONFIRMATION_REPORTER_GAP, CONFIRMATION_TONES, FORECAST_CLOSED_REASON, RANK_BANDS, rankBand } from "./shared/goalieInventory.sources";

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
    expect(html).toContain("Validated · 5h ago");
    expect(html).toContain("Unknown");
  });
  it("keeps the short labels on the card and moves the full notes to the evidence", () => {
    const result = startSitResult(throughResolver([], [CONFIRMATION_REPORTER_GAP, CONFIRMATION_LINK_GAP])), html = card(result);
    expect(html).toContain("Unknown = no report yet. Reports aren&#x27;t split by reporter.");
    expect(html).toContain("No win odds");
    expect(html).toContain("Forecast unavailable");
    expect(html).not.toContain("No source link or expiry exists");
    expect(html).not.toContain("correlated");
    for (const note of [CONFIRMATION_REPORTER_GAP, CONFIRMATION_LINK_GAP, START_SIT_LENS_NOTE, FORECAST_ADMITTED_NOTE]) expect(result.evidence.sample).toContain(note);
  });
  it("says no start odds only while no forecast is qualified, and caps the rows it shows", () => {
    const closed = startSitResult(buildGoalieInventory({ ...FIXTURE_INPUT, forecasts: null }));
    expect(card(closed)).toContain("No win or start odds");
    const goalie = closed.data!.inventory.goalies[0];
    const inventory = { ...closed.data!.inventory, goalies: [{ ...goalie, games: Array.from({ length: 25 }, (_, index) => ({ ...goalie.games[0], gameId: 800000 + index })) }] };
    const html = card({ ...closed, data: { ...closed.data!, inventory } });
    expect(html.match(/data-testid="start-sit-row"/g)).toHaveLength(18);
    expect(html).toContain("18 of 25");
  });
});

describe("Start/Sit colour", () => {
  const metric = (value: number | null, leagueRank: number | null, leagueCohort: number | null = 32) => ({ value, unit: "per game", window: "", sampleGames: 10, leagueRank, leagueCohort });
  const cell = (html: string, testid: string, state: string) => html.match(new RegExp(`<span[^>]*data-testid="${testid}"[^>]*data-state="${state}"[^>]*>`))?.[0];
  it("bands league ranks at the thirds, on one scale for every cohort", () => {
    expect([1, 11, 12, 21, 22, 32].map(rank => rankBand(metric(1, rank)))).toEqual(["top", "top", "middle", "middle", "bottom", "bottom"]);
    expect([1, 2, 3, 4].map(rank => rankBand(metric(1, rank, 4)))).toEqual(["top", "top", "bottom", "bottom"]);
    expect(rankBand(metric(null, null, null))).toBeNull();
    expect(rankBand(metric(3, null, 32))).toBeNull();
  });
  it("fills each lens number from its own rank and keeps every number", () => {
    const html = card(startSitResult(GOALIE_INVENTORY_FIXTURE_DETAIL));
    const row = startSitRows(data, "")[0], { volume, ratioExposure, winSupport } = row.game.signals;
    const chips = [...html.matchAll(/<span data-testid="rank-chip" data-band="(\w+)"([^>]*)>([^<]*)</g)].slice(0, 6);
    const metrics = [volume.opponentShotsForPerGame, volume.teamShotsAgainstPerGame, ratioExposure.opponentXgfPerGame, ratioExposure.teamXgaPerGame, winSupport.teamGoalsForPerGame, winSupport.opponentGoalsAgainstPerGame];
    chips.forEach((chip, index) => {
      const band = rankBand(metrics[index]);
      expect(chip[1]).toBe(band ?? "missing");
      if (band) expect(chip[2]).toContain(`background:${RANK_BANDS[band].fill}`);
      expect(chip[3]).toContain(metrics[index].value!.toFixed(index < 2 ? 1 : 2));
      expect(chip[3]).toContain(`#${metrics[index].leagueRank}`);
    });
    expect(chips).toHaveLength(6);
  });
  it("leaves a metric with no rank unfilled, never the bottom colour", () => {
    const html = card(startSitResult(buildGoalieInventory({ ...FIXTURE_INPUT, nst: FIXTURE_INPUT.nst.filter(row => row.team_abbreviation !== "TOR") })));
    const missing = html.match(/<span data-testid="rank-chip" data-band="missing"[^>]*>/)![0];
    expect(missing).not.toContain("style=");
  });
  it("keeps unknown neutral, conflicting distinct and an unavailable forecast plain", () => {
    const html = card(startSitResult(GOALIE_INVENTORY_FIXTURE_DETAIL));
    expect(cell(html, "start-sit-confirmation", "none")).not.toContain("style=");
    expect(cell(html, "start-sit-confirmation", "conflicting")).toContain(`background:${CONFIRMATION_TONES.conflicting.fill}`);
    expect(cell(html, "start-sit-confirmation", "conflicting")).toContain("dashed");
    expect(cell(html, "start-sit-confirmation", "confirmed")).toContain(`background:${CONFIRMATION_TONES.confirmed.fill}`);
    expect(cell(html, "start-sit-confirmation", "projected")).toContain(`background:${CONFIRMATION_TONES.projected.fill}`);
    expect(cell(html, "start-sit-forecast", "unavailable")).not.toContain("style=");
    const fills = [...Object.values(CONFIRMATION_TONES).map(tone => tone.fill), ...Object.values(RANK_BANDS).map(band => band.fill)];
    expect(new Set(fills).size).toBe(fills.length);
  });
  it("adds nothing across lenses and gives no odds", () => {
    const html = card(startSitResult(buildGoalieInventory({ ...FIXTURE_INPUT, forecasts: null })));
    expect(html).toContain("No win or start odds");
    expect(html).not.toMatch(/score|composite|total/i);
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
    expect(closed.evidence.sample).toContain(CONFIRMATION_CLOSED_REASON);
    expect(closed.evidence.sample).toContain(FORECAST_CLOSED_REASON);
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
    expect(startSitResult(GOALIE_INVENTORY_FIXTURE_DETAIL).evidence.sample).toContain(FORECAST_ADMITTED_NOTE);
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
