import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { fetchMock, fromMock, upsertMock } = vi.hoisted(() => ({
  fetchMock: vi.fn(),
  fromMock: vi.fn(),
  upsertMock: vi.fn(),
}));

vi.mock("../../../../../lib/supabase/server", () => ({
  default: { from: fromMock },
}));

vi.mock("lib/cors-fetch", () => ({
  default: fetchMock,
}));

import {
  fetchDataForGameType,
  processAndUpsertGameTypeData,
  readWgoSkaterDateDigests,
  type AllSkaterStats,
} from "../../../../../pages/api/v1/db/update-wgo-skaters";

function createSkaterData(gameId = 2025020001): AllSkaterStats {
  return {
    skaterStats: [
      {
        playerId: 8478402,
        skaterFullName: "Connor McDavid",
        shootsCatches: "L",
        positionCode: "C",
        gamesPlayed: 1,
        points: 2,
        pointsPerGame: 2,
        goals: 1,
        assists: 1,
        shots: 4,
        shootingPct: 0.25,
        plusMinus: 1,
        otGoals: 0,
        gameWinningGoals: 1,
        ppPoints: 1,
        faceoffWinPct: 0.55,
        timeOnIcePerGame: 20.5,
        teamAbbrev: "EDM",
        gameId,
        opponentTeamAbbrev: "CGY",
        homeRoad: "H",
        evGoals: 1,
        evPoints: 1,
      },
    ],
    skatersBio: [],
    miscSkaterStats: [],
    faceOffStats: [],
    faceoffWinLossStats: [],
    goalsForAgainstStats: [
      {
        gameId,
        playerId: 8478402,
        evenStrengthGoalDifference: 1,
        evenStrengthGoalsAgainst: 2,
        evenStrengthGoalsFor: 3,
        evenStrengthGoalsForPct: 0.6,
        evenStrengthTimeOnIcePerGame: 10.25,
        powerPlayGoalsAgainst: 0,
        powerPlayGoalFor: 1,
        powerPlayTimeOnIcePerGame: 2.5,
        shortHandedGoalsAgainst: 0,
        shortHandedGoalsFor: 0,
        shortHandedTimeOnIcePerGame: 1.25,
      },
    ],
    penaltiesStats: [],
    penaltyKillStats: [
      {
        gameId,
        playerId: 8478402,
        ppGoalsAgainstPer60: 0,
        shAssists: 0,
        shGoals: 0,
        shPoints: 0,
        shGoalsPer60: 0,
        shIndividualSatFor: 1,
        shIndividualSatForPer60: 1,
        shPointsPer60: 0,
        shPrimaryAssists: 0,
        shPrimaryAssistsPer60: 0,
        shSecondaryAssists: 0,
        shSecondaryAssistsPer60: 0,
        shShootingPct: 0,
        shShots: 1,
        shShotsPer60: 1,
        shTimeOnIce: 60,
        shTimeOnIcePctPerGame: 0.05,
      },
    ],
    powerPlayStats: [
      {
        gameId,
        playerId: 8478402,
        ppAssists: 1,
        ppGoals: 0,
        ppGoalsForPer60: 1,
        ppGoalsPer60: 0,
        ppIndividualSatFor: 2,
        ppIndividualSatForPer60: 2,
        ppPointsPer60: 1,
        ppPrimaryAssists: 1,
        ppPrimaryAssistsPer60: 1,
        ppSecondaryAssists: 0,
        ppSecondaryAssistsPer60: 0,
        ppShootingPct: 0,
        ppShots: 2,
        ppShotsPer60: 2,
        ppTimeOnIce: 120,
        ppTimeOnIcePctPerGame: 0.1,
      },
    ],
    puckPossessionStats: [
      {
        gameId,
        playerId: 8478402,
        goalsPct: 0.6,
        faceoffPct5v5: 0.55,
        individualSatForPer60: 10,
        individualShotsForPer60: 8,
        onIceShootingPct: 0.1,
        satPct: 0.58,
        timeOnIcePerGame5v5: 12.5,
        usatPct: 0.57,
        offensiveZoneStartRatio: 0.52,
      },
    ],
    satCountsStats: [],
    satPercentagesStats: [],
    scoringRatesStats: [],
    scoringPerGameStats: [],
    shotTypeStats: [
      {
        gameId,
        playerId: 8478402,
        goalsBackhand: 0,
        goalsBat: 0,
        goalsBetweenLegs: 0,
        goalsCradle: 0,
        goalsDeflected: 0,
        goalsPoke: 0,
        goalsSlap: 1,
        goalsSnap: 0,
        goalsTipIn: 0,
        goalsWrapAround: 0,
        goalsWrist: 0,
        shootingPctBackhand: 0,
        shootingPctBat: 0,
        shootingPctBetweenLegs: 0,
        shootingPctCradle: 0,
        shootingPctDeflected: 0,
        shootingPctPoke: 0,
        shootingPctSlap: 0.125,
        shootingPctSnap: 0,
        shootingPctTipIn: 0,
        shootingPctWrapAround: 0,
        shootingPctWrist: 0,
        shotsOnNetBackhand: 0,
        shotsOnNetBat: 0,
        shotsOnNetBetweenLegs: 0,
        shotsOnNetCradle: 0,
        shotsOnNetDeflected: 0,
        shotsOnNetPoke: 0,
        shotsOnNetSlap: 8,
        shotsOnNetSnap: 0,
        shotsOnNetTipIn: 0,
        shotsOnNetWrapAround: 0,
        shotsOnNetWrist: 0,
      },
    ],
    timeOnIceStats: [
      {
        gameId,
        playerId: 8478402,
        evTimeOnIce: 900,
        evTimeOnIcePerGame: 900,
        otTimeOnIce: 30,
        otTimeOnIcePerOtGame: 30,
        shifts: 20,
        shiftsPerGame: 20,
        timeOnIcePerShift: 45,
      },
    ],
  };
}

