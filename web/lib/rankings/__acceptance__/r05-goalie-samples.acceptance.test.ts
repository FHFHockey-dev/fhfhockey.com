// Goalie regression tests for F5 (team token), F6 (window Start Share) and F7
// (projection age). Only the data layer (Supabase) is faked; requests are
// built by the real URL builder and parsed by the real parser. The open R05
// exposure reproduction lives in
// tasks/artifacts/rankings-acceptance-2026-11-14/offline-correctness/repros/.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { failClosedFetch, type FakeDb } from "./fakeSupabase";

const db = vi.hoisted(() => ({ tables: {}, calls: [] }) as FakeDb);
vi.mock("lib/supabase/server", async () => {
  const { createFakeSupabase } = await import("./fakeSupabase");
  return { default: createFakeSupabase(db) };
});

import {
  buildGoalieMatrixSurface,
  clearGoalieMatrixSurfaceCachesForTests,
  parseGoalieMatrixRequest,
} from "../goalieMatrix";
import { parsePlayerMatrixRequestWithResolvedTeam } from "../playerMatrix";
import { ContextualRankingsQueryError } from "../rankingTypes";
import { buildContextualRankingSnapshotSurface } from "../snapshot";
import {
  DEFAULT_RANKINGS_FILTERS,
  buildGoalieMatrixRequestPath,
  buildSnapshotRequestPath,
  type RankingsFilterState,
} from "../rankingUrlState";
import { seasonDay, seedGoalieDb, type GoalieAppearanceSpec } from "./goalieFixture";

const fetchSpy = vi.fn(failClosedFetch());
const EDM = { id: 22, abbreviation: "EDM", name: "Edmonton Oilers" };
const TOR = { id: 10, abbreviation: "TOR", name: "Toronto Maple Leafs" };

function queryOf(path: string | null) {
  if (path == null) throw new Error("URL builder returned null");
  return Object.fromEntries(new URLSearchParams(path.split("?")[1]));
}

function goalieFilters(overrides: Partial<RankingsFilterState> = {}): RankingsFilterState {
  return {
    ...DEFAULT_RANKINGS_FILTERS,
    entity: "goalies",
    season: "20262027",
    pageSize: "50",
    ...overrides,
  };
}

async function goalieMatrix(overrides: Partial<RankingsFilterState> = {}) {
  const request = parseGoalieMatrixRequest(
    queryOf(buildGoalieMatrixRequestPath(goalieFilters(overrides))),
  );
  return buildGoalieMatrixSurface(request);
}

/** Team `teamId`: `starts` games, goalie `starterId` starts each one. */
function teamGames(args: {
  teamId: number;
  firstGameId: number;
  firstDay: number;
  starts: Array<{ goalieId: number; hdShots?: number; hdSaves?: number }>;
}): GoalieAppearanceSpec[] {
  return args.starts.map((start, index) => ({
    goalieId: start.goalieId,
    teamId: args.teamId,
    gameId: args.firstGameId + index,
    date: seasonDay(args.firstDay + index * 2),
    started: true,
    shots: 30,
    saves: 27,
    hdShots: start.hdShots,
    hdSaves: start.hdSaves,
  }));
}

beforeEach(() => {
  vi.useFakeTimers({ now: new Date("2026-11-10T12:00:00.000Z"), toFake: ["Date"] });
  vi.stubGlobal("fetch", fetchSpy);
  fetchSpy.mockClear();
  db.tables = {};
  db.calls = [];
  clearGoalieMatrixSurfaceCachesForTests();
});

