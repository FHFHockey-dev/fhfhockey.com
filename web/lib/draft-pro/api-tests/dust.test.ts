import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireApiUser: vi.fn(),
  loadDraftProAccess: vi.fn(),
  requireDraftProServerCapability: vi.fn(),
  enforceDraftProDustRateLimit: vi.fn(),
  readRosterSchedule: vi.fn(),
  from: vi.fn(),
  metadataRows: [] as Array<{ game_key: string; season: string; source_season_id: number }>,
  metadataPages: [] as Array<Array<{ game_key: string; season: string; source_season_id: number }>>,
}));

vi.mock("lib/api/requireApiUser", () => ({ requireApiUser: mocks.requireApiUser }));
vi.mock("lib/draft-pro/server", () => ({
  loadDraftProAccess: mocks.loadDraftProAccess,
  requireDraftProServerCapability: mocks.requireDraftProServerCapability,
}));
vi.mock("lib/draft-pro/features", () => ({ getDraftProFeatureFlags: vi.fn(() => ({})) }));
vi.mock("lib/draft-pro/dustRateLimit", () => ({ enforceDraftProDustRateLimit: mocks.enforceDraftProDustRateLimit }));
vi.mock("lib/rosterScheduleData", async () => {
  const actual = await vi.importActual<typeof import("lib/rosterScheduleData")>("lib/rosterScheduleData");
  return { ...actual, readRosterSchedule: mocks.readRosterSchedule };
});
vi.mock("lib/supabase/server", () => ({ default: { from: mocks.from } }));

import handler from "../../../pages/api/v1/draft-pro/dust";

function response() {
  const state = { status: 0, body: null as unknown, headers: new Map<string, string>() };
  const api = {
    status: vi.fn((status: number) => { state.status = status; return api; }),
    json: vi.fn((body: unknown) => { state.body = body; return api; }),
    setHeader: vi.fn((name: string, value: string | string[]) => state.headers.set(name, String(value))),
  };
  return {
    state,
    api,
  };
}

