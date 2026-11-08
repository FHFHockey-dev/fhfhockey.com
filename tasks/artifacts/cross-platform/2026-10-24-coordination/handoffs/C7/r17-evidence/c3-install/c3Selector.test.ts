import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentSeason: vi.fn(),
  summaryGameIds: vi.fn(),
  gamesRows: [] as Array<Record<string, unknown>>,
}));

vi.mock("lib/NHL/server", () => ({ getCurrentSeason: mocks.getCurrentSeason }));
vi.mock("lib/underlying-stats/playerStatsSummaryRefresh", () => ({
  fetchSeasonSummaryGameIdSet: mocks.summaryGameIds,
  PLAYER_STATS_SUMMARY_PARTITION_SOURCE_URL_PREFIX: "derived://underlying-player-summary-v2/",
}));
vi.mock("lib/supabase/pagination", () => ({
  fetchAllSupabasePages: async (factory: (page: { from: number; to: number }) => PromiseLike<{ data: unknown[] }>) =>
    (await factory({ from: 0, to: 999 })).data,
}));
vi.mock("lib/supabase/server", () => {
  const query: any = {
    select: () => query, eq: () => query, lte: () => query, order: () => query, range: () => query,
    then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: mocks.gamesRows, error: null }).then(resolve),
  };
  return { default: { from: () => query } };
});

import { resolvePlayerStatsIncrementalSelection } from "lib/underlying-stats/playerStatsRefreshWindow";
import { writeFileSync } from "node:fs";
// C7 property control for C3b v2: 400 random seasons of finished games and coverage holes.
describe("C7 C3b selector properties", () => {
  it("P1 startDate = earliest selected; watermark kept; holes only within latest-finished − 7 d; no covered game behind the watermark; ids unique", async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-12-31T16:00:00Z")); mocks.getCurrentSeason.mockResolvedValue({ seasonId: 20262027 });
    let seed = 7; const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
    const bad: string[] = []; let selectedHoles = 0, cases = 0;
    for (let n = 0; n < 400; n++) {
      const days = 5 + Math.floor(rnd() * 40), games: any[] = []; let gid = 1;
      for (let d = 0; d < days; d++) { if (rnd() < 0.3) continue; const date = new Date(Date.UTC(2026, 9, 1 + d)).toISOString().slice(0, 10);
        for (let k = 0; k < 1 + Math.floor(rnd() * 8); k++) games.push({ id: 2026020000 + gid++, date, startTime: `${date}T23:00:00Z`, seasonId: 20262027, type: 2 }); }
      if (!games.length) continue;
      const covered = new Set(games.filter(() => rnd() > (n % 4 === 0 ? 0.9 : 0.15)).map(g => g.id));
      mocks.gamesRows = [...games].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id); mocks.summaryGameIds.mockResolvedValue(covered);
      const s = await resolvePlayerStatsIncrementalSelection(); cases++;
      const byId = new Map(games.map(g => [g.id, g])), sel = s.gameIds.map(id => byId.get(id)!);
      const latest = games.reduce((m, g) => g.date > m ? g.date : m, ""); const cov = games.filter(g => covered.has(g.id)); const wm = cov.length ? cov.reduce((m, g) => g.date > m ? g.date : m, "") : null;
      const floor = new Date(Date.parse(`${latest}T12:00:00Z`) - 7 * 86400000).toISOString().slice(0, 10);
      const tag = `case ${n}`;
      if (new Set(s.gameIds).size !== s.gameIds.length) bad.push(`${tag} dup`);
      if (s.latestCoveredDate !== wm) bad.push(`${tag} watermark ${s.latestCoveredDate} vs ${wm}`);
      if (s.endDate !== latest) bad.push(`${tag} endDate`);
      if (sel.length && s.startDate !== sel.reduce((m, g) => g.date < m ? g.date : m, "9999")) bad.push(`${tag} startDate ${s.startDate}`);
      const start = wm ?? games.reduce((m, g) => g.date < m ? g.date : m, "9999");
      for (const g of games) {
        const want = g.date >= start || (wm !== null && !covered.has(g.id) && g.date >= floor);
        if (want !== s.gameIds.includes(g.id)) bad.push(`${tag} game ${g.id} ${g.date} want ${want}`);
        if (want && g.date < start) selectedHoles++;
      }
    }
    if (process.env.C7_C3_OUT) writeFileSync(process.env.C7_C3_OUT, JSON.stringify({ cases, selectedHoles, bad: bad.slice(0, 20), badCount: bad.length }, null, 2));
    expect(bad).toEqual([]); expect(selectedHoles).toBeGreaterThan(0);
  });
});
