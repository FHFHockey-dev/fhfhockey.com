import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PLAYER_STATS_TABLE_RENDERING_STRATEGY } from "lib/underlying-stats/playerStatsTypes";
import type { PlayerStatsTableFamily } from "lib/underlying-stats/playerStatsTypes";

import PlayerStatsTable from "./PlayerStatsTable";
import PlayerStatsTableState from "./PlayerStatsTableState";

afterEach(() => {
  cleanup();
});

describe("PlayerStatsTable", () => {
  it.each<
    [PlayerStatsTableFamily, string, string, string]
  >([
    ["individualCounts", "Goals", "Sort by Total Points", "Sort by SH%"],
    ["individualRates", "Goals/60", "Sort by Total Points/60", "Sort by SH%"],
    ["onIceCounts", "CF", "Sort by xGF%", "Sort by HDGF%"],
    ["onIceRates", "CF/60", "Sort by xGF%", "Sort by HDGF%"],
    ["goalieCounts", "Shots Against", "Sort by SV%", "Sort by Avg Shot Distance"],
    ["goalieRates", "Shots Against/60", "Sort by SV%", "Sort by Avg Goal Distance"],
  ])(
    "renders the %s column family with the expected default active sort",
    (family, metricHeaderLabel, activeSortLabel, secondarySortLabel) => {
      const row =
        family === "goalieCounts" || family === "goalieRates"
          ? {
              rowKey: `${family}-row`,
              playerName: "Sergei Bobrovsky",
              teamLabel: "FLA",
              gamesPlayed: 54,
              toiSeconds: 10234,
              toiPerGameSeconds: 189.5,
              shotsAgainst: 1632,
              saves: 1491,
              goalsAgainst: 141,
              savePct: 0.914,
              gaa: 2.41,
              gsaa: 4.86,
              gsaaPer60: 0.11,
              xgAgainst: 148.22,
              xgAgainstPer60: 2.52,
              hdShotsAgainst: 401,
              hdSaves: 347,
              hdGoalsAgainst: 54,
              hdSavePct: 0.866,
              hdGaa: 1.08,
              hdGsaa: 2.14,
              hdGsaaPer60: 0.06,
              mdShotsAgainst: 543,
              mdSaves: 504,
              mdGoalsAgainst: 39,
              mdSavePct: 0.929,
              mdGaa: 0.81,
              mdGsaa: 1.21,
              mdGsaaPer60: 0.03,
              ldShotsAgainst: 688,
              ldSaves: 640,
              ldGoalsAgainst: 48,
              ldSavePct: 0.93,
              ldGaa: 0.52,
              ldGsaa: 1.51,
              ldGsaaPer60: 0.02,
              rushAttemptsAgainst: 40,
              rushAttemptsAgainstPer60: 2.4,
              reboundAttemptsAgainst: 31,
              reboundAttemptsAgainstPer60: 1.9,
              avgShotDistance: 33.4,
              avgGoalDistance: 19.8,
              shotsAgainstPer60: 29.1,
              savesPer60: 27.4,
            }
          : {
              rowKey: `${family}-row`,
              playerName: "Sam Bennett",
              teamLabel: "FLA",
              positionCode: "C",
              gamesPlayed: 82,
              toiSeconds: 3723,
              toiPerGameSeconds: 45.4,
              goals: 25,
              goalsPer60: 1.61,
              totalAssists: 24,
              totalAssistsPer60: 1.55,
              firstAssists: 16,
              firstAssistsPer60: 1.03,
              secondAssists: 8,
              secondAssistsPer60: 0.52,
              totalPoints: 49,
              totalPointsPer60: 3.16,
              ipp: 0.62,
              shots: 211,
              shotsPer60: 8.9,
              shootingPct: 0.118,
              ixg: 19.44,
              ixgPer60: 0.94,
              iCf: 302,
              iCfPer60: 12.13,
              iFf: 231,
              iFfPer60: 9.3,
              iScf: 157,
              iScfPer60: 6.32,
              iHdcf: 62,
              iHdcfPer60: 2.51,
              rushAttempts: 28,
              rushAttemptsPer60: 1.13,
              reboundsCreated: 17,
              reboundsCreatedPer60: 0.68,
              pim: 78,
              pimPer60: 3.12,
              totalPenalties: 39,
              totalPenaltiesPer60: 1.57,
              minorPenalties: 38,
              minorPenaltiesPer60: 1.53,
              majorPenalties: 1,
              majorPenaltiesPer60: 0.04,
              misconductPenalties: 0,
              misconductPenaltiesPer60: 0,
              penaltiesDrawn: 31,
              penaltiesDrawnPer60: 1.25,
              giveaways: 19,
              giveawaysPer60: 0.76,
              takeaways: 37,
              takeawaysPer60: 1.49,
              hits: 188,
              hitsPer60: 7.56,
              hitsTaken: 74,
              hitsTakenPer60: 2.98,
              shotsBlocked: 41,
              shotsBlockedPer60: 1.65,
              faceoffsWon: 402,
              faceoffsWonPer60: 16.17,
              faceoffsLost: 367,
              faceoffsLostPer60: 14.75,
              faceoffPct: 0.523,
              cf: 1001,
              cfPer60: 47.22,
              ca: 919,
              caPer60: 43.33,
              cfPct: 0.521,
              ff: 756,
              ffPer60: 35.64,
              fa: 702,
              faPer60: 33.08,
              ffPct: 0.519,
              sf: 542,
              sfPer60: 25.55,
              sa: 498,
              saPer60: 23.47,
              sfPct: 0.521,
              gf: 61,
              gfPer60: 2.87,
              ga: 49,
              gaPer60: 2.31,
              gfPct: 0.555,
              xgf: 54.66,
              xgfPer60: 2.58,
              xga: 48.91,
              xgaPer60: 2.31,
              xgfPct: 0.528,
              scf: 431,
              scfPer60: 20.32,
              sca: 380,
              scaPer60: 17.92,
              scfPct: 0.531,
              hdcf: 173,
              hdcfPer60: 8.15,
              hdca: 144,
              hdcaPer60: 6.79,
              hdcfPct: 0.546,
              hdgf: 27,
              hdgfPer60: 1.27,
              hdga: 19,
              hdgaPer60: 0.9,
              hdgfPct: 0.587,
              mdcf: 149,
              mdcfPer60: 7.03,
              mdca: 137,
              mdcaPer60: 6.46,
              mdcfPct: 0.521,
              mdgf: 21,
              mdgfPer60: 0.99,
              mdga: 18,
              mdgaPer60: 0.85,
              mdgfPct: 0.538,
              ldcf: 109,
            };

      const sortState =
        family === "individualCounts"
          ? { sortKey: "totalPoints", direction: "desc" as const }
          : family === "individualRates"
            ? { sortKey: "totalPointsPer60", direction: "desc" as const }
            : family === "goalieCounts" || family === "goalieRates"
              ? { sortKey: "savePct", direction: "desc" as const }
              : { sortKey: "xgfPct", direction: "desc" as const };

      render(<PlayerStatsTable family={family} rows={[row]} sortState={sortState} />);

      expect(
        screen.getByRole("button", { name: activeSortLabel }).getAttribute(
          "aria-pressed"
        )
      ).toBe("true");
      expect(
        screen.getByRole("button", { name: secondarySortLabel }).getAttribute(
          "aria-pressed"
        )
      ).toBe("false");
      expect(screen.getByText(metricHeaderLabel)).toBeTruthy();
    }
  );

  it("renders a wide sortable table shell with sticky identity offsets", () => {
    render(
      <PlayerStatsTable
        family="individualCounts"
        rows={[
          {
            rowKey: "player-1",
            playerName: "Sam Bennett",
            teamLabel: "FLA",
            positionCode: "C",
            gamesPlayed: 82,
            toiSeconds: 3723,
            goals: 25,
            totalAssists: 24,
            firstAssists: 16,
            secondAssists: 8,
            totalPoints: 49,
            ipp: 0.62,
            shots: 211,
            shootingPct: 0.118,
            ixg: 19.44,
            iCf: 302,
            iFf: 231,
            iScf: 157,
            iHdcf: 62,
            rushAttempts: 28,
            reboundsCreated: 17,
            pim: 78,
            totalPenalties: 39,
            minorPenalties: 38,
            majorPenalties: 1,
            misconductPenalties: 0,
            penaltiesDrawn: 31,
            giveaways: 19,
            takeaways: 37,
            hits: 188,
            hitsTaken: 74,
            shotsBlocked: 41,
            faceoffsWon: 402,
            faceoffsLost: 367,
            faceoffPct: 0.523,
          },
        ]}
        sortState={{ sortKey: "totalPoints", direction: "desc" }}
      />
    );

    const table = screen.getByRole("table");
    expect(table).toBeTruthy();

    const playerHeader = screen.getByRole("button", { name: "Sort by Player" });
    const teamHeader = screen.getByRole("button", { name: "Sort by Team" });
    const positionHeader = screen.getByRole("button", { name: "Sort by Position" });

    expect((playerHeader.closest("th") as HTMLTableCellElement).style.left).toBe("0px");
    expect((teamHeader.closest("th") as HTMLTableCellElement).style.left).toBe("188px");
    expect((positionHeader.closest("th") as HTMLTableCellElement).style.left).toBe("260px");
    expect(screen.getByText("POS")).toBeTruthy();

    const row = within(table).getByText("Sam Bennett").closest("tr");
    expect(row).toBeTruthy();
    expect(within(row as HTMLElement).getByText("62:03")).toBeTruthy();
    expect(within(row as HTMLElement).getByText("52.3%")).toBeTruthy();
  });

  it("emits the next canonical sort state when a header is clicked", () => {
    const onSortChange = vi.fn();

    render(
      <PlayerStatsTable
        family="goalieRates"
        rows={[
          {
            rowKey: "goalie-1",
            playerName: "Sergei Bobrovsky",
            teamLabel: "FLA",
            gamesPlayed: 54,
            toiSeconds: 10234,
            toiPerGameSeconds: 189.5,
            shotsAgainstPer60: 29.1,
            savesPer60: 27.4,
            savePct: 0.914,
            gaa: 2.41,
            gsaaPer60: 0.11,
            xgAgainstPer60: 2.52,
            hdShotsAgainstPer60: 8.2,
            hdSavesPer60: 7.1,
            hdSavePct: 0.866,
            hdGaa: 1.08,
            hdGsaaPer60: 0.06,
            mdShotsAgainstPer60: 11.2,
            mdSavesPer60: 10.4,
            mdSavePct: 0.929,
            mdGaa: 0.81,
            mdGsaaPer60: 0.03,
            ldShotsAgainstPer60: 9.7,
            ldSavesPer60: 9.3,
            ldSavePct: 0.959,
            ldGaa: 0.39,
            ldGsaaPer60: 0.02,
            rushAttemptsAgainstPer60: 2.4,
            reboundAttemptsAgainstPer60: 1.9,
            avgShotDistance: 33.4,
            avgGoalDistance: 19.8,
          },
        ]}
        sortState={{ sortKey: "savePct", direction: "desc" }}
        onSortChange={onSortChange}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Sort by SV%" }));
    expect(onSortChange).toHaveBeenCalledWith({
      sortKey: "savePct",
      direction: "asc",
    });

    fireEvent.click(screen.getByRole("button", { name: "Sort by GAA" }));
    expect(onSortChange).toHaveBeenLastCalledWith({
      sortKey: "gaa",
      direction: "desc",
    });
  });

  it("formats counts, rates, percentages, decimals, and distances using the shared table value formatters", () => {
    const { rerender } = render(
      <PlayerStatsTable
        family="individualCounts"
        rows={[
          {
            rowKey: "player-1",
            playerName: "Sam Bennett",
            teamLabel: "FLA",
            positionCode: "C",
            gamesPlayed: 82,
            toiSeconds: 3723,
            goals: 25,
            totalAssists: 24,
            firstAssists: 16,
            secondAssists: 8,
            totalPoints: 49,
            ipp: 0.62,
            shots: 1211,
            shootingPct: 0.118,
            ixg: 19.44,
            iCf: 302,
            iFf: 231,
            iScf: 157,
            iHdcf: 62,
            rushAttempts: 28,
            reboundsCreated: 17,
            pim: 78,
            totalPenalties: 39,
            minorPenalties: 38,
            majorPenalties: 1,
            misconductPenalties: 0,
            penaltiesDrawn: 31,
            giveaways: 19,
            takeaways: 37,
            hits: 188,
            hitsTaken: 74,
            shotsBlocked: 41,
            faceoffsWon: 402,
            faceoffsLost: 367,
            faceoffPct: 0.523,
          },
        ]}
        sortState={{ sortKey: "totalPoints", direction: "desc" }}
      />
    );

    expect(screen.getByText("1,211")).toBeTruthy();
    expect(screen.getByText("19.44")).toBeTruthy();
    expect(screen.getAllByText("52.3%").length).toBeGreaterThan(0);

    rerender(
      <PlayerStatsTable
        family="individualRates"
        rows={[
          {
            rowKey: "player-1",
            playerName: "Sam Bennett",
            teamLabel: "FLA",
            positionCode: "C",
            gamesPlayed: 82,
            toiSeconds: 3723,
            toiPerGameSeconds: 45.4,
            goalsPer60: 1.61,
            totalAssistsPer60: 1.55,
            firstAssistsPer60: 1.03,
            secondAssistsPer60: 0.52,
            totalPointsPer60: 3.16,
            ipp: 0.62,
            shotsPer60: 8.9,
            shootingPct: 0.118,
            ixgPer60: 0.94,
            iCfPer60: 12.13,
            iFfPer60: 9.3,
            iScfPer60: 6.32,
            iHdcfPer60: 2.51,
            rushAttemptsPer60: 1.13,
            reboundsCreatedPer60: 0.68,
            pimPer60: 3.12,
            totalPenaltiesPer60: 1.57,
            minorPenaltiesPer60: 1.53,
            majorPenaltiesPer60: 0.04,
            misconductPenaltiesPer60: 0,
            penaltiesDrawnPer60: 1.25,
            giveawaysPer60: 0.76,
            takeawaysPer60: 1.49,
            hitsPer60: 7.56,
            hitsTakenPer60: 2.98,
            shotsBlockedPer60: 1.65,
            faceoffsWonPer60: 16.17,
            faceoffsLostPer60: 14.75,
            faceoffPct: 0.523,
          },
        ]}
        sortState={{ sortKey: "totalPointsPer60", direction: "desc" }}
      />
    );

    expect(screen.getByText("3.16")).toBeTruthy();
    expect(screen.getByText("0.94")).toBeTruthy();

    rerender(
      <PlayerStatsTable
        family="goalieCounts"
        rows={[
          {
            rowKey: "goalie-1",
            playerName: "Sergei Bobrovsky",
            teamLabel: "FLA",
            gamesPlayed: 54,
            toiSeconds: 10234,
            shotsAgainst: 1632,
            saves: 1491,
            goalsAgainst: 141,
            savePct: 0.914,
            gaa: 2.41,
            gsaa: 4.86,
            xgAgainst: 148.22,
            hdShotsAgainst: 401,
            hdSaves: 347,
            hdGoalsAgainst: 54,
            hdSavePct: 0.866,
            hdGaa: 1.08,
            hdGsaa: 2.14,
            mdShotsAgainst: 543,
            mdSaves: 504,
            mdGoalsAgainst: 39,
            mdSavePct: 0.929,
            mdGaa: 0.81,
            mdGsaa: 1.21,
            ldShotsAgainst: 688,
            ldSaves: 640,
            ldGoalsAgainst: 48,
            ldSavePct: 0.959,
            ldGaa: 0.39,
            ldGsaa: 0.52,
            rushAttemptsAgainst: 40,
            reboundAttemptsAgainst: 31,
            avgShotDistance: 33.4,
            avgGoalDistance: 19.8,
          },
        ]}
        sortState={{ sortKey: "savePct", direction: "desc" }}
      />
    );

    expect(screen.getByText("91.4%")).toBeTruthy();
    expect(screen.getByText("33.4")).toBeTruthy();
    expect(screen.getByText("19.8")).toBeTruthy();
  });

  it("uses paginated rendering controls instead of virtualization for the initial release", () => {
    const onPageChange = vi.fn();

    render(
      <PlayerStatsTable
        family="individualCounts"
        rows={[
          {
            rowKey: "player-1",
            playerName: "Sam Bennett",
            teamLabel: "FLA",
            positionCode: "C",
            gamesPlayed: 82,
            toiSeconds: 3723,
            goals: 25,
            totalAssists: 24,
            firstAssists: 16,
            secondAssists: 8,
            totalPoints: 49,
            ipp: 0.62,
            shots: 211,
            shootingPct: 0.118,
            ixg: 19.44,
            iCf: 302,
            iFf: 231,
            iScf: 157,
            iHdcf: 62,
            rushAttempts: 28,
            reboundsCreated: 17,
            pim: 78,
            totalPenalties: 39,
            minorPenalties: 38,
            majorPenalties: 1,
            misconductPenalties: 0,
            penaltiesDrawn: 31,
            giveaways: 19,
            takeaways: 37,
            hits: 188,
            hitsTaken: 74,
            shotsBlocked: 41,
            faceoffsWon: 402,
            faceoffsLost: 367,
            faceoffPct: 0.523,
          },
        ]}
        sortState={{ sortKey: "totalPoints", direction: "desc" }}
        pagination={{ page: 2, pageSize: 50, totalRows: 138, totalPages: 3 }}
        onPageChange={onPageChange}
      />
    );

    expect(PLAYER_STATS_TABLE_RENDERING_STRATEGY).toBe("pagination");
    expect(screen.getByText("Showing 51-100 of 138")).toBeTruthy();
    expect(screen.getByText("Page 2 of 3")).toBeTruthy();
    expect(screen.queryByText(/virtual/i)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    expect(onPageChange).toHaveBeenCalledWith(1);

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(onPageChange).toHaveBeenLastCalledWith(3);
  });

  it("hides pagination controls when the table is rendered without a page-change handler", () => {
    render(
      <PlayerStatsTable
        family="individualCounts"
        rows={[
          {
            rowKey: "player-1",
            playerName: "Sam Bennett",
            teamLabel: "FLA",
            positionCode: "C",
            gamesPlayed: 82,
            toiSeconds: 3723,
            goals: 25,
            totalAssists: 24,
            totalPoints: 49,
          },
        ]}
        sortState={{ sortKey: "totalPoints", direction: "desc" }}
        pagination={{ page: 2, pageSize: 50, totalRows: 138, totalPages: 3 }}
      />
    );

    expect(screen.queryByText("Showing 51-100 of 138")).toBeNull();
    expect(screen.queryByRole("button", { name: "Previous" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Next" })).toBeNull();
  });

  it("renders a reusable loading, empty, error, or warning state instead of the table when requested", () => {
    const { container, rerender } = render(
      <PlayerStatsTable
        family="individualCounts"
        rows={[]}
        sortState={{ sortKey: "totalPoints", direction: "desc" }}
        state={{ kind: "loading", message: "Loading player stats..." }}
      />
    );

    expect(screen.getByText("Loading player stats...")).toBeTruthy();
    expect(container.querySelector("table")).toBeNull();

    rerender(
      <PlayerStatsTable
        family="individualCounts"
        rows={[]}
        sortState={{ sortKey: "totalPoints", direction: "desc" }}
        state={{ kind: "empty", message: "No players matched the current filters." }}
      />
    );

    expect(screen.getByText("No players matched the current filters.")).toBeTruthy();

    rerender(
      <PlayerStatsTable
        family="individualCounts"
        rows={[]}
        sortState={{ sortKey: "totalPoints", direction: "desc" }}
        state={{ kind: "error", message: "Player stats query failed." }}
      />
    );

    expect(screen.getByText("Player stats query failed.")).toBeTruthy();

    rerender(
      <PlayerStatsTable
        family="individualCounts"
        rows={[]}
        sortState={{ sortKey: "totalPoints", direction: "desc" }}
        state={{
          kind: "warning",
          message: "Goalie mode does not support winger-only filters.",
        }}
      />
    );

    expect(screen.getByText("Filter combination warning")).toBeTruthy();
    expect(
      screen.getByText("Goalie mode does not support winger-only filters.")
    ).toBeTruthy();
  });

  it("keeps the rank column aligned to the visible row order and renders inline expanded content", () => {
    render(
      <PlayerStatsTable
        family="individualCounts"
        rows={[
          {
            rowKey: "player-2",
            playerId: 2,
            playerName: "Second Player",
            teamLabel: "BBB",
            positionCode: "C",
            gamesPlayed: 8,
            toiSeconds: 640,
            goals: 4,
            totalAssists: 5,
            firstAssists: 3,
            secondAssists: 2,
            totalPoints: 9,
            ipp: 0.51,
            shots: 32,
            shootingPct: 0.125,
            ixg: 3.8,
            iCf: 46,
            iFf: 39,
            iScf: 21,
            iHdcf: 9,
            rushAttempts: 4,
            reboundsCreated: 1,
            pim: 6,
            totalPenalties: 3,
            minorPenalties: 3,
            majorPenalties: 0,
            misconductPenalties: 0,
            penaltiesDrawn: 2,
            giveaways: 1,
            takeaways: 4,
            hits: 7,
            hitsTaken: 2,
            shotsBlocked: 3,
            faceoffsWon: 20,
            faceoffsLost: 18,
            faceoffPct: 0.526,
          },
          {
            rowKey: "player-1",
            playerId: 1,
            playerName: "First Player",
            teamLabel: "AAA",
            positionCode: "LW",
            gamesPlayed: 7,
            toiSeconds: 590,
            goals: 3,
            totalAssists: 2,
            firstAssists: 2,
            secondAssists: 0,
            totalPoints: 5,
            ipp: 0.48,
            shots: 27,
            shootingPct: 0.111,
            ixg: 2.9,
            iCf: 34,
            iFf: 31,
            iScf: 18,
            iHdcf: 5,
            rushAttempts: 2,
            reboundsCreated: 1,
            pim: 2,
            totalPenalties: 1,
            minorPenalties: 1,
            majorPenalties: 0,
            misconductPenalties: 0,
            penaltiesDrawn: 1,
            giveaways: 2,
            takeaways: 3,
            hits: 4,
            hitsTaken: 1,
            shotsBlocked: 2,
            faceoffsWon: 0,
            faceoffsLost: 0,
            faceoffPct: null,
          },
        ]}
        sortState={{ sortKey: "totalPoints", direction: "desc" }}
        showRankColumn
        expandedRowKey="player-2"
        renderExpandedRow={({ row }) => (
          <div>{`Expanded content for ${String(row.playerName)}`}</div>
        )}
      />
    );

    const rows = screen.getAllByRole("row");
    expect(within(rows[1] as HTMLElement).getAllByRole("cell")[0]?.textContent).toBe("1");
    expect(within(rows[1] as HTMLElement).getByText("Second Player")).toBeTruthy();
    expect(within(rows[3] as HTMLElement).getAllByRole("cell")[0]?.textContent).toBe("2");
    expect(within(rows[3] as HTMLElement).getByText("First Player")).toBeTruthy();
    expect(screen.getByText("Expanded content for Second Player")).toBeTruthy();
  });
});

describe("PlayerStatsTableState", () => {
  it("supports an explicit warning title override", () => {
    render(
      <PlayerStatsTableState
        state={{
          kind: "warning",
          title: "No compatible filters",
          message: "Try clearing the score-state or position filter.",
        }}
      />
    );

    expect(screen.getByText("No compatible filters")).toBeTruthy();
    expect(
      screen.getByText("Try clearing the score-state or position filter.")
    ).toBeTruthy();
  });
});
