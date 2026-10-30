import { StrictMode } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SocialShare, { deploymentBadges, moverDigits, moverSparkPoints, NEON, OUTLINE_FALLBACK_TEAMS, ppChip, goldGlow, roleChipList, roleHero, rosteredText, Sparkline, tileRoleChips, toneOf } from "./SocialShare";
import { TUESDAY_NOT_CONNECTED, buildBlockedSnapshot, buildScheduleSnapshot, calendarWeekStart, selectScheduleDates, weekDates } from "lib/socialShare/schedule";
import { fictionalLeagueWeek } from "lib/socialShare/fixtures";
import { buildTrendLayer, trendDefinitions, trendExportToken } from "lib/socialShare/trends";
import { assertToken } from "lib/socialShare/export";
import { fictionalTrendSources } from "lib/socialShare/trendsFixture";
import { localDate } from "lib/rosterScheduleOptimizer/planningDates";
import type { ShareDeploymentRow, SocialShareSnapshot } from "lib/socialShare/types";
vi.mock("lib/supabase/client", () => ({ default: { auth: {
  getSession: vi.fn(async () => ({ data: { session: { user: { id: "social-editor" }, access_token: "synthetic-token" } }, error: null })),
} } }));
// Ticket 15: the studio keeps its selection in the URL and remembers the edition for the signed-in user.
const router = vi.hoisted(() => ({ query: {} as Record<string, string>, pathname: "/social-share/[format]", isReady: true, replace: (() => Promise.resolve(true)) as (...args: unknown[]) => Promise<boolean> }));
vi.mock("next/router", () => ({ useRouter: () => router }));
const auth = vi.hoisted(() => ({ user: { id: "social-editor" } }));
vi.mock("contexts/AuthProviderContext", () => ({ useAuth: () => auth }));