function nhlPage(data: unknown[], total = data.length) {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    headers: { get: () => "application/json" },
    json: async () => ({ data, total }),
  };
}

describe("WGO skater generated insert contracts", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    fetchMock.mockResolvedValue(nhlPage([]));
    upsertMock.mockResolvedValue({ error: null });
    fromMock.mockReturnValue({ upsert: upsertMock });
  });

  afterEach(() => vi.useRealTimers());

  it("fetches one bounded page per report for an empty date window", async () => {
    await Promise.all([
      expect(
        fetchDataForGameType(2, "2026-01-18", -1, "2026-01-12"),
      ).resolves.toEqual(
        expect.objectContaining({ skaterStats: [], timeOnIceStats: [] }),
      ),
      vi.runAllTimersAsync(),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(16);
    for (const [input] of fetchMock.mock.calls) {
      const params = new URL(input).searchParams;
      expect(params.get("start")).toBe("0");
      expect(params.get("limit")).toBe("100");
      expect(params.get("cayenneExp")).toBe(
        'gameDate<="2026-01-18 23:59:59" and gameDate>="2026-01-12" and gameTypeId=2',
      );
    }
  });

  it("rejects an incomplete first NHL page", async () => {
    fetchMock.mockResolvedValue(nhlPage([{}], 2));

    await Promise.all([
      expect(
        fetchDataForGameType(2, "2026-01-18", -1, "2026-01-12"),
      ).rejects.toThrow("returned 1/2"),
      vi.runAllTimersAsync(),
    ]);
  });

  it("persists all 432 same-date rows from NHL-capped report pages and retries a later 429", async () => {
    const date = "2026-11-19";
    const gameRows = Array.from({ length: 432 }, (_, index) => ({
      playerId: index + 1,
      gameId: 2026020300 + Math.floor(index / 36),
      gameDate: date,
      skaterFullName: `Fixture Skater ${index + 1}`,
      hits: index % 7,
    }));
    const bios = gameRows.map(({ playerId }) => ({
      playerId,
      birthCity: `Fixture City ${playerId}`,
    }));
    const offsets = new Map<string, number[]>();
    let pending = 0;
    let maxPending = 0;
    let rateLimited = false;
    fetchMock.mockImplementation(async (uri: string) => {
      const url = new URL(uri);
      const report = url.pathname.split("/").at(-1)!;
      const start = Number(url.searchParams.get("start"));
      const limit = Number(url.searchParams.get("limit"));
      const providerPageSize = limit <= 0 ? 100 : Math.min(100, limit);
      const reportOffsets = offsets.get(report) ?? [];
      reportOffsets.push(start);
      offsets.set(report, reportOffsets);
      pending += 1;
      maxPending = Math.max(maxPending, pending);
      await Promise.resolve();
      pending -= 1;

      if (!rateLimited && report === "timeonice" && start === 100) {
        rateLimited = true;
        return {
          ok: false,
          status: 429,
          statusText: "Too Many Requests",
          headers: { get: () => "application/json" },
          text: async () => "",
        };
      }

      const rows = report === "bios" ? bios : gameRows;
      return nhlPage(rows.slice(start, start + providerPageSize), rows.length);
    });

    const [allData] = await Promise.all([
      fetchDataForGameType(2, date),
      vi.runAllTimersAsync(),
    ]);
    await expect(
      processAndUpsertGameTypeData(allData, "wgo_skater_stats", date, 20262027),
    ).resolves.toBe(432);

    expect(maxPending).toBe(4);
    expect(offsets.size).toBe(16);
    for (const [report, starts] of offsets) {
      expect(starts).toEqual(
        report === "timeonice"
          ? [0, 100, 100, 200, 300, 400]
          : [0, 100, 200, 300, 400],
      );
    }
    expect(upsertMock).toHaveBeenCalledTimes(1);
    const [records, options] = upsertMock.mock.calls[0];
    expect(options).toEqual({ onConflict: "player_id, date" });
    expect(
      records.map(({ player_id }: { player_id: number }) => player_id),
    ).toEqual(gameRows.map(({ playerId }) => playerId));
    expect(records[431]).toEqual(
      expect.objectContaining({
        birth_city: "Fixture City 432",
        date,
        game_id: gameRows[431].gameId,
        hits: gameRows[431].hits,
      }),
    );
  });

  it("joins one player's distinct games and one bio across an independently paged date window", async () => {
    const dates = ["2026-11-18", "2026-11-19"];
    const first = {
      ...createSkaterData().skaterStats[0],
      gameId: 2026020300,
      gameDate: dates[0],
      playerId: 1,
    };
    const second = { ...first, gameId: 2026020301, gameDate: dates[1] };
    const rowsByReport: Record<string, unknown[]> = {
      summary: [first, second],
      realtime: [{ ...second, hits: 7 }, { ...first, hits: 2 }],
      bios: [{ playerId: 1, birthCity: "Fixture City" }],
    };
    const offsets = new Map<string, number[]>();
    fetchMock.mockImplementation(async (uri: string) => {
      const url = new URL(uri);
      const report = url.pathname.split("/").at(-1)!;
      const start = Number(url.searchParams.get("start"));
      expect(url.searchParams.get("limit")).toBe("1");
      const sort = JSON.parse(url.searchParams.get("sort")!);
      expect(sort.at(-1)).toEqual({
        property: report === "bios" ? "playerId" : "gameId",
        direction: "ASC",
      });
      const reportOffsets = offsets.get(report) ?? [];
      reportOffsets.push(start);
      offsets.set(report, reportOffsets);

      const rows = rowsByReport[report] ?? [];
      return nhlPage(rows.slice(start, start + 1), rows.length);
    });

    const [allData] = await Promise.all([
      fetchDataForGameType(2, dates[1], 1, dates[0]),
      vi.runAllTimersAsync(),
    ]);
    expect(offsets.size).toBe(16);
    for (const [report, starts] of offsets) {
      expect(starts).toEqual(
        report === "summary" || report === "realtime" ? [0, 1] : [0],
      );
    }
    for (const [index, stat] of [first, second].entries()) {
      await expect(
        processAndUpsertGameTypeData(
          { ...allData, skaterStats: [allData.skaterStats[index]] },
          "wgo_skater_stats",
          dates[index],
          20262027,
        ),
      ).resolves.toBe(1);
      expect(upsertMock).toHaveBeenNthCalledWith(
        index + 1,
        [
          expect.objectContaining({
            birth_city: "Fixture City",
            date: dates[index],
            game_id: stat.gameId,
            hits: index === 0 ? 2 : 7,
          }),
        ],
        expect.anything(),
      );
    }
  });

  it.each([
    ["changed total", "realtime", nhlPage([{}], 3), /changed the miscSkaterStats total/],
    ["short page", "realtime", nhlPage([], 2), /returned 0\/1 miscSkaterStats rows at offset 1/],
    [
      "repeated game",
      "realtime",
      nhlPage([{ playerId: 1, gameId: 2026020300 }], 2),
      /duplicate player\/game row/,
    ],
    ["repeated bio", "bios", nhlPage([{ playerId: 1 }], 2), /duplicate player row/],
  ] as const)(
    "rejects a %s in a later report page before writing",
    async (_, badReport, badPage, message) => {
      const date = "2026-11-19";
      const summary = {
        ...createSkaterData(2026020300).skaterStats[0],
        gameDate: date,
        playerId: 1,
      };
      fetchMock.mockImplementation(async (uri: string) => {
        const url = new URL(uri);
        const report = url.pathname.split("/").at(-1);
        const start = Number(url.searchParams.get("start"));
        if (report === badReport) {
          return start === 0 ? nhlPage([summary], 2) : badPage;
        }
        return nhlPage(report === "summary" ? [summary] : []);
      });

      const write = fetchDataForGameType(2, date, 1).then((allData) =>
        processAndUpsertGameTypeData(allData, "wgo_skater_stats", date, 20262027),
      );
      await Promise.all([expect(write).rejects.toThrow(message), vi.runAllTimersAsync()]);
      expect(upsertMock).not.toHaveBeenCalled();
    },
  );

  it("rejects repeated summary keys before a multi-day window can split them", async () => {
    const firstDate = "2026-11-18";
    const lastDate = "2026-11-19";
    const summary = createSkaterData(2026020300).skaterStats[0];
    fetchMock.mockImplementation(async (uri: string) => {
      const url = new URL(uri);
      if (!url.pathname.endsWith("/summary")) return nhlPage([]);
      const gameDate = url.searchParams.get("start") === "0" ? firstDate : lastDate;
      return nhlPage([{ ...summary, gameDate }], 2);
    });

    await Promise.all([
      expect(
        fetchDataForGameType(2, lastDate, 1, firstDate),
      ).rejects.toThrow("duplicate player/game row"),
      vi.runAllTimersAsync(),
    ]);
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("retains the unbounded total safeguard without applying it to explicitly paged calls", async () => {
    const date = "2026-11-19";
    const rows = Array.from({ length: 9_000 }, (_, index) => ({
      playerId: index + 1,
      gameId: 2026020300,
    }));
    fetchMock.mockImplementation(async (uri: string) => {
      const url = new URL(uri);
      if (!url.pathname.endsWith("/summary")) return nhlPage([]);
      const start = Number(url.searchParams.get("start"));
      return nhlPage(rows.slice(start, start + 100), rows.length);
    });

    await Promise.all([
      expect(fetchDataForGameType(2, date)).rejects.toThrow("potentially capped response"),
      vi.runAllTimersAsync(),
    ]);
    await Promise.all([
      expect(fetchDataForGameType(2, date, 100).then((data) => data.skaterStats))
        .resolves.toHaveLength(rows.length),
      vi.runAllTimersAsync(),
    ]);
  });

  it("writes numeric time fields through the regular-season table contract", async () => {
    await expect(
      processAndUpsertGameTypeData(
        createSkaterData(),
        "wgo_skater_stats",
        "2025-10-08",
        20252026,
      ),
    ).resolves.toBe(1);

    expect(fromMock).toHaveBeenCalledWith("wgo_skater_stats");
    expect(upsertMock).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          player_id: 8478402,
          season_id: 20252026,
          game_id: 2025020001,
          es_toi_per_game: 10.25,
          ev_time_on_ice: 900,
          ot_time_on_ice: 30,
          pp_toi: 120,
          sh_time_on_ice: 60,
          time_on_ice_per_shift: 45,
          toi_per_game_5v5: 12.5,
          zone_start_pct: 0.52,
          shooting_pct_slap: 0.125,
        }),
      ],
      { onConflict: "player_id, date" },
    );
  });

  it.each(["1959-10-08", "1967-10-08", "2024-10-08", "2027-10-08"])(
    "rejects an out-of-season requested date %s before any write even without a source gameDate",
    async (date) => {
      await expect(processAndUpsertGameTypeData(createSkaterData(), "wgo_skater_stats", date, 20252026))
        .rejects.toThrow("outside season 20252026");
      expect(upsertMock).not.toHaveBeenCalled();
    },
  );

  it("keeps delayed 2019-20 playoffs in September 2020 valid", async () => {
    await expect(processAndUpsertGameTypeData(createSkaterData(2019030716), "wgo_skater_stats_playoffs", "2020-09-28", 20192020))
      .resolves.toBe(1);
    expect(upsertMock).toHaveBeenCalledWith([expect.objectContaining({ date: "2020-09-28", season_id: 20192020 })], expect.anything());
  });

  it("normalizes time fields to text through the playoff table contract", async () => {
    await expect(
      processAndUpsertGameTypeData(
        createSkaterData(2025030001),
        "wgo_skater_stats_playoffs",
        "2026-05-01",
        20252026,
      ),
    ).resolves.toBe(1);

    expect(fromMock).toHaveBeenCalledWith("wgo_skater_stats_playoffs");
    expect(upsertMock).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          player_id: 8478402,
          season_id: 20252026,
          game_id: 2025030001,
          es_toi_per_game: "10.25",
          ev_time_on_ice: "900",
          ot_time_on_ice: "30",
          pp_toi: "120",
          sh_time_on_ice: "60",
          time_on_ice_per_shift: "45",
          toi_per_game_5v5: "12.5",
        }),
      ],
      { onConflict: "player_id, date" },
    );
  });
});

