import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ForecastExplorer, { buildRevisionSpans } from "./ForecastExplorer";
import { CATEGORIES, available, unavailable, type HistoryEvent, type PublicGameView, type PublicPlayerView, type PublicRevision } from "../../lib/forge-v2/contracts";
import { DEFAULT_SCORING } from "../../lib/forge-v2/identity";
import { fixtureMeans, fixtureOpportunity } from "../../lib/forge-v2/fixtures";
import { getServerSideProps } from "../../pages/forge/v2";

function revision(value: number | null, index: number): PublicRevision {
  return { id: `r${index}`, sequence: index + 1, publishedAt: new Date(Date.parse("2026-01-01T12:00:00Z") + index * 60000).toISOString(),
    inputCutoffAt: "2026-01-01T11:00:00Z", horizon: 10, teamId: index < 2 ? 1 : 2, modelVersion: index < 2 ? "fixture-model-1" : "fixture-model-2",
    trigger: "daily", evidenceClass: "fixture", value: value === null ? unavailable("missing_input") : available(value), means: fixtureMeans(),
    qualified: true,
    issuedValue: value === null ? unavailable("missing_input") : available(value), issuedProfileId: DEFAULT_SCORING.id,
    participation: available(0.8), intervals: available([{ level: 0.5, lower: 3, upper: 8 }, { level: 0.9, lower: 0, upper: 12 }]),
    intervalVintageId: `r${index}`, eligiblePregame: true, artifactState: "online", limitations: ["Synthetic fixture only"] };
}
function fixtureView(values: Array<number | null> = [10, 5, 8, 6.5]): PublicPlayerView {
  const opportunity = fixtureOpportunity();
  const revisions = values.map(revision);
  const game: PublicGameView = { opportunity, profileId: DEFAULT_SCORING.id, revisions, latestRevision: revisions.at(-1) ?? null, lockedFinalRevision: revisions.at(-1) ?? null, events: [], nextCursor: null,
    lockedFinal: { state: "selected", vintageId: `r${values.length - 1}`, value: available(6.5), lockAt: opportunity.scheduledStartAt, timingStatus: "provisional", reason: null },
    actual: { revisionId: "result-1", appearance: "official_appearance", value: available(6.5), status: "corrected" },
    freshness: { state: "fresh", asOf: "2026-01-01T12:03:00Z", reason: null },
    qualification: { state: "qualified", reason: "synthetic_display_fixture_only", supportedHorizons: [10], supportedCategories: [...CATEGORIES] } };
  return { player: { id: opportunity.playerId, name: "Synthetic Skater" }, games: [game], excluded: [{ gameId: null, reason: "affiliation_unresolved" }],
    profile: DEFAULT_SCORING, scoringLabel: "as issued", methodology: "Synthetic display fixture; no real qualification or calibration.",
    accountability: { requested: 10, forecastCount: 4, outcomeCount: 1, abstentions: 6, mae: unavailable("not_evaluated"), rmse: unavailable("not_evaluated"), bias: unavailable("not_evaluated"), evidenceClass: "fixture", limitations: ["No scientific qualification"] } };
}
const players = [{ id: 9900001, name: "Synthetic Skater" }, { id: 9900002, name: "Another Skater" }];
afterEach(cleanup);

describe("FORGE revision overlap", () => {
  it("matches the approved numeric example exactly", () => {
    const rows = [10, 5, 8, 6.5].map((value, i) => ({ ...revision(value, i), value }));
    expect(buildRevisionSpans(rows, [])).toEqual([
      { lower: 5, upper: 6.5, traversals: 2, opacity: 0.4375 },
      { lower: 6.5, upper: 8, traversals: 3, opacity: 0.578125 },
      { lower: 8, upper: 10, traversals: 1, opacity: 0.25 },
    ]);
  });
  it("keeps equal revisions as markers and breaks spans across unavailable values and explicit gaps", () => {
    const rows = [10, 10, null, 5, 8].map((value, i) => ({ ...revision(value, i), value }));
    const event: HistoryEvent = { ...fixtureOpportunity(), id: "gap", at: "2026-01-01T12:03:30Z", kind: "missing_refresh", reason: "source_late", vintageId: null, predecessorId: null };
    expect(buildRevisionSpans(rows, [event])).toEqual([]);
    expect(buildRevisionSpans(rows, [])).toEqual([{ lower: 5, upper: 8, traversals: 1, opacity: 0.25 }]);
    rows[4].eligiblePregame = false;
    expect(buildRevisionSpans(rows, [])).toEqual([]);
  });
});

