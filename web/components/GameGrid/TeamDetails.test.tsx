import React, { useState } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EXTENDED_DAY_ABBREVIATION, GameData, Team, WeekData } from "lib/NHL/types";
import TeamDetails, { TeamDetailsProps } from "./TeamDetails";
import TeamRow from "./TeamRow";
import TransposedGrid from "./TransposedGrid";
import { TEAM_FORECAST_CATEGORIES, TEAM_FORECAST_CREDITS, TeamForecastContext, TeamForecastRecord } from "./utils/teamForecasts";

const teams: Record<number, Team> = {
  12: { id: 12, name: "Carolina Hurricanes", abbreviation: "CAR", logo: "/car.svg" },
  13: { id: 13, name: "Florida Panthers", abbreviation: "FLA", logo: "/fla.svg" },
};

vi.mock("./contexts/GameGridContext", () => ({ useTeam: (id: number) => teams[id] }));
vi.mock("hooks/useTeams", () => ({ useTeamsMap: () => teams }));
vi.mock("next/image", () => ({ default: ({ alt }: { alt: string }) => <span role="img" aria-label={alt} /> }));
vi.mock("next/legacy/image", () => ({ default: ({ alt }: { alt: string }) => <span role="img" aria-label={alt} /> }));
vi.mock("./PDHC/PoissonHeatMap", () => ({ default: () => null }));
vi.mock("./VerticalMatchupCell", () => ({ default: () => null }));

afterEach(cleanup);

type PreviewFixture = GameData & { startTimeUTC?: string; venue?: string };
const game = (id: number, gameDate: string, state = "FUT", extra: Partial<PreviewFixture> = {}): PreviewFixture => ({
  id, season: 20262027, gameType: 2, gameDate, gameState: state,
  homeTeam: { id: 12 }, awayTeam: { id: 13 }, ...extra,
});
const dates = ["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11"];
const defaults: TeamDetailsProps = {
  teamId: 12, schedule: {}, startDate: dates[0], asOf: "2026-10-07T16:00:00Z",
  coveredDates: dates, scheduleCoverage: { known: 7, expected: 7 },
};

const forecastContext: TeamForecastContext = {
  seasonId: 20262027, scheduleRevision: "schedule-r1", rosterRevision: "roster-r1", rosterScope: "skaters",
  games: [{ gameId: 1, startsAt: "2026-10-08T23:00:00Z", state: "scheduled" },
    { gameId: 2, startsAt: "2026-10-11T23:00:00Z", state: "scheduled" }],
};
function forecast(overrides: Partial<TeamForecastRecord> = {}): TeamForecastRecord {
  return { teamId: 12, gameId: 1, seasonId: 20262027, category: "G", mean: 2.4,
    unit: "count", scope: "full_game_regulation_overtime", conditioning: "unconditional",
    creditDefinition: TEAM_FORECAST_CREDITS.G, rosterScope: "skaters", rosterRevision: "roster-r1",
    scheduleRevision: "schedule-r1", startsAt: forecastContext.games[0].startsAt, status: "qualified",
    allowedUses: { totals: true, comparison: false }, revisionId: "fixture-output-r1", modelVersion: "fixture-model-v1",
    comparisonLineageId: "fixture-run-r1", sourceWatermark: "fixture-input-r1", sourceAvailableAt: "2026-10-07T13:00:00Z",
    cutoffAt: "2026-10-07T14:00:00Z", issuedAt: "2026-10-07T14:30:00Z", availableAt: "2026-10-07T14:31:00Z",
    expiresAt: "2026-10-07T22:00:00Z", ...overrides };
}
const forecastSchedule = {
  THU: game(1, dates[3], "FUT", { startTimeUTC: forecastContext.games[0].startsAt }),
  SUN: game(2, dates[6], "PRE", { startTimeUTC: forecastContext.games[1].startsAt }),
};
const weekly = () => within(screen.getByLabelText("Remaining-week category forecasts"));
const categoryCard = (label: string) => within(screen.getByLabelText(label)).getByText("G", { exact: true }).closest("div")!;

