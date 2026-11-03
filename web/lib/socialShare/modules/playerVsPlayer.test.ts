import { cleanup, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import PlayerVsPlayerCard from "components/SocialShare/modules/PlayerVsPlayerCard";
import { parseShareSettings, sharePostExportBlock, type AnyShareModule, type SharePostSnapshot } from "./contract";
import shippedCandidates from "./playerVsPlayer.candidates.json";
import { buildPlayerVsPlayer, claimsForPair, comparePlayerWindows, joinNst, NO_CONSENSUS, playerVsPlayerModule, playerWindow, pvpAltText, pvpBarShares, pvpHasRows, pvpLegend, summarizeDiscussion, validateCandidate, validateCandidateFile, type CandidateRecord, type PlayerVsPlayerData, type PlayerVsPlayerSettings, type PvpNstRow, type PvpStrength, type PvpTeamCoverage } from "./playerVsPlayer";
import type { SkaterAppearance } from "./shared/skaterAppearances";

const entry = playerVsPlayerModule as AnyShareModule;
/* Every URL, id and claim below is fictional; the shipped candidate file holds none of them. */
const A = 9000001, B = 9000002;
const claimInput = (over: Record<string, unknown> = {}) => ({ id: "fake-1", players: [{ id: A, name: "Alpha Fake" }, { id: B, name: "Beta Fake" }], url: "https://www.reddit.com/r/fake/comments/fake1", date: "2026-10-20", platform: "reddit", claimKind: "paraphrased", claim: "Fictional poster prefers Alpha.", favorsPlayerId: A, selectionRationale: "Fictional thread asked this exact question.", limitations: "One fictional thread.", ...over });
const claim = (over: Record<string, unknown> = {}) => validateCandidate(claimInput(over)).record as CandidateRecord;
const game = (playerId: number, index: number, over: Partial<SkaterAppearance> = {}): SkaterAppearance => ({ playerId, name: playerId === A ? "Alpha Fake" : "Beta Fake", position: "C", group: "F", gameId: 100 + index, date: `2026-10-${String(index + 1).padStart(2, "0")}`, team: "NJD", opponent: "NYR", home: true, goals: 1, assists: 0, points: 1, shots: 3, hits: 1, blocks: 1, ppPoints: 0, toiSeconds: 1200, ppToiSeconds: 120, penaltyMinutes: 0, ...over });
const games = (playerId: number, count: number, over: Partial<SkaterAppearance> = {}) => Array.from({ length: count }, (_, index) => game(playerId, index, over));
const nstFor = (rows: readonly SkaterAppearance[]): PvpNstRow[] => rows.map(row => ({ player_id: row.playerId, date_scraped: row.date, gp: 1, ixg: 0.5, iscfs: 2 }));
const settings = (over: Partial<PlayerVsPlayerSettings> = {}): PlayerVsPlayerSettings => ({ pair: "manual", playerA: A, playerB: B, window: "l10", basis: "per-game", strength: "all", minCoverage: 90, ...over });
/** One team's scheduled nights, from Oct 1, each with whether its result is reported. */
const nights = (count: number, late: number[] = []) => Array.from({ length: count }, (_, index) => ({ date: `2026-10-${String(index + 1).padStart(2, "0")}`, completed: !late.includes(index) }));
const build = (input: { settings?: PlayerVsPlayerSettings; appearances?: SkaterAppearance[]; nst?: PvpNstRow[] | null; candidates?: unknown; coverage?: PvpTeamCoverage[] } = {}) => {
  const appearances = input.appearances ?? [...games(A, 10), ...games(B, 10, { goals: 0, points: 0 })];
  return buildPlayerVsPlayer({ settings: input.settings ?? settings(), season: 20262027, through: "2026-10-30", today: "2026-10-31", appearances, nst: input.nst === undefined ? nstFor(appearances) : input.nst, teamCoverage: input.coverage ?? [{ team: "NJD", games: nights(10) }], candidates: input.candidates ?? { candidates: [] } });
};
const windowOf = (playerId: number, count: number, strength: PvpStrength = "all", basis: "per-game" | "total" | "per-60" = "per-game", windowId: "l5" | "l10" | "std" = "l10") => playerWindow(playerId, joinNst(games(playerId, count), nstFor(games(playerId, count))), { windowId, basis, strength });

describe("candidate schema (5.1)", () => {
  it("ships a valid file with no invented candidates", () => {
    expect(shippedCandidates.candidates).toEqual([]);
    expect(validateCandidateFile(shippedCandidates).refused).toEqual([]);
  });
  it("refuses a record with no URL or no date: no URL means no claim", () => {
    expect(validateCandidate(claimInput({ url: "" })).reasons).toContain("Missing URL.");
    expect(validateCandidate(claimInput({ url: undefined })).record).toBeNull();
    expect(validateCandidate(claimInput({ date: "" })).reasons).toContain("Missing date.");
    expect(validateCandidate(claimInput({ date: "2026-02-31" })).reasons).toContain("Date must be YYYY-MM-DD.");
  });
  it("refuses a URL off the stated platform, a future date and a missing rationale or limitation", () => {
    expect(validateCandidate(claimInput({ url: "https://example.com/post" })).record).toBeNull();
    expect(validateCandidate(claimInput({ url: "https://notreddit.com/post" })).record).toBeNull();
    expect(validateCandidate(claimInput({ url: "http://www.reddit.com/r/fake" })).record).toBeNull();
    expect(validateCandidate(claimInput({ url: `https://www.reddit.com/r/fake/${"a".repeat(200)}` })).reasons).toContain("URL is over 200 characters.");
    expect(validateCandidate(claimInput({ platform: "x", url: "https://x.com/fake/status/1" })).record?.platform).toBe("x");
    expect(validateCandidate(claimInput({ date: "2026-11-02" }), "2026-10-31").reasons).toContain("Date is in the future.");
    expect(validateCandidate(claimInput({ selectionRationale: " " })).reasons).toContain("Missing selection rationale.");
    expect(validateCandidate(claimInput({ limitations: "" })).reasons).toContain("Missing limitations.");
  });
  it("keeps quoted and paraphrased labeled and refuses neither", () => {
    expect(validateCandidate(claimInput({ claimKind: "quoted" })).record?.claimKind).toBe("quoted");
    expect(validateCandidate(claimInput({ claimKind: "paraphrased" })).record?.claimKind).toBe("paraphrased");
    expect(validateCandidate(claimInput({ claimKind: undefined })).reasons).toContain("Claim must be labeled quoted or paraphrased.");
  });
  it("refuses a side that is not one of the pair, a repeated player and a duplicate id", () => {
    expect(validateCandidate(claimInput({ favorsPlayerId: 5 })).record).toBeNull();
    expect(validateCandidate(claimInput({ favorsPlayerId: undefined })).record).toBeNull();
    expect(validateCandidate(claimInput({ favorsPlayerId: null })).record?.favorsPlayerId).toBeNull();
    expect(validateCandidate(claimInput({ players: [{ id: A, name: "Alpha Fake" }, { id: A, name: "Alpha Fake" }], favorsPlayerId: null })).record).toBeNull();
    const file = validateCandidateFile({ candidates: [claimInput(), claimInput(), { id: "bad" }] });
    expect(file.accepted).toHaveLength(1);
    expect(file.refused.map(entry => entry.id)).toEqual(["fake-1", "bad"]);
    expect(validateCandidateFile({}).refused).toHaveLength(1);
  });
  it("matches a pair in either player order, newest first", () => {
    const flipped = claim({ id: "fake-2", date: "2026-10-25", players: [{ id: B, name: "Beta Fake" }, { id: A, name: "Alpha Fake" }] });
    const other = claim({ id: "fake-3", players: [{ id: A, name: "Alpha Fake" }, { id: 9000003, name: "Gamma Fake" }] });
    expect(claimsForPair([claim(), flipped, other], B, A).map(record => record.id)).toEqual(["fake-2", "fake-1"]);
  });
});

describe("comparable windows (5.2)", () => {
  it("refuses a different strength, basis or window", () => {
    expect(comparePlayerWindows(windowOf(A, 10, "all"), windowOf(B, 10, "pp"), 90)).toEqual({ ok: false, reason: expect.stringMatching(/Refused: All situations .* Power play/) });
    expect(comparePlayerWindows(windowOf(A, 10, "all", "total"), windowOf(B, 10, "all", "per-60"), 90).ok).toBe(false);
    expect(comparePlayerWindows(windowOf(A, 10, "all", "total", "l5"), windowOf(B, 10, "all", "total", "l10"), 90).ok).toBe(false);
  });
  it("discloses differing samples and does not compare totals across them", () => {
    const result = comparePlayerWindows(windowOf(A, 10, "all", "total"), windowOf(B, 6, "all", "total"), 90);
    if (!result.ok) throw new Error(result.reason);
    expect(result.notes[0]).toMatch(/Samples differ: Alpha Fake 10, Beta Fake 6 appearances\. Totals are shown but not compared\./);
    expect(result.metrics.every(row => row.higher === null)).toBe(true);
    expect(result.metrics.find(row => row.id === "goals")).toMatchObject({ a: { shown: "10" }, b: { shown: "6" } });
  });
  it("still compares a rate across differing samples, and prints the short sample", () => {
    const result = build({ appearances: [...games(A, 10), ...games(B, 6, { goals: 2 })] });
    expect(result.data?.a).toMatchObject({ appearances: 10, short: false });
    expect(result.data?.b).toMatchObject({ appearances: 6, requested: 10, short: true });
    expect(result.data?.metrics.find(row => row.id === "goals")).toMatchObject({ higher: "b", a: { shown: "1.00" }, b: { shown: "2.00" } });
    expect(result.evidence.sample).toContain("Beta Fake 6 of 10 appearances");
  });
  it("pools per 60 from summed parts on that strength's own time", () => {
    const pp = build({ settings: settings({ strength: "pp", basis: "per-60" }), nst: [], appearances: [game(A, 0, { ppPoints: 1, ppToiSeconds: 60 }), game(A, 1, { ppPoints: 0, ppToiSeconds: 300 }), game(B, 0)] });
    expect(pp.data?.metrics.map(row => row.id)).toEqual(["ppPoints"]);
    expect(pp.data?.metrics[0].a.value).toBeCloseTo(10);
    expect(build({ settings: settings({ basis: "per-60" }) }).data?.metrics.some(row => row.id === "toi")).toBe(false);
  });
  it("keeps one strength per view, so power-play stats never sit in the all-situations table", () => {
    const ids = build().data?.metrics.map(row => row.id);
    expect(ids).toContain("ixg");
    expect(ids).not.toContain("ppPoints");
    expect(build({ settings: settings({ strength: "pp" }) }).data?.metrics.map(row => row.id)).toEqual(["ppPoints", "ppToi"]);
  });
  it("leaves an NST metric unranked below minimum coverage, with its count, never zero-filled", () => {
    const appearances = [...games(A, 10), ...games(B, 10)];
    const nst = [...nstFor(games(A, 10)), ...nstFor(games(B, 8))];
    const result = build({ appearances, nst });
    const ixg = result.data?.metrics.find(row => row.id === "ixg");
    expect(ixg).toMatchObject({ higher: null, b: { value: null, shown: "—", observed: 8, expected: 10, missing: 2, admitted: false }, a: { admitted: true } });
    expect(result.data?.notes.join(" ")).toContain("Beta Fake 8 of 10, 2 missing");
    expect(result.evidence.cohort).toContain("Beta Fake 8 of 10, 2 missing");
    expect(build({ appearances, nst, settings: settings({ minCoverage: 80 }) }).data?.metrics.find(row => row.id === "ixg")?.b.admitted).toBe(true);
  });
  it("joins nothing on a repeated NST date, and a null stat is missing, not zero", () => {
    const [joined] = joinNst([game(A, 0)], [{ player_id: A, date_scraped: "2026-10-01", gp: 1, ixg: 1, iscfs: 1 }, { player_id: A, date_scraped: "2026-10-01", gp: 1, ixg: 2, iscfs: 2 }]);
    expect(joined.ixg).toBeNull();
    const result = build({ appearances: [game(A, 0, { hits: null }), game(A, 1, { hits: 3 }), game(B, 0)] });
    expect(result.state).toBe("partial");
    expect(result.data?.metrics.find(row => row.id === "hits")?.a).toMatchObject({ value: 3, observed: 1, missing: 1 });
    expect(result.data?.metrics.find(row => row.id === "bsh")?.a).toMatchObject({ observed: 1, missing: 1 });
  });
  it("discloses mixed positions and a traded player's teams", () => {
    const notes = build({ appearances: [game(A, 0), game(A, 1, { team: "NYI" }), game(B, 0, { group: "D", position: "D" })] }).data?.notes.join(" ");
    expect(notes).toContain("Different positions");
    expect(notes).toContain("Alpha Fake played for NJD and NYI");
  });
  it("is blocked without two players and validates its settings", () => {
    expect(build({ settings: settings({ playerB: null }), appearances: [], nst: [] })).toMatchObject({ state: "blocked", data: null });
    expect(parseShareSettings(entry, {})).toMatchObject({ pair: "manual", playerA: null, window: "l10", basis: "per-game", strength: "all", minCoverage: 90 });
    expect(() => parseShareSettings(entry, { playerA: "5", playerB: "5" })).toThrow("different players");
    expect(() => parseShareSettings(entry, { strength: "ev" })).toThrow("Invalid value");
    expect(() => parseShareSettings(entry, { sentiment: "1" })).toThrow("Invalid query");
  });
  it("is partial and cannot export when a team's results lag, a source fails or a record is refused", () => {
    expect(build({ coverage: [{ team: "NJD", games: [...nights(10), { date: "2026-10-05", completed: false }] }] })).toMatchObject({ state: "partial", reasons: [expect.stringContaining("1 of 11")] });
    expect(build({ nst: null })).toMatchObject({ state: "partial", reasons: ["Natural Stat Trick game logs could not be read."] });
    expect(build({ candidates: { candidates: [claimInput({ url: "" })] } })).toMatchObject({ state: "partial", reasons: ["Candidate records refused: fake-1."] });
  });
});

describe("late newest night (TJ, 2026-11-03)", () => {
  /* Both players play Oct 1 to 11; Beta's team's Oct 11 result is not reported yet. */
  const appearances = [...games(A, 11), ...games(B, 11, { team: "NYI" })];
  const coverage = (lateNyi: number[]): PvpTeamCoverage[] => [{ team: "NJD", games: nights(11) }, { team: "NYI", games: nights(11, lateNyi) }];

  it("ends the card the night before a late newest night, stays ready, and says so on the page", () => {
    const result = build({ appearances, coverage: coverage([10]) });
    expect(result).toMatchObject({ state: "ready", reasons: [], pageNotes: ["Oct 11 is not fully reported yet, so this card ends Oct 10."] });
    expect(result.data).toMatchObject({ through: "2026-10-10", a: { appearances: 10, lastDate: "2026-10-10" }, b: { appearances: 10, lastDate: "2026-10-10" } });
    expect(result.evidence.coverage).toEqual({ observed: 20, expected: 20, missing: 0, unit: "team games" });
    expect(result.evidence.sources[0].asOf).toBe("2026-10-10");
  });
  it("cuts several late newest nights", () => {
    expect(build({ appearances, coverage: coverage([9, 10]) })).toMatchObject({ state: "ready", data: { through: "2026-10-09" }, pageNotes: ["Oct 10 and Oct 11 are not fully reported yet, so this card ends Oct 9."] });
  });
  it("keeps an older gap partial, with the per-team reason, even when the newest night is also late", () => {
    const result = build({ appearances, coverage: coverage([4, 10]) });
    expect(result).toMatchObject({ state: "partial", reasons: ["NYI: 1 of 10 scheduled games have no reported result."], data: { through: "2026-10-10" } });
    expect(build({ appearances, coverage: coverage([4]) })).toMatchObject({ state: "partial", reasons: ["NYI: 1 of 11 scheduled games have no reported result."] });
  });
  it("has no page note when every night is reported", () => {
    const result = build({ appearances, coverage: coverage([]) });
    expect(result).toMatchObject({ state: "ready", data: { through: "2026-10-30" } });
    expect(result.pageNotes).toBeUndefined();
  });
  it("is unavailable when no night is complete", () => {
    expect(build({ appearances, coverage: [{ team: "NYI", games: nights(11, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) }] })).toMatchObject({ state: "blocked", data: null, reasons: ["No night in this window is fully reported yet."] });
  });
});

describe("discussion states (5.3)", () => {
  const conflicting = [claim(), claim({ id: "fake-2", favorsPlayerId: B, date: "2026-10-21" })];
  const cases: [string, CandidateRecord[], string][] = [["empty", [], "empty"], ["one post", [claim()], "one-sided"], ["one-sided", [claim(), claim({ id: "fake-2" })], "one-sided"], ["conflicting", conflicting, "conflicting"], ["no side", [claim({ favorsPlayerId: null })], "no-side"]];
  it.each(cases)("%s prints no consensus, with no count or share", (_, claims, kind) => {
    const summary = summarizeDiscussion(claims);
    expect(summary).toMatchObject({ headline: NO_CONSENSUS, kind });
    expect(`${summary.headline} ${summary.note} ${summary.caveat ?? ""}`).not.toMatch(/\d|%|majority|most |market says/i);
  });
  it("adds no tally to the evidence, and never labels the post a market observation", () => {
    const result = build({ candidates: { candidates: [claimInput(), claimInput({ id: "fake-2", favorsPlayerId: B })] } });
    expect(result.evidence.sample).not.toMatch(/post|claim/i);
    expect(result.evidence.sources.at(-1)).toMatchObject({ name: "Reviewed discussion posts", asOf: "2026-10-20" });
    expect(entry.basis).toBe("observed");
  });
  it("keeps both sides when the card has to trim", () => {
    const shown = summarizeDiscussion(claimsForPair([claim({ id: "a1", date: "2026-10-23" }), claim({ id: "a2", date: "2026-10-22" }), claim({ id: "a3", date: "2026-10-21" }), claim({ id: "b1", favorsPlayerId: B, date: "2026-10-01" })], A, B)).shown;
    expect(shown.map(record => record.id)).toEqual(["a1", "b1"]);
  });
  it("is exportable with no discussion, because the stats stand and it says none exists", () => {
    const result = build();
    expect(result.state).toBe("ready");
    expect(result.data?.discussion).toMatchObject({ headline: NO_CONSENSUS, kind: "empty", caveat: null });
    expect(result.data?.selection.sourced).toBe(false);
  });
  it("ties on the printed value", () => {
    const result = build({ appearances: [...games(A, 3, { shots: 1 }), ...games(B, 3, { shots: 1 })] });
    expect(result.data?.metrics.find(row => row.id === "shots")?.higher).toBe("tie");
  });
});

describe("card and alt text (5.4)", () => {
  afterEach(cleanup);
  const candidates = { candidates: [claimInput({ claimKind: "quoted", claim: "Fictional quote." }), claimInput({ id: "fake-2", platform: "x", url: "https://x.com/fake/status/2", favorsPlayerId: B, date: "2026-10-21" }), claimInput({ id: "fake-3", url: "https://www.reddit.com/r/fake/comments/fake3", date: "2026-10-05" })] };
  const snapshotOf = (data: PlayerVsPlayerData, current: PlayerVsPlayerSettings) => ({ schemaVersion: 1, id: "x", post: "player-vs-player", state: "ready", reasons: [], generatedAt: "2026-10-31T12:00:00Z", expiresAt: "2026-10-31T12:15:00Z", timeZone: "America/New_York", settings: current, evidence: { sources: [{ name: "x", tables: [], state: "ready", asOf: null, updatedAt: null }], sample: "s", strength: "s", cohort: "c", coverage: null }, data, teams: [], fixture: false } as unknown as SharePostSnapshot<PlayerVsPlayerSettings, PlayerVsPlayerData>);
  const show = (data: PlayerVsPlayerData, current = settings()) => render(createElement(PlayerVsPlayerCard, { snapshot: snapshotOf(data, current), data, settings: current, logos: {} }));

  it("prints the headline, labels and URLs, and keeps quoted apart from paraphrased", () => {
    const data = build({ candidates }).data!;
    show(data);
    expect(screen.getByTestId("pvp-discussion").dataset.kind).toBe("conflicting");
    expect(screen.getByRole("heading", { name: NO_CONSENSUS })).toBeTruthy();
    expect(screen.getByText("“Fictional quote.”")).toBeTruthy();
    expect(screen.getByText(/Reddit · 2026-10-20 · Quoted/)).toBeTruthy();
    expect(screen.getByText(/X · 2026-10-21 · Paraphrased/)).toBeTruthy();
    expect(screen.getByText("https://x.com/fake/status/2")).toBeTruthy();
    expect(screen.getByTestId("pvp-legend").textContent).toBe("Bright = higher. Hand-picked posts, not a market price or a poll.");
  });
  it("marks the higher side, and marks nothing on totals over differing samples", () => {
    const { unmount } = show(build({ appearances: [...games(A, 10), ...games(B, 10, { goals: 0 })] }).data!);
    expect(screen.getByTestId("pvp-stats").querySelectorAll("[data-higher]").length).toBeGreaterThan(0);
    unmount();
    const current = settings({ basis: "total" }), data = build({ settings: current, appearances: [...games(A, 10), ...games(B, 6)] }).data!;
    show(data, current);
    expect(screen.getByTestId("pvp-stats").querySelectorAll("[data-higher]").length).toBe(0);
    expect(pvpLegend(data)).toBe("Totals not compared: samples differ. No posts on file.");
  });
  const metricSide = (value: number | null, shown = value === null ? "—" : String(value)) => ({ value, shown, observed: 1, expected: 1, missing: 0, admitted: true });
  it("sizes each bar by that side's share of the pair's combined value", () => {
    expect(pvpBarShares({ a: metricSide(3), b: metricSide(1), higher: "a" })).toEqual({ a: 0.75, b: 0.25 });
    expect(pvpBarShares({ a: metricSide(0.5), b: metricSide(1.5), higher: "b" })).toEqual({ a: 0.25, b: 0.75 });
  });
  it("splits a printed tie evenly, even when the unrounded values differ", () => {
    expect(pvpBarShares({ a: metricSide(1.251, "1.25"), b: metricSide(1.249, "1.25"), higher: "tie" })).toEqual({ a: 0.5, b: 0.5 });
  });
  it("gives a zero no width, on one side or both", () => {
    expect(pvpBarShares({ a: metricSide(0), b: metricSide(2), higher: "b" })).toEqual({ a: 0, b: 1 });
    expect(pvpBarShares({ a: metricSide(0), b: metricSide(0), higher: "tie" })).toEqual({ a: 0, b: 0 });
    expect(pvpBarShares({ a: metricSide(0.001, "0.00"), b: metricSide(0.002, "0.00"), higher: "tie" })).toEqual({ a: 0, b: 0 });
  });
  it("has no share for a missing value or an uncompared row", () => {
    expect(pvpBarShares({ a: metricSide(2), b: metricSide(null), higher: null })).toEqual({ a: null, b: null });
    expect(pvpBarShares({ a: metricSide(10), b: metricSide(6), higher: null })).toEqual({ a: null, b: null });
  });
  it("draws the bars from the shares and keeps every printed value", () => {
    const data = build({ appearances: [...games(A, 10, { goals: 3, assists: 0, shots: 2 }), ...games(B, 10, { goals: 1, assists: 0, shots: 2 })] }).data!;
    show(data);
    const row = (id: string) => screen.getByTestId("pvp-stats").querySelector(`[data-metric="${id}"]`) as HTMLElement;
    const bars = (id: string) => [...row(id).querySelectorAll<HTMLElement>("[data-testid=pvp-bar]")];
    const widths = (id: string) => bars(id).map(bar => parseFloat(bar.style.width));
    expect(widths("goals")).toEqual([75, 25]);
    expect(bars("goals")[0].style.backgroundColor).not.toBe(bars("goals")[1].style.backgroundColor);
    expect(row("goals").textContent).toContain("3.00");
    expect(row("goals").textContent).toContain("1.00");
    expect(widths("shots")).toEqual([50, 50]);
    expect(bars("shots")[0].style.backgroundColor).toBe(bars("shots")[1].style.backgroundColor);
    expect(widths("assists")).toEqual([0, 0]);
    expect(row("assists").textContent?.match(/0\.00/g)).toHaveLength(2);
  });
  it("shows a missing value as a marked gap with no bar on either side, never zero", () => {
    const appearances = [...games(A, 10), ...games(B, 10)];
    show(build({ appearances, nst: [...nstFor(games(A, 10)), ...nstFor(games(B, 8))] }).data!);
    const row = screen.getByTestId("pvp-stats").querySelector('[data-metric="ixg"]') as HTMLElement;
    expect(row.querySelectorAll("[data-testid=pvp-bar]")).toHaveLength(0);
    expect(row.querySelectorAll("[data-missing]")).toHaveLength(1);
    expect(row.textContent).toContain("—");
    expect(row.textContent).toContain("0.50");
  });
  it("draws no bars for totals over differing samples, which stay uncompared", () => {
    const current = settings({ basis: "total" });
    show(build({ settings: current, appearances: [...games(A, 10), ...games(B, 6)] }).data!, current);
    expect(screen.queryAllByTestId("pvp-bar")).toHaveLength(0);
  });
  it("shrinks the headline to a small line with no posts, and keeps it full with posts", () => {
    const { unmount } = show(build().data!);
    expect(screen.getByRole("heading", { name: NO_CONSENSUS }).dataset.size).toBe("small");
    unmount();
    show(build({ candidates }).data!);
    expect(screen.getByRole("heading", { name: NO_CONSENSUS }).dataset.size).toBe("full");
  });
  it("sends the disclosures to the evidence, off the card", () => {
    const result = build({ candidates, appearances: [...games(A, 10), ...games(B, 6)] });
    show(result.data!);
    expect(result.evidence.cohort).toContain("Selected because: Fictional thread");
    expect(result.evidence.cohort).toContain("The reviewed posts here disagree.");
    expect(result.evidence.cohort).toContain("Hand-picked posts. Not a market price");
    expect(result.evidence.cohort).toContain("Samples differ: Alpha Fake 10, Beta Fake 6 appearances.");
    expect(result.evidence.cohort).not.toMatch(/% of|majority/i);
    expect(screen.getByTestId("pvp-discussion").textContent).not.toMatch(/Limits|Why this pair|disagree/);
  });
  it("puts every URL, the labels and the headline in the alt text", () => {
    const data = build({ candidates }).data!;
    const alt = pvpAltText(data, "Sample line");
    for (const url of ["https://www.reddit.com/r/fake/comments/fake1", "https://x.com/fake/status/2", "https://www.reddit.com/r/fake/comments/fake3"]) expect(alt).toContain(url);
    expect(alt).toContain(NO_CONSENSUS);
    expect(alt).toContain('quoted: "Fictional quote."');
    expect(alt).toContain("paraphrased: Fictional poster");
    expect(alt).toContain("Limitations: One fictional thread.");
    expect(alt).toContain("Selected because: Fictional thread");
  });
  it("says the pair is editor-chosen when nothing is on file", () => {
    show(build().data!);
    expect(screen.getByRole("heading", { name: NO_CONSENSUS })).toBeTruthy();
    expect(screen.getByTestId("pvp-legend").textContent).toBe("Bright = higher. No posts on file.");
    expect(build().evidence.cohort).toContain("Editor-chosen pair");
    expect(pvpAltText(build().data!, "s")).toContain("Editor-chosen pair.");
  });
  it("shows why a player has no window, and does not export it", () => {
    const data = build({ appearances: games(A, 3), nst: [] }).data!;
    expect(pvpHasRows(data, settings())).toBe(false);
    show(data);
    expect(screen.getByText(/no appearance in this window/)).toBeTruthy();
  });
  it("refuses data loaded under other settings, which the shell's footer would mislabel", () => {
    const data = build().data!, changed = settings({ window: "l5" });
    expect(pvpHasRows(data, changed)).toBe(false);
    expect(sharePostExportBlock(entry, { ...snapshotOf(data, changed), expiresAt: new Date(Date.now() + 60000).toISOString() } as unknown as SharePostSnapshot, changed)).toMatch(/Nothing qualifies/);
    show(data, changed);
    expect(screen.getByText(/Refresh this post/)).toBeTruthy();
  });
  it("exports with no discussion on a ready snapshot", () => {
    const data = build().data!;
    expect(sharePostExportBlock(entry, { ...snapshotOf(data, settings()), expiresAt: new Date(Date.now() + 60000).toISOString() } as unknown as SharePostSnapshot, settings())).toBeNull();
  });
});

describe("loader", () => {
  type Query = Record<string, (...args: unknown[]) => Query> & { then: PromiseLike<unknown>["then"] };
  const client = (reads: string[], tables: Record<string, { rows?: unknown[]; fail?: boolean }>) => ({ from: (table: string) => {
    reads.push(table);
    const query = {} as Query;
    for (const method of ["select", "eq", "in", "gte", "lte", "or", "order"]) query[method] = () => query;
    let done: unknown = { data: [], error: null, count: 0 };
    query.range = (...args: unknown[]) => { const [from, to] = args as [number, number], source = tables[table] ?? {}, rows = source.rows ?? []; done = source.fail ? { data: null, error: { message: "fake failure" }, count: null } : { data: rows.slice(from, to + 1), error: null, count: rows.length }; return query; };
    query.then = ((resolve: (value: unknown) => unknown) => Promise.resolve(done).then(resolve)) as PromiseLike<unknown>["then"];
    return query;
  } });
  const wgo = (playerId: number, date: string, gameId: number) => ({ player_id: playerId, player_name: "Fake", position_code: "C", date, season_id: 20262027, game_id: gameId, team_abbrev: "NJD", opponent_team_abbrev: "NYR", home_road: "H", games_played: 1, goals: 1, assists: 0, points: 1, shots: 1, hits: 1, blocked_shots: 1, pp_points: 0, toi_per_game: 900, pp_toi: 60, penalty_minutes: 0 });
  const tables = () => ({ wgo_skater_stats: { rows: [wgo(A, "2026-10-10", 1), wgo(B, "2026-10-10", 1)] }, nst_gamelog_as_counts: { rows: [] as unknown[] }, games: { rows: [{ id: 2, date: "2026-10-08", homeTeamId: 1, awayTeamId: 3 }, { id: 1, date: "2026-10-10", homeTeamId: 1, awayTeamId: 3 }] }, wgo_team_stats: { rows: [{ team_id: 1, game_id: 1 }] } });
  const load = async () => (await import("./playerVsPlayer.sources")).loadPlayerVsPlayer;

  it("reads nothing until two players are chosen", async () => {
    const reads: string[] = [];
    const result = await (await load())({ client: client(reads, {}), generatedAt: "2026-10-31T16:00:00Z" }, settings({ playerA: null, playerB: null }));
    expect(result.state).toBe("blocked");
    expect(reads).toEqual([]);
  });
  it("reads the four sources, checks the team's schedule, and keeps a failed NST read partial", async () => {
    const reads: string[] = [];
    const result = await (await load())({ client: client(reads, { ...tables(), nst_gamelog_as_counts: { fail: true } }), generatedAt: "2026-10-31T16:00:00Z" }, settings());
    expect(new Set(reads)).toEqual(new Set(["wgo_skater_stats", "nst_gamelog_as_counts", "games", "wgo_team_stats"]));
    expect(result.state).toBe("partial");
    expect(result.reasons).toEqual(expect.arrayContaining(["NJD: 1 of 2 scheduled games have no reported result.", "Natural Stat Trick game logs could not be read."]));
    expect(result.evidence.coverage).toEqual({ observed: 1, expected: 2, missing: 1, unit: "team games" });
  });
  it("ends at the last complete night when only the newest team result is late", async () => {
    const reads: string[] = [];
    const late = { ...tables(), games: { rows: [{ id: 1, date: "2026-10-10", homeTeamId: 1, awayTeamId: 3 }, { id: 2, date: "2026-10-12", homeTeamId: 1, awayTeamId: 3 }] } };
    const result = await (await load())({ client: client(reads, late), generatedAt: "2026-10-31T16:00:00Z" }, settings());
    expect(result).toMatchObject({ state: "ready", data: { through: "2026-10-10" }, pageNotes: ["Oct 12 is not fully reported yet, so this card ends Oct 10."] });
  });
  it("does not read NST for a power-play view", async () => {
    const reads: string[] = [];
    await (await load())({ client: client(reads, tables()), generatedAt: "2026-10-31T16:00:00Z" }, settings({ strength: "pp" }));
    expect(reads).not.toContain("nst_gamelog_as_counts");
  });
});
