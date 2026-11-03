// @vitest-environment node
import { teamsInfo } from "lib/teamsInfo";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import RiskyStartsCard from "components/SocialShare/modules/RiskyStartsCard";
import { postEvidenceLine } from "components/SocialShare/PostStudio";
import { resolveDailyBoardEvidence, type BoardGoalieEvidence } from "lib/projections/dailyBoardEvidence";
import { sharePostExportBlock, sharePostExportToken, parseShareSettings } from "./contract";
import { shareModule } from "./registry";
import { loadPostSnapshot } from "./server";
import { compactRiskyEvidence, goalieRoles, likelyStarter, ordinalRank, RISKY_READING_NOTE, ROLE_CARD_BACKGROUND, ROLE_COLORS, ROLE_PICK_NOTE, sourceHandle, RISKY_CORRELATION_NOTE, type GoalieRole, type RiskyGoalie, riskyFlags, riskyGameSides, riskyPairs, riskyRows, riskyRowsForLens, riskyStartsModule, riskyStartsResult, type RiskyPair, type RiskyRow, type RiskySide, type RiskyStartsData, type RiskyStartsSettings } from "./riskyStarts";
import { loadOpponentRecords, loadRiskyMarketLines, MARKET_LINES_NOTE, NHL_FAILED_NOTE, NHL_PARTNER_URL, partnerLine, storedLine, STORED_FAILED_NOTE, type PartnerFeed, type StoredLineRow } from "./riskyStarts.sources";
import { gameSignals, buildTeamLenses, buildGoalieInventory, CONFIRMATION_LINK_GAP, CONFIRMATION_REPORTER_GAP, rankBand, strengthShare } from "./shared/goalieInventory.sources";
import { FIXTURE_GENERATED_AT, FIXTURE_INPUT, FIXTURE_TEAMS, GOALIE_INVENTORY_FIXTURE, GOALIE_INVENTORY_FIXTURE_DETAIL } from "./shared/goalieInventory.fixture";

vi.mock("lib/supabase/public-client", () => ({ default: {} }));
vi.mock("lib/supabase/server", () => ({ default: { from: () => { throw new Error("No database reads in card tests."); } } }));

const { lenses, lowFirstRanks } = buildTeamLenses({ teamGames: FIXTURE_INPUT.teamGames, nst: FIXTURE_INPUT.nst, teams: FIXTURE_TEAMS, season: 20262027, cutoff: "2026-11-01" });
const data = riskyStartsResult(GOALIE_INVENTORY_FIXTURE_DETAIL).data as RiskyStartsData;
const settings = (lens: RiskyStartsSettings["lens"]): RiskyStartsSettings => ({ days: 7, period: "days", week: null, start: null, end: null, lens });
const POST = "risky-starts";
const periodCard = (cardData: unknown) => renderToStaticMarkup(createElement(RiskyStartsCard, { snapshot: { generatedAt: FIXTURE_GENERATED_AT } as never, data: cardData as RiskyStartsData, settings: settings("ratio"), logos: {} }));
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



const reporters = (team: number, gameId: number, first: number, second: number): BoardGoalieEvidence[] => [first, second].map((player_id, index) => ({ id: `obs-${index}`, game_id: gameId, team_id: team, player_id, observation_status: "confirmed", accepted: true, source_key: "validated_events", source_account: `reporter${index}`, source_url: null, observed_at: `2026-11-02T10:0${index * 5}:00Z`, available_at: `2026-11-02T10:0${index * 5}:30Z`, created_at: `2026-11-02T10:0${index * 5}:40Z`, expires_at: null }));
const throughResolver = (goalies: BoardGoalieEvidence[], gaps: string[] = []) => buildGoalieInventory({ ...FIXTURE_INPUT, confirmations: { evidence: resolveDailyBoardEvidence({ cutoff: FIXTURE_GENERATED_AT, lineups: [], goalies, conflicts: [] }), expiresAt: new Map(), gaps } });
const card = (result: ReturnType<typeof riskyStartsResult>, lens: RiskyStartsSettings["lens"]) => renderToStaticMarkup(createElement(RiskyStartsCard, { snapshot: { generatedAt: FIXTURE_GENERATED_AT } as never, data: result.data as RiskyStartsData, settings: settings(lens), logos: {} }));

describe("Risky Starts card, through the real resolver", () => {
  it("keeps a resolver conflict between distinct reporters conflicting on the card", () => {
    // NYR's night against NJD is flagged under volume. A second goalie id makes the reporters disagree.
    const detail = throughResolver(reporters(3, 900010, 7003, 7999));
    expect(detail.conflicts).toEqual([{ gameId: 900010, team: "NYR" }]);
    const html = card(riskyStartsResult(detail), "volume");
    expect(html).toContain('data-team="NYR"');
    expect(html).toContain("Conflicting reports");
    expect(html).not.toContain("Source: confirmed");
  });
  it("keeps reading notes, gaps and the pick rule off the card and in the evidence", () => {
    const result = riskyStartsResult(throughResolver([], [CONFIRMATION_REPORTER_GAP, CONFIRMATION_LINK_GAP])), html = card(result, "volume");
    for (const text of ["Unknown", "No win or start odds", "Longer bar", "1ST = highest", "market lines", "ago"]) expect(html).not.toContain(text);
    expect(result.evidence.sample).toContain(ROLE_PICK_NOTE);
    expect(result.evidence.sample).toContain(RISKY_READING_NOTE);
    expect(html).not.toContain("correlated");
    expect(html).not.toContain("No source link or expiry exists");
    expect(result.evidence.sample).toContain(CONFIRMATION_REPORTER_GAP);
    expect(result.evidence.sample).toContain(CONFIRMATION_LINK_GAP);
    expect(result.evidence.cohort).toContain(RISKY_CORRELATION_NOTE);
  });
  it("shows up to eight tiles", () => {
    const row = data.rows.find(item => item.lenses.volume[0].flagged)!;
    const many = Array.from({ length: 11 }, (_, index) => ({ ...row, gameId: 800000 + index }));
    const html = card({ ...riskyStartsResult(GOALIE_INVENTORY_FIXTURE_DETAIL), data: { ...data, rows: many } }, "volume");
    expect(html.match(/data-testid="risky-row"/g)).toHaveLength(8);
  });
});

