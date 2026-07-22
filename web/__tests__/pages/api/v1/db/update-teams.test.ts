import { beforeEach, describe, expect, it, vi } from "vitest";
import { teamsInfo } from "../../../../../lib/teamsInfo";

const { getCurrentSeasonMock, getMock } = vi.hoisted(() => ({
  getCurrentSeasonMock: vi.fn(),
  getMock: vi.fn(),
}));

vi.mock("../../../../../lib/cron/withCronJobAudit", () => ({
  withCronJobAudit: (handler: unknown) => handler,
}));

vi.mock("../../../../../utils/adminOnlyMiddleware", () => ({
  default: (handler: unknown) => handler,
}));

vi.mock("../../../../../lib/NHL/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../../../lib/NHL/server")>()),
  getCurrentSeason: getCurrentSeasonMock,
}));

vi.mock("../../../../../lib/NHL/base", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../../../lib/NHL/base")>()),
  get: getMock,
}));

import handler from "../../../../../pages/api/v1/db/update-teams";

function createMockRes() {
  return {
    statusCode: 200,
    body: null as any,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    },
  } as any;
}

function scheduleTeam(id: number, abbrev: string, name: string) {
  return { id, abbrev, name: { default: name } };
}

function scheduleCalendar(
  startDate: string,
  teams = [
    scheduleTeam(1, "BOS", "Boston Bruins"),
    scheduleTeam(2, "NYR", "New York Rangers"),
  ],
) {
  return { startDate, teams };
}

function currentScheduleTeams() {
  return Object.values(teamsInfo).map((team) =>
    scheduleTeam(team.id, team.abbrev, team.name),
  );
}

function createSupabase(
  args: {
    seasonId?: number;
    startDate?: string;
    seasonError?: unknown;
    existingTeamIds?: number[];
    existingRowsError?: unknown;
    teamsUpsertError?: unknown;
    teamSeasonUpsertError?: unknown;
    deleteError?: unknown;
  } = {},
) {
  const seasonId = args.seasonId ?? 20252026;
  const startDate = args.startDate ?? "2025-10-07";
  const seasonSingleMock = vi.fn().mockResolvedValue({
    data: args.seasonError ? null : { id: seasonId, startDate },
    error: args.seasonError ?? null,
  });
  const seasonEqMock = vi.fn(() => ({ single: seasonSingleMock }));
  const seasonSelectMock = vi.fn(() => ({ eq: seasonEqMock }));

  const teamsUpsertMock = vi.fn().mockResolvedValue({
    error: args.teamsUpsertError ?? null,
  });
  const teamSeasonUpsertMock = vi.fn().mockResolvedValue({
    error: args.teamSeasonUpsertError ?? null,
  });
  const teamSeasonEqMock = vi.fn().mockResolvedValue({
    data: (args.existingTeamIds ?? []).map((teamId) => ({ teamId })),
    error: args.existingRowsError ?? null,
  });
  const teamSeasonSelectMock = vi.fn(() => ({ eq: teamSeasonEqMock }));
  const deleteInMock = vi.fn().mockResolvedValue({
    error: args.deleteError ?? null,
  });
  const deleteEqMock = vi.fn(() => ({ in: deleteInMock }));
  const teamSeasonDeleteMock = vi.fn(() => ({ eq: deleteEqMock }));

  const fromMock = vi.fn((table: string) => {
    if (table === "seasons") return { select: seasonSelectMock };
    if (table === "teams") return { upsert: teamsUpsertMock };
    if (table === "team_season") {
      return {
        upsert: teamSeasonUpsertMock,
        select: teamSeasonSelectMock,
        delete: teamSeasonDeleteMock,
      };
    }
    throw new Error(`Unexpected table ${table}`);
  });

  return {
    client: { from: fromMock },
    fromMock,
    seasonSelectMock,
    seasonEqMock,
    seasonSingleMock,
    teamsUpsertMock,
    teamSeasonUpsertMock,
    teamSeasonSelectMock,
    teamSeasonEqMock,
    teamSeasonDeleteMock,
    deleteEqMock,
    deleteInMock,
  };
}

async function invoke(
  supabase: ReturnType<typeof createSupabase>,
  query: Record<string, unknown> = {},
) {
  const req = { method: "POST", query, supabase: supabase.client } as any;
  const res = createMockRes();
  await handler(req, res);
  return res;
}

function expectNoMutations(supabase: ReturnType<typeof createSupabase>) {
  expect(supabase.teamsUpsertMock).not.toHaveBeenCalled();
  expect(supabase.teamSeasonUpsertMock).not.toHaveBeenCalled();
  expect(supabase.teamSeasonDeleteMock).not.toHaveBeenCalled();
}

