import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({ default: ({ children, href, ...rest }: any) => <a href={String(href)} {...rest}>{children}</a> }));

import FocusedSlateContext from "components/forge-command-center/FocusedSlateContext";
import GoalieContextPanel from "components/forge-command-center/GoalieContextPanel";
import { normalizeGoalieResponse, normalizeStartChartResponse } from "lib/dashboard/normalizers";

const moduleState = <T,>(data: T) => ({ status: "ready" as const, data, requestedDate: "2026-03-14", resolvedDate: "2026-03-14",
  fallbackApplied: false, message: null, error: null, contract: { label: "Fixture" } as any });

describe("goalie readers on the FORGE command center", () => {
  it("labels the legacy Start Chart number as an L10 start share (W1 P0 #17)", () => {
    const slate = normalizeStartChartResponse({ dateUsed: "2026-03-14", goalieStartBasis: "l10_start_share", games: [{
      id: 1, date: "2026-03-14", homeTeamId: 1, awayTeamId: 2,
      homeGoalies: [{ player_id: 10, name: "Home Goalie", start_probability: 0.7 }], awayGoalies: [] }] });
    render(<FocusedSlateContext module={moduleState(slate)} selectedTeam="all" startChartHref="/start-chart" />);
    expect(screen.getByText(/L10 start share 70%/)).toBeTruthy();
    expect(screen.queryByText(/Projected 70%/)).toBeNull();
  });

  it("shows each candidate's Win if he starts and the team win separately (decision 25)", () => {
    const goalies = normalizeGoalieResponse({ data: [
      { goalie_id: 1, goalie_name: "Starter", team_abbreviation: "NJD", row_basis: "candidate_goalie_game",
        starter_probability: 0.62, proj_win_prob: 0.42, team_win_prob: 0.45 },
      { goalie_id: 2, goalie_name: "Backup", team_abbreviation: "NJD", row_basis: "candidate_goalie_game",
        starter_probability: 0.38, proj_win_prob: 0.33, team_win_prob: 0.45 },
    ] });
    render(<GoalieContextPanel module={moduleState(goalies)} selectedTeam="all" playerHref={(id) => `/players/${id}`} />);
    expect(screen.getByText("Win if starts 42%")).toBeTruthy();
    expect(screen.getByText("Win if starts 33%")).toBeTruthy();
    expect(screen.getAllByText("Team win 45%")).toHaveLength(2);
    expect(screen.queryByText(/^Win 42%/)).toBeNull();
  });
});