describe("Risky Starts head-to-head tiles", () => {
  const metric = (value: number | null, leagueRank: number | null, leagueCohort: number | null = 32) => ({ value, unit: "per game", window: "", sampleGames: 10, leagueRank, leagueCohort });
  const side = (team: string, label: string, metricId: RiskySide["metricId"], value: ReturnType<typeof metric>): RiskySide => ({ team, label, metricId, metric: value, lowFirstRank: value.leagueRank === null || value.leagueCohort === null ? null : value.leagueCohort - value.leagueRank + 1, digits: 2 });
  // Game 900010: NYR at home, NJD away.
  const njdRow = data.rows.find(item => item.team === "NJD" && item.gameId === 900010)!, nyrRow = data.rows.find(item => item.team === "NYR" && item.gameId === 900010)!;
  const render = (row: RiskyRow, pairs: RiskyPair[], rows: RiskyRow[] = [row]) => {
    const tile = { ...row, lenses: { ...row.lenses, volume: pairs.map(pair => ({ ...pair, flagged: true })) } };
    return card({ ...riskyStartsResult(GOALIE_INVENTORY_FIXTURE_DETAIL), data: { ...data, rows: [tile, ...rows.filter(item => item !== row)] } }, "volume");
  };
  const sideOf = (html: string, placement: "home" | "away") => html.match(new RegExp(`<span class="[^"]*" data-side="${placement}" data-team="[^>]*>.*?</b>`))![0];
  const barOf = (html: string) => html.match(/<rect data-testid="risky-bar"[^>]*>/)![0];
  const xg = (winner: string | null, nyr: number | null, njd: number | null): RiskyPair => ({ id: "xg", label: "xG", flagged: true, winner, sides: [side("NYR", "xGF/GP", "xgf", metric(nyr === null ? null : 4.06, nyr)), side("NJD", "xGA/GP", "xga", metric(njd === null ? null : 3.5, njd))] });
  it("puts the actual home team left and each value on its own team's side, from either team's tile", () => {
    for (const row of [njdRow, nyrRow]) {
      expect(riskyGameSides(data.rows, row).home.team).toBe("NYR");
      expect(riskyGameSides(data.rows, row).away.team).toBe("NJD");
      const html = render(row, [xg("NYR", 2, 8)]), home = sideOf(html, "home"), away = sideOf(html, "away");
      expect(home).toContain('data-team="NYR"');
      expect(home).toContain("4.06 XGF/GP | 2ND");
      expect(away).toContain('data-team="NJD"');
      expect(away).toContain("3.50 XGA/GP | 8TH");
      expect(html.indexOf("HOME")).toBeLessThan(html.indexOf("AWAY"));
    }
    // Sides given the other way round still land by team.
    const flipped = render(njdRow, [{ ...xg("NYR", 2, 8), sides: [...xg("NYR", 2, 8).sides].reverse() }]);
    expect(sideOf(flipped, "home")).toContain("4.06 XGF/GP");
  });
  it("points the triangle at the winning side, and draws none without a winner", () => {
    const left = render(njdRow, [xg("NYR", 2, 8)]), right = render(njdRow, [xg("NJD", 20, 32)]), none = render(njdRow, [xg(null, 8, 25)]);
    expect(left).toContain('data-testid="risky-edge" data-points="left" data-winner="NYR"');
    expect(right).toContain('data-testid="risky-edge" data-points="right" data-winner="NJD"');
    expect(none).not.toContain("risky-edge");
  });
  it("computes the pair's winner through the shared rule", () => {
    const signals = gameSignals(lenses.get("NJD")!, lenses.get("NYR")!);
    const ranks = (ratio: Partial<typeof signals.ratioExposure>, low = { xga: { A: 28 }, timesShorthanded: { A: 32 } }) => riskyPairs("A", "B", { ...signals, ratioExposure: { ...signals.ratioExposure, ...ratio } }, low).ratio;
    expect(ranks({ opponentXgfPerGame: metric(3, 10), teamXgaPerGame: metric(3, 5) })[0].winner).toBe("B");
    expect(ranks({ opponentPowerPlayPct: metric(20, 16), teamPenaltyKillPct: metric(90, 1) }).find(pair => pair.id === "special-teams")!.winner).toBe("A");
    expect(ranks({ opponentPowerPlayPct: metric(20, 16), teamTimesShorthandedPerGame: metric(5, 1) }).find(pair => pair.id === "penalties")!.winner).toBe("B");
    expect(ranks({ opponentXgfPerGame: metric(null, null, null) })[0].winner).toBeNull();
    expect(riskyPairs("A", "B", signals, {}).win.find(pair => pair.id === "differential")!.winner).toBeNull();
  });
  it("has no winner, and a full bar, for a tie for the fewest allowed against the top attack", () => {
    const signals = gameSignals(lenses.get("NJD")!, lenses.get("NYR")!);
    const [xgPair] = riskyPairs("A", "B", { ...signals, ratioExposure: { ...signals.ratioExposure, opponentXgfPerGame: metric(3.4, 1), teamXgaPerGame: metric(2.1, 31) } }, { xga: { A: 1 } }).ratio;
    expect(xgPair.winner).toBeNull();
    expect(xgPair.sides.map(strengthShare)).toEqual([1, 1]);
  });
  it("sizes each bar by strength out from the centre, so the longer bar is the winner, with fills as attributes", () => {
    const html = render(njdRow, [xg("NYR", 1, 32)]);
    const [home, away] = [...html.matchAll(/<rect data-testid="risky-bar"[^>]*>/g)].map(match => match[0]);
    expect(home).toContain('x="0.00"');
    expect(home).toContain('width="100.00"');
    expect(away).toContain('x="0.00"');
    expect(away).toContain('width="100.00"');
    const close = render(njdRow, [xg("NYR", 16, 1)]), [left, right] = [...close.matchAll(/<rect data-testid="risky-bar"[^>]*>/g)].map(match => match[0]);
    expect(left).toContain(`width="${(17 / 32 * 100).toFixed(2)}"`);
    expect(left).toContain(`x="${(100 - 17 / 32 * 100).toFixed(2)}"`);
    expect(right).toContain(`width="${(1 / 32 * 100).toFixed(2)}"`);
    expect(barOf(close)).toMatch(/fill="#/);
    expect(close).toMatch(/<b style="color:#\w+">HOME/);
    expect(close).toMatch(/<b style="color:#\w+">AWAY/);
  });
  it("keeps a missing metric visibly missing, and a one-sided pairing's other half empty", () => {
    const html = render(njdRow, [xg(null, null, 4)]);
    expect(barOf(html)).toContain('data-mark="missing"');
    expect(barOf(html)).toContain('fill="none"');
    expect(sideOf(html, "home")).toContain("— XGF/GP | —");
    expect(sideOf(html, "away")).toContain("3.50 XGA/GP | 4TH");
    expect(rankBand(metric(4.06, null, null))).toBeNull();
    const single = render(nyrRow, [{ id: "differential", label: "Goal diff", flagged: true, winner: null, sides: [side("NYR", "GD/GP", "goalDifferential", metric(0.5, 3))] }]);
    expect(single).toContain('data-side="away" data-empty=""');
    expect(single).not.toContain("risky-edge");
  });
  it("shows each team's goalies under its own side, finding the other team's in its own row", () => {
    const html = card(riskyStartsResult(GOALIE_INVENTORY_FIXTURE_DETAIL), "volume");
    const block = (team: string) => html.match(new RegExp(`data-testid="risky-row" data-team="NYR" data-game="900010".*?data-testid="risky-goalies" data-side="${team === "NYR" ? "home" : "away"}" data-team="${team}"[^>]*>(.*?)</p>`))![1];
    expect(block("NYR")).toContain("Mikko Søgaard");
    expect(block("NYR")).toContain(">PROJECTED<");
    expect(block("NJD")).toContain("Éric Testeur");
    expect(block("NJD")).toContain(">CONFIRMED<");
    expect(block("NJD")).toContain(">Backup<");
    expect(block("NJD")).toMatch(/\d+\/\d+/);
  });
  it("leaves a side visibly empty when the other team has no goalies, and keeps the date and a known B2B", () => {
    expect(riskyGameSides([njdRow], njdRow).home.goalies).toEqual([]);
    const html = card({ ...riskyStartsResult(GOALIE_INVENTORY_FIXTURE_DETAIL), data: { ...data, rows: [nyrRow] } }, "volume");
    expect(html).toContain('data-testid="risky-goalies-empty"');
    expect(html).toContain("No goalie listed");
    expect(html).toContain("Mon, Nov 2");
    expect(html).toContain("on a B2B");
    expect(html).not.toMatch(/rested|unknown/i);
  });
  it("prints ordinals, and adds no combined score and no odds", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 32].map(ordinalRank)).toEqual(["1ST", "2ND", "3RD", "4TH", "11TH", "12TH", "13TH", "21ST", "22ND", "23RD", "32ND"]);
    const html = card(riskyStartsResult(GOALIE_INVENTORY_FIXTURE_DETAIL), "volume");
    expect(html).not.toMatch(/score|composite|probability/i);
    expect(JSON.stringify(data.rows[0])).not.toMatch(/"(share|score|total|composite|odds)"/);
  });
});