describe("FORGE forecast explorer", () => {
  it("keeps latest, extrema, locked-final, actual and outcome intervals distinct when values coincide", () => {
    render(<ForecastExplorer initialView={fixtureView()} players={players} />);
    expect(screen.getByText("Latest eligible revision")).toBeTruthy();
    expect(screen.getByText("Historical low / high")).toBeTruthy();
    expect(screen.getByText("Locked-final forecast · dashed line")).toBeTruthy();
    expect(screen.getByText("Actual result · diamond")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Outcome uncertainty" })).toBeTruthy();
    expect(screen.getByText("50% outcome interval: 3–8 fantasy points")).toBeTruthy();
    expect(screen.getByText("90% outcome interval: 0–12 fantasy points")).toBeTruthy();
    expect(screen.getByText("6.5–8: 3 traversals, 57.8125% opacity")).toBeTruthy();
    expect(screen.getByText("corrected")).toBeTruthy();
    expect(screen.getAllByText(/fixture-model-2/).length).toBeGreaterThan(0);
    expect(screen.getByText("4 forecasts / 10 requested opportunities · 1 outcomes · 6 abstentions.")).toBeTruthy();
  });
  it("withholds unqualified values and participation even when numeric values were supplied", () => {
    const view = fixtureView([1234]); view.games[0].qualification.state = "unqualified";
    view.games[0].revisions.forEach(r => { r.qualified = false; });
    render(<ForecastExplorer initialView={view} players={players} />);
    expect(screen.queryByText("1,234")).toBeNull();
    expect(screen.getByText(/Forecast values unavailable for this scope/)).toBeTruthy();
    expect(screen.getByText(/Participation: probability unavailable/)).toBeTruthy();
    expect(screen.queryByText(/50% outcome interval/)).toBeNull();
  });
  it.each(["nonappearance", "dressed_unused", "ambiguous", "game_not_played"] as const)("does not render %s as zero performance", appearance => {
    const view = fixtureView(); view.games[0].actual.appearance = appearance; view.games[0].actual.value = available(0);
    render(<ForecastExplorer initialView={view} players={players} />);
    const label = screen.getByText("Actual result · diamond");
    expect(label.parentElement?.textContent).toContain(appearance.replaceAll("_", " "));
    expect(label.parentElement?.textContent).not.toMatch(/diamond0/);
  });
  it("shows a credited zero outcome and pending/provisional final selection honestly", () => {
    const view = fixtureView(); view.games[0].actual.value = available(0); view.games[0].lockedFinal.state = "pending";
    render(<ForecastExplorer initialView={view} players={players} />);
    expect(screen.getByText("Actual result · diamond").parentElement?.textContent).toContain("0");
    expect(screen.getByText("Locked-final forecast · dashed line").parentElement?.textContent).toContain("Pending");
    expect(screen.getByText(/provisional lock/)).toBeTruthy();
  });
  it("selects vintage-specific intervals and exposes archive retrieval state", () => {
    const view = fixtureView(); view.games[0].revisions[0].artifactState = "retrieval_pending";
    render(<ForecastExplorer initialView={view} players={players} />);
    fireEvent.change(screen.getByLabelText("Uncertainty vintage"), { target: { value: "r0" } });
    expect(screen.getByText(/Artifact retrieval pending/)).toBeTruthy();
    expect(screen.queryByText(/50% outcome interval/)).toBeNull();
    expect(screen.getByText(/Intervals unavailable/)).toBeTruthy();
  });
  it("supports signed profile changes while retaining original scores", async () => {
    const view = fixtureView();
    const onRescore = vi.fn(async (_playerId, profile) => ({ ...structuredClone(view), profile, scoringLabel: "re-scored under selected profile" as const,
      games: view.games.map(game => {
        const revisions = game.revisions.map(r => ({ ...r, value: available(-4), intervals: unavailable("profile_not_qualified") }));
        return { ...game, profileId: profile.id, revisions, latestRevision: revisions.at(-1)!, lockedFinalRevision: revisions.at(-1)! };
      }) }));
    render(<ForecastExplorer initialView={view} players={players} onRescore={onRescore} />);
    fireEvent.change(screen.getByRole("spinbutton", { name: "G weight" }), { target: { value: "-3" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply scoring" }));
    await waitFor(() => expect(onRescore).toHaveBeenCalledOnce());
    await screen.findByText(/Re-scored under selected profile. Original issued values and grades remain unchanged/);
    expect(onRescore.mock.calls[0][1].weights.G).toBe(-3);
    expect(view.games[0].revisions[0].value).toEqual(available(10));
    const firstRow = within(screen.getByRole("table", { name: /Comparable revisions/ })).getAllByRole("row")[1];
    expect(within(firstRow).getAllByRole("cell")[0].textContent).toBe("-4");
    expect(within(firstRow).getAllByRole("cell")[1].textContent).toBe("10");
    expect(screen.getByText(/Intervals unavailable — profile not qualified/)).toBeTruthy();
  });
  it("rejects blank scoring weights and does not call the scorer", () => {
    const onRescore = vi.fn(); render(<ForecastExplorer initialView={fixtureView()} players={players} onRescore={onRescore} />);
    fireEvent.change(screen.getByRole("spinbutton", { name: "PIM weight" }), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply scoring" }));
    expect(screen.getByRole("alert").textContent).toContain("finite number"); expect(onRescore).not.toHaveBeenCalled();
  });
  it("supports player filtering and native form submission without fetching independently", async () => {
    const other = fixtureView(); other.player = players[1]; other.games = [];
    const onSelectPlayer = vi.fn(async () => other);
    render(<ForecastExplorer initialView={fixtureView()} players={players} onSelectPlayer={onSelectPlayer} />);
    fireEvent.change(screen.getByLabelText("Search players"), { target: { value: "Another" } });
    fireEvent.change(screen.getByLabelText("Player"), { target: { value: String(players[1].id) } });
    fireEvent.submit(screen.getByRole("form", { name: "Find a skater" }));
    await screen.findByText("Another Skater · Next scheduled games");
    expect(onSelectPlayer).toHaveBeenCalledWith(players[1].id);
    expect(screen.getByText("No game detail is available in this scope.")).toBeTruthy();
  });
  it("uses focusable game controls, labelled fields and an accessible table scroll region", () => {
    const view = fixtureView(); view.games.push({ ...view.games[0], opportunity: { ...view.games[0].opportunity, gameId: 2099020011, horizon: 9 } });
    render(<ForecastExplorer initialView={view} players={players} />);
    const games = screen.getByRole("group", { name: "Choose a scheduled game" });
    const second = within(games).getAllByRole("button")[1]; second.focus(); expect(document.activeElement).toBe(second);
    fireEvent.click(second); expect(second.getAttribute("aria-pressed")).toBe("true");
    const region = screen.getByRole("region", { name: /Revision history table/ }); region.focus(); expect(document.activeElement).toBe(region);
    expect(region.getAttribute("tabindex")).toBe("0");
    expect(screen.getAllByRole("spinbutton")).toHaveLength(7);
  });
  it("keeps more than 3000 loaded revisions available through bounded table pages", () => {
    const view = fixtureView(Array.from({ length: 3001 }, () => 6.5));
    render(<ForecastExplorer initialView={view} players={players} />);
    expect(screen.getByText(/3001 revisions loaded/)).toBeTruthy();
    expect(within(screen.getByRole("table", { name: /Comparable revisions/ })).getAllByRole("row")).toHaveLength(51);
    fireEvent.click(screen.getByRole("button", { name: "Load more history" }));
    expect(within(screen.getByRole("table", { name: /Comparable revisions/ })).getAllByRole("row")).toHaveLength(101);
  });
  it("loads subsequent history without replacing earlier revisions", async () => {
    const view = fixtureView([10]); view.games[0].nextCursor = "next-1";
    const onLoadHistory = vi.fn(async () => ({ ...view.games[0], revisions: [revision(5, 1)], nextCursor: null }));
    render(<ForecastExplorer initialView={view} players={players} onLoadHistory={onLoadHistory} />);
    expect(screen.getByText("Loaded history low / high")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Load more history" }));
    await screen.findByText(/2 revisions loaded/);
    expect(onLoadHistory).toHaveBeenCalledWith(view.player.id, view.games[0].opportunity.gameId, "next-1", view.profile);
    expect(within(screen.getByRole("table", { name: /Comparable revisions/ })).getAllByRole("row")).toHaveLength(3);
    expect(screen.queryByRole("button", { name: "Load more history" })).toBeNull();
  });
  it("preserves displayed history if a later page conflicts with an issued revision", async () => {
    const view = fixtureView([10]); view.games[0].nextCursor = "next-1";
    const onLoadHistory = vi.fn(async () => ({ ...view.games[0], revisions: [revision(99, 0)], nextCursor: null }));
    render(<ForecastExplorer initialView={view} players={players} onLoadHistory={onLoadHistory} />);
    fireEvent.click(screen.getByRole("button", { name: "Load more history" }));
    await screen.findByRole("alert"); expect(screen.getByRole("alert").textContent).toContain("preserved revision changed");
    expect(screen.getByText(/1 revisions loaded/)).toBeTruthy();
  });
  it("keeps separate latest and final extras out of the contiguous loaded history chain", () => {
    const view = fixtureView([10, 5]), game = view.games[0];
    game.nextCursor = "next-page"; game.latestRevision = revision(20, 9); game.lockedFinalRevision = revision(6, 8);
    game.lockedFinal.vintageId = "r8"; game.lockedFinal.value = available(6);
    const { container } = render(<ForecastExplorer initialView={view} players={players} />);
    expect(screen.getByText("5–10: 1 traversals, 25% opacity")).toBeTruthy();
    expect(container.querySelectorAll("svg rect")).toHaveLength(1);
    expect(screen.getByText("Latest eligible revision").parentElement?.textContent).toContain("20");
    expect(screen.getByText("Loaded history low / high").parentElement?.textContent).toContain("5 / 10");
    expect(within(screen.getByRole("table", { name: /Comparable revisions/ })).getAllByRole("row")).toHaveLength(3);
    expect(within(screen.getByLabelText("Uncertainty vintage")).getAllByRole("option")).toHaveLength(4);
  });
  it("defaults post-lock uncertainty to the selected final even when a later revision differs", () => {
    const view = fixtureView([10]), game = view.games[0];
    game.latestRevision = revision(20, 9); game.lockedFinalRevision = revision(6, 8); game.lockedFinal.vintageId = "r8";
    game.lockedFinalRevision.intervals = available([{ level: 0.5, lower: 2, upper: 7 }, { level: 0.9, lower: 1, upper: 9 }]);
    render(<ForecastExplorer initialView={view} players={players} />);
    expect((screen.getByLabelText("Uncertainty vintage") as HTMLSelectElement).value).toBe("r8");
    expect(screen.getByText("50% outcome interval: 2–7 fantasy points")).toBeTruthy();
  });
  it("preserves independently qualified historical revisions when the current horizon is unsupported", () => {
    const view = fixtureView([12.25]), game = view.games[0];
    game.qualification = { ...game.qualification, state: "unqualified", supportedHorizons: [], supportedCategories: [] };
    game.lockedFinalRevision!.means.PIM = unavailable("source_incomplete");
    render(<ForecastExplorer initialView={view} players={players} />);
    const row = within(screen.getByRole("table", { name: /Comparable revisions/ })).getAllByRole("row")[1];
    expect(within(row).getAllByRole("cell")[0].textContent).toBe("12.25");
    const categories = screen.getByRole("table", { name: /Conditional category means/ });
    expect(within(categories).getAllByRole("row")).toHaveLength(8);
    expect(within(categories).getByText("Unavailable — source incomplete")).toBeTruthy();
  });
  it("keeps public routing unconditionally disabled", async () => {
    expect(await getServerSideProps()).toEqual({ notFound: true });
    render(<ForecastExplorer initialView={null} players={[]} />);
    expect(screen.getByRole("heading", { name: "Forecasts unavailable" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "View player" }).hasAttribute("disabled")).toBe(true);
  });
});
