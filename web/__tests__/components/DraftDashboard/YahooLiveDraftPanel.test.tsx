import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import YahooLiveDraftPanel, { YahooDraftOrderReminder, yahooDraftTimeMs } from "../../../components/DraftDashboard/YahooLiveDraftPanel";

afterEach(() => { cleanup(); vi.useRealTimers(); window.sessionStorage.clear(); });

describe("YahooLiveDraftPanel", () => {
  const baseProps = {
    mode: "manual" as const,
    leagues: [],
    selectedLeagueId: "",
    draftState: null,
    reconciliation: {
      draftedPlayers: [],
      unresolved: [],
      warnings: [],
      currentPick: 1,
      expectedNext: { pickNumber: 1, roundNumber: 1, pickInRound: 1, predicted: true as const },
    },
    isLoading: false,
    isPolling: false,
    error: null,
    onLeagueChange: vi.fn(),
    onConnect: vi.fn(),
    onRefreshAccount: vi.fn(),
    onRefreshDraft: vi.fn(),
    onStart: vi.fn(),
    onApplySettings: vi.fn(),
    onStopAndContinueManually: vi.fn(),
  };

  const waitingState = {
    session: { id: "waiting", status: "predraft" as const },
    teams: [{ yahooTeamKey: "team.1", name: "One" }],
    settings: { teamCount: 1, inferredDraftOrder: true }, picks: [],
  };

  it("highlights unapplied settings and removes the cue only when the parent reports they match", () => {
    const props = { ...baseProps, mode: "yahoo" as const, authenticated: true, draftProEligible: true,
      liveSyncEnabled: true, draftState: waitingState, settingsNeedApplying: true };
    const { rerender } = render(<YahooLiveDraftPanel {...props} />);
    const button = screen.getByRole("button", { name: "Apply Yahoo settings" });
    expect(button.className).toContain("applyNeeded");
    fireEvent.click(button);
    expect(button.className).toContain("applyNeeded"); // A cancelled confirmation must not clear it.
    rerender(<YahooLiveDraftPanel {...props} settingsNeedApplying={false} />);
    expect(button.className).not.toContain("applyNeeded");
  });

  it("combines snake notices without disguising actual connection errors", () => {
    render(<YahooLiveDraftPanel {...baseProps} draftState={waitingState}
      reconciliation={{ ...baseProps.reconciliation, warnings: ["Yahoo did not provide an explicit snake or straight draft order."] }}
      error="Reconnect failed" />);
    expect(screen.getAllByText(/Draft format is not confirmed/)).toHaveLength(1);
    expect(screen.queryByText(/did not provide an explicit snake/)).toBeNull();
    expect(screen.getByText("Reconnect failed").closest('[role="alert"]')).toBeTruthy();
  });

  it("shows a dismissible reminder only inside the pre-draft window and remembers dismissal", () => {
    vi.useFakeTimers();
    const start = Date.parse("2026-09-13T20:00:00Z");
    vi.setSystemTime(start - 31 * 60_000);
    const props = { state: waitingState, enabled: true, onReview: vi.fn(),
      league: { externalLeagueId: "league", name: "League", supported: true, draftTime: String(start / 1000) } };
    const { unmount } = render(<YahooDraftOrderReminder {...props} />);
    expect(screen.queryByRole("button", { name: "Refresh leagues & review" })).toBeNull();
    act(() => vi.advanceTimersByTime(60_000));
    fireEvent.click(screen.getByRole("button", { name: "Refresh leagues & review" }));
    expect(props.onReview).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "Dismiss" })).toBeNull();
    unmount();
    render(<YahooDraftOrderReminder {...props} />);
    expect(screen.queryByRole("button", { name: "Dismiss" })).toBeNull();
  });

  it.each(["disabled", "started", "complete-order", "missing-time", "at-start"])("does not prompt for %s", (condition) => {
    vi.useFakeTimers();
    const start = Date.parse("2026-09-13T20:00:00Z");
    vi.setSystemTime(condition === "at-start" ? start : start - 10 * 60_000);
    render(<YahooDraftOrderReminder enabled={condition !== "disabled"} onReview={vi.fn()}
      league={{ externalLeagueId: "league", name: "League", supported: true,
        draftTime: condition === "missing-time" ? undefined : new Date(start).toISOString() }}
      state={{ ...waitingState, session: { ...waitingState.session, status: condition === "started" ? "active" : "predraft" },
        teams: [{ ...waitingState.teams[0], draftPosition: condition === "complete-order" ? 1 : undefined }] }} />);
    expect(screen.queryByRole("button", { name: "Dismiss" })).toBeNull();
  });

  it("also reminds a connected league before sync starts", () => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.parse("2026-09-13T19:45:00Z"));
    render(<YahooDraftOrderReminder enabled onReview={vi.fn()} state={null}
      league={{ externalLeagueId: "league", name: "League", supported: true,
        draftStatus: "predraft", draftTime: "2026-09-13T20:00:00Z" }} />);
    expect(screen.getByRole("button", { name: "Dismiss" })).toBeTruthy();
  });

  it("asks whether missing positions are already set, refreshing only on confirmation", () => {
    const refresh = vi.fn();
    const props = { ...baseProps, draftState: waitingState, mode: "yahoo" as const,
      authenticated: true, draftProEligible: true, liveSyncEnabled: true, onRefreshAccount: refresh,
      selectedLeagueId: "one" };
    const { rerender } = render(<YahooLiveDraftPanel {...props} />);
    expect((screen.getByRole("button", { name: /^Confirm$/ }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("radio", { name: "Already set" }));
    expect(refresh).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /^Confirm$/ }));
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/FHFH’s order remains provisional/)).toBeTruthy();
    rerender(<YahooLiveDraftPanel {...props} selectedLeagueId="two" />);
    fireEvent.click(screen.getByRole("radio", { name: "Randomized before the draft" }));
    fireEvent.click(screen.getByRole("button", { name: /^Confirm$/ }));
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/A reminder appears in the final 30 minutes/)).toBeTruthy();
  });

  it("reports imported playoffs separately from unknown playoff settings", () => {
    const { rerender } = render(<YahooLiveDraftPanel {...baseProps} mode="yahoo"
      draftState={{ ...waitingState, settings: { ...waitingState.settings, playoffWeeks: [24, 25, 26] } }} />);
    expect(screen.getByText(/Yahoo weeks 24, 25, 26 · synced automatically/)).toBeTruthy();
    rerender(<YahooLiveDraftPanel {...baseProps} draftState={waitingState} />);
    expect(screen.getByText(/Your existing selection is preserved/)).toBeTruthy();
  });

  it("parses Unix seconds, milliseconds and zoned dates without guessing a timezone", () => {
    const expected = Date.parse("2026-09-13T20:00:00Z");
    for (const value of [expected / 1000, String(expected), "2026-09-13T13:00:00-07:00"]) {
      expect(yahooDraftTimeMs(value)).toBe(expected);
    }
    for (const value of [null, "", "2026-09-13 13:00", "garbage"]) expect(yahooDraftTimeMs(value)).toBeNull();
  });

  it.each([
    ["signed out", { authenticated: false, draftProEligible: false, liveSyncEnabled: false }, "Sign in required", "Sign in"],
    ["free", { authenticated: true, draftProEligible: false, liveSyncEnabled: false }, "Draft Pro required", "Explore Draft Pro"],
    ["paid and preparing", { authenticated: true, draftProEligible: true, liveSyncEnabled: false, requestState: "loading" as const }, "Preparing", null],
    ["paid but unavailable", { authenticated: true, draftProEligible: true, liveSyncEnabled: false, requestState: "ready" as const }, "Unavailable", null],
    ["paid and ready", { authenticated: true, draftProEligible: true, liveSyncEnabled: true }, "Ready to connect", null],
  ])("keeps the Yahoo setup visible for %s", (_name, state, status, linkName) => {
    render(<YahooLiveDraftPanel {...baseProps} {...state} />);
    expect(screen.getByText(status)).toBeTruthy();
    if (linkName) expect(screen.getByRole("link", { name: linkName })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Yahoo Fantasy Draft Sync" })).toBeTruthy();
    if (state.liveSyncEnabled) expect(screen.getByText("Connect your Yahoo draft")).toBeTruthy();
    expect(screen.queryByText(/did not provide an explicit snake or straight draft order/)).toBeNull();
  });

  it("gates live actions while keeping stop available after access loss", () => {
    render(
      <YahooLiveDraftPanel
        {...baseProps}
        authenticated
        draftProEligible
        liveSyncEnabled={false}
        requestState="ready"
        mode="yahoo"
      />,
    );

    expect((screen.getByRole("button", { name: "Refresh leagues" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Check for updates" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Apply Yahoo settings" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Stop & continue manually" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("shows live status, predicted next pick, unresolved picks, and Yahoo attribution", () => {
    const onStop = vi.fn();
    const onApplySettings = vi.fn();
    render(
      <YahooLiveDraftPanel
        mode="yahoo"
        authenticated
        draftProEligible
        liveSyncEnabled
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
    expect(screen.getByText(/Applying updates roster and scoring/)).toBeTruthy();
    expect(screen.getByText("Your team: Tim's Team")).toBeTruthy();
    expect(screen.getByText(/Yahoo updates are delayed/)).toBeTruthy();
    expect(screen.getByText(/use Quick Fix to assign the players manually/)).toBeTruthy();
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
