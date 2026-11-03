import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import CurrentPlayerCardStudio from "./CurrentPlayerCardStudio";
import CurrentPlayerCard from "./CurrentPlayerCard";
import { assertCurrentNhlExport } from "../../lib/player-cards/currentNhlExport";
import { buildCurrentNhlCard } from "../../lib/player-cards/currentNhl";
// Preserve missing-art consumer fixtures while the real registry adds qualified Kucherov.
vi.mock("../../lib/player-cards/reviewedHeroSamples", async importOriginal => {
  const actual = await importOriginal<typeof import("../../lib/player-cards/reviewedHeroSamples")>();
  return { REVIEWED_HERO_SAMPLES: actual.REVIEWED_HERO_SAMPLES.filter(sample => sample.id !== 8476453) };
});
afterEach(() => { window.history.replaceState(null, "", "/"); localStorage.clear(); });
const fixture = () => buildCurrentNhlCard({ playerId: 8476453, season: 20262027, count: 5 }, {
  identity: { playerId: 8476453, firstName: { default: "Fixture" }, lastName: { default: "Player" }, currentTeamAbbrev: "TBL", position: "R", seasonTotals: [{ season: 20262027, gameTypeId: 2, leagueAbbrev: "NHL", gamesPlayed: 1 }] },
  history: { seasonId: 20262027, gameTypeId: 2, gameLog: [{ gameId: 2026020167, gameDate: "2026-10-23", teamAbbrev: "TBL", goals: 1, assists: 0, points: 1, shots: 4, toi: "20:00" }] },
  schedule: { games: [{ id: 2026020167, season: 20262027, gameType: 2, gameDate: "2026-10-23", startTimeUTC: "2026-10-24T01:00:00Z", gameState: "OFF", homeTeam: { abbrev: "COL" }, awayTeam: { abbrev: "TBL" } }] }, observedAt: "2026-10-26T00:00:00Z", source: "contract-fixture",
});
it("does not auto-fetch and switches real metric suites without refetching or cosmetic-only tabs", () => {
  const load = vi.fn(); render(<CurrentPlayerCardStudio initialCard={fixture()} load={load} />);
  expect(load).not.toHaveBeenCalled(); expect(screen.getByRole("img").querySelector('[data-metric="shots60"]')).not.toBeNull();
  fireEvent.change(screen.getByLabelText("Card category"), { target: { value: "results-milestones" } });
  expect(screen.getByRole("img").querySelector('[data-metric="goals"]')).not.toBeNull(); expect(screen.getByRole("img").querySelector('[data-metric="shots60"]')).toBeNull();
  expect(screen.getByRole("img").textContent).toContain("Milestone baselines unavailable"); expect(load).not.toHaveBeenCalled();
});
it("invalidates a loaded snapshot on player changes and ignores late aborted loads", async () => {
  let resolve!: (value: ReturnType<typeof fixture>) => void;
  const load = vi.fn(() => new Promise<ReturnType<typeof fixture>>(done => { resolve = done; })); render(<CurrentPlayerCardStudio initialCard={fixture()} load={load} />);
  fireEvent.click(screen.getByRole("button", { name: "Load NHL results" })); await waitFor(() => expect(load).toHaveBeenCalledTimes(1));
  fireEvent.change(screen.getByLabelText("Player NHL ID"), { target: { value: "8479318" } }); await act(async () => resolve(fixture()));
  expect(screen.queryByRole("img")).toBeNull(); expect(screen.getByRole("button", { name: "Download PNG" }).hasAttribute("disabled")).toBe(true);
});
it("export keys bind values, source and selected format; unavailable context cannot export", () => {
  const card = fixture(), { container } = render(<CurrentPlayerCard card={card} format="rates-opportunity" />), svg = container.querySelector("svg")!;
  expect(() => assertCurrentNhlExport(svg, card, "rates-opportunity")).not.toThrow();
  expect(() => assertCurrentNhlExport(svg, card, "results-milestones")).toThrow("snapshot");
  expect(() => assertCurrentNhlExport(svg, { ...card, values: { ...card.values, goals: 99 } }, "rates-opportunity")).toThrow("snapshot");
  expect(() => assertCurrentNhlExport(svg, { ...card, state: "unavailable" }, "rates-opportunity")).toThrow("snapshot");
});