describe("/api/v1/db/update-teams", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentSeasonMock.mockResolvedValue({ seasonId: 20252026 });
  });

  it.each([
    {
      seasonId: 20232024,
      startDate: "2023-10-10",
      team: scheduleTeam(53, "ARI", "Arizona Coyotes"),
    },
    {
      seasonId: 20242025,
      startDate: "2024-10-04",
      team: scheduleTeam(59, "UTA", "Utah Hockey Club"),
    },
    {
      seasonId: 20252026,
      startDate: "2025-10-07",
      team: scheduleTeam(68, "UTA", "Utah Mammoth"),
    },
  ])(
    "uses the $seasonId calendar and preserves its returned franchise ID",
    async ({ seasonId, startDate, team }) => {
      const supabase = createSupabase({ seasonId, startDate });
      getMock.mockResolvedValue(scheduleCalendar(startDate, [team]));

      const res = await invoke(supabase, { seasonId: String(seasonId) });

      expect(res.statusCode).toBe(200);
      expect(getCurrentSeasonMock).not.toHaveBeenCalled();
      expect(getMock).toHaveBeenCalledWith(`/schedule-calendar/${startDate}`);
      expect(supabase.seasonSelectMock).toHaveBeenCalledWith("id,startDate");
      expect(supabase.teamsUpsertMock).toHaveBeenCalledWith([
        { id: team.id, abbreviation: team.abbrev, name: team.name.default },
      ]);
      expect(supabase.teamSeasonUpsertMock).toHaveBeenCalledWith([
        { teamId: team.id, seasonId },
      ]);
      expect(supabase.teamSeasonSelectMock).not.toHaveBeenCalled();
      expect(supabase.teamSeasonDeleteMock).not.toHaveBeenCalled();
    },
  );

  it("performs validated exact-set cleanup only for the implicit current season", async () => {
    const supabase = createSupabase({
      existingTeamIds: [1, 2, 59],
    });
    getMock.mockResolvedValue(
      scheduleCalendar("2025-10-07", currentScheduleTeams()),
    );

    const res = await invoke(supabase);

    expect(res.statusCode).toBe(200);
    expect(getCurrentSeasonMock).toHaveBeenCalledOnce();
    expect(supabase.teamSeasonSelectMock).toHaveBeenCalledWith("teamId");
    expect(supabase.teamSeasonEqMock).toHaveBeenCalledWith(
      "seasonId",
      20252026,
    );
    expect(supabase.teamSeasonDeleteMock).toHaveBeenCalledOnce();
    expect(supabase.deleteEqMock).toHaveBeenCalledWith("seasonId", 20252026);
    expect(supabase.deleteInMock).toHaveBeenCalledWith("teamId", [59]);
  });

  it.each([
    {
      label: "truncated",
      teams: currentScheduleTeams().slice(0, -1),
    },
    {
      label: "identity-drifted",
      teams: currentScheduleTeams().map((team, index) =>
        index === 0 ? { ...team, abbrev: "ABC" } : team,
      ),
    },
  ])(
    "rejects a $label implicit-current calendar before inventory or writes",
    async ({ teams }) => {
      const supabase = createSupabase({ existingTeamIds: [1, 2, 68] });
      getMock.mockResolvedValue(scheduleCalendar("2025-10-07", teams));

      const res = await invoke(supabase);

      expect(res.statusCode).toBe(400);
      expect(supabase.teamSeasonSelectMock).not.toHaveBeenCalled();
      expectNoMutations(supabase);
    },
  );

  it("keeps a forced-team run additive and includes the forced memberships", async () => {
    const supabase = createSupabase();
    getMock.mockResolvedValue(scheduleCalendar("2025-10-07"));

    const res = await invoke(supabase, { forceTeamIds: "53, 59" });

    expect(res.statusCode).toBe(200);
    expect(supabase.teamSeasonUpsertMock).toHaveBeenCalledWith([
      { teamId: 1, seasonId: 20252026 },
      { teamId: 2, seasonId: 20252026 },
      { teamId: 53, seasonId: 20252026 },
      { teamId: 59, seasonId: 20252026 },
    ]);
    expect(supabase.teamSeasonSelectMock).not.toHaveBeenCalled();
    expect(supabase.teamSeasonDeleteMock).not.toHaveBeenCalled();
  });

  it.each([
    { query: { seasonId: "" }, label: "empty season" },
    { query: { seasonId: "2025.2026" }, label: "decimal season" },
    { query: { seasonId: "2025202" }, label: "short season" },
    { query: { seasonId: "20252027" }, label: "nonconsecutive season" },
    {
      query: { seasonId: "9007199254740992" },
      label: "unsafe season",
    },
    { query: { seasonId: ["20252026"] }, label: "array season" },
    { query: { forceTeamIds: "" }, label: "empty forced IDs" },
    { query: { forceTeamIds: "53,nope" }, label: "nonnumeric forced ID" },
    { query: { forceTeamIds: "53,53" }, label: "duplicate forced ID" },
    {
      query: { forceTeamIds: "9007199254740992" },
      label: "unsafe forced ID",
    },
  ])(
    "rejects a malformed $label before any dependency work",
    async ({ query }) => {
      const supabase = createSupabase();

      const res = await invoke(supabase, query);

      expect(res.statusCode).toBe(400);
      expect(getCurrentSeasonMock).not.toHaveBeenCalled();
      expect(getMock).not.toHaveBeenCalled();
      expect(supabase.fromMock).not.toHaveBeenCalled();
      expectNoMutations(supabase);
    },
  );

  it("rejects an invalid resolved current season before route database or NHL work", async () => {
    const supabase = createSupabase();
    getCurrentSeasonMock.mockResolvedValue({ seasonId: 20252027 });

    const res = await invoke(supabase);

    expect(res.statusCode).toBe(400);
    expect(getCurrentSeasonMock).toHaveBeenCalledOnce();
    expect(getMock).not.toHaveBeenCalled();
    expect(supabase.fromMock).not.toHaveBeenCalled();
    expectNoMutations(supabase);
  });

  it("fails a season lookup without mutating team tables", async () => {
    const supabase = createSupabase({
      seasonError: new Error("lookup failed"),
    });

    const res = await invoke(supabase, { seasonId: "20252026" });

    expect(res.statusCode).toBe(400);
    expect(getMock).not.toHaveBeenCalled();
    expectNoMutations(supabase);
  });

  it("fails an invalid season start date without requesting a calendar", async () => {
    const supabase = createSupabase({ startDate: "2025-02-29" });

    const res = await invoke(supabase, { seasonId: "20252026" });

    expect(res.statusCode).toBe(400);
    expect(getMock).not.toHaveBeenCalled();
    expectNoMutations(supabase);
  });

  it("fails an upstream calendar request without mutating team tables", async () => {
    const supabase = createSupabase();
    getMock.mockRejectedValue(new Error("NHL unavailable"));

    const res = await invoke(supabase, { seasonId: "20252026" });

    expect(res.statusCode).toBe(400);
    expectNoMutations(supabase);
  });

  it("fails an implicit cleanup inventory lookup before any write", async () => {
    const supabase = createSupabase({
      existingRowsError: new Error("membership lookup failed"),
    });
    getMock.mockResolvedValue(
      scheduleCalendar("2025-10-07", currentScheduleTeams()),
    );

    const res = await invoke(supabase);

    expect(res.statusCode).toBe(400);
    expect(supabase.teamSeasonSelectMock).toHaveBeenCalledWith("teamId");
    expectNoMutations(supabase);
  });

  it.each([
    {
      calendar: scheduleCalendar("2025-10-08"),
      label: "wrong response date",
    },
    { calendar: scheduleCalendar("2025-10-07", []), label: "empty team set" },
    {
      calendar: scheduleCalendar("2025-10-07", [
        scheduleTeam(53, "ARI", "Arizona Coyotes"),
        scheduleTeam(53, "ARI", "Arizona Coyotes"),
      ]),
      label: "duplicate team IDs",
    },
    {
      calendar: scheduleCalendar("2025-10-07", [
        scheduleTeam(0, "BOS", "Boston Bruins"),
      ]),
      label: "nonpositive team ID",
    },
    {
      calendar: scheduleCalendar("2025-10-07", [
        scheduleTeam(1.5, "BOS", "Boston Bruins"),
      ]),
      label: "noninteger team ID",
    },
    {
      calendar: scheduleCalendar("2025-10-07", [
        scheduleTeam(1, "bos", "Boston Bruins"),
      ]),
      label: "invalid abbreviation",
    },
    {
      calendar: scheduleCalendar("2025-10-07", [scheduleTeam(1, "BOS", "")]),
      label: "missing name",
    },
  ])("rejects a $label before the first write", async ({ calendar }) => {
    const supabase = createSupabase();
    getMock.mockResolvedValue(calendar);

    const res = await invoke(supabase, { seasonId: "20252026" });

    expect(res.statusCode).toBe(400);
    expectNoMutations(supabase);
  });
});