describe("Draft Pro DUST API", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-09T12:00:00.000Z"));
    vi.resetAllMocks();
    mocks.requireApiUser.mockResolvedValue({ id: "user-1" });
    mocks.loadDraftProAccess.mockResolvedValue({});
    mocks.enforceDraftProDustRateLimit.mockResolvedValue({ remainingPoints: 19 });
    mocks.metadataRows = [];
    mocks.metadataPages = [];
    const query = {
      select: vi.fn(),
      eq: vi.fn(),
      order: vi.fn(),
      range: vi.fn(async (from: number) => ({
        data: mocks.metadataPages[from / 1_000] ?? mocks.metadataRows,
        error: null,
      })),
    };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.order.mockReturnValue(query);
    mocks.from.mockReturnValue(query);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const requestBody = {
    season: "20262027",
    lineupMode: "daily",
    inputOrigin: "draft",
    startWeek: 1,
    endWeek: 1,
    rosterSlots: { RW: 1 },
    roster: [{ id: "r", teamAbbreviation: "AAA", eligiblePositions: "RW", value: 1, projectionSeason: "20262027" }],
    candidates: [{ id: "c", teamAbbreviation: "BBB", eligiblePositions: "RW", value: 1, projectionSeason: "20262027" }],
  };

  const mappedScheduleRows = [
    { game_key: "500", season: "2026", source_season_id: 20262027, source_game_id: 1, game_date: "2026-10-06", team_abbreviation: "AAA", week: 1, fetched_at: "2026-09-09T11:00:00.000Z" },
    { game_key: "500", season: "2026", source_season_id: 20262027, source_game_id: 2, game_date: "2026-10-06", team_abbreviation: "BBB", week: 1, fetched_at: "2026-09-09T11:00:00.000Z" },
  ];

  it("returns the shared 401 fixture before premium work", async () => {
    mocks.requireApiUser.mockImplementation(async (_req, res, options) => {
      options.onUnauthorized("Authentication required.");
      return null;
    });
    const res = response();
    await handler({ method: "POST" } as any, res.api as any);
    expect(res.state).toMatchObject({ status: 401, body: { success: false, error: { code: "authentication_required" } } });
    expect(mocks.loadDraftProAccess).not.toHaveBeenCalled();
  });

  it("returns a capability 403 before parsing or reading schedule data", async () => {
    const denied = new Error("Draft Pro access is required for this action.");
    Object.assign(denied, { statusCode: 403, code: "no_active_grant" });
    mocks.requireDraftProServerCapability.mockImplementation(() => { throw denied; });
    const res = response();
    await handler({ method: "POST", body: {} } as any, res.api as any);
    expect(res.state).toMatchObject({ status: 403, body: { success: false, error: { code: "no_active_grant" } } });
    expect(mocks.readRosterSchedule).not.toHaveBeenCalled();
  });

  it("returns the bounded invalid-input fixture without reading schedule data", async () => {
    const res = response();
    await handler({ method: "POST", body: {} } as any, res.api as any);
    expect(res.state).toMatchObject({ status: 400, body: { success: false, error: { code: "invalid_input" } } });
    expect(mocks.readRosterSchedule).not.toHaveBeenCalled();
  });

  it("resolves NHL 20262027 to the persisted Yahoo 2026 game key before reading schedule", async () => {
    mocks.metadataRows = [{ game_key: "500", season: "2026", source_season_id: 20262027 }];
    mocks.readRosterSchedule.mockResolvedValue(mappedScheduleRows);
    const res = response();
    await handler({ method: "POST", body: requestBody } as any, res.api as any);
    expect(mocks.readRosterSchedule).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ gameKey: "500" }));
    expect(mocks.from().select).toHaveBeenCalledWith("id,game_key,season,source_season_id");
    expect(mocks.from().order).toHaveBeenCalledWith("id", { ascending: true });
    expect(mocks.from().range).toHaveBeenCalledWith(0, 999);
    expect(res.state).toMatchObject({ status: 200, body: { success: true, data: { state: "ready" } } });
  });

  it("returns unavailable when persisted mapping is missing or ambiguous", async () => {
    for (const metadataRows of [
      [],
      [
        { game_key: "500", season: "2026", source_season_id: 20262027 },
        { game_key: "501", season: "2026", source_season_id: 20262027 },
      ],
    ]) {
      mocks.metadataRows = metadataRows;
      const res = response();
      await handler({ method: "POST", body: requestBody } as any, res.api as any);
      expect(res.state).toMatchObject({ status: 503, body: { success: false, error: { code: "schedule_season_unavailable" } } });
      expect(mocks.readRosterSchedule).not.toHaveBeenCalled();
      mocks.readRosterSchedule.mockClear();
    }
  });

  it("returns unavailable when read schedule rows do not match the resolved NHL source season", async () => {
    mocks.metadataRows = [{ game_key: "500", season: "2026", source_season_id: 20262027 }];
    mocks.readRosterSchedule.mockResolvedValue([{ ...mappedScheduleRows[0], source_season_id: 20252026 }]);
    const res = response();
    await handler({ method: "POST", body: requestBody } as any, res.api as any);
    expect(res.state).toMatchObject({ status: 503, body: { success: false, error: { code: "schedule_season_unavailable" } } });
  });

  it("reads later metadata pages before deciding whether a mapping is ambiguous", async () => {
    const matching = { game_key: "500", season: "2026", source_season_id: 20262027 };
    mocks.metadataPages = [
      Array.from({ length: 1_000 }, () => matching),
      [{ game_key: "501", season: "2026", source_season_id: 20262027 }],
    ];
    const res = response();
    await handler({ method: "POST", body: requestBody } as any, res.api as any);
    expect(res.state).toMatchObject({ status: 503, body: { success: false, error: { code: "schedule_season_unavailable" } } });
    expect(mocks.readRosterSchedule).not.toHaveBeenCalled();
  });

  it("accepts a complete multi-page metadata read when every page has the same mapping", async () => {
    const matching = { game_key: "500", season: "2026", source_season_id: 20262027 };
    mocks.metadataPages = [Array.from({ length: 1_000 }, () => matching), [matching]];
    mocks.readRosterSchedule.mockResolvedValue(mappedScheduleRows);
    const res = response();
    await handler({ method: "POST", body: requestBody } as any, res.api as any);
    expect(res.state).toMatchObject({ status: 200, body: { success: true, data: { state: "ready" } } });
    expect(mocks.from().range).toHaveBeenCalledWith(1_000, 1_999);
  });

  it("fails closed when the bounded metadata page limit is reached", async () => {
    const matching = { game_key: "500", season: "2026", source_season_id: 20262027 };
    mocks.metadataPages = Array.from({ length: 10 }, () => Array.from({ length: 1_000 }, () => matching));
    const res = response();
    await handler({ method: "POST", body: requestBody } as any, res.api as any);
    expect(res.state).toMatchObject({ status: 503, body: { success: false, error: { code: "schedule_season_unavailable" } } });
  });
});