describe("Risky Starts pairings (11.4)", () => {
  it("is symmetric: each game gives both sides, and each side's opponent rate is the other's own", () => {
    const rows = riskyRows(GOALIE_INVENTORY_FIXTURE, [], lowFirstRanks).filter(row => row.gameId === 900010);
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
    const pairs = riskyPairs("NJD", "NYR", gameSignals(lenses.get("NJD")!, lenses.get("NYR")!), lowFirstRanks), mirror = riskyPairs("NYR", "NJD", gameSignals(lenses.get("NYR")!, lenses.get("NJD")!), lowFirstRanks);
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
    const special = riskyPairs("A", "B", { ...gameSignals(lenses.get("NJD")!, lenses.get("TOR")!), ratioExposure: { ...gameSignals(lenses.get("NJD")!, lenses.get("TOR")!).ratioExposure, opponentPowerPlayPct: { value: 30, unit: "%", window: "", sampleGames: 2, leagueRank: 1, leagueCohort: 32 }, teamPenaltyKillPct: { value: 70, unit: "%", window: "", sampleGames: 2, leagueRank: 32, leagueCohort: 32 } } }, {});
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
    const pair = (flagged: boolean) => ({ id: "p", label: "P", sides: [], flagged, winner: null });
    const row = (team: string, volume: boolean[], ratio: boolean[]): RiskyRow => ({ gameId: 1, date: "2026-11-02", startTimeUtc: null, team, opponent: "X", home: true, teamSecondNight: false, opponentSecondNight: false, conflicting: false, goalies: [], lenses: { volume: volume.map(pair), ratio: ratio.map(pair), win: [] } });
    const rows = [row("A", [true], [true, true, true]), row("B", [true], [true]), row("C", [false], [true, true])];
    expect(riskyRowsForLens(rows, "ratio").map(item => item.team)).toEqual(["A", "C", "B"]);
    expect(riskyRowsForLens(rows, "volume").map(item => item.team)).toEqual(["A", "B"]);
    expect(riskyFlags(rows[0], "volume")).toBe(1);
    expect(JSON.stringify(data)).not.toMatch(/"(score|total|composite|odds|winProbability)"/);
  });
  it("carries the correlation note in the evidence and the alt text, and promises no odds", () => {
    expect(riskyStartsResult(GOALIE_INVENTORY_FIXTURE_DETAIL).evidence.cohort).toContain(RISKY_CORRELATION_NOTE);
    expect(RISKY_CORRELATION_NOTE).toMatch(/correlated/);
    expect(RISKY_CORRELATION_NOTE).toMatch(/no win or start odds/);
    expect(riskyStartsModule.altText({ evidence: { sample: "s" } } as never, data, settings("volume"))).toContain(RISKY_CORRELATION_NOTE);
  });
});

