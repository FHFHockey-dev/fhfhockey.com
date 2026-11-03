import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import CurrentPlayerCardStudio from "./CurrentPlayerCardStudio";
import CurrentPlayerCard from "./CurrentPlayerCard";
import { assertCurrentNhlExport } from "../../lib/player-cards/currentNhlExport";
import { buildCurrentNhlCard } from "../../lib/player-cards/currentNhl";
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
