import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const getSession = vi.hoisted(() => vi.fn());
vi.mock("lib/supabase/client", () => ({ default: { auth: { getSession } } }));

import SuggestedPicks from "../../../components/DraftDashboard/SuggestedPicks";
import { draftProRecommendationsInputSchema } from "../../../lib/draft-pro/recommendationsContract";

function player(playerId: number, name: string, position: string, points: number) {
  return {
    playerId,
    fullName: name,
    displayTeam: "TST",
    displayPosition: position,
    eligiblePositions: position.split(","),
    combinedStats: {},
    fantasyPoints: {
      projected: points,
      actual: null,
      diffPercentage: null,
      projectedPerGame: null,
      actualPerGame: null
    },
    yahooAvgPick: playerId
  } as any;
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("SuggestedPicks grouped-forward presentation", () => {
  it("replaces stale split filters with FWD and filters cards by that contract", async () => {
    window.localStorage.setItem(
      "suggested.posFilterMulti",
      JSON.stringify(["C"])
    );
    const players = [
      player(1, "Multi Forward", "C,LW", 100),
      player(2, "Defense Player", "D", 80)
    ];

    render(
      <SuggestedPicks
        players={players}
        currentPick={1}
        teamCount={1}
        forwardGrouping="fwd"
        rosterProgress={[
          { pos: "FWD", filled: 0, total: 3 },
          { pos: "D", filled: 0, total: 1 }
        ]}
      />
    );

    const positionSelect = screen.getByRole("combobox", {
      name: "Filter by position"
    }) as HTMLSelectElement;
    const options = Array.from(positionSelect.options).map((option) => option.value);
    expect(options).toContain("FWD");
    expect(options).not.toContain("C");
    expect(options).not.toContain("LW");
    expect(screen.getAllByText("FWD").length).toBeGreaterThan(0);

    await waitFor(() =>
      expect(window.localStorage.getItem("suggested.posFilterMulti")).toBe("[]")
    );

    fireEvent.click(screen.getByRole("button", { name: "FWD 0 of 3" }));
    expect(screen.getByText("Multi Forward")).toBeTruthy();
    expect(screen.queryByText("Defense Player")).toBeNull();
  });

  it("defaults to canonical risk-aware rank and exposes working draft/compare actions", () => {
    const players = [
      { ...player(1, "Urgent Player", "C", 100), yahooAvgPick: 2 },
      { ...player(2, "Later Player", "D", 90), yahooAvgPick: 100 }
    ];
    const metrics = new Map([
      ["1", { vbd: 10, vorp: 10, vona: 0 } as any],
      ["2", { vbd: 11, vorp: 11, vona: 0 } as any]
    ]);
    const onDraftPlayer = vi.fn();
    const onComparePlayer = vi.fn();
    render(
      <SuggestedPicks
        players={players}
        vorpMetrics={metrics}
        currentPick={1}
        nextPickNumber={10}
        teamCount={1}
        onDraftPlayer={onDraftPlayer}
        onComparePlayer={onComparePlayer}
      />
    );

    expect(
      (screen.getByRole("combobox", { name: "Sort suggested picks" }) as HTMLSelectElement)
        .value
    ).toBe("rank");
    expect(screen.getAllByRole("listitem")[0].textContent).toContain(
      "Urgent Player"
    );
    expect(screen.getAllByTitle("Probability of remaining available at your next pick")[0].textContent).toContain("%");
    expect(screen.queryByText(/Gone by next pick/)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Draft Urgent Player" }));
    fireEvent.click(
      screen.getByRole("button", {
        name: "Add Urgent Player to comparison"
      })
    );
    expect(onDraftPlayer).toHaveBeenCalledWith("1");
    expect(onComparePlayer).toHaveBeenCalledWith("1");
  });

  it("renders an honest empty state when no available players remain", () => {
    render(<SuggestedPicks players={[]} currentPick={1} teamCount={1} />);
    expect(screen.getByText("No matching available players")).toBeTruthy();
  });

  it("connects disclosure buttons to the content they control", () => {
    render(<SuggestedPicks players={[]} currentPick={1} teamCount={1} />);
    const advanced = screen.getByRole("button", { name: "Advanced" });
    expect(advanced.getAttribute("aria-controls")).toBe(
      "suggested-picks-advanced-controls",
    );
    fireEvent.click(advanced);
    expect(
      screen.getByRole("button", { name: "Hide cards" }).getAttribute(
        "aria-controls",
      ),
    ).toBe("suggested-picks-cards");
    fireEvent.click(screen.getByRole("button", { name: "Hide cards" }));
    expect(document.getElementById("suggested-picks-cards")?.hidden).toBe(true);
  });

  it("shows personal rank without changing it and locks Yahoo-mode drafting", () => {
    const onDraftPlayer = vi.fn();
    render(
      <SuggestedPicks
        players={[player(1, "Ranked Player", "C", 100)]}
        currentPick={1}
        teamCount={1}
        onDraftPlayer={onDraftPlayer}
        canDraft={false}
        personalRankByPlayerId={{ "1": 4 }}
      />
    );

    expect(screen.getAllByText("My Rank")).toHaveLength(2);
    expect(screen.getByText("4")).toBeTruthy();
    expect(
      Array.from(
        screen.getByRole<HTMLSelectElement>("combobox", {
          name: "Sort suggested picks"
        }).options
      ).map((option) => option.value)
    ).toContain("myRank");
    const draftButton = screen.getByRole("button", {
      name: "Draft Ranked Player"
    });
    expect((draftButton as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(draftButton);
    expect(onDraftPlayer).not.toHaveBeenCalled();
  });

  it("uses the authenticated Draft Pro rank order only when the capability is active", async () => {
    getSession.mockResolvedValue({ data: { session: { access_token: "token" } } });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [
      { candidate: { id: "2" }, recommendationScore: 20, globalVorp: 9, availabilityEstimate: .8, reasons: ["Roster need"] },
      { candidate: { id: "1" }, recommendationScore: 10, globalVorp: 10, availabilityEstimate: .7, reasons: ["Standard"] },
    ] }) }));
    const players = [player(1, "First Player", "C", 100), player(2, "Roster Fit", "D", 90)];
    const metrics = new Map([["1", { vbd: 10, vorp: 10, vona: 0 } as any], ["2", { vbd: 9, vorp: 9, vona: 0 } as any]]);
    render(<SuggestedPicks players={players} vorpMetrics={metrics} currentPick={1} teamCount={1} draftProEligible needWeightEnabled categoryWeights={{ GOALS: 1 }} onNeedWeightEnabledChange={vi.fn()} />);
    await waitFor(() => expect(screen.getAllByRole("listitem")[0].textContent).toContain("Roster Fit"));
  });

  it("does not send local CSV rows to Draft Pro recommendations and explains the lock", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<SuggestedPicks players={[player(1, "Local Player", "C", 100)]} currentPick={1} teamCount={1} draftProEligible recommendationDataOrigin="local_csv" />);
    expect(screen.getByText(/Save the import to your account first/)).toBeTruthy();
    expect((screen.getByRole("checkbox", { name: "Prioritize my roster needs" }) as HTMLInputElement).disabled).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("serializes filtered skater and goalie candidates within the endpoint's output bound", async () => {
    getSession.mockResolvedValue({ data: { session: { access_token: "token" } } });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [] }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<SuggestedPicks players={[player(1, "Skater", "C", 100), player(2, "Goalie", "G", 90)]} currentPick={1} teamCount={1} draftProEligible />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const request = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body);
    expect(draftProRecommendationsInputSchema.parse(request)).toEqual(request);
    expect(request.limit).toBe(100);
    expect(request.candidates.map((candidate: { role: string }) => candidate.role).sort()).toEqual(["goalie", "skater"]);
  });

  it("does not request paid analysis for an empty filtered player pool", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<SuggestedPicks players={[]} currentPick={1} teamCount={1} draftProEligible />);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("exposes ordinary and schedule-fit DUST sorting only when DUST is available", () => {
    const onDustSortChange = vi.fn();
    const { rerender } = render(<SuggestedPicks players={[player(1, "Player", "C", 100)]} currentPick={1} teamCount={1} dustSort="ordinary" onDustSortChange={onDustSortChange} />);
    expect((screen.getByRole("combobox", { name: "DUST sort" }) as HTMLSelectElement).disabled).toBe(true);
    rerender(<SuggestedPicks players={[player(1, "Player", "C", 100)]} currentPick={1} teamCount={1} canUseProDust dustSort="ordinary" onDustSortChange={onDustSortChange} />);
    fireEvent.change(screen.getByRole("combobox", { name: "DUST sort" }), { target: { value: "schedule_fit" } });
    expect(onDustSortChange).toHaveBeenCalledWith("schedule_fit");
  });

  it("orders visible candidates by active games, then value, for schedule-fit DUST", () => {
    const players = [player(1, "Higher Value", "C", 100), player(2, "More Active Games", "G", 90)];
    const metrics = new Map([["1", { vbd: 10, vorp: 10, vona: 0 } as any], ["2", { vbd: 9, vorp: 9, vona: 0 } as any]]);
    const dustInsights = new Map([["1", { activeGamesAdded: 2, marginalDustGames: 1, candidateScheduledGames: 8, dustRate: .1, risk: "moderate" } as any], ["2", { activeGamesAdded: 5, marginalDustGames: 1, candidateScheduledGames: 8, dustRate: .1, risk: "moderate" } as any]]);
    render(<SuggestedPicks players={players} vorpMetrics={metrics} currentPick={1} teamCount={1} dustInsights={dustInsights} dustSort="schedule_fit" canUseProDust />);
    expect(screen.getAllByRole("listitem")[0].textContent).toContain("More Active Games");
  });

  it("keeps ordinary ranking while schedule-fit DUST insights are unavailable", () => {
    const players = [
      { ...player(1, "Urgent Player", "C", 90), yahooAvgPick: 2 },
      { ...player(2, "Higher Value", "C", 100), yahooAvgPick: 100 },
    ];
    const metrics = new Map([["1", { value: 90, vbd: 9, vorp: 9, vona: 0 } as any], ["2", { value: 100, vbd: 10, vorp: 10, vona: 0 } as any]]);
    render(<SuggestedPicks players={players} vorpMetrics={metrics} currentPick={1} nextPickNumber={10} teamCount={1} dustInsights={new Map()} dustSort="schedule_fit" canUseProDust />);
    expect(screen.getAllByRole("listitem")[0].textContent).toContain("Urgent Player");
  });

  it("labels weekly DUST lineup analysis as unavailable", () => {
    const onDustLineupModeChange = vi.fn();
    render(<SuggestedPicks players={[player(1, "Player", "C", 100)]} currentPick={1} teamCount={1} canUseProDust dustLineupMode="daily" onDustLineupModeChange={onDustLineupModeChange} />);
    fireEvent.change(screen.getByRole("combobox", { name: "DUST lineup mode" }), { target: { value: "weekly" } });
    expect(onDustLineupModeChange).toHaveBeenCalledWith("weekly");
    expect(screen.getByRole("option", { name: "Weekly lock (unavailable)" })).toBeTruthy();
  });

  it("surfaces a schedule-fit player outside the ordinary recommendation output", () => {
    const players = Array.from({ length: 201 }, (_, index) => player(index + 1, `Player ${index + 1}`, index === 200 ? "G" : "C", 300 - index));
    const metrics = new Map(players.map((candidate, index) => [String(candidate.playerId), { vbd: 300 - index, vorp: 300 - index, vona: 0 } as any]));
    const dustInsights = new Map([["201", { activeGamesAdded: 9, marginalDustGames: 0, candidateScheduledGames: 8, dustRate: 0, risk: "low" } as any]]);
    render(<SuggestedPicks players={players} vorpMetrics={metrics} currentPick={1} teamCount={1} dustInsights={dustInsights} dustSort="schedule_fit" canUseProDust />);
    expect(screen.getAllByRole("listitem")[0].textContent).toContain("Player 201");
  });

  it("sends a goalie-only filtered request through the shared contract", async () => {
    getSession.mockResolvedValue({ data: { session: { access_token: "token" } } });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [] }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<SuggestedPicks players={[player(1, "Goalie", "G", 90)]} currentPick={1} teamCount={1} draftProEligible />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const request = draftProRecommendationsInputSchema.parse(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body));
    expect(request.candidates).toHaveLength(1);
    expect(request.candidates[0]?.role).toBe("goalie");
  });

  it("sends more than 200 filtered candidates without dropping later positions", async () => {
    getSession.mockResolvedValue({ data: { session: { access_token: "token" } } });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [] }) });
    vi.stubGlobal("fetch", fetchMock);
    const players = Array.from({ length: 201 }, (_, index) => player(index + 1, `Player ${index + 1}`, index === 200 ? "G" : "C", 100 - index));
    render(<SuggestedPicks players={players} currentPick={1} teamCount={1} draftProEligible />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const request = draftProRecommendationsInputSchema.parse(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body));
    expect(request.candidates).toHaveLength(201);
    expect(request.candidates.at(-1)?.role).toBe("goalie");
  });
});