describe("Risky Starts post", () => {
  it("drops games already started, and keeps goalies with their own status", () => {
    const rows = riskyRows({ ...GOALIE_INVENTORY_FIXTURE, generatedAt: "2026-11-02T23:15:00.000Z" }, [], lowFirstRanks);
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
    const missing = riskyStartsResult({ coverage: null, conflicts: [], lowFirstRanks: {}, inventory: { ...GOALIE_INVENTORY_FIXTURE, state: "missing", goalies: [], sources: [], reasons: ["could not be read"] } });
    expect(missing).toMatchObject({ state: "missing", data: null, reasons: ["could not be read"] });
    const closed = riskyStartsResult(buildGoalieInventory({ ...FIXTURE_INPUT, confirmations: null, forecasts: null }));
    expect(closed.state).toBe("ready");
    expect(closed.evidence.cohort).not.toContain("Goalie start observations");
    expect(closed.evidence.sources[0].tables).not.toContain("player_forecast_goalie_start_observations");
    expect(closed.evidence.sample).toMatch(/could not be read/);
    expect(closed.data!.confirmationLegend).toBe("Unknown = reports unreadable.");
  });
  it("treats the lens as a browser setting the export token still covers", () => {
    const field = riskyStartsModule.fields.find(item => item.id === "lens")!;
    expect(field.clientOnly).toBe(true);
    const snapshot = { id: "e", post: "risky-starts" };
    expect(sharePostExportToken(riskyStartsModule.fields, snapshot, settings("ratio"))).not.toBe(sharePostExportToken(riskyStartsModule.fields, snapshot, settings("win")));
  });
});