afterEach(() => {
  expect(fetchSpy).not.toHaveBeenCalled();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("R05 goalie samples, stints and workload (offline, 89da739cb)", () => {

  it("FIXED F6 R05-STARTSHARE-WINDOW (was DEFECT PRESENT): Start Share in a Last 5 view is the window share; the projection's season share stays role context", async () => {
    // EDM: goalie 1 starts games 1-10, goalie 2 starts the last 4 of the last 5.
    const starts = [
      ...Array.from({ length: 10 }, () => ({ goalieId: 1 })),
      { goalieId: 1 },
      ...Array.from({ length: 4 }, () => ({ goalieId: 2 })),
    ];
    const appearances = teamGames({ teamId: EDM.id, firstGameId: 100, firstDay: 10, starts });
    const projection = {
      player_id: 1, team_id: EDM.id, game_id: 999, game_date: "2026-11-07",
      start_probability: 0.7, projected_gsaa_per_60: 0.1, confirmed_status: false,
      l10_start_pct: 0.6, season_start_pct: 0.73,
    };
    seedGoalieDb(db, { teams: [EDM], appearances, projections: [projection] });

    const filters = { window: "last5" as const, goalieMetric: "start_share" as const, goalieMinStarts: "0", goalieMinShots: "0" };
    const withProjection = await goalieMatrix(filters);
    const goalieOne = withProjection.rows.find((row) => row.entity.id === 1)!;
    expect(goalieOne.role.windowStartShare).toBe(0.2);
    expect(goalieOne.metrics.start_share.rawValue).toBe(0.2);
    // The projection still drives role context.
    expect(goalieOne.role).toMatchObject({
      seasonStartShare: 0.73,
      deploymentSource: "goalie_start_projections.season_start_pct",
    });

    // The season view keeps the matching-team projected season share.
    clearGoalieMatrixSurfaceCachesForTests();
    const season = await goalieMatrix({ ...filters, window: "season" });
    expect(season.rows.find((row) => row.entity.id === 1)!.metrics.start_share.rawValue).toBe(0.73);
  });

  it("FIXED F7 R05-PROJECTION-AGE (was DEFECT PRESENT): a projection more than 7 days older than the window's latest game is role context only, with a warning and lower confidence", async () => {
    const appearances = teamGames({
      teamId: EDM.id, firstGameId: 100, firstDay: 16,
      starts: [
        ...Array.from({ length: 6 }, () => ({ goalieId: 1 })),
        ...Array.from({ length: 6 }, () => ({ goalieId: 2 })),
      ],
    }); // last game 2026-11-08
    const projectionAt = (gameDate: string) => ({
      player_id: 1, team_id: EDM.id, game_id: 999, game_date: gameDate,
      start_probability: 0.9, projected_gsaa_per_60: 0.2, confirmed_status: true,
      l10_start_pct: 0.9, season_start_pct: 0.9,
    });
    async function goalieOneWith(gameDate: string) {
      clearGoalieMatrixSurfaceCachesForTests();
      seedGoalieDb(db, { teams: [EDM], appearances, projections: [projectionAt(gameDate)] });
      return (await goalieMatrix({ goalieMetric: "start_share" })).rows.find((row) => row.entity.id === 1)!;
    }

    // Fresh (1 day) and boundary (exactly 7 days): confirmed projection drives the role.
    for (const fresh of ["2026-11-07", "2026-11-01"]) {
      const row = await goalieOneWith(fresh);
      expect(row.role).toMatchObject({
        deploymentSource: "goalie_start_projections.season_start_pct",
        roleConfidence: "high",
      });
      expect(row.metrics.start_share.rawValue).toBe(0.9);
      expect(row.warnings).not.toContain("stale_start_projection");
    }

    // Stale (8 and 38 days): context only.
    for (const stale of ["2026-10-31", "2026-10-01"]) {
      const row = await goalieOneWith(stale);
      expect(row.warnings).toContain("stale_start_projection");
      expect(row.role.roleConfidence).not.toBe("high");
      expect(row.role.deploymentSource).toBe("selected_window_team_start_share");
      expect(row.metrics.start_share.rawValue).toBe(0.5);
      // Still shown as context.
      expect(row.role.seasonStartShare).toBe(0.9);
      expect(row.role.confirmedStatus).toBe(true);
    }
  });
});

describe("R04 goalie team token handling (F5)", () => {
  it("FIXED F5 R04-GOALIE-INVALID-TOKEN (was DEFECT PRESENT): an unknown goalie team token is the same query error as for skaters, in the matrix and the snapshot", async () => {
    seedGoalieDb(db, {
      teams: [EDM],
      appearances: teamGames({
        teamId: EDM.id, firstGameId: 100, firstDay: 0,
        starts: Array.from({ length: 6 }, () => ({ goalieId: 1 })),
      }),
    });

    const skaterError = await parsePlayerMatrixRequestWithResolvedTeam({ season: "20262027", team: "XYZ" })
      .then(() => null, (error: unknown) => error as Error & { details?: unknown });
    expect(skaterError).toBeInstanceOf(ContextualRankingsQueryError);

    const goalieError = await goalieMatrix({ team: "XYZ" })
      .then(() => null, (error: unknown) => error as Error & { details?: unknown });
    expect(goalieError).toBeInstanceOf(ContextualRankingsQueryError);
    expect(goalieError!.message).toBe(skaterError!.message);
    expect(goalieError!.details).toEqual(skaterError!.details);

    clearGoalieMatrixSurfaceCachesForTests();
    await expect(buildContextualRankingSnapshotSurface(
      queryOf(buildSnapshotRequestPath(goalieFilters({ team: "XYZ", selectedGoalieId: "1" }))),
    )).rejects.toBeInstanceOf(ContextualRankingsQueryError);

    // Valid abbreviation, id or name still find the goalie.
    for (const token of ["EDM", "22", "Edmonton Oilers"]) {
      clearGoalieMatrixSurfaceCachesForTests();
      expect((await goalieMatrix({ team: token })).rows.map((row) => row.entity.id)).toEqual([1]);
    }
  });
});
