import { fireEvent, cleanup, render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getTeamScheduleSummary } from "components/GameGrid/utils/scheduleSummary";
import type { GameData } from "lib/NHL/types";
import type { CanonicalSchedule } from "./canonicalSchedule";
const state = vi.hoisted(() => ({ data: null as CanonicalSchedule | null }));
vi.mock("./canonicalSchedule", async importOriginal => ({ ...await importOriginal<typeof import("./canonicalSchedule")>(), useCanonicalSchedule: () => state.data }));
import TeamScheduleContext, { teamScheduleContext } from "./TeamScheduleContext";
import styles from "./TeamScheduleContext.module.scss";

afterEach(cleanup);
const dates = Array.from({ length: 7 }, (_, index) => `2026-10-${12 + index}`);
function fixture(): CanonicalSchedule {
  const teams = Array.from({ length: 18 }, (_, index) => ({ id: index + 1, name: "Fixture team", abbreviation: String.fromCharCode(65 + index).repeat(3), logo: "" }));
  const pair = (id: number, date: string, home: number, away: number, gameState = "FUT"): GameData =>
    ({ id, season: 20262027, gameType: 2, gameDate: date, startTimeUTC: `${date}T20:00:00Z`, gameState, homeTeam: { id: home }, awayTeam: { id: away } });
  const games = teams.flatMap((team, index) => index % 2 ? [] : [pair(index + 1, dates[0], team.id, team.id + 1)]);
  games.push(pair(20, dates[1], 2, 1), pair(21, dates[2], 3, 4, "FINAL"), pair(22, dates[3], 1, 2, "CNCL"));
  return { games: games.filter(game => game.gameState !== "CNCL"), teams, complete: true, error: null };
}
function show(data: CanonicalSchedule, selected = dates) {
  state.data = data;
  return render(<TeamScheduleContext dates={selected} seasonId={20262027} timeZone="America/New_York" />);
}

