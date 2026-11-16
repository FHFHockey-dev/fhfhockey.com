// Open-defect reproduction (goalies: R05 per-metric exposure, F8). A PASSING
// "DEFECT PRESENT" test means the defect still exists; when a fix lands, flip
// it into a regression test in web/lib/rankings/__acceptance__/. Only the data
// layer (Supabase) is faked.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { failClosedFetch, type FakeDb } from "./fakeSupabase";

const db = vi.hoisted(() => ({ tables: {}, calls: [] }) as FakeDb);
vi.mock("/Users/tim/Code/fhfhockey.com/web/lib/supabase/server", async () => {
  const { createFakeSupabase } = await import("./fakeSupabase");
  return { default: createFakeSupabase(db) };
});

import {
  buildGoalieMatrixSurface,
  clearGoalieMatrixSurfaceCachesForTests,
  parseGoalieMatrixRequest,
} from "/Users/tim/Code/fhfhockey.com/web/lib/rankings/goalieMatrix";
import {
  DEFAULT_RANKINGS_FILTERS,
  buildGoalieMatrixRequestPath,
  type RankingsFilterState,
} from "/Users/tim/Code/fhfhockey.com/web/lib/rankings/rankingUrlState";
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

describe("Open: R05 per-metric exposure (F8)", () => {
  it("DEFECT PRESENT R05-EXPOSURE: HD SV% is ranked on 1 high-danger shot because only the global start/shot floor gates every metric", async () => {
    seedGoalieDb(db, {
      teams: [EDM, TOR],
      appearances: [
        // Goalie 1: 6 starts, 180 shots, but a single high-danger shot (saved).
        ...teamGames({
          teamId: EDM.id, firstGameId: 100, firstDay: 0,
          starts: Array.from({ length: 6 }, (_, index) => ({
            goalieId: 1, hdShots: index === 0 ? 1 : 0, hdSaves: index === 0 ? 1 : 0,
          })),
        }),
        // Goalie 2: same workload with 48 high-danger shots, 44 saved.
        ...teamGames({
          teamId: TOR.id, firstGameId: 200, firstDay: 1,
          starts: Array.from({ length: 6 }, () => ({ goalieId: 2, hdShots: 8, hdSaves: 7 })),
        }),
      ],
    });

    const response = await goalieMatrix({ goalieMetric: "high_danger_save_percentage" });
    const one = response.rows.find((row) => row.entity.id === 1)!;
    const two = response.rows.find((row) => row.entity.id === 2)!;

    expect(one.sample).toMatchObject({ gamesStarted: 6, shotsAgainst: 180, minimumSampleMet: true });
    expect(one.metrics.high_danger_save_percentage).toMatchObject({ rawValue: 1, rank: 1, percentile: 100 });
    expect(two.metrics.high_danger_save_percentage).toMatchObject({ rank: 2, percentile: 0 });
    // No metric-specific exposure warning accompanies the 1-shot rate.
    expect(one.warnings.filter((warning) => /high_danger|exposure/.test(warning))).toEqual([]);
    expect(one.warnings).toEqual(two.warnings);

    // Paired control: the only gate is the global floor. Below 5 starts the
    // same goalie is unranked for every metric, including HD SV%.
    clearGoalieMatrixSurfaceCachesForTests();
    const lowered = await goalieMatrix({
      goalieMetric: "high_danger_save_percentage",
      goalieMinStarts: "7",
    });
    expect(lowered.rows.find((row) => row.entity.id === 1)!.metrics.high_danger_save_percentage.rank).toBeNull();
  });
});