describe("Game Grid team previews", () => {
  it("distinguishes a covered bye from unavailable schedule data", () => {
    const { rerender } = render(<TeamDetails {...defaults} />);
    expect(screen.getByText("No upcoming games in this selection.")).toBeTruthy();
    expect(screen.getAllByText("No remaining games")).toHaveLength(7);
    rerender(<TeamDetails {...defaults} scheduleCoverage={undefined} coveredDates={undefined} />);
    expect(screen.getByText("Schedule unavailable for this selection. Retry the schedule read.")).toBeTruthy();
    expect(weekly().getAllByText("Unavailable")).toHaveLength(7);
    expect(screen.queryByText("No remaining games")).toBeNull();
  });

  it("keeps selected game previews chronological and remaining totals within Sunday", () => {
    const schedule: WeekData = {
      MON: game(1, dates[0], "OFF"), WED: game(2, dates[2], "LIVE"),
      THU: game(3, dates[3], "FUT", { gameScheduleState: "PPD" }),
      FRI: game(4, dates[4]), SUN: game(5, dates[6], "FUT", { startTimeUTC: "2026-10-12T03:00:00Z", venue: "Test Arena" }),
      nMON: game(6, "2026-10-12"), nTUE: game(6, "2026-10-12"),
    };
    render(<TeamDetails {...defaults} schedule={schedule} extended excludedDays={["FRI"]}
      leagueSlateCounts={[1, 0, 6, null, 8, 0, 2, 4, 4, 0]} />);
    expect(screen.getByText(/1 confirmed upcoming regular-season game in the included dates/)).toBeTruthy();
    expect(weekly().getAllByText("Unavailable")).toHaveLength(7);
    expect(weekly().getAllByText("Coverage: 0 of 1 games")).toHaveLength(7);
    const previews = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(previews).toHaveLength(6);
    expect(previews.map((preview) => preview.textContent?.match(/(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), Oct \d+, 2026/)?.[0])).toEqual([
      "Mon, Oct 5, 2026", "Wed, Oct 7, 2026", "Thu, Oct 8, 2026", "Fri, Oct 9, 2026", "Sun, Oct 11, 2026", "Mon, Oct 12, 2026",
    ]);
    expect(previews[4].textContent).toContain("11:00 PM EDT");
    expect(previews[4].textContent).toContain("Test Arena");
    expect(previews[5].textContent).toContain("Next calendar week — outside remaining-week totals.");
    expect(previews[2].textContent).toContain("Postponed");
    expect(previews[2].textContent).toContain("slate: unavailable");
    expect(screen.getByText(/Schedule source freshness unavailable/)).toBeTruthy();
  });

  it("does not count same-day games without a future start or next-week games in either mode", () => {
    const schedule: WeekData = {
      WED: game(1, dates[2]), SUN: game(2, dates[6]), nMON: game(3, "2026-10-12"),
    };
    const { rerender } = render(<TeamDetails {...defaults} schedule={schedule} />);
    expect(screen.getByText(/1 confirmed upcoming regular-season game/)).toBeTruthy();
    expect(screen.getByText(/Remaining eligibility is unavailable/)).toBeTruthy();
    expect(within(screen.getByRole("list")).getAllByRole("listitem")).toHaveLength(2);
    rerender(<TeamDetails {...defaults} schedule={schedule} extended />);
    expect(screen.getByText(/1 confirmed upcoming regular-season game/)).toBeTruthy();
    expect(within(screen.getByRole("list")).getAllByRole("listitem")).toHaveLength(3);
    rerender(<TeamDetails {...defaults} schedule={schedule} />);
    expect(within(screen.getByRole("list")).getAllByRole("listitem")).toHaveLength(2);
  });

  it.each([
    { label: "before its verified start", startTimeUTC: "2026-10-07T21:00:00Z", expectedGames: 1, uncertain: false },
    { label: "without a start time", startTimeUTC: undefined, expectedGames: 0, uncertain: true },
    { label: "with an invalid start time", startTimeUTC: "unavailable", expectedGames: 0, uncertain: true },
    { label: "at its verified start", startTimeUTC: defaults.asOf, expectedGames: 0, uncertain: false },
    { label: "after its verified start", startTimeUTC: "2026-10-07T15:59:59Z", expectedGames: 0, uncertain: false },
  ])("handles a PRE game $label without fabricating an empty remaining week", ({ startTimeUTC, expectedGames, uncertain }) => {
    render(<TeamDetails {...defaults} schedule={{ WED: game(1, dates[2], "PRE", { startTimeUTC }) }} />);
    expect(screen.getByText(new RegExp(`${expectedGames} confirmed upcoming regular-season game`))).toBeTruthy();
    expect(screen.queryByText(/Remaining eligibility is unavailable/) !== null).toBe(uncertain);
    if (expectedGames > 0 || uncertain) {
      expect(weekly().getAllByText("Unavailable")).toHaveLength(7);
      expect(screen.queryByText("No remaining games")).toBeNull();
    } else {
      expect(screen.getAllByText("No remaining games")).toHaveLength(7);
    }
    expect(screen.getByRole("listitem").textContent).toContain("Pregame");
  });

  it("keeps a future-day PRE game without a start time unknown", () => {
    render(<TeamDetails {...defaults} schedule={{ THU: game(1, dates[3], "PRE") }} />);
    expect(screen.getByText(/0 confirmed upcoming regular-season games/)).toBeTruthy();
    expect(screen.getByText(/Remaining eligibility is unavailable/)).toBeTruthy();
    expect(weekly().getAllByText("Unavailable")).toHaveLength(7);
    expect(screen.queryByText("No remaining games")).toBeNull();
  });

  it("derives partial totals and true zero from the displayed game records", () => {
    const forecastRecords = [forecast(), ...forecastContext.games.map((item) => forecast({
      gameId: item.gameId, startsAt: item.startsAt, category: "A", mean: 0, creditDefinition: TEAM_FORECAST_CREDITS.A,
    }))];
    const props = { ...defaults, schedule: forecastSchedule, forecastRecords, forecastContext };
    const { rerender } = render(<TeamDetails {...props} />);
    expect(weekly().getByText("2.4")).toBeTruthy();
    expect(weekly().getByText("Known subtotal, 1 of 2 games")).toBeTruthy();
    expect(weekly().getByText("0.0")).toBeTruthy();
    expect(weekly().getAllByText("Unavailable")).toHaveLength(5);
    expect(within(screen.getByLabelText("Game 1 category forecasts")).getByText("2.4")).toBeTruthy();
    expect(categoryCard("Game 2 category forecasts").textContent).toContain("Unavailable");
    expect(screen.getAllByText(/Model: fixture-model-v1. Cutoff: 2026-10-07T14:00:00Z/)).toHaveLength(3);
    rerender(<TeamDetails {...props} scheduleCoverage={{ known: 6, expected: 7 }} />);
    expect(weekly().getByText("Known subtotal, 2 of 2 games")).toBeTruthy();
    expect(screen.getByText(/Incomplete schedule coverage may omit games/)).toBeTruthy();
  });

  it("reconciles every complete category total to rounded per-game means", () => {
    const records = TEAM_FORECAST_CATEGORIES.flatMap((category) => forecastContext.games.map((item) => forecast({
      gameId: item.gameId, startsAt: item.startsAt, category, mean: 1.24,
      unit: category === "PIM" ? "minutes" : "count", creditDefinition: TEAM_FORECAST_CREDITS[category],
    })));
    render(<TeamDetails {...defaults} schedule={forecastSchedule} forecastRecords={records} forecastContext={forecastContext} />);
    expect(weekly().getAllByText("2.4")).toHaveLength(7);
    expect(within(screen.getByLabelText("Game 1 category forecasts")).getAllByText("1.2")).toHaveLength(7);
    expect(within(screen.getByLabelText("Game 2 category forecasts")).getAllByText("1.2")).toHaveLength(7);
    expect(weekly().getAllByText("Coverage: 2 of 2 games")).toHaveLength(7);
    expect(screen.queryByText(/Category forecasts and forecast source freshness unavailable for this game/)).toBeNull();
  });

  it.each([
    ["stale", { expiresAt: defaults.asOf }], ["conditional", { conditioning: "conditional_playing" }],
    ["goals used as PPP", { category: "PPP", creditDefinition: "team_power_play_goals" }],
    ["another season", { seasonId: 20252026 }], ["another team", { teamId: 13 }],
    ["another game", { gameId: 3 }], ["another schedule", { scheduleRevision: "other" }],
  ] as Array<[string, Partial<TeamForecastRecord>]>)("keeps %s records unavailable in totals and game cards", (_, overrides) => {
    render(<TeamDetails {...defaults} schedule={forecastSchedule} forecastContext={forecastContext} forecastRecords={[forecast(overrides)]} />);
    expect(weekly().getAllByText("Unavailable")).toHaveLength(7);
    expect(within(screen.getByLabelText("Game 1 category forecasts")).getAllByText("Unavailable")).toHaveLength(7);
    expect(screen.queryByText(/Model: fixture-model/)).toBeNull();
  });

  it("excludes next-week and excluded game means from totals while keeping full-game previews", () => {
    const nextStart = "2026-10-12T23:00:00Z";
    const context = { ...forecastContext, games: [...forecastContext.games, { gameId: 3, startsAt: nextStart, state: "scheduled" as const }] };
    render(<TeamDetails {...defaults} extended excludedDays={["THU"]} forecastContext={context}
      schedule={{ ...forecastSchedule, nMON: game(3, "2026-10-12", "FUT", { startTimeUTC: nextStart }) }}
      coveredDates={[...dates, "2026-10-12"]}
      forecastRecords={context.games.map((item) => forecast({ gameId: item.gameId, startsAt: item.startsAt, mean: item.gameId }))} />);
    expect(weekly().getByText("2.0")).toBeTruthy();
    expect(within(screen.getByLabelText("Game 1 category forecasts")).getByText("1.0")).toBeTruthy();
    expect(within(screen.getByLabelText("Game 3 category forecasts")).getByText("3.0")).toBeTruthy();
  });

  it("withdraws forecasts at start and on same-week schedule refresh", () => {
    const props = { ...defaults, schedule: forecastSchedule, forecastContext, forecastRecords: [forecast()] };
    const { rerender } = render(<TeamDetails {...props} />);
    expect(weekly().getByText("2.4")).toBeTruthy();
    rerender(<TeamDetails {...props} schedule={{ ...forecastSchedule, THU: { ...forecastSchedule.THU, gameState: "LIVE" } }} />);
    expect(weekly().queryByText("2.4")).toBeNull();
    expect(within(screen.getByLabelText("Game 1 category forecasts")).queryByText("2.4")).toBeNull();
    rerender(<TeamDetails {...props} asOf={forecastContext.games[0].startsAt} />);
    expect(weekly().queryByText("2.4")).toBeNull();
  });

  it("does not trust a forecast context that differs from the displayed start", () => {
    render(<TeamDetails {...defaults} schedule={{ ...forecastSchedule, THU: { ...forecastSchedule.THU, startTimeUTC: "2026-10-08T22:00:00Z" } as PreviewFixture }}
      forecastContext={forecastContext} forecastRecords={[forecast()]} />);
    expect(weekly().getAllByText("Unavailable")).toHaveLength(7);
  });

  it.each(["MON", "THU"] as const)("keeps an inferred %s game date unknown rather than claiming an empty week", (day) => {
    render(<TeamDetails {...defaults} schedule={{ [day]: { ...forecastSchedule.THU, gameDate: undefined } }} forecastContext={forecastContext} forecastRecords={[forecast()]} />);
    expect(weekly().getAllByText("Unavailable")).toHaveLength(7);
    expect(weekly().queryByText("No remaining games")).toBeNull();
  });

  it("keeps out-of-horizon records unavailable even if supplied in a selected column", () => {
    const startsAt = "2026-10-12T23:00:00Z";
    const outside = { ...forecastSchedule.THU, gameDate: "2026-10-12", startTimeUTC: startsAt };
    render(<TeamDetails {...defaults} schedule={{ THU: outside }} coveredDates={[...dates, "2026-10-12"]}
      forecastRecords={[forecast({ startsAt })]} forecastContext={{ ...forecastContext, games: [{ ...forecastContext.games[0], startsAt }] }} />);
    expect(within(screen.getByLabelText("Game 1 category forecasts")).getAllByText("Unavailable")).toHaveLength(7);
    expect(screen.queryByText(/Model: fixture-model/)).toBeNull();
  });

  it("labels historical selections without live remaining predictions", () => {
    render(<TeamDetails {...defaults} asOf="2026-10-20T12:00:00Z" schedule={{ SUN: game(2, dates[6]) }} />);
    expect(screen.getByText(/Historical selection — no live remaining forecasts/)).toBeTruthy();
    expect(screen.getByText(/0 confirmed upcoming regular-season games/)).toBeTruthy();
  });
});

