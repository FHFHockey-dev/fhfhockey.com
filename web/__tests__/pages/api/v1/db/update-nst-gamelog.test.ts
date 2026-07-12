import { describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
});

import {
  NST_DATASET_GROUPS,
  buildNstScheduledDateMap,
  buildNstStatusUrl,
  filterReverseSeasonsForHistoricalDatedNst,
  getPlayerCacheCandidates,
  normalizeTargetDates,
  parseDatesParam,
  resolveNstSeasonTypeForGameType,
  resolveMappedPlayerName,
  shouldBlockHistoricalDatedNstRequest,
  type PlayerCacheRow
} from "../../../../../pages/api/v1/db/update-nst-gamelog";

describe("update-nst-gamelog request scoping", () => {
  it("normalizes comma-separated exact dates for targeted backfills", () => {
    expect(
      parseDatesParam([
        "2026-04-12, 2026-01-12",
        "2026-04-12",
        "2026-03-07"
      ])
    ).toEqual(["2026-01-12", "2026-03-07", "2026-04-12"]);
  });

  it("rejects malformed targeted backfill dates", () => {
    expect(() => normalizeTargetDates(["2026-04-12", "2026/04/13"])).toThrow(
      "dates must be YYYY-MM-DD"
    );
  });

  it("exposes bounded dataset groups for ranking freshness backfills", () => {
    expect(NST_DATASET_GROUPS.allStrengths).toEqual([
      "allStrengthsCounts",
      "allStrengthsRates",
      "allStrengthsCountsOi",
      "allStrengthsRatesOi"
    ]);
    expect(NST_DATASET_GROUPS.powerPlay).toEqual([
      "powerPlayCounts",
      "powerPlayRates",
      "powerPlayCountsOi",
      "powerPlayRatesOi"
    ]);
    expect(NST_DATASET_GROUPS.rankingFreshnessSkaterSources).toEqual([
      ...NST_DATASET_GROUPS.allStrengths,
      "evenStrengthCounts",
      "evenStrengthRates",
      "evenStrengthCountsOi",
      "evenStrengthRatesOi",
      ...NST_DATASET_GROUPS.powerPlay,
      "penaltyKillCounts",
      "penaltyKillRates",
      "penaltyKillCountsOi",
      "penaltyKillRatesOi"
    ]);
  });

  it("matches NST hyphenated player names against normalized player cache keys", () => {
    const cache = new Map<string, PlayerCacheRow[]>([
      ["vikinggustafssonnyberg", [{ id: 8486166, position: "D" }]]
    ]);

    expect(getPlayerCacheCandidates(cache, "Viking Gustafsson-Nyberg")).toEqual([
      { id: 8486166, position: "D" }
    ]);
  });

  it("maps NST nickname variants to canonical player names", () => {
    expect(resolveMappedPlayerName("Freddy Gaudreau")).toBe(
      "Frederick Gaudreau"
    );
    expect(resolveMappedPlayerName("Frederic Gaudreau")).toBe(
      "Frederick Gaudreau"
    );
  });

  it("builds a single authenticated-status diagnostic URL from route params", () => {
    const diagnostic = buildNstStatusUrl({
      date: "2025-10-07",
      datasetGroup: "fiveOnFive"
    });

    expect(diagnostic).toMatchObject({
      date: "2025-10-07",
      seasonId: "20252026",
      datasetType: "fiveOnFiveRates",
      source: "constructed"
    });
    expect(diagnostic.url).toContain("sit=5v5");
    expect(diagnostic.url).toContain("rate=y");
    expect(diagnostic.url).toContain("fromseason=20252026");
    expect(new URL(diagnostic.url).searchParams.get("fd")).toBe("2025-10-07");
    expect(diagnostic.url).not.toContain("key=");
  });

  it("matches the NST daily date-filtered counts URL contract", () => {
    const diagnostic = buildNstStatusUrl({
      date: "2025-04-16",
      seasonId: "20242025",
      datasetType: "fiveOnFiveCounts"
    });

    const url = new URL(diagnostic.url);
    expect(url.origin + url.pathname).toBe(
      "https://data.naturalstattrick.com/playerteams.php"
    );
    expect(Object.fromEntries(url.searchParams)).toEqual({
      sit: "5v5",
      score: "all",
      stdoi: "std",
      rate: "n",
      team: "ALL",
      fromseason: "20242025",
      thruseason: "20242025",
      stype: "2",
      pos: "S",
      loc: "B",
      toi: "0",
      gpfilt: "gpdate",
      fd: "2025-04-16",
      td: "2025-04-16",
      lines: "single",
      draftteam: "ALL",
      tgp: "410"
    });
  });

  it("accepts a custom diagnostic NST URL without requiring browser-visible keys", () => {
    const diagnostic = buildNstStatusUrl({
      testUrl:
        "https://data.naturalstattrick.com/playerteams.php?sit=5v5&fromseason=20242025&fd=2025-04-17&td=2025-04-17"
    });

    expect(diagnostic).toMatchObject({
      date: "2025-04-17",
      seasonId: "20242025",
      datasetType: "custom",
      source: "testUrl"
    });
  });

  it("maps NHL game types to NST stype values", () => {
    expect(resolveNstSeasonTypeForGameType(1)).toBe("1");
    expect(resolveNstSeasonTypeForGameType(2)).toBe("2");
    expect(resolveNstSeasonTypeForGameType(3)).toBe("3");
    expect(resolveNstSeasonTypeForGameType(4)).toBeNull();
    expect(resolveNstSeasonTypeForGameType(null)).toBeNull();
  });

  it("builds the NST scheduled-date aperture from actual game rows", () => {
    const scheduled = buildNstScheduledDateMap([
      { date: "2025-09-22", seasonId: 20252026, type: 1 },
      { date: "2025-10-07", seasonId: 20252026, type: 2 },
      { date: "2026-04-19", seasonId: 20252026, type: 3 },
      { date: "2026-06-30", seasonId: 20252026, type: 4 },
      { date: "2026-07-01", seasonId: 20252026, type: null }
    ]);

    expect(Array.from(scheduled.keys())).toEqual([
      "2025-09-22",
      "2025-10-07",
      "2026-04-19"
    ]);
    expect(scheduled.get("2025-09-22")).toMatchObject({
      seasonId: "20252026",
      gameType: 1,
      stype: "1"
    });
    expect(scheduled.get("2026-04-19")).toMatchObject({
      seasonId: "20252026",
      gameType: 3,
      stype: "3"
    });
  });

  it("uses explicit diagnostic stype for preseason and playoff status checks", () => {
    const preseason = buildNstStatusUrl({
      date: "2025-09-22",
      seasonId: "20252026",
      datasetType: "fiveOnFiveRates",
      stype: "1"
    });
    const playoffs = buildNstStatusUrl({
      date: "2026-04-19",
      seasonId: "20252026",
      datasetType: "fiveOnFiveRates",
      gameType: "3"
    });

    expect(preseason.url).toContain("stype=1");
    expect(playoffs.url).toContain("stype=3");
  });

  it("blocks prior-season dated NST backfills unless explicitly allowed", () => {
    expect(
      shouldBlockHistoricalDatedNstRequest({
        requestedStartDate: "2025-04-17",
        currentSeasonStartDate: "2025-10-07"
      })
    ).toBe(true);
    expect(
      shouldBlockHistoricalDatedNstRequest({
        requestedStartDate: "2025-04-17",
        currentSeasonStartDate: "2025-10-07",
        allowHistoricalDatedRequests: true
      })
    ).toBe(false);
    expect(
      shouldBlockHistoricalDatedNstRequest({
        requestedStartDate: "2025-10-07",
        currentSeasonStartDate: "2025-10-07"
      })
    ).toBe(false);
  });

  it("limits reverse NST date-filtered backfills to the current season by default", () => {
    const seasons = [
      { id: 20252026, startDate: "2025-10-07" },
      { id: 20242025, startDate: "2024-10-04" },
      { id: 20232024, startDate: "2023-10-10" }
    ];

    expect(
      filterReverseSeasonsForHistoricalDatedNst(seasons, "20252026")
    ).toEqual([{ id: 20252026, startDate: "2025-10-07" }]);
    expect(
      filterReverseSeasonsForHistoricalDatedNst(seasons, "20252026", true)
    ).toEqual(seasons);
  });
});