// A strict-mode double mount must still make exactly one edition API call (SS1-8 correction).
describe("SocialShare edition loading", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    router.query = { format: "tuesday-trends" }; router.replace = vi.fn(async () => true);
    fetchMock.mockImplementation(async (url: string) => {
      const query = new URL(url, "http://localhost").searchParams;
      const body = buildBlockedSnapshot({ format: "tuesday-trends", weekStart: query.get("weekStart")!, generatedAt: "2026-10-24T19:00:00Z", ...TUESDAY_NOT_CONNECTED });
      return { ok: true, status: 200, json: async () => body } as unknown as Response;
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
    Object.defineProperty(document, "fonts", { configurable: true, value: { load: async () => [], check: () => false } });
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it("issues one API call per load under a React strict-mode double mount", async () => {
    render(<StrictMode><SocialShare format="tuesday-trends" asOf="2026-10-24T19:00:00Z" /></StrictMode>);
    await waitFor(() => expect(screen.getByText(/Rolling game metrics and ownership are not connected/)).toBeTruthy());
    const apiCalls = fetchMock.mock.calls.filter(([url]) => String(url).startsWith("/api/v1/social-share/"));
    expect(apiCalls).toEqual([["/api/v1/social-share/tuesday-trends?weekStart=2026-10-19", { cache: "no-store", credentials: "omit", headers: { Authorization: "Bearer synthetic-token" } }]]);
  });

  it("restores the URL's week, days and card, and a remount (gate re-check on tab return) reuses the edition without a refetch", async () => {
    // A current, ready schedule edition for next week (a blocked Tuesday edition never expires, so it is never remembered).
    const week = calendarWeekStart(new Date(Date.now() + 7 * 86400000).toISOString()), days = weekDates(week).slice(1, 3);
    fetchMock.mockImplementation(async (url: string) => {
      const query = new URL(url, "http://localhost").searchParams, generatedAt = new Date().toISOString();
      const edition = buildScheduleSnapshot({ format: "game-grid", weekStart: query.get("weekStart")!, generatedAt, schedule: fictionalLeagueWeek(query.get("weekStart")!, generatedAt) });
      return { ok: true, status: 200, json: async () => selectScheduleDates(edition, query.get("selectedDates")!.split(",")) } as unknown as Response;
    });
    router.query = { format: "game-grid", week, dates: days.join(","), card: "tiers" };
    const first = render(<SocialShare format="game-grid" asOf={new Date().toISOString()} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(String(fetchMock.mock.calls[0][0])).toBe(`/api/v1/social-share/game-grid?weekStart=${week}&selectedDates=${encodeURIComponent(days.join(","))}`);
    await waitFor(() => expect((screen.getByRole("button", { name: "Refresh schedule" }) as HTMLButtonElement).disabled).toBe(false));
    expect((screen.getByRole("combobox", { name: /^Graphic/ }) as HTMLSelectElement).value).toBe("tiers");
    // The URL never drops the days while the edition loads (ticket 16 flake fix).
    for (const [target] of (router.replace as ReturnType<typeof vi.fn>).mock.calls) expect((target as { query: Record<string, string> }).query.dates).toBe(days.join(","));
    first.unmount();
    // Remount as the gate does after Supabase re-announces the session on tab return.
    render(<SocialShare format="game-grid" asOf={new Date().toISOString()} />);
    expect((screen.getByLabelText(/^Week of/) as HTMLInputElement).value).toBe(week);
    expect((screen.getByRole("combobox", { name: /^Graphic/ }) as HTMLSelectElement).value).toBe("tiers");
    expect((screen.getByRole("button", { name: "Refresh schedule" }) as HTMLButtonElement).disabled).toBe(false);
    expect(fetchMock.mock.calls.filter(([url]) => String(url).startsWith("/api/v1/social-share/"))).toHaveLength(1);
  });

  it("writes the selection into the URL with a shallow replace", async () => {
    render(<SocialShare format="tuesday-trends" asOf="2026-10-24T19:00:00Z" />);
    await waitFor(() => expect(router.replace).toHaveBeenCalled());
    const [target, , options] = (router.replace as ReturnType<typeof vi.fn>).mock.calls.at(-1)!;
    expect(target).toMatchObject({ pathname: "/social-share/[format]", query: { format: "tuesday-trends", week: "2026-10-19", card: "hot" } });
    expect(options).toMatchObject({ shallow: true, scroll: false });
  });

  it.each(["2026-13-01", "2026-00-10", "2026-10-32", "2026-02-30", "2026-1-05", "not-a-date", "0000-01-03", "0001-01-01", "0099-01-05", "0999-01-07", "0999-12-31"])("falls back to the default week for an impossible ?week=%s instead of crashing (C7 SS1-15-F1)", async week => {
    router.query = { format: "tuesday-trends", week, dates: "2026-02-30,2026-10-99", card: "bogus" };
    expect(() => render(<SocialShare format="tuesday-trends" asOf="2026-10-24T19:00:00Z" />)).not.toThrow();
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    // Default week, no day selection from the bad dates, default card.
    expect(String(fetchMock.mock.calls[0][0])).toBe("/api/v1/social-share/tuesday-trends?weekStart=2026-10-19");
    expect((screen.getByRole("combobox", { name: /^Graphic/ }) as HTMLSelectElement).value).toBe("hot");
  });
  it.each([
    ["1000-01-01", "0999-12-30", "1000-01-01"],
    ["1000-01-06", "1000-01-06", "1000-01-07"],
    ["2026-10-24", "2026-10-19", "2026-10-24"],
  ])("normalizes valid ?week=%s and preserves selected dates at the supported year boundary", async (week, monday, selected) => {
    router.query = { format: "tuesday-trends", week, dates: selected, card: "rates" };
    render(<SocialShare format="tuesday-trends" asOf="2026-10-24T19:00:00Z" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const apiCalls = fetchMock.mock.calls.filter(([url]) => String(url).startsWith("/api/v1/social-share/"));
    expect(apiCalls).toHaveLength(1);
    expect(String(apiCalls[0][0])).toBe(`/api/v1/social-share/tuesday-trends?weekStart=${monday}&selectedDates=${selected}`);
    expect((screen.getByLabelText(/^Week of/) as HTMLInputElement).value).toBe(monday);
    expect((screen.getByRole("combobox", { name: /^Graphic/ }) as HTMLSelectElement).value).toBe("rates");
  });
});

describe("week input (REL-SS1-LOW-YEAR-R1)", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockImplementation(async (url: string) => {
      const query = new URL(url, "http://localhost").searchParams;
      const body = buildBlockedSnapshot({ format: "tuesday-trends", weekStart: query.get("weekStart")!, generatedAt: "2026-10-24T19:00:00Z", ...TUESDAY_NOT_CONNECTED });
      return { ok: true, status: 200, json: async () => body } as unknown as Response;
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
    Object.defineProperty(document, "fonts", { configurable: true, value: { load: async () => [], check: () => false } });
    router.query = { format: "tuesday-trends" }; router.replace = vi.fn(async () => true);
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it("ignores a typed year 0000–0999 (keeps the current week, no request), and still accepts the year-1000 boundary", async () => {
    render(<SocialShare format="tuesday-trends" asOf="2026-10-24T19:00:00Z" />);
    const input = screen.getByLabelText(/^Week of/) as HTMLInputElement;
    await waitFor(() => expect(input.disabled).toBe(false));
    const calls = () => fetchMock.mock.calls.filter(([url]) => String(url).startsWith("/api/v1/social-share/")).length, before = calls();
    for (const low of ["0000-01-03", "0999-12-31", "0099-02-30"]) {
      expect(() => fireEvent.change(input, { target: { value: low } })).not.toThrow();
      expect(input.value).toBe("2026-10-19");
    }
    expect(calls()).toBe(before);
    fireEvent.change(input, { target: { value: "1000-01-07" } });
    await waitFor(() => expect(input.value).toBe("1000-01-06"));
    expect(calls()).toBe(before + 1);
  });
});

describe("role chips (C7 SS1-15-F4)", () => {
  const skater = (line: string | null, ppUnit: string | null) => ({ kind: "skater" as const, games: 5, through: "2026-10-24", goals: 0, assists: 0, points: 0, shots: 0, hitsPerGame: 0, blocksPerGame: 0, toiSeconds: 900, ppPoints: 0,
    line: line as "L1" | null, ppUnit: ppUnit as "PP1" | null, toiSeasonSeconds: 900 });
  it("shows PP1/PP2 only: the writer's unit 3 (incidental PP time) and an unknown unit get no PP chip (TT-4)", () => {
    expect(roleChipList(skater("L1", "PP1"))).toEqual([{ role: "L1", tone: "green" }, { role: "PP1", tone: "green" }]);
    expect(roleChipList(skater("L3", "PP2"))).toEqual([{ role: "L3", tone: "orange" }, { role: "PP2", tone: "yellow" }]);
    expect(roleChipList(skater("L4", "PP3"))).toEqual([{ role: "L4", tone: "red" }]);
    expect(roleChipList(skater("P1", null))).toEqual([{ role: "P1", tone: "green" }]);
    expect(roleChipList(skater(null, null))).toEqual([]);
    expect(roleChipList(null)).toEqual([]);
  });
});

/** A live-shaped Tuesday edition: fictional schedule plus a trend layer built from fixture rows (OFFLINE FIXTURE). */
function tuesdayEdition(weekStart: string, selected?: string[]): SocialShareSnapshot {
  const generatedAt = new Date().toISOString(), snapshot = buildScheduleSnapshot({ format: "tuesday-trends", weekStart, selectedDates: selected, generatedAt, schedule: fictionalLeagueWeek(weekStart, generatedAt) });
  const season = snapshot.games[0].season, today = localDate(generatedAt, "America/New_York");
  return { ...snapshot, trends: buildTrendLayer(fictionalTrendSources(season, today, new Date(Date.now() - 4 * 3600000).toISOString()), { season, fetchedAt: generatedAt, generatedAt }) };
}

describe("Tuesday trend edition (lane TT)", () => {
  const fetchMock = vi.fn(), week = calendarWeekStart(new Date(Date.now() + 7 * 86400000).toISOString()), days = weekDates(week).slice(1, 4);
  const apiCalls = () => fetchMock.mock.calls.filter(([url]) => String(url).startsWith("/api/v1/social-share/"));
  beforeEach(() => {
    fetchMock.mockReset(); auth.user = { id: "social-editor" };
    fetchMock.mockImplementation(async (url: string) => {
      const query = new URL(url, "http://localhost").searchParams, selected = query.get("selectedDates");
      return { ok: true, status: 200, json: async () => tuesdayEdition(query.get("weekStart")!, selected === null ? undefined : selected.split(",")) } as unknown as Response;
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
    Object.defineProperty(document, "fonts", { configurable: true, value: { load: async () => [{}], check: () => true } });
    router.query = { format: "tuesday-trends", week, dates: days.join(","), card: "deployment" }; router.replace = vi.fn(async () => true);
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it("keeps week, days and card in the URL, restores them on remount without a refetch, and refetches for another account", async () => {
    const first = render(<SocialShare format="tuesday-trends" asOf={new Date().toISOString()} />);
    await waitFor(() => expect(screen.getByTestId("share-square").textContent).toContain("DEPLOYMENT CHANGES"));
    expect(String(apiCalls()[0][0])).toBe(`/api/v1/social-share/tuesday-trends?weekStart=${week}&selectedDates=${encodeURIComponent(days.join(","))}`);
    for (const [target] of (router.replace as ReturnType<typeof vi.fn>).mock.calls) expect((target as { query: Record<string, string> }).query).toMatchObject({ week, dates: days.join(","), card: "deployment" });
    first.unmount();
    const second = render(<SocialShare format="tuesday-trends" asOf={new Date().toISOString()} />);
    expect((screen.getByRole("combobox", { name: /^Graphic/ }) as HTMLSelectElement).value).toBe("deployment");
    expect(apiCalls()).toHaveLength(1);
    second.unmount();
    // Another signed-in account never sees the first account's remembered edition.
    auth.user = { id: "other-editor" };
    render(<SocialShare format="tuesday-trends" asOf={new Date().toISOString()} />);
    await waitFor(() => expect(apiCalls()).toHaveLength(2));
  });

  it("stamps the square with the snapshot/card/days token the PNG export checks", async () => {
    render(<SocialShare format="tuesday-trends" asOf={new Date().toISOString()} />);
    const square = await screen.findByTestId("share-square");
    await waitFor(() => expect(square.textContent).toContain("USAGE UP"));
    const token = square.getAttribute("data-export-token")!;
    expect(token.split("|")).toEqual([expect.any(String), "deployment", days.join(",")]);
    fireEvent.change(screen.getByRole("combobox", { name: /^Graphic/ }), { target: { value: "movers" } });
    await waitFor(() => expect(screen.getByTestId("share-square").getAttribute("data-export-token")).toBe(token.replace("|deployment|", "|movers|")));
    expect(screen.getByTestId("share-square").textContent).toContain("pct pts = percentage-point change in Yahoo rostered %");
    // The only add/drop wording is the disclaimer that this card is not add/drop counts.
    expect(screen.getByTestId("share-square").textContent!.replace("not add/drop counts", "").replace("not adds/drops", "")).not.toMatch(/add|drop/i);
  });

  it("labels every section with its definition and the movers card in points, never adds or drops", () => {
    expect(trendDefinitions.hot.join(" ")).toMatch(/^Hot\/Cold \(recent-form-v1-early\): P\/GP last 5 appearances vs the 5 before.*All 10 this season · last game ≤ 7 days · Early season · small sample$/);
    expect(trendDefinitions.rates.join(" ")).toMatch(/Min 50 L5 min/);
    expect(trendDefinitions.movers.join(" ")).toMatch(/^pct pts = percentage-point change.*No observation ≠ 0% · not add\/drop counts$/);
    const snapshot = tuesdayEdition(week);
    expect(trendExportToken(snapshot, "hot")).toBe(`${snapshot.id}|hot|${snapshot.selectedDates.join(",")}`);
  });

  it("refuses a capture whose preview token no longer matches the clicked edition; untokened (Monday) exports are unchanged", () => {
    const node = document.createElement("div");
    node.setAttribute("data-export-token", "edition-1|hot|2026-11-03");
    expect(() => assertToken(node, { token: "edition-1|hot|2026-11-03" })).not.toThrow();
    expect(() => assertToken(node, { token: "edition-2|hot|2026-11-03" })).toThrow("The preview changed after Download was clicked. Download again.");
    expect(() => assertToken(node, {})).not.toThrow();
  });

  it("shows rostered % beside every name (— when missing, never 0%), the gold glow, and the latest line/PP chips (TT-10, TT-16)", () => {
    const who = { nhlId: 1, name: "A", team: "TOR", position: "C" };
    expect([rosteredText({ ...who, rostered: 45 }), rosteredText({ ...who, rostered: 3.4 }), rosteredText({ ...who, rostered: null }), rosteredText(who)]).toEqual(["45%", "3.4%", "—", null]);
    // TT-16: gold glow under 50% rostered, full at 25% or less; none when missing or not computed.
    expect([50, 49, 37.5, 25, 3, 100].map(rostered => goldGlow({ ...who, rostered }))).toEqual([0, 0.04, 0.5, 1, 1, 0]);
    expect([goldGlow({ ...who, rostered: null }), goldGlow(who)]).toEqual([0, 0]);
    const chips = (line: string | null, pp: 1 | 2 | 3 | "none" | null) => tileRoleChips({ ...who, role: { line, pp } }).map(chip => chip.text);
    expect(chips("L1", 1)).toEqual(["L1", "PP1"]);
    expect(chips(null, null)).toEqual(["PP ?"]);
    expect(chips("P2", "none")).toEqual(["P2", "off PP"]);
    expect(chips("L3", 3)).toEqual(["L3", "off PP"]);
    expect(tileRoleChips(who)).toEqual([]);
  });

  it("shows PP ? for an unknown unit and off PP only with game evidence, never no PP", () => {
    expect([ppChip(null), ppChip("none"), ppChip(2)]).toEqual(["PP ?", "off PP", "PP2"]);
    const row = (change: Partial<ShareDeploymentRow>): ShareDeploymentRow => ({ nhlId: 1, name: "A", team: "TOR", position: "C", lastGame: "2026-10-26", toi: { l5: 1000, season: 1000 }, ev: { l5: null, season: null }, pp: { l5: null, season: null },
      delta: 0, driver: "role", line: { now: "L2", before: "L2" }, ppUnit: { now: null, before: 1 }, teamChange: false, lineChange: 0, ppChange: 0, ...change });
    expect(deploymentBadges(row({}))).toEqual([{ text: "L2", tone: "flat" }, { text: "PP ?", tone: "flat" }]);
    expect(deploymentBadges(row({ line: { now: "L1", before: "L3" }, lineChange: 1, ppUnit: { now: "none", before: 1 }, ppChange: -1 }))).toEqual([{ text: "▲ L3 → L1", tone: "up" }, { text: "▼ PP1 → off PP", tone: "down" }]);
    expect(deploymentBadges(row({ teamChange: true, line: { now: "L1", before: null } })).map(badge => badge.text)).toEqual(["NEW TEAM", "L1", "PP ?"]);
    for (const state of [null, "none", 1, 2, 3] as const) expect(ppChip(state)).not.toMatch(/no PP/i);
    // Two PP units only (TT-4): a stored unit 3 reads "off PP", and a 3 ↔ off PP "change" shows no change chip.
    expect(ppChip(3)).toBe("off PP");
    expect(deploymentBadges(row({ ppUnit: { now: "none", before: 3 }, ppChange: -1 }))).toEqual([{ text: "L2", tone: "flat" }, { text: "off PP", tone: "flat" }]);
    expect(deploymentBadges(row({ ppUnit: { now: 3, before: 1 }, ppChange: -1 })).at(-1)).toEqual({ text: "▼ PP1 → off PP", tone: "down" });
    // Role-only heroes name the role direction, never a TOI number (TT-3).
    expect(roleHero(row({ lineChange: 1 }))).toBe("▲ LINE");
    expect(roleHero(row({ lineChange: -1, ppChange: -1 }))).toBe("▼ LINE + PP");
  });

  it("tiles take the hero's sign as their accent and draw sparklines with gaps, never interpolated (TT-4)", async () => {
    expect([toneOf(1.4), toneOf(-0.2), toneOf(0), toneOf(null)]).toEqual(["up", "down", "flat", "flat"]);
    const { container } = render(<Sparkline values={[1, null, 3, 2, null]} split={3} what="test" width={100} height={30} />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("data-sparkline")).toBe("1,gap,3,2,gap");
    expect(svg.querySelectorAll("[data-gap]")).toHaveLength(2);
    // TT-16: each gap also gets a faint dotted column, so it reads as "no data" rather than a clipped line.
    expect(svg.querySelectorAll("[data-gap-column]")).toHaveLength(2);
    // Runs break at gaps: [1] alone has no line; [3,2] is one segment.
    expect([...svg.querySelectorAll("path:not([data-gap])")].map(path => path.getAttribute("d")!.split("L").length)).toEqual([1, 2, 2]);
    expect(render(<Sparkline values={[null, null]} what="none" width={100} height={30} />).container.querySelector("svg")).toBeNull();
    expect(render(<Sparkline values={null} what="none" width={100} height={30} />).container.querySelector("svg")).toBeNull();
    // A rendered Tuesday tile's tone is the sign of its hero.
    render(<SocialShare format="tuesday-trends" asOf={new Date().toISOString()} />);
    await waitFor(() => expect(document.querySelectorAll("[data-player][data-tone]").length).toBeGreaterThan(0));
    for (const tile of document.querySelectorAll("[data-player][data-tone]")) {
      const hero = tile.querySelector("span[data-tone] > strong")!.textContent!;
      expect(tile.getAttribute("data-tone")).toBe(/^[+▲]/.test(hero) ? "up" : /^[−▼]/.test(hero) ? "down" : "flat");
    }
  });

  it("movers use Transaction Trends' sparkline only for a complete daily series; a gap means no line (TT-5)", () => {
    const dates = ["2026-10-21", "2026-10-22", "2026-10-23"];
    expect(moverSparkPoints([10, 12, 15], dates)).toEqual([{ date: "2026-10-21", value: 10 }, { date: "2026-10-22", value: 12 }, { date: "2026-10-23", value: 15 }]);
    expect(moverSparkPoints([10, null, 15], dates)).toBeNull();
    expect(moverSparkPoints([10, 12], dates)).toBeNull();
    expect(moverSparkPoints(null, dates)).toBeNull();
    expect(NEON).toEqual({ up: "#00ff99", down: "#ff6b6b", flat: "#63d2f5" });
    expect([...OUTLINE_FALLBACK_TEAMS].every(team => /^[A-Z]{3}$/.test(team))).toBe(true);
  });

  it("shows whole-number Yahoo rostered % without a decimal, and keeps one only when the source has decimals (TT-3)", () => {
    expect(moverDigits([{ latest: 45, previous: 28 }, { latest: 31, previous: 44 }])).toBe(0);
    expect(moverDigits([{ latest: 45.5, previous: 28 }])).toBe(1);
  });
});
