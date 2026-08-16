import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import YahooLiveDraftPanel from "../../../components/DraftDashboard/YahooLiveDraftPanel";

afterEach(cleanup);

describe("YahooLiveDraftPanel", () => {
  it("shows live status, predicted next pick, unresolved picks, and Yahoo attribution", () => {
    const onStop = vi.fn();
    const onApplySettings = vi.fn();
    render(
      <YahooLiveDraftPanel
        mode="yahoo"
        leagues={[
          {
            externalLeagueId: "league-1",
            name: "League One",
            teamName: "Tim's Team",
            season: 2026,
            supported: true,
          },
        ]}
        selectedLeagueId="league-1"
        draftState={{
          session: {
            id: "session-1",
            status: "active",
            snapshotVersion: 8,
            yahooLeagueUrl: "https://hockey.fantasysports.yahoo.com/draft-room",
            stale: true,
          },
          teams: [
            {
              yahooTeamKey: "team.1",
              name: "First Team",
              draftPosition: 1,
            },
          ],
          settings: {
            teamCount: 1,
            isSnakeDraft: true,
            rosterConfig: { C: 1, G: 1 },
            requiresScoringConfirmation: true,
            scoringCategories: { GOALS: 3 },
          },
          picks: [
            {
              pickNumber: 1,
              roundNumber: 1,
              pickInRound: 1,
              yahooTeamKey: "team.1",
              yahooPlayerId: "999",
              displayName: "Unknown Player",
              active: true,
            },
          ],
        }}
        reconciliation={{
          draftedPlayers: [],
          unresolved: [
            {
              pickNumber: 1,
              yahooPlayerId: "999",
              displayName: "Unknown Player",
              reason: "No exact mapping",
            },
          ],
          warnings: [],
          currentPick: 2,
          expectedNext: {
            pickNumber: 2,
            roundNumber: 2,
            pickInRound: 1,
            yahooTeamKey: "team.1",
            teamName: "First Team",
            predicted: true,
          },
        }}
        isLoading={false}
        isPolling={false}
        error={null}
        onLeagueChange={vi.fn()}
        onConnect={vi.fn()}
        onRefreshAccount={vi.fn()}
        onRefreshDraft={vi.fn()}
        onStart={vi.fn()}
        onApplySettings={onApplySettings}
        onStopAndContinueManually={onStop}
        />
    );

    expect(screen.getByText("Live")).toBeTruthy();
    expect(screen.getByText("Pick 2")).toBeTruthy();
    expect(screen.getByText(/predicted/)).toBeTruthy();
    expect(
      screen.getByText(/could not be mapped automatically/).closest('[role="alert"]')
        ?.textContent,
    ).toContain("Unknown Player");
    expect(screen.getByText(/scoring values incomplete/)).toBeTruthy();
    expect(screen.getByText("Your team: Tim's Team")).toBeTruthy();
    expect(screen.getByText(/Live updates are stale/)).toBeTruthy();
    const attribution = screen.getByRole("img", { name: "Powered by Yahoo" });
    expect(attribution.getAttribute("src")).toBe(
      "https://poweredby.yahoo.com/poweredby_yahoo_h_white_retina.png",
    );
    expect(attribution.closest("a")?.getAttribute("href")).toBe(
      "https://www.yahoo.com/?ilc=401",
    );
    expect(
      screen.getByRole("link", { name: "Create a personal board" }).getAttribute(
        "href",
      ),
    ).toBe("/draft-rankings");
    expect(
      screen.getByRole("link", { name: /Open Yahoo draft room/ }).getAttribute(
        "href",
      ),
    ).toBe("https://hockey.fantasysports.yahoo.com/draft-room");

    fireEvent.click(screen.getByRole("button", { name: "Apply Yahoo settings" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Stop & continue manually" }),
    );
    expect(onApplySettings).toHaveBeenCalledTimes(1);
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it("keeps an unsupported league visible and explains why Start is disabled", () => {
    render(
      <YahooLiveDraftPanel
        mode="manual"
        leagues={[
          {
            externalLeagueId: "salary-league",
            name: "Salary League",
            supported: false,
            unsupportedReason: "yahoo_salary_cap_unsupported",
          },
        ]}
        selectedLeagueId="salary-league"
        draftState={null}
        reconciliation={{
          draftedPlayers: [],
          unresolved: [],
          warnings: [],
          currentPick: 1,
          expectedNext: {
            pickNumber: 1,
            roundNumber: 1,
            pickInRound: 1,
            predicted: true,
          },
        }}
        isLoading={false}
        isPolling={false}
        error={null}
        onLeagueChange={vi.fn()}
        onConnect={vi.fn()}
        onRefreshAccount={vi.fn()}
        onRefreshDraft={vi.fn()}
        onStart={vi.fn()}
        onApplySettings={vi.fn()}
        onStopAndContinueManually={vi.fn()}
      />,
    );

    expect(
      (screen.getByRole("button", { name: "Start live sync" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(screen.getByRole("alert").textContent).toContain(
      "Salary-cap Yahoo drafts are not supported",
    );
    expect(screen.getByRole("alert").textContent).not.toContain(
      "yahoo_salary_cap_unsupported",
    );
  });
});