it("reuses qualified captured windows and categories, with a selected-only reproducibility manifest", async () => {
  const first = fixture(), windows = ([5, 10, 20] as const).map(count => ({ ...first, request: { ...first.request, count } }));
  const load = vi.fn(); render(<CurrentPlayerCardStudio initialCard={{ ...first, windows }} load={load} />);
  fireEvent.change(screen.getByLabelText("Own last appearances"), { target: { value: "10" } });
  expect(screen.getByRole("img").textContent).toContain("1/10 GP"); expect(load).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Card category"), { target: { value: "results-milestones" } });
  expect(screen.getByRole("img").querySelector('[data-metric="goals"]')).toBeTruthy(); expect(window.location.search).toContain("cardFormat=results-milestones"); expect(load).not.toHaveBeenCalled();
});
it("restores player/window/category on browser navigation without source requests and discards an in-flight export", async () => {
  const first = fixture(), load = vi.fn(); let finish!: (blob: Blob) => void;
  const rasterize = vi.fn(() => new Promise<Blob>(resolve => { finish = resolve; }));
  render(<CurrentPlayerCardStudio initialCard={first} load={load} rasterize={rasterize} />);
  fireEvent.click(screen.getByRole("button", { name: "Prepare social image" }));
  window.history.pushState(null, "", "/player-cards?playerId=8479318&season=20262027&count=20&cardFormat=results-milestones");
  act(() => window.dispatchEvent(new PopStateEvent("popstate")));
  await act(async () => finish(new Blob(["obsolete PNG"])));
  expect(screen.queryByRole("img")).toBeNull(); expect(screen.queryByRole("button", { name: "Share prepared image" })).toBeNull(); expect(load).not.toHaveBeenCalled();
  expect((screen.getByLabelText("Player NHL ID") as HTMLInputElement).value).toBe("8479318"); expect((screen.getByLabelText("Own last appearances") as HTMLSelectElement).value).toBe("20");
});
it("accepts a verified FHFH player URL, submits with Enter/form semantics and rejects malformed identity without loading", async () => {
  const first = fixture(), load = vi.fn(async () => first); render(<CurrentPlayerCardStudio load={load} />);
  fireEvent.change(screen.getByLabelText("Player NHL ID"), { target: { value: "https://fhfhockey.com/stats/player/8476453" } });
  fireEvent.change(screen.getByLabelText("Own last appearances"), { target: { value: "5" } });
  fireEvent.submit(screen.getByRole("button", { name: "Load NHL results" }).closest("form")!);
  await screen.findByRole("img"); expect(load).toHaveBeenCalledWith(first.request, expect.any(AbortSignal));
  fireEvent.change(screen.getByLabelText("Player NHL ID"), { target: { value: "https://other.invalid/stats/player/8476453" } });
  fireEvent.click(screen.getByRole("button", { name: "Load NHL results" })); await screen.findByText("Enter a valid NHL ID or FHFH player URL."); expect(load).toHaveBeenCalledTimes(1);
});