describe("readWgoSkaterDateDigests (Rankings row proof)", () => {
  it("stores each readable digest unchanged and leaves out a date it cannot read", async () => {
    const rpc = vi.fn(async (_name: string, args: { p_date: string }) =>
      args.p_date === "2026-11-21" ? { data: { rows: 504, md5: "0123456789abcdef0123456789abcdef" }, error: null }
        : args.p_date === "2026-11-22" ? { data: null, error: { message: "function does not exist" } }
        : Promise.reject(new Error("network")));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const digests = await readWgoSkaterDateDigests({ rpc } as any, ["2026-11-21", "2026-11-22", "2026-11-23"]);

    expect(digests).toEqual({ "2026-11-21": { rows: 504, md5: "0123456789abcdef0123456789abcdef" } });
    expect(rpc.mock.calls.map(call => call[1])).toEqual([
      { p_date: "2026-11-21" }, { p_date: "2026-11-22" }, { p_date: "2026-11-23" }]);
    expect(rpc.mock.calls.every(call => call[0] === "wgo_skater_date_digest")).toBe(true);
    warn.mockRestore();
  });

  it("refuses a malformed digest", async () => {
    const rpc = vi.fn(async () => ({ data: { rows: "504", md5: "x" }, error: null }));
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(await readWgoSkaterDateDigests({ rpc } as any, ["2026-11-21"])).toEqual({});
  });
});