describe("RSO explanatory team schedule context", () => {
  it("uses the actual Game Grid summary with one count per game and off-night threshold", () => {
    const data = fixture();
    data.games.push({ ...data.games[0] });
    const result = teamScheduleContext(data, dates);
    expect(result.reason).toBeNull();
    expect(result.teams.map(team => team.abbreviation)).toEqual(["AAA", "BBB", "CCC", "DDD", "EEE"]);
    const first = result.teams[0];
    expect(first.summary).toEqual(getTeamScheduleSummary({ ...first.games, teamId: first.teamId },
      [9, 1, 1, 0, 0, 0, 0], [], result.days, result.days.map(() => true)));
    expect(first.summary).toMatchObject({ totalGamesPlayed: 2, totalOffNights: 1, scoreDecomposition: { matchup: 0 } });
    expect(result.teams[2].summary.totalGamesPlayed).toBe(2); // Completed games remain full-calendar context.
  });

  it("uses the exact clipped date range, retaining truthful home/away and neutral missing odds", () => {
    const clipped = dates.slice(1, 3);
    show(fixture(), clipped);
    const aaa = screen.getByLabelText("AAA team schedule");
    expect(within(aaa).getByLabelText(/^GP 1 · OFF 1 · Score /)).toBeTruthy();
    expect(within(aaa).getByLabelText("Oct 13: Away at BBB · Off-night")).toBeTruthy();
    expect(within(aaa).getByLabelText("Oct 14: No game")).toBeTruthy();
    expect(screen.queryByLabelText(/Oct 12:/)).toBeNull();
    fireEvent.focus(screen.getByRole("button", { name: "About team schedule scores" }));
    expect(screen.getByText(/Missing matchup odds contribute neutrally/)).toBeTruthy();
    expect(screen.getByText(/not net roster fit or confirmed participation/)).toBeTruthy();
    expect(screen.getByText(/America\/New_York range/)).toBeTruthy();
  });

  it("shows each game as the opponent's logo, off-nights in green, the team band in team colours and GP/OFF beneath the score", () => {
    const data = fixture();
    data.teams[0] = { ...data.teams[0], abbreviation: "NJD" }; data.teams[1] = { ...data.teams[1], abbreviation: "BOS" };
    show(data, dates.slice(1, 3));
    const card = screen.getByLabelText("NJD team schedule");
    const away = within(card).getByLabelText("Oct 13: Away at BOS · Off-night");
    const cell = away.querySelector("b")!;
    expect(cell.getAttribute("data-off-night")).toBe("true");
    expect(cell.getAttribute("data-game")).toBe("away");
    expect(cell.textContent).not.toMatch(/^[HA]$/);
    expect(cell.querySelector("img")?.getAttribute("src")).toContain("BOS");
    const band = card.querySelector("[data-team-band]") as HTMLElement;
    expect(band.textContent).toBe("NJD");
    // lib/teamsInfo NJD: primary black, secondary red, jersey white.
    expect(band.style.background).toBe("rgb(0, 0, 0)");
    expect(band.style.color).toBe("rgb(162, 6, 32)");
    expect(band.style.boxShadow).toBe("inset 0 0 0 2px #FFFFFF");
    const metrics = within(card).getByLabelText(/^GP 1 · OFF 1 · Score /);
    expect([...metrics.querySelectorAll("small")].map(node => node.textContent)).toEqual(["Score", "GP", "OFF"]);
  });

  it("stretches every day cell to the card's row height, label on top and the game box filling the rest", () => {
    show(fixture(), dates.slice(1, 3));
    const card = screen.getByLabelText("AAA team schedule");
    const cells = [...card.querySelectorAll(`.${styles.days} > span`)];
    expect(cells).toHaveLength(2);
    for (const cell of cells) {
      expect(cell.className).toBe(styles.dayCell);
      expect([...cell.children].map(node => node.tagName)).toEqual(["SMALL", "B"]);
    }
    const css = readFileSync(join(__dirname, "TeamScheduleContext.module.scss"), "utf8");
    expect(css).toMatch(/\.days \{ align-self: stretch; grid-auto-rows: 1fr; \}/);
    expect(css).toMatch(/\.days > \.dayCell \{ display: flex; flex-direction: column;/);
    expect(css).toMatch(/\.days \.dayCell b \{ flex: 1 1 auto; \}/);
  });

  it.each(["partial", "conflicting rows"])("withholds ranks for %s", mode => {
    const data = fixture();
    if (mode === "partial") { data.complete = false; data.error = "Canonical calendar coverage unavailable"; }
    if (mode === "conflicting rows") data.games.push({ ...data.games[0], id: 100 });
    show(data);
    expect(screen.queryByText("Top five team schedules")).toBeNull();
    expect(screen.queryByText(/Score \d/)).toBeNull();
    expect(screen.queryByLabelText(/team schedule$/)).toBeNull();
  });

  it("retains unique dates across a nonstandard multiweek matchup without roster identities", () => {
    const selected = Array.from({ length: 14 }, (_, i) => new Date(Date.UTC(2026, 9, 12 + i)).toISOString().slice(0, 10));
    const data = fixture(); data.teams = [];
    data.games.push({ ...data.games[0], id: 100, gameDate: selected[7] });
    const result = teamScheduleContext(data, selected);
    expect(result.reason).toBeNull();
    expect(result.counts[0]).toBe(9); expect(result.counts[7]).toBe(1);
    expect(result.teams.find(team => team.teamId === 1)?.summary.totalGamesPlayed).toBe(3);
    expect(result.teams.find(team => team.teamId === 1)?.abbreviation).toBe("Team 1");
  });

  it.each([{ selected: [] }, { selected: Array.from({ length: 29 }, (_, i) => new Date(Date.UTC(2026, 9, 12 + i)).toISOString().slice(0, 10)) }, { selected: [dates[0], dates[2]] },
    { selected: ["2026-02-30"] }])("does not silently change an unsupported horizon $selected", ({ selected }) => {
    expect(teamScheduleContext(fixture(), selected).reason).toContain("consecutive range");
  });

  it("keeps context collapsed by default without actions or persistence changes", () => {
    window.localStorage.setItem("fhfh:rso:workspace:v1", "retained fixture intent");
    show(fixture());
    expect(screen.getByText("Top five team schedules").closest("details")).toHaveProperty("open", false);
    expect(screen.getByRole("button", { name: "About team schedule scores" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Select|Add|Drop/ })).toBeNull();
    expect(screen.getByLabelText("Top team schedule cards")).toHaveProperty("tabIndex", 0);
    expect(window.localStorage.getItem("fhfh:rso:workspace:v1")).toBe("retained fixture intent");
  });
});