it("keeps uncaptured artwork unavailable and never loads a different player's image", async () => {
  const loadArtwork = vi.fn(); render(<CurrentPlayerCardStudio initialCard={fixture()} loadArtwork={loadArtwork} />);
  expect(loadArtwork).not.toHaveBeenCalled(); expect(screen.queryByLabelText("Portrait style")).toBeNull();
  expect(screen.getByRole("img").querySelector("image")).toBeNull(); expect(screen.getByRole("button", { name: "Download PNG" }).hasAttribute("disabled")).toBe(false);
});
it("joins verified artwork controls to the data card and invalidates prepared images on treatment changes", async () => {
  const { REVIEWED_HERO_SAMPLES } = await import("../../lib/player-cards/reviewedHeroSamples");
  const { PORTRAIT_VERSION } = await import("../../lib/player-cards/portraitTreatment");
  const sample = REVIEWED_HERO_SAMPLES[0], first = fixture(), card = { ...first, player: { id: sample.id, name: sample.name, team: sample.team, position: sample.position }, request: { ...first.request, playerId: sample.id } };
  const loadArtwork = vi.fn(async () => ({ ...sample, dataUrl: "data:image/png;base64,original" }));
  const treatArtwork = vi.fn(async (hero, style) => ({ ...hero, dataUrl: `data:image/png;base64,${style}`, treatment: { style, version: PORTRAIT_VERSION, sourceAlphaSha256: sample.alphaSha256, renderedSha256: sample.alphaSha256, width: sample.sourceWidth, height: sample.sourceHeight } }));
  const rasterize = vi.fn<typeof import("../../lib/player-cards/currentNhlExport").rasterizeCurrentNhlCard>(async () => new Blob(["png"])); render(<CurrentPlayerCardStudio initialCard={card} loadArtwork={loadArtwork} treatArtwork={treatArtwork} rasterize={rasterize} />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Prepare social image" }).hasAttribute("disabled")).toBe(false));
  fireEvent.click(screen.getByRole("button", { name: "Prepare social image" })); await screen.findByRole("button", { name: "Share prepared image" });
  expect(rasterize.mock.calls[0][3]).toMatchObject({ id: sample.id, team: sample.team });
  fireEvent.change(screen.getByLabelText("Portrait style"), { target: { value: "posterized" } });
  await waitFor(() => expect(document.querySelector('[data-hero-image="true"]')?.getAttribute("href")).toBe("data:image/png;base64,posterized"));
  expect(screen.queryByRole("button", { name: "Share prepared image" })).toBeNull();
  fireEvent.change(screen.getByLabelText("Player NHL ID"), { target: { value: "8476453" } });
  expect(screen.queryByRole("img")).toBeNull(); expect(screen.queryByLabelText("Portrait style")).toBeNull(); expect(loadArtwork).toHaveBeenCalledTimes(1);
});
it("selects a catalog name without fetching and loads that exact identity only on request", async () => {
  const card = fixture(), load = vi.fn(async () => card); render(<CurrentPlayerCardStudio load={load} />);
  fireEvent.change(screen.getByLabelText("Own last appearances"), { target: { value: "5" } });
  fireEvent.change(screen.getByLabelText("Player name, team or NHL ID"), { target: { value: "Kucherov" } });
  fireEvent.click(screen.getByRole("button", { name: /Nikita Kucherov.*8476453/ }));
  expect((screen.getByLabelText("Player NHL ID") as HTMLInputElement).value).toBe("8476453"); expect(load).not.toHaveBeenCalled(); expect(window.location.search).toContain("playerId=8476453");
  fireEvent.click(screen.getByRole("button", { name: "Load NHL results" })); await screen.findByRole("img"); expect(load).toHaveBeenCalledWith(card.request, expect.any(AbortSignal));
});
it("catalog selection aborts an older in-flight load and clears prior stats/artwork", async () => {
  let finish!: (card: ReturnType<typeof fixture>) => void;
  const load = vi.fn<(request: import("../../lib/player-cards/currentNhl").CurrentNhlRequest, signal: AbortSignal) => Promise<ReturnType<typeof fixture>>>(() => new Promise<ReturnType<typeof fixture>>(resolve => { finish = resolve; })); render(<CurrentPlayerCardStudio initialCard={fixture()} load={load} />);
  fireEvent.click(screen.getByRole("button", { name: "Load NHL results" })); await waitFor(() => expect(load).toHaveBeenCalledTimes(1));
  fireEvent.change(screen.getByLabelText("Player name, team or NHL ID"), { target: { value: "McDavid" } }); fireEvent.click(screen.getByRole("button", { name: /Connor McDavid.*8478402/ }));
  expect(load.mock.calls[0][1].aborted).toBe(true); await act(async () => finish(fixture()));
  expect(screen.queryByRole("img")).toBeNull(); expect((screen.getByLabelText("Player NHL ID") as HTMLInputElement).value).toBe("8478402"); expect(load).toHaveBeenCalledTimes(1);
});
it("uses catalog team labels only as hints and keeps the verified response identity", async () => {
  const card = fixture(), observed = { ...card, player: { ...card.player, name: "Observed Kucherov", team: "NYR" } }, load = vi.fn(async () => observed);
  render(<CurrentPlayerCardStudio load={load} />); fireEvent.change(screen.getByLabelText("Own last appearances"), { target: { value: "5" } });
  fireEvent.change(screen.getByLabelText("Player name, team or NHL ID"), { target: { value: "Kucherov" } }); fireEvent.click(screen.getByRole("button", { name: /Nikita Kucherov.*TBL.*8476453/ }));
  fireEvent.click(screen.getByRole("button", { name: "Load NHL results" })); const svg = await screen.findByRole("img");
  expect(svg.textContent).toContain("New York Rangers"); expect(svg.textContent).toContain("OBSERVED"); expect(svg.querySelector("image")).toBeNull();
});
