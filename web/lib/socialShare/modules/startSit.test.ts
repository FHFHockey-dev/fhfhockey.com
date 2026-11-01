import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import StartSitCard from "components/SocialShare/modules/StartSitCard";
import { resolveDailyBoardEvidence, type BoardGoalieEvidence } from "lib/projections/dailyBoardEvidence";
import { parseShareSettings, sharePostExportToken } from "./contract";
import { shareModule } from "./registry";
import { FORECAST_ADMITTED_NOTE, START_SIT_LENS_NOTE, startSitConflicting, startSitModule, startSitResult, startSitRows, upcomingInventory, type StartSitData, type StartSitSettings } from "./startSit";
import { FIXTURE_GENERATED_AT, FIXTURE_INPUT, GOALIE_INVENTORY_FIXTURE, GOALIE_INVENTORY_FIXTURE_DETAIL } from "./shared/goalieInventory.fixture";
import { buildGoalieInventory, CONFIRMATION_CLOSED_REASON, CONFIRMATION_LINK_GAP, CONFIRMATION_REPORTER_GAP, CONFIRMATION_TONES, FORECAST_CLOSED_REASON, headToHeadWinner, HEAD_TO_HEAD_COLORS } from "./shared/goalieInventory.sources";

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
  const cell = (html: string, testid: string, state: string) => html.match(new RegExp(`<span[^>]*data-testid="${testid}"[^>]*data-state="${state}"[^>]*>`))?.[0];
  const withSignals = (edit: (signals: StartSitData["inventory"]["goalies"][number]["games"][number]["signals"]) => object, logos: Record<string, string> = {}) => {
    const result = startSitResult(GOALIE_INVENTORY_FIXTURE_DETAIL), row = startSitRows(result.data as StartSitData, "")[0];
    const goalie = { ...row.goalie, games: [{ ...row.game, signals: { ...row.game.signals, ...edit(row.game.signals) } }] };
    return renderToStaticMarkup(createElement(StartSitCard, { snapshot: { generatedAt: FIXTURE_GENERATED_AT } as never, data: { ...(result.data as StartSitData), inventory: { ...(result.data as StartSitData).inventory, goalies: [goalie] } }, settings: settings(""), logos }));
  };
  const metric = (value: number | null, leagueRank: number | null, leagueCohort: number | null = 32) => ({ value, unit: "per game", window: "", sampleGames: 10, leagueRank, leagueCohort });
  type Metric = ReturnType<typeof metric>;
  // In each lens the first metric is the goalie's team and the second the opponent's.
  const lensEdits = {
    quality: (team: Metric, opponent: Metric) => (signals: never) => ({ ratioExposure: { ...(signals as { ratioExposure: object }).ratioExposure, teamXgaPerGame: team, opponentXgfPerGame: opponent } }),
    quantity: (team: Metric, opponent: Metric) => (signals: never) => ({ volume: { ...(signals as { volume: object }).volume, teamShotsAgainstPerGame: team, opponentShotsForPerGame: opponent } }),
    win: (team: Metric, opponent: Metric) => (signals: never) => ({ winSupport: { ...(signals as { winSupport: object }).winSupport, teamGoalsForPerGame: team, opponentGoalsAgainstPerGame: opponent } }),
  };
  const lensCell = (html: string, lens: string) => html.match(new RegExp(`data-testid="lens-cell" data-lens="${lens}".*?(?=data-testid="lens-cell"|$)`))![0];
  const chips = (cell: string) => [...cell.matchAll(/<span data-testid="lens-chip" data-result="(\w+)"([^>]*)>([^<]*)</g)].map(match => ({ result: match[1], attrs: match[2], text: match[3] }));
  // Fixture row: NJD's goalie at NYR.
  it.each([
    // The fewest allowed is the strongest defence, against a weak attack: the goalie's team wins.
    ["quality", metric(2.1, 32), metric(2.5, 20), "left", "winner", "loser", "NJD"],
    // The 5th-most allowed is the 28th-strongest defence, against the 10th attack: the opponent wins.
    ["quality", metric(3.4, 5), metric(3.1, 10), "right", "loser", "winner", "NYR"],
    ["quantity", metric(24.1, 32), metric(27.5, 20), "left", "winner", "loser", "NJD"],
    ["quantity", metric(33.4, 5), metric(33.1, 10), "right", "loser", "winner", "NYR"],
    // A strong attack against a leaky defence: the goalie's team wins. Against the fewest allowed, the opponent does.
    ["win", metric(3.6, 3), metric(3.5, 5), "left", "winner", "loser", "NJD"],
    ["win", metric(3.6, 3), metric(2.1, 32), "right", "loser", "winner", "NYR"],
  ] as const)("%s: team %#, colours and triangle follow the winner, with the team left", (lens, team, opponent, points, left, right, winner) => {
    const html = withSignals(lensEdits[lens](team, opponent) as never), cell = lensCell(html, lens), [first, second] = chips(cell);
    const digits = lens === "quantity" ? 1 : 2;
    expect(first.text).toBe(`${team.value!.toFixed(digits)} #${team.leagueRank}`);
    expect(second.text).toBe(`${opponent.value!.toFixed(digits)} #${opponent.leagueRank}`);
    expect([first.result, second.result]).toEqual([left, right]);
    expect(first.attrs).toContain(`background:${HEAD_TO_HEAD_COLORS[left]}`);
    expect(second.attrs).toContain(`background:${HEAD_TO_HEAD_COLORS[right]}`);
    expect(cell).toContain(`data-points="${points}"`);
    expect(cell.match(/data-winner="(\w+)"/)![1]).toBe(winner);
    expect(cell.indexOf("NJD")).toBeLessThan(cell.lastIndexOf("NYR"));
  });
  it("agrees with the shared rule", () => {
    expect(headToHeadWinner({ metricId: "xga", metric: metric(3.4, 5) }, { metricId: "xgf", metric: metric(3.1, 10) })).toBe(1);
  });
  it("runs the columns Quality, Quantity, Win, with the headers in the same order as the chips", () => {
    const html = card(startSitResult(GOALIE_INVENTORY_FIXTURE_DETAIL));
    const heads = ["QUALITY", "xGA / OPP xGF", "QUANTITY", "SA / OPP SF", "WIN", "GF / OPP GA"].map(text => html.indexOf(text));
    expect(heads).toEqual([...heads].sort((a, b) => a - b));
    expect(heads).not.toContain(-1);
    expect([...html.matchAll(/data-lens="(\w+)"/g)].slice(0, 3).map(match => match[1])).toEqual(["quality", "quantity", "win"]);
    expect(html).not.toMatch(/VOLUME|RATIO|OPP SF \/ SA|OPP xGF \/ xGA/);
    const result = startSitResult(GOALIE_INVENTORY_FIXTURE_DETAIL);
    expect(result.evidence.sample).toContain("Quality, quantity and win");
    expect(result.evidence.sample).not.toMatch(/Volume|ratio and/);
    expect(startSitModule.altText({ evidence: { sample: "s" } } as never, data, settings(""))).toContain("Quality, quantity and win");
  });
  it("prints the game as two logos with no opponent text", () => {
    const logos = { NJD: "/njd.svg", NYR: "/nyr.svg", MTL: "/mtl.svg", TOR: "/tor.svg" };
    const away = withSignals(() => ({}), logos).match(/data-testid="start-sit-game">(.*?)<\/span>/)![1];
    expect(away).toMatch(/<img src="\/njd\.svg"[^>]*>@<img src="\/nyr\.svg"[^>]*>/);
    expect(away.replace(/<[^>]*>/g, "")).toBe("@");
    const home = renderToStaticMarkup(createElement(StartSitCard, { snapshot: { generatedAt: FIXTURE_GENERATED_AT } as never, data, settings: settings("søgaard"), logos })).match(/data-testid="start-sit-game">(.*?)<\/span>/)![1];
    expect(home).toMatch(/<img src="\/nyr\.svg"[^>]*>vs<img src="\/njd\.svg"[^>]*>/);
  });
  it("leaves a tie plain, with no triangle", () => {
    const cell = lensCell(withSignals(lensEdits.quantity(metric(30, 25), metric(33, 8)) as never), "quantity"), [first, second] = chips(cell);
    expect([first.result, second.result]).toEqual(["neutral", "neutral"]);
    expect(first.attrs).not.toContain("style=");
    expect(second.attrs).not.toContain("style=");
    expect(cell).not.toContain("lens-edge");
  });
  it("leaves a missing metric dashed and plain, its partner plain too", () => {
    const cell = lensCell(withSignals(lensEdits.quality(metric(3, 5), metric(null, null, null)) as never), "quality"), [first, second] = chips(cell);
    expect([first.result, second.result]).toEqual(["neutral", "missing"]);
    expect(second.attrs).not.toContain("style=");
    expect(second.text).toBe("—");
    expect(first.text).toBe("3.00 #5");
    expect(cell).not.toContain("lens-edge");
  });
  it("never adds blue chips or band fills", () => {
    expect(card(startSitResult(GOALIE_INVENTORY_FIXTURE_DETAIL))).not.toContain("#3f9bdc");
  });
  it("keeps unknown neutral, conflicting distinct and an unavailable forecast plain", () => {
    const html = card(startSitResult(GOALIE_INVENTORY_FIXTURE_DETAIL));
    expect(cell(html, "start-sit-confirmation", "none")).not.toContain("style=");
    expect(cell(html, "start-sit-confirmation", "conflicting")).toContain(`background:${CONFIRMATION_TONES.conflicting.fill}`);
    expect(cell(html, "start-sit-confirmation", "conflicting")).toContain("dashed");
    expect(cell(html, "start-sit-forecast", "unavailable")).not.toContain("style=");
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
