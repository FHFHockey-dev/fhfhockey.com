import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import StartSitCard from "components/SocialShare/modules/StartSitCard";
import { resolveDailyBoardEvidence, type BoardGoalieEvidence } from "lib/projections/dailyBoardEvidence";
import { parseShareSettings, sharePostExportBlock, sharePostExportToken } from "./contract";
import { shareModule } from "./registry";
import { loadPostSnapshot } from "./server";
import { FORECAST_ADMITTED_NOTE, START_SIT_LENS_NOTE, START_SIT_STATUS_NOTE, startSitConflicting, startSitModule, startSitResult, startSitRows, upcomingInventory, type StartSitData, type StartSitSettings } from "./startSit";
import { FIXTURE_GENERATED_AT, FIXTURE_INPUT, GOALIE_INVENTORY_FIXTURE, GOALIE_INVENTORY_FIXTURE_DETAIL } from "./shared/goalieInventory.fixture";
import { buildGoalieInventory, CONFIRMATION_CLOSED_REASON, CONFIRMATION_LINK_GAP, CONFIRMATION_REPORTER_GAP, CONFIRMATION_TONES, FORECAST_CLOSED_REASON, headToHeadWinner, HEAD_TO_HEAD_COLORS } from "./shared/goalieInventory.sources";

vi.mock("lib/supabase/public-client", () => ({ default: {} }));
vi.mock("lib/supabase/server", () => ({ default: { from: () => { throw new Error("No database reads in card tests."); } } }));

const data = startSitResult(GOALIE_INVENTORY_FIXTURE_DETAIL).data as StartSitData;
const settings = (search: string): StartSitSettings => ({ days: 7, period: "days", week: null, start: null, end: null, search });
const POST = "start-sit";
/** Answers the calendar; every other table fails, so a test can see which dates were asked for without a real read. */
const periodClient = (rows: readonly object[] | null = WEEKS) => {
  const tables: string[] = [], filters: [string, string, unknown][] = [];
  return { tables, filters, from: (table: string) => {
    tables.push(table);
    const chain: Record<string, unknown> = {};
    for (const method of ["select", "order", "range", "in", "gte"]) chain[method] = () => chain;
    chain.eq = chain.lte = (column: string, value: unknown) => { filters.push([table, column, value]); return chain; };
    chain.then = (resolve: (value: object) => void) => resolve(table === "yahoo_matchup_weeks" && rows ? { data: rows, error: null, count: rows.length } : { data: null, error: new Error("not read"), count: null });
    return chain;
  } };
};
const WEEKS = [{ week: 1, start_date: "2026-10-05", end_date: "2026-10-11" }, { week: 2, start_date: "2026-10-12", end_date: "2026-10-18" }, { week: 3, start_date: "2026-10-19", end_date: "2026-10-25" }, { week: 4, start_date: "2026-10-26", end_date: "2026-11-01" }, { week: 5, start_date: "2026-11-02", end_date: "2026-11-08" }, { week: 6, start_date: "2026-11-09", end_date: "2026-11-22" }];
const periodEdition = (query: Record<string, string>, table = periodClient(), at = FIXTURE_GENERATED_AT) => loadPostSnapshot(POST, query, table as never, () => new Date(at));

const periodCard = (cardData: unknown) => renderToStaticMarkup(createElement(StartSitCard, { snapshot: { generatedAt: FIXTURE_GENERATED_AT } as never, data: cardData as StartSitData, settings: settings(""), logos: {} }));
const names = (search: string) => [...new Set(startSitRows(data, search).map(row => row.goalie.name))];


const reporters = (team: number, gameId: number, first: number, second: number): BoardGoalieEvidence[] => [first, second].map((player_id, index) => ({ id: `obs-${index}`, game_id: gameId, team_id: team, player_id, observation_status: "confirmed", accepted: true, source_key: "validated_events", source_account: `reporter${index}`, source_url: null, observed_at: `2026-11-02T10:0${index * 5}:00Z`, available_at: `2026-11-02T10:0${index * 5}:30Z`, created_at: `2026-11-02T10:0${index * 5}:40Z`, expires_at: null }));
const throughResolver = (goalies: BoardGoalieEvidence[], gaps: string[] = []) => buildGoalieInventory({ ...FIXTURE_INPUT, confirmations: { evidence: resolveDailyBoardEvidence({ cutoff: FIXTURE_GENERATED_AT, lineups: [], goalies, conflicts: [] }), expiresAt: new Map(), gaps } });
const card = (result: ReturnType<typeof startSitResult>, search = "") => renderToStaticMarkup(createElement(StartSitCard, { snapshot: { generatedAt: FIXTURE_GENERATED_AT } as never, data: result.data as StartSitData, settings: settings(search), logos: {} }));