function RowDisclosure({ extended = false }: { extended?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  return <table><tbody><TeamRow teamId={12} extended={extended} rank={1} totalGamesPlayed={0}
    totalOffNights={0} weekScore={-100} excludedDays={[]} games={[]}
    expanded={expanded} onToggle={() => setExpanded((value) => !value)}
    details={<TeamDetails {...defaults} />} /></tbody></table>;
}

function TransposedDisclosure() {
  const [expanded, setExpanded] = useState(new Set<number>());
  const [excludedDays, setExcludedDays] = useState<EXTENDED_DAY_ABBREVIATION[]>([]);
  return <TransposedGrid sortedTeams={[
    { teamId: 12, totalGamesPlayed: 1, totalOffNights: 1, weekScore: 1 },
    { teamId: 13, totalGamesPlayed: 2, totalOffNights: 1, weekScore: 2 },
  ]} games={[]} excludedDays={excludedDays} setExcludedDays={setExcludedDays}
    extended={false} start={dates[0]} mode="7-Day" expandedTeamIds={expanded}
    onToggleTeam={(id) => setExpanded((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next; })}
    renderTeamDetails={(teamId) => <TeamDetails {...defaults} teamId={teamId} />} />;
}

describe("Game Grid team disclosures", () => {
  it.each([false, true])("associates the compact row with its sibling panel and restores focus (extended %s)", (extended) => {
    render(<RowDisclosure extended={extended} />);
    const trigger = screen.getByRole("button", { name: "Show Carolina Hurricanes upcoming category forecasts" });
    expect(trigger.tagName).toBe("BUTTON");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(trigger.closest("a")).toBeNull();
    expect(screen.getByRole("link", { name: "Open Carolina Hurricanes Team HQ" }).getAttribute("href")).toBe("/stats/team/CAR");
    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(trigger.getAttribute("aria-label")).toBe("Hide Carolina Hurricanes upcoming category forecasts");
    const panel = document.getElementById(trigger.getAttribute("aria-controls")!);
    expect(panel?.closest("td")?.getAttribute("colspan")).toBe("11");
    const close = screen.getByRole("button", { name: "Close Carolina Hurricanes game previews" });
    close.focus();
    fireEvent.click(close);
    expect(document.activeElement).toBe(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(document.getElementById("game-grid-team-details-12")).toBeNull();
  });

  it("keeps transposed panels anchored to team identity across sorting and independent closes", () => {
    render(<TransposedDisclosure />);
    const carolina = screen.getByRole("button", { name: "Show Carolina Hurricanes upcoming category forecasts" });
    const florida = screen.getByRole("button", { name: "Show Florida Panthers upcoming category forecasts" });
    fireEvent.click(carolina);
    fireEvent.click(florida);
    expect(document.getElementById("game-grid-team-details-12")?.querySelector("h3")?.textContent).toBe("Carolina Hurricanes game previews");
    expect(document.getElementById("game-grid-team-details-13")?.querySelector("h3")?.textContent).toBe("Florida Panthers game previews");
    expect(document.getElementById("game-grid-team-details-12")?.closest("table")).toBeNull();
    fireEvent.click(screen.getAllByRole("columnheader").find((cell) => cell.textContent === "Total GP" && cell.getAttribute("style"))!);
    expect(carolina.getAttribute("aria-expanded")).toBe("true");
    expect(florida.getAttribute("aria-expanded")).toBe("true");
    const close = screen.getByRole("button", { name: "Close Carolina Hurricanes game previews" });
    close.focus();
    fireEvent.click(close);
    expect(document.activeElement).toBe(carolina);
    expect(document.getElementById("game-grid-team-details-12")).toBeNull();
    expect(document.getElementById("game-grid-team-details-13")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open Florida Panthers Team HQ" }).getAttribute("href")).toBe("/stats/team/FLA");
  });
});