describe("Risky Starts market lines", () => {
  const game = { gameId: 900010, home: "NYR", away: "NJD", startTimeUtc: "2026-11-02T23:00:00Z" };
  const stored = (over: Partial<StoredLineRow> = {}): StoredLineRow => ({ game_id: 900010, provider: "DraftKings", captured_at: "2026-11-02T12:00:00Z", event_start_at: "2026-11-02T23:00:00Z", home_team_abbreviation: "NYR", away_team_abbreviation: "NJD", home_moneyline: -132, away_moneyline: 112, total_line: 6.5, ...over });
  const team = (abbrev: string, moneyline: number | null, total = "O6.5") => ({ abbrev, odds: [{ description: "MONEY_LINE_3_WAY", value: 999, qualifier: "" }, ...(moneyline === null ? [] : [{ description: "MONEY_LINE_2_WAY", value: moneyline, qualifier: "" }]), { description: "OVER_UNDER", value: -110, qualifier: total }] });
  const feed = (over: Partial<PartnerFeed> = {}): PartnerFeed => ({ lastUpdatedUTC: "2026-11-02T14:00:00Z", bettingPartner: { name: "OtherBook" }, games: [{ gameId: 900010, startTimeUTC: "2026-11-02T23:00:00Z", homeTeam: team("NYR", -140), awayTeam: team("NJD", 120, "U6.5") }], ...over });
  const client = (rows: StoredLineRow[] | null, error: unknown = null) => {
    const query = { select: vi.fn(() => query), in: vi.fn(() => query), eq: vi.fn(() => query), lte: vi.fn(() => query), order: vi.fn(() => query), limit: vi.fn(async () => ({ data: rows, error })) };
    return { from: vi.fn(() => query), query };
  };
  const ok = (body: PartnerFeed) => vi.fn(async () => new Response(JSON.stringify(body), { status: 200 })) as unknown as typeof fetch;
  const rows = data.rows.filter(row => row.gameId === 900010);

  it("takes the latest stored row captured before puck drop", () => {
    const line = storedLine(game, [stored({ captured_at: "2026-11-02T09:00:00Z", home_moneyline: -101 }), stored(), stored({ captured_at: "2026-11-02T10:00:00Z", home_moneyline: -102 })], FIXTURE_GENERATED_AT);
    expect(line).toMatchObject({ source: "stored", book: "DraftKings", capturedAt: "2026-11-02T12:00:00Z", home: "NYR", away: "NJD", homeMoneyline: -132, awayMoneyline: 112, total: 6.5 });
  });
  it("ignores a row captured at or after puck drop, and one captured after the edition", () => {
    const late = "2026-11-02T23:30:00.000Z";
    expect(storedLine(game, [stored({ captured_at: "2026-11-02T23:00:00Z" })], late)).toBeNull();
    expect(storedLine(game, [stored({ captured_at: "2026-11-02T23:10:00Z" })], late)).toBeNull();
    expect(storedLine(game, [stored({ captured_at: "2026-11-02T15:30:00Z" })], FIXTURE_GENERATED_AT)).toBeNull();
    expect(storedLine(game, [stored({ captured_at: "2026-11-02T23:10:00Z", home_moneyline: -999 }), stored()], late)?.homeMoneyline).toBe(-132);
  });
  it("refuses a stored row for other teams or with no puck drop to compare", () => {
    expect(storedLine(game, [stored({ home_team_abbreviation: "NJD", away_team_abbreviation: "NYR" })], FIXTURE_GENERATED_AT)).toBeNull();
    expect(storedLine({ ...game, startTimeUtc: null }, [stored({ event_start_at: null })], FIXTURE_GENERATED_AT)).toBeNull();
  });
  it("prefers the stored row and makes no NHL request when every game has one", async () => {
    const fetchImpl = ok(feed()), result = await loadRiskyMarketLines(rows, FIXTURE_GENERATED_AT, { client: client([stored()]) as never, fetchImpl });
    expect(result.lines["900010"]).toMatchObject({ source: "stored", book: "DraftKings", homeMoneyline: -132 });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result.sources.map(source => source.name)).toEqual(["DraftKings market lines (stored)"]);
    expect(result.notes).toEqual([MARKET_LINES_NOTE]);
  });
  it("reads narrow columns only, up to the edition, and through the client it is given", async () => {
    const reader = client([stored()]);
    await loadRiskyMarketLines(rows, FIXTURE_GENERATED_AT, { client: reader as never, fetchImpl: ok(feed()) });
    expect(reader.from).toHaveBeenCalledWith("game_prediction_market_odds_snapshots");
    expect(reader.query.select.mock.calls[0]).toEqual([expect.not.stringContaining("no_vig")]);
    expect(reader.query.lte).toHaveBeenCalledWith("captured_at", FIXTURE_GENERATED_AT);
    expect(reader.query.eq).toHaveBeenCalledWith("provider", "DraftKings");
  });
  it("falls back to NHL.com with one request when a game has no stored row", async () => {
    const fetchImpl = ok(feed()), result = await loadRiskyMarketLines(rows, FIXTURE_GENERATED_AT, { client: client([]) as never, fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect((fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe(NHL_PARTNER_URL);
    expect((fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
    expect(result.lines["900010"]).toMatchObject({ source: "nhl", book: "OtherBook", capturedAt: "2026-11-02T14:00:00Z", homeMoneyline: -140, awayMoneyline: 120, total: 6.5 });
    expect(result.sources.map(source => source.name)).toEqual(["NHL.com partner odds (OtherBook)"]);
  });
  it("never mixes books within a game: each line is whole from one source", async () => {
    const twoGames = data.rows.filter(row => row.gameId === 900010 || row.gameId === 900011);
    const result = await loadRiskyMarketLines(twoGames, FIXTURE_GENERATED_AT, { client: client([stored()]) as never, fetchImpl: ok(feed({ games: [...feed().games!, { gameId: 900011, startTimeUTC: "2026-11-02T23:30:00Z", homeTeam: team("TOR", -150), awayTeam: team("MTL", 130, "U6") }] })) });
    expect(result.lines["900010"]).toMatchObject({ source: "stored", book: "DraftKings", homeMoneyline: -132, awayMoneyline: 112, total: 6.5 });
    expect(result.lines["900011"]).toMatchObject({ source: "nhl", book: "OtherBook", homeMoneyline: -150, awayMoneyline: 130 });
    // The stored row lacking a total takes no total from the feed.
    const noTotal = await loadRiskyMarketLines(rows, FIXTURE_GENERATED_AT, { client: client([stored({ total_line: null })]) as never, fetchImpl: ok(feed()) });
    expect(noTotal.lines["900010"]).toMatchObject({ book: "DraftKings", total: null });
  });
  it("takes an older DraftKings row over a newer row from another book", () => {
    const line = storedLine(game, [stored({ provider: "FanDuel", captured_at: "2026-11-02T14:00:00Z", home_moneyline: -500, away_moneyline: 400 }), stored()], FIXTURE_GENERATED_AT);
    expect(line).toMatchObject({ book: "DraftKings", capturedAt: "2026-11-02T12:00:00Z", homeMoneyline: -132, awayMoneyline: 112 });
  });
  it("falls through to NHL.com when another book is all that's stored, and names no stored book", async () => {
    const fetchImpl = ok(feed()), result = await loadRiskyMarketLines(rows, FIXTURE_GENERATED_AT, { client: client([stored({ provider: "FanDuel" })]) as never, fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(result.lines["900010"]).toMatchObject({ source: "nhl", book: "OtherBook", homeMoneyline: -140 });
    expect(result.sources.map(source => source.name)).toEqual(["NHL.com partner odds (OtherBook)"]);
    expect(riskyStartsResult(GOALIE_INVENTORY_FIXTURE_DETAIL, result).evidence.sources[0].name).not.toContain("DraftKings");
  });
  it("refuses a feed updated after puck drop, a one-sided moneyline and mismatched teams", () => {
    expect(partnerLine(game, feed({ lastUpdatedUTC: "2026-11-02T23:00:00Z" }))).toBeNull();
    expect(partnerLine(game, feed({ games: [{ gameId: 900010, homeTeam: team("NYR", -140), awayTeam: team("NJD", null) }] }))).toBeNull();
    expect(partnerLine(game, feed({ games: [{ gameId: 900010, homeTeam: team("NJD", -140), awayTeam: team("NYR", 120) }] }))).toBeNull();
    expect(partnerLine(game, feed({ games: [] }))).toBeNull();
    expect(partnerLine(game, feed({ bettingPartner: {} }))).toBeNull();
    expect(partnerLine(game, feed({ games: [{ gameId: 900010, homeTeam: team("NYR", -140, "O6"), awayTeam: team("NJD", 120, "U6.5") }] }))?.total).toBeNull();
  });
  it.each([
    ["a rejected request", vi.fn(async () => { throw new Error("timeout"); })],
    ["a bad status", vi.fn(async () => new Response("nope", { status: 404 }))],
    ["unreadable JSON", vi.fn(async () => new Response("<html>", { status: 200 }))],
  ])("survives NHL failure from %s: no line, and the evidence says so", async (_name, fetchImpl) => {
    const market = await loadRiskyMarketLines(rows, FIXTURE_GENERATED_AT, { client: client([]) as never, fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(market.lines).toEqual({});
    expect(market.notes).toContain(NHL_FAILED_NOTE);
    const result = riskyStartsResult(GOALIE_INVENTORY_FIXTURE_DETAIL, market);
    expect(result.state).toBe("ready");
    expect(result.evidence.sample).toContain(NHL_FAILED_NOTE);
    expect(result.evidence.cohort).not.toContain("NHL.com partner odds");
  });
  it("survives a stored read failure, still trying the feed, and a missing server client", async () => {
    const failed = await loadRiskyMarketLines(rows, FIXTURE_GENERATED_AT, { client: client(null, new Error("denied")) as never, fetchImpl: ok(feed()) });
    expect(failed.notes).toContain(STORED_FAILED_NOTE);
    expect(failed.lines["900010"].source).toBe("nhl");
    const noClient = await loadRiskyMarketLines(rows, FIXTURE_GENERATED_AT, { fetchImpl: ok(feed({ games: [] })) });
    expect(noClient.notes).toContain(STORED_FAILED_NOTE);
    expect(noClient.lines).toEqual({});
  });
  it("makes no reads without games", async () => {
    const reader = client([]), fetchImpl = ok(feed());
    expect((await loadRiskyMarketLines([], FIXTURE_GENERATED_AT, { client: reader as never, fetchImpl })).lines).toEqual({});
    expect(reader.from).not.toHaveBeenCalled();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it("prints each moneyline on its own team's side, the total and book in the centre, with no derived number", async () => {
    const market = await loadRiskyMarketLines(data.rows, FIXTURE_GENERATED_AT, { client: client([stored()]) as never, fetchImpl: ok(feed({ games: [] })) });
    const result = riskyStartsResult(GOALIE_INVENTORY_FIXTURE_DETAIL, market), only = (result.data as RiskyStartsData).rows.filter(row => row.gameId === 900010 && row.team === "NYR");
    const html = card({ ...result, data: { ...(result.data as RiskyStartsData), rows: only } }, "volume");
    expect(html.indexOf("HOME")).toBeLessThan(html.indexOf('data-team="NYR">-132'));
    expect(html.indexOf('data-team="NYR">-132')).toBeLessThan(html.indexOf("O/U 6.5 · DK<"));
    expect(html.indexOf("O/U 6.5 · DK<")).toBeLessThan(html.indexOf('data-team="NJD">+112'));
    expect(html.indexOf('data-team="NJD">+112')).toBeLessThan(html.indexOf("AWAY"));
    expect(html).not.toContain("No line yet");
    expect(result.evidence.sample).toContain("DraftKings market lines");
    expect(html).not.toMatch(/\d%(?! PP)|implied|probab|no.vig/i);
    expect(JSON.stringify(market.lines)).not.toMatch(/probability|overround|vig/i);
    expect(riskyStartsModule.altText({ evidence: { sample: "s" } } as never, { ...(result.data as RiskyStartsData), rows: only }, settings("volume"))).toContain("Market line, DraftKings: NYR -132, NJD +112, total 6.5");
  });
  it("prints nothing for a game with no DraftKings line, including another book's", () => {
    const row = data.rows.find(item => item.gameId === 900010 && item.team === "NYR")!;
    const other = { gameId: 900010, source: "nhl" as const, book: "FanDuel", capturedAt: FIXTURE_GENERATED_AT, home: "NYR", away: "NJD", homeMoneyline: -120, awayMoneyline: 100, total: 6 };
    for (const lines of [{}, { 900010: other }] as Record<string, RiskyStartsData["lines"][string]>[]) {
      const html = card({ ...riskyStartsResult(GOALIE_INVENTORY_FIXTURE_DETAIL), data: { ...data, rows: [row], lines } }, "volume");
      expect(html).not.toMatch(/No line|risky-moneyline|risky-line|FanDuel/);
    }
  });
  it("lists the source it used in the evidence, with its capture time", async () => {
    const market = await loadRiskyMarketLines(rows, FIXTURE_GENERATED_AT, { client: client([stored()]) as never, fetchImpl: ok(feed()) });
    const { evidence } = riskyStartsResult(GOALIE_INVENTORY_FIXTURE_DETAIL, market);
    expect(evidence.sources[0].tables).toContain("game_prediction_market_odds_snapshots");
    expect(evidence.cohort).toContain("DraftKings market lines (stored) through 2026-11-02 (updated Nov 2, 7:00 AM ET)");
    expect(evidence.sample).toContain(MARKET_LINES_NOTE);
  });
});

describe("Risky Starts footer and tile edge", () => {
  const source = (name: string, asOf: string | null, tables: string[], state: "ready" | "partial" = "ready", reasons?: string[]) => ({ name, tables, state, asOf, updatedAt: asOf && `${asOf}T12:00:00Z`, reasons });
  const full = [source("NHL.com schedule", "2026-11-06", ["games"]), source("NHL.com team game stats", "2026-10-30", ["wgo_team_stats"]), source("NST team game logs (all situations)", "2026-10-30", ["nst_team_gamelogs_as_counts"]), source("NHL.com goalie game stats", "2026-10-30", ["wgo_goalie_stats"]), source("Goalie start observations", "2026-10-31", ["player_forecast_goalie_start_observations"], "partial", ["gap"]), source("DraftKings market lines (stored)", "2026-11-01", ["game_prediction_market_odds_snapshots"]), source("NHL.com partner odds", null, ["api-web.nhle.com/v1/partner-game/US/now"])];
  const evidence = { sources: full, sample: "s", strength: "All situations (shots, xG, chances); PP and PK as labeled", cohort: "c.", coverage: { observed: 432, expected: 432, missing: 0, unit: "completed team games" } };
  it("gives the footer one line with every source at its fullest, using the shell's own line", () => {
    const line = postEvidenceLine(compactRiskyEvidence(evidence));
    expect(line).toBe("NHL.com, NST, goalie reports, DraftKings through 2026-10-30 · All situations · 432 of 432 completed team games");
    // The footer is 984px less the watermark, about 115 characters at 15px.
    expect(line.length).toBeLessThanOrEqual(115);
  });
  it("keeps every source's date and update in the panel, and its tables and reasons on the record", () => {
    const compact = compactRiskyEvidence(evidence);
    expect(compact.cohort).toContain("All situations (shots, xG, chances); PP and PK as labeled");
    for (const name of full.map(item => item.name)) expect(compact.cohort).toContain(name);
    expect(compact.cohort).toContain("NHL.com schedule through 2026-11-06 (updated Nov 6, 7:00 AM ET)");
    expect(compact.sources).toHaveLength(1);
    expect(compact.sources[0]).toMatchObject({ state: "partial", asOf: "2026-10-30", reasons: ["gap"] });
    expect(compact.sources[0].tables).toEqual(full.flatMap(item => item.tables));
  });
  it("still has no source when none was readable, so the post cannot export", () => {
    expect(compactRiskyEvidence({ ...evidence, sources: [] }).sources).toEqual([]);
  });
  it("leaves other posts' shared evidence alone", () => {
    expect(postEvidenceLine(evidence)).toContain("NHL.com team game stats through 2026-10-30");
  });
  it("sets the tile's edge inline, so the PNG keeps it", () => {
    const html = card(riskyStartsResult(GOALIE_INVENTORY_FIXTURE_DETAIL), "volume"), tile = html.match(/<div class="[^"]*" style="([^"]*)" data-testid="risky-row"/)![1];
    expect(tile).toContain("border:1.5px solid");
    expect(tile).toContain("border-radius:10px");
    expect(tile).toContain("box-shadow:");
  });
});

describe("Risky Starts edition expiry", () => {
  const edition = async (generatedAt: string, schedule = FIXTURE_INPUT.schedule) => {
    vi.spyOn(shareModule("risky-starts")!, "load").mockResolvedValue((async () => riskyStartsResult(buildGoalieInventory({ ...FIXTURE_INPUT, schedule, request: { ...FIXTURE_INPUT.request, generatedAt } }))) as never);
    return loadPostSnapshot("risky-starts", {}, {} as never, () => new Date(generatedAt));
  };
  const block = (snapshot: Awaited<ReturnType<typeof edition>>, now: string) => sharePostExportBlock(shareModule("risky-starts")!, snapshot, { ...snapshot.settings, lens: "volume" }, Date.parse(now));
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

describe("period control", () => {
  beforeEach(() => vi.restoreAllMocks());
  it("leaves the default URL as it was: seven days ahead with no calendar read", async () => {
    expect(parseShareSettings(shareModule(POST)!, {})).toMatchObject({ days: 7, period: "days", week: null, start: null, end: null });
    const table = periodClient(), snapshot = await periodEdition({}, table);
    expect(table.tables).not.toContain("yahoo_matchup_weeks");
    expect(snapshot.settings).toMatchObject({ days: 7, period: "days" });
    expect(table.filters).toContainEqual(["games", "date", "2026-11-09"]);
  });
  it("reads a chosen matchup week's own dates", async () => {
    const table = periodClient();
    await periodEdition({ period: "matchup", week: "5" }, table);
    expect(table.tables[0]).toBe("yahoo_matchup_weeks");
    expect(table.filters).toContainEqual(["games", "date", "2026-11-09"]);
  });
  it("reads the whole of a 14-day week, and the schedule a day past it for back-to-backs", async () => {
    const table = periodClient();
    await periodEdition({ period: "matchup", week: "6" }, table);
    expect(table.filters).toContainEqual(["games", "date", "2026-11-23"]);
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
    expect(table.filters).toContainEqual(["games", "date", "2026-11-07"]);
  });
});

describe("the period on the card", () => {
  const period = { label: "Week 4 · Oct 26 to Nov 8", from: "2026-10-26", through: "2026-11-08", listedFrom: "2026-11-02", elapsed: false, usedCalendar: true, season: 20262027 };
  it("prints the dates, names a part-played week and files the calendar on the one footer source", () => {
    const result = riskyStartsResult(GOALIE_INVENTORY_FIXTURE_DETAIL, undefined, period);
    expect(card(result, "volume")).toContain("Week 4 · Oct 26 to Nov 8 · games still to start");
    expect(result.evidence.sources).toHaveLength(1);
    expect(result.evidence.sources[0].name).toContain("Yahoo");
    expect(result.evidence.sources[0].tables).toContain("yahoo_matchup_weeks");
  });
  it("says no upcoming games once every game has started, and not a lens miss", () => {
    const empty = riskyStartsResult({ ...GOALIE_INVENTORY_FIXTURE_DETAIL, inventory: { ...GOALIE_INVENTORY_FIXTURE_DETAIL.inventory, generatedAt: "2026-11-30T00:00:00.000Z" } }, undefined, period);
    expect(card(empty, "volume")).toContain("No upcoming games in this period");
    expect(card(empty, "volume")).not.toContain("flagged pairing");
  });
  it("shows no line on a later week and expires at puck drop on a chosen period", () => {
    const generatedAt = "2026-11-02T22:59:00.000Z", result = riskyStartsResult(buildGoalieInventory({ ...FIXTURE_INPUT, request: { ...FIXTURE_INPUT.request, generatedAt } }), undefined, period);
    expect(result.ttlSeconds).toBe(60);
    expect(card(result, "volume")).not.toMatch(/No line|risky-line/);
  });
});

describe("goalie labels", () => {
  const none = { state: "none", source: null, observedAt: null, expiresAt: null, sourceUrl: null } as const;
  const goalie = (goalieId: number, starts: number | null, confirmation: RiskyGoalie["confirmation"] = none): Omit<RiskyGoalie, "role"> => ({ goalieId, name: `G${goalieId}`, starts, teamGames: 10, confirmation });
  const row = { gameId: 1, team: "NJD", opponent: "NYR", conflicting: false };
  const labels = (roles: Map<number, GoalieRole>) => Object.fromEntries([...roles].map(([id, role]) => [id, role.label]));
  it("labels the L10 leader Likely Starter and the other Likely Backup", () => {
    expect(labels(goalieRoles(row, [goalie(1, 8), goalie(2, 2)], {}))).toEqual({ 1: "LIKELY STARTER", 2: "LIKELY BACKUP" });
  });
  it("breaks an L10 tie on recent starts, then the record against this opponent, and says Split when still tied", () => {
    const tied = [goalie(1, 5), goalie(2, 5)];
    expect(likelyStarter(tied, "NJD", "NYR", { recentTrend: { "NJD:1": 1, "NJD:2": 2 } })).toBe(2);
    const even = { "NJD:1": 1, "NJD:2": 1 };
    expect(likelyStarter(tied, "NJD", "NYR", { recentTrend: even, records: { "1:NYR": { wins: 3, losses: 1, otLosses: 0 }, "2:NYR": { wins: 1, losses: 2, otLosses: 1 } } })).toBe(1);
    // A record for another opponent separates nothing.
    expect(labels(goalieRoles(row, tied, { recentTrend: even, records: { "1:TOR": { wins: 3, losses: 0, otLosses: 0 } } }))).toEqual({ 1: "Split", 2: "Split" });
  });
  it("shows which game of a B2B it is, for both goalies, only against the weaker opponent", () => {
    const pair = [goalie(1, 8), goalie(2, 2)];
    expect(labels(goalieRoles(row, pair, { backToBacks: { "1:NJD": { order: 2, otherGameId: 2, otherOpponent: "TOR", weakerOpponent: true } } }))).toEqual({ 1: "2nd game of a B2B", 2: "2nd game of a B2B" });
    expect(labels(goalieRoles(row, pair, { backToBacks: { "1:NJD": { order: 1, otherGameId: 2, otherOpponent: "TOR", weakerOpponent: true } } }))).toEqual({ 1: "1st game of a B2B", 2: "1st game of a B2B" });
    for (const weakerOpponent of [false, null]) expect(labels(goalieRoles(row, pair, { backToBacks: { "1:NJD": { order: 2, otherGameId: 2, otherOpponent: "TOR", weakerOpponent } } }))).toEqual({ 1: "LIKELY STARTER", 2: "LIKELY BACKUP" });
  });
  it("puts a source's report first: Projected with its account, the other goalie Backup (Projected), and Backup once confirmed", () => {
    const projected = { state: "projected", source: "GoalieReporter", observedAt: FIXTURE_GENERATED_AT, expiresAt: null, sourceUrl: null } as const;
    const roles = goalieRoles(row, [goalie(1, 8), goalie(2, 2, projected)], { backToBacks: { "1:NJD": { order: 2, otherGameId: 2, otherOpponent: "TOR", weakerOpponent: true } } });
    expect([...roles.values()]).toEqual([{ kind: "backup-projected", label: "Backup (Projected)", handle: null }, { kind: "projected", label: "PROJECTED", handle: "@GoalieReporter" }]);
    expect(labels(goalieRoles(row, [goalie(1, 8, { ...projected, state: "confirmed" }), goalie(2, 2)], {}))).toEqual({ 1: "CONFIRMED", 2: "Backup" });
    // The pipeline's own key names no account, so no handle is invented.
    expect(sourceHandle({ ...projected, source: "validated_events" })).toBeNull();
    expect(labels(goalieRoles({ ...row, conflicting: true }, [goalie(1, 8, projected), goalie(2, 2)], {}))).toEqual({ 1: "Conflicting reports", 2: "Conflicting reports" });
  });
  it("shows a projection only on the game it is for, never the team's other game", () => {
    const base = FIXTURE_INPUT.confirmations!.evidence.assertions[1];
    const nextGame = { ...base, gameId: 900012, teamId: teamsInfo.NJD.id, playerId: 7002, evidenceId: "obs-next" }, wrongGame = { ...base, gameId: 900011, teamId: teamsInfo.NJD.id, playerId: 7001, evidenceId: "obs-wrong" };
    const { rows } = riskyStartsResult(buildGoalieInventory({ ...FIXTURE_INPUT, confirmations: { ...FIXTURE_INPUT.confirmations!, evidence: { assertions: [nextGame, wrongGame], conflicts: [] } } })).data as RiskyStartsData;
    const roles = (gameId: number) => Object.fromEntries(rows.find(item => item.gameId === gameId && item.team === "NJD")!.goalies.map(entry => [entry.name, entry.role.label]));
    expect(roles(900012)).toEqual({ "Éric Testeur": "Backup (Projected)", "Sam Relief": "PROJECTED" });
    expect(Object.values(roles(900010))).not.toContain("PROJECTED");
    expect(Object.values(roles(900010))).not.toContain("Backup (Projected)");
  });
  it("prints every label as coloured text with no chip, each at WCAG AA on the card", () => {
    const luminance = (hex: string) => { const [r, g, b] = [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16) / 255).map(value => value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
    const ratio = (a: string, b: string) => { const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (high + 0.05) / (low + 0.05); };
    for (const color of [...Object.values(ROLE_COLORS), "#b8c2cc"]) expect(ratio(color, ROLE_CARD_BACKGROUND)).toBeGreaterThanOrEqual(4.5);
    const html = card(riskyStartsResult(GOALIE_INVENTORY_FIXTURE_DETAIL), "volume");
    const styles = [...html.matchAll(/data-testid="risky-role"[^>]*style="([^"]*)"/g)].map(match => match[1]);
    expect(styles.length).toBeGreaterThan(0);
    for (const style of styles) expect(style).toMatch(/^color:#[0-9a-f]{6}$/);
  });
});

describe("goalie records against an opponent", () => {
  const tableClient = (rows: object[]) => {
    const calls: string[] = [];
    const chain: Record<string, unknown> = {};
    for (const method of ["select", "eq", "gte", "lte", "in", "order", "range"]) chain[method] = () => chain;
    chain.then = (resolve: (value: object) => void) => resolve({ data: rows, error: null, count: rows.length });
    return { calls, from: (table: string) => { calls.push(table); return chain; } };
  };
  const split = (goalieId: number): RiskyGoalie => ({ goalieId, name: "", starts: 5, teamGames: 10, confirmation: { state: "none", source: null, observedAt: null, expiresAt: null, sourceUrl: null }, role: { kind: "split", label: "Split", handle: null } });
  const appearance = (goalieId: number, opponent: string, wins: number, season = 20262027) => ({ goalie_id: goalieId, goalie_name: "", date: season === 20262027 ? "2026-10-20" : "2026-01-20", season_id: season, game_id: goalieId * 1000 + opponent.charCodeAt(0) + season % 7, team_abbreviation: "NJD", opponent_team_abbrev: opponent, home_road: "H", games_played: 1, games_started: 1, wins, losses: 1 - wins, ot_losses: 0 });
  it("reads only for goalies still split, and sums decisions against that opponent only", async () => {
    const decided = data.rows.map(entry => ({ ...entry, goalies: entry.goalies.map(item => ({ ...item, role: { kind: "likely-starter" as const, label: "LIKELY STARTER", handle: null } })) }));
    const none = tableClient([]);
    expect(await loadOpponentRecords(none as never, decided, 20262027, "2026-11-01")).toEqual({});
    expect(none.calls).toEqual([]);
    const reader = tableClient([appearance(1, "NYR", 1), appearance(1, "TOR", 1), appearance(2, "NYR", 0), appearance(1, "NYR", 1, 20252026)]);
    const records = await loadOpponentRecords(reader as never, [{ ...data.rows[0], team: "NJD", opponent: "NYR", goalies: [split(1), split(2)] }], 20262027, "2026-11-01");
    expect(reader.calls).toEqual(["wgo_goalie_stats", "wgo_goalie_stats"]);
    // Last season counts too.
    expect(records["1:NYR"]).toEqual({ wins: 2, losses: 0, otLosses: 0 });
    expect(records["2:NYR"]).toEqual({ wins: 0, losses: 1, otLosses: 0 });
    expect(records["1:TOR"]).toBeUndefined();
  });
});