describe("Start/Sit card, through the real resolver", () => {
  it("keeps a resolver conflict between distinct reporters conflicting on the card", () => {
    const detail = throughResolver(reporters(1, 900010, 7001, 7002));
    expect(detail.conflicts).toEqual([{ gameId: 900010, team: "NJD" }]);
    const html = card(startSitResult(detail), "new jersey");
    expect(html).toContain(">Conflicting<");
    expect(html).toContain('data-state="conflicting"');
    expect(html).not.toContain(">Confirmed");
    // The frozen shape is still unknown, with the reason in its source.
    expect(detail.inventory.goalies.find(goalie => goalie.goalieId === 7001)!.games[0].confirmation.state).toBe("none");
    expect(detail.inventory.sources.find(source => source.name === "Goalie start observations")!.reasons.join(" ")).toMatch(/conflicting start reports/);
  });
  it("marks only that team's game, and shows a resolved claim with its source and age", () => {
    const detail = throughResolver([{ ...reporters(1, 900010, 7001, 7002)[0], source_account: null }]);
    const html = card(startSitResult(detail), "new jersey");
    expect(html).not.toContain(">Conflicting<");
    expect(html).toContain(">Confirmed<");
    expect(html).toContain("Validated · 5h ago");
    expect(html).toContain("Unknown");
  });
  it("keeps the short labels on the card and moves the full notes to the evidence", () => {
    const result = startSitResult(throughResolver([], [CONFIRMATION_REPORTER_GAP, CONFIRMATION_LINK_GAP])), html = card(result);
    expect(html).toContain("Unknown = no report yet. Reports aren&#x27;t split by reporter.");
    expect(html).toContain("No win odds");
    expect(html).not.toContain("Forecast unavailable");
    expect(html).not.toContain("No source link or expiry exists");
    expect(html).not.toContain("correlated");
    for (const note of [CONFIRMATION_REPORTER_GAP, CONFIRMATION_LINK_GAP, START_SIT_LENS_NOTE, FORECAST_ADMITTED_NOTE, START_SIT_STATUS_NOTE]) expect(result.evidence.sample).toContain(note);
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
  const withSignals = (edit: (signals: StartSitData["inventory"]["goalies"][number]["games"][number]["signals"]) => object, logos: Record<string, string> = {}, ranks?: StartSitData["lowFirstRanks"]) => {
    const result = startSitResult(GOALIE_INVENTORY_FIXTURE_DETAIL), row = startSitRows(result.data as StartSitData, "")[0];
    const signals = { ...row.game.signals, ...edit(row.game.signals) }, goalie = { ...row.goalie, games: [{ ...row.game, signals }] };
    // These edits have no ties, so reversing a rank gives the low-first one. Fixture row: NJD at NYR.
    const reversed = ({ leagueRank, leagueCohort }: { leagueRank: number | null; leagueCohort: number | null }) => leagueRank === null || leagueCohort === null ? 0 : leagueCohort - leagueRank + 1;
    const lowFirstRanks = ranks ?? { xga: { NJD: reversed(signals.ratioExposure.teamXgaPerGame) }, shotsAgainst: { NJD: reversed(signals.volume.teamShotsAgainstPerGame) }, goalsAgainst: { NYR: reversed(signals.winSupport.opponentGoalsAgainstPerGame) } };
    return renderToStaticMarkup(createElement(StartSitCard, { snapshot: { generatedAt: FIXTURE_GENERATED_AT } as never, data: { ...(result.data as StartSitData), lowFirstRanks, inventory: { ...(result.data as StartSitData).inventory, goalies: [goalie] } }, settings: settings(""), logos }));
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
    expect(headToHeadWinner({ metricId: "xga", metric: metric(3.4, 5), lowFirstRank: 28 }, { metricId: "xgf", metric: metric(3.1, 10), lowFirstRank: null })).toBe(1);
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
  it("leaves a tie for the fewest allowed against the top attack plain, whatever its high-first rank", () => {
    const cell = lensCell(withSignals(lensEdits.quality(metric(2.1, 31), metric(3.4, 1)) as never, {}, { xga: { NJD: 1 } }), "quality"), [first, second] = chips(cell);
    expect([first.result, second.result]).toEqual(["neutral", "neutral"]);
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
  it("merges status and forecast into one column under one header", () => {
    const html = card(startSitResult(GOALIE_INVENTORY_FIXTURE_DETAIL));
    expect(html).toContain("STATUS");
    expect(html).toContain("SOURCE · FORECAST");
    expect(html).not.toContain("SOURCE STATUS");
    expect(html).not.toContain(">FORECAST<");
    const statuses = [...html.matchAll(/data-testid="start-sit-confirmation" data-state="(\w+)"[^>]*>(.*?)<\/span>/g)].map(match => [match[1], match[2].replace(/<[^>]*>/g, "|")]);
    const of = (state: string) => statuses.filter(item => item[0] === state).map(item => item[1]);
    expect(of("confirmed")[0]).toMatch(/^Confirmed\|Validated · \d+[mhd] ago\|$/);
    expect(of("projected")[0]).toMatch(/^Projected\|Validated · /);
    expect(of("conflicting")).toContain("Conflicting");
    expect(of("none")).toContain("Unknown");
    expect(of("none")).toContain("Unknown|Cond. forecast 62%|");
  });
  it("prints no forecast line when none qualifies, the full wording staying in the alt text and evidence", () => {
    const closed = startSitResult(buildGoalieInventory({ ...FIXTURE_INPUT, forecasts: null })), html = card(closed);
    expect(html).not.toContain("start-sit-forecast");
    expect(html).not.toContain("Forecast unavailable");
    expect(closed.evidence.sample).toContain(FORECAST_CLOSED_REASON);
    expect(closed.evidence.sample).toContain(START_SIT_STATUS_NOTE);
    const alt = startSitModule.altText({ evidence: { sample: "s" } } as never, closed.data as StartSitData, settings(""));
    expect(alt).toContain("Forecast unavailable");
    expect(alt).toContain("Source: confirmed");
  });
  it("never adds blue chips or band fills", () => {
    expect(card(startSitResult(GOALIE_INVENTORY_FIXTURE_DETAIL))).not.toContain("#3f9bdc");
  });
  it("keeps unknown neutral, conflicting distinct and an unavailable forecast plain", () => {
    const html = card(startSitResult(GOALIE_INVENTORY_FIXTURE_DETAIL));
    expect(cell(html, "start-sit-confirmation", "none")).not.toContain("style=");
    expect(cell(html, "start-sit-confirmation", "conflicting")).toContain(`background:${CONFIRMATION_TONES.conflicting.fill}`);
    expect(cell(html, "start-sit-confirmation", "conflicting")).toContain("dashed");
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
    expect(parseShareSettings(startSitModule, { search: "eric" }, "all")).toEqual({ days: 7, period: "days", week: null, start: null, end: null, search: "eric" });
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
    expect(startSitResult({ coverage: null, conflicts: [], lowFirstRanks: {}, inventory: { ...GOALIE_INVENTORY_FIXTURE, state: "missing", reasons: ["r"], goalies: [], sources: [] } })).toMatchObject({ state: "missing", data: null });
  });
  describe("edition expiry", () => {
    const edition = async (generatedAt: string, schedule = FIXTURE_INPUT.schedule) => {
      vi.spyOn(shareModule("start-sit")!, "load").mockResolvedValue((async () => startSitResult(buildGoalieInventory({ ...FIXTURE_INPUT, schedule, request: { ...FIXTURE_INPUT.request, generatedAt } }))) as never);
      return loadPostSnapshot("start-sit", {}, {} as never, () => new Date(generatedAt));
    };
    const block = (snapshot: Awaited<ReturnType<typeof edition>>, now: string) => sharePostExportBlock(shareModule("start-sit")!, snapshot, snapshot.settings, Date.parse(now));
    it("expires at the earliest puck drop, and blocks export from then on", async () => {
      const snapshot = await edition("2026-11-02T22:59:00.000Z");
      expect(snapshot.expiresAt).toBe("2026-11-02T23:00:00.000Z");
      expect(block(snapshot, "2026-11-02T22:59:30.000Z")).toBeNull();
      expect(block(snapshot, "2026-11-02T23:00:00.000Z")).toMatch(/expired/);
      expect(block(snapshot, "2026-11-02T23:01:00.000Z")).toMatch(/expired/);
    });
    it("keeps the default with a later puck drop or no start time", async () => {
      expect((await edition(FIXTURE_GENERATED_AT)).expiresAt).toBe("2026-11-02T15:15:00.000Z");
      expect((await edition("2026-11-02T22:59:00.000Z", FIXTURE_INPUT.schedule.map(game => ({ ...game, startTime: null })))).expiresAt).toBe("2026-11-02T23:14:00.000Z");
    });
  });
  it("registers both posts as observed goalie posts", () => {
    for (const id of ["risky-starts", "start-sit"]) expect(shareModule(id)).toMatchObject({ group: "goalies", basis: "observed" });
  });
});

describe("period control", () => {
  beforeEach(() => vi.restoreAllMocks());
  it("leaves the default URL as it was: seven days ahead with no calendar read", async () => {
    expect(parseShareSettings(shareModule(POST)!, {})).toMatchObject({ days: 7, period: "days", week: null, start: null, end: null });
    const table = periodClient(), snapshot = await periodEdition({}, table);
    expect(table.tables).not.toContain("yahoo_matchup_weeks");
    expect(snapshot.settings).toMatchObject({ days: 7, period: "days" });
    expect(table.filters).toContainEqual(["games", "date", "2026-11-08"]);
  });
  it("reads a chosen matchup week's own dates", async () => {
    const table = periodClient();
    await periodEdition({ period: "matchup", week: "5" }, table);
    expect(table.tables[0]).toBe("yahoo_matchup_weeks");
    expect(table.filters).toContainEqual(["games", "date", "2026-11-08"]);
  });
  it("reads the whole of a 14-day week", async () => {
    const table = periodClient();
    await periodEdition({ period: "matchup", week: "6" }, table);
    expect(table.filters).toContainEqual(["games", "date", "2026-11-22"]);
  });
  it("shows a past matchup as no upcoming games, with no game reads and no export", async () => {
    const table = periodClient(), snapshot = await periodEdition({ period: "matchup", week: "3" }, table);
    expect(table.tables).toEqual(["yahoo_matchup_weeks"]);
    expect(snapshot).toMatchObject({ state: "ready", teams: [] });
    expect(snapshot.evidence.sources.map(source => source.name)).toEqual(["Yahoo matchup weeks"]);
    expect(sharePostExportBlock(shareModule(POST)!, snapshot, snapshot.settings, Date.parse(FIXTURE_GENERATED_AT))).toBe("Nothing qualifies with these settings.");
    expect(periodCard(snapshot.data)).toContain("No upcoming games in this period: Week 3 · Oct 19 to Oct 25");
  });
  it("is missing, with the reason, for a week off the calendar or an unreadable calendar", async () => {
    expect(await periodEdition({ period: "matchup", week: "9" })).toMatchObject({ state: "missing", data: null, reasons: ["Week 9 is not on the matchup calendar."] });
    expect(await periodEdition({ period: "matchup" }, periodClient(null))).toMatchObject({ state: "missing", data: null, reasons: ["Matchup weeks could not be read."] });
  });
  it("refuses a bad custom range before any read", () => {
    const parse = (query: Record<string, string>) => parseShareSettings(shareModule(POST)!, query, "server");
    expect(() => parse({ period: "custom" })).toThrow("A custom range needs a start date and an end date.");
    expect(() => parse({ period: "custom", start: "2026-11-05", end: "2026-11-03" })).toThrow("The start date must be before the end date.");
    expect(() => parse({ period: "custom", start: "2026-11-02", end: "2026-12-03" })).toThrow("at most 31 days");
    expect(parse({ period: "custom", start: "2026-11-02", end: "2026-12-02" })).toMatchObject({ start: "2026-11-02", end: "2026-12-02" });
  });
  it("refuses a custom range outside the season, and reads a good one", async () => {
    expect(await periodEdition({ period: "custom", start: "2027-05-01", end: "2027-05-03" })).toMatchObject({ state: "missing", reasons: [expect.stringContaining("inside the season")] });
    const table = periodClient();
    await periodEdition({ period: "custom", start: "2026-11-03", end: "2026-11-06" }, table);
    expect(table.filters).toContainEqual(["games", "date", "2026-11-06"]);
  });
});

describe("the period on the card", () => {
  const period = { label: "Week 4 · Oct 26 to Nov 8", from: "2026-10-26", through: "2026-11-08", listedFrom: "2026-11-02", elapsed: false, usedCalendar: true, season: 20262027 };
  it("prints the dates, names a part-played week and lists the calendar as a source", () => {
    const result = startSitResult(GOALIE_INVENTORY_FIXTURE_DETAIL, period);
    expect(card(result)).toContain("Week 4 · Oct 26 to Nov 8 · games still to start");
    expect(result.evidence.sources.map(source => source.name)).toContain("Yahoo matchup weeks");
    expect(card(startSitResult(GOALIE_INVENTORY_FIXTURE_DETAIL))).toContain('data-testid="start-sit-period">Nov 2 to Nov 4<');
  });
  it("says no upcoming games when the last game of a period has started, and not a search miss", () => {
    const empty = startSitResult({ ...GOALIE_INVENTORY_FIXTURE_DETAIL, inventory: { ...GOALIE_INVENTORY_FIXTURE, generatedAt: "2026-11-30T00:00:00.000Z" } }, period);
    expect(card(empty)).toContain("No upcoming games in this period");
    expect(card(empty, "eric")).toContain("No upcoming games in this period");
    expect(startSitModule.hasRows(empty.data!, settings(""))).toBe(false);
  });
  it("keeps expiring at puck drop on a chosen period", () => {
    const generatedAt = "2026-11-02T22:59:00.000Z";
    expect(startSitResult(buildGoalieInventory({ ...FIXTURE_INPUT, request: { ...FIXTURE_INPUT.request, generatedAt } }), period).ttlSeconds).toBe(60);
  });
});
