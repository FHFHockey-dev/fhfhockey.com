import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { lineTestDatabase } from "./testDatabase";
const observed = vi.fn();
vi.mock("./gameState", async (load) => ({ ...await load<object>(), observeLineGame: async (game: any, now: string) => { observed(game.id); return { ...game, phase: "live", actualStart: "2026-11-08T00:07:00Z", observedAt: now, stateSource: "fixture:nhl" }; } }));
import { readGameLines } from "./service";
import { fixtureClaim } from "./testFixtures";

// Game-night shape: team 14 has a season of games behind it, a state row every 5 minutes for tonight's game, and
// one claim plus an entry/PP decision chain for each recent game.
const NOW = "2026-11-08T01:00:00Z";
const TONIGHT = 2026020500;
const row = (id: number, date: string, start: string | null, home = 14, away = 3) => ({ id, date, startTime: start, homeTeamId: home, awayTeamId: away, home: { abbreviation: home === 14 ? "TBL" : "NYR" }, away: { abbreviation: away === 14 ? "TBL" : "NYR" } });
const history = Array.from({ length: 120 }, (_, index) => {
  const date = new Date(Date.parse("2026-11-07T00:00:00Z") - (index + 1) * 2 * 86_400_000).toISOString().slice(0, 10);
  return row(2026020000 + index, date, `${date}T23:00:00Z`);
});
const tonight = row(TONIGHT, "2026-11-07", "2026-11-08T00:00:00Z");
const states: any[] = Array.from({ length: 300 }, (_, index): any => ({ game_id: TONIGHT, state_id: `s${index}`, observed_at: new Date(Date.parse(NOW) - (index + 2) * 300_000).toISOString(),
  payload: { id: TONIGHT, date: tonight.date, homeTeamId: 14, awayTeamId: 3, homeAbbreviation: "TBL", awayAbbreviation: "NYR", scheduledStart: tonight.startTime, phase: "pregame", actualStart: null,
    observedAt: new Date(Date.parse(NOW) - (index + 2) * 300_000).toISOString(), stateSource: "fixture:nhl", scheduleIdentity: `${TONIGHT}:${tonight.startTime}:OK`, replacesGameId: null } }))
  .concat(history.flatMap((game) => Array.from({ length: 30 }, (_, index) => ({ game_id: game.id, state_id: `h${game.id}:${index}`, observed_at: `${game.date}T2${index % 10}:00:00Z`, payload: { id: game.id, phase: "final" } }))));
const claims = history.slice(0, 60).map((game, index) => fixtureClaim(`c${index}`, { gameId: game.id }))
  .map((claim, index) => ({ team_id: 14, claim_id: claim.id, interpreted_at: new Date(Date.parse("2026-11-07T00:00:00Z") - (index + 1) * 2 * 86_400_000).toISOString(), payload: { ...claim, time: { ...claim.time, interpretedAt: new Date(Date.parse("2026-11-07T00:00:00Z") - (index + 1) * 2 * 86_400_000).toISOString() } } }));
const entries = history.slice(0, 60).flatMap((game) => Array.from({ length: 5 }, (_, revision) => ({ entry_id: `e${game.id}:${revision}`, team_id: 14, game_id: game.id, revision: revision + 1,
  payload: { id: `e${game.id}:${revision}`, gameId: game.id, teamId: 14, revision: revision + 1, previousId: null, status: "frozen", units: [], conflicts: [], cutoff: `${game.date}T23:07:00Z`, frozenState: null, selectorVersion: "t", createdAt: `${game.date}T23:00:00Z`, reason: "t", correctionClaimIds: [] } })));
function database() {
  return lineTestDatabase({ games: [tonight, ...history], line_game_state_observations: states, line_claim_revisions: claims, line_entry_revisions: entries, line_pp_decisions: [], rosters: [] });
}
const count = (db: ReturnType<typeof database>) => ({ queries: db.from.mock.calls.length, rows: db.reads.rows, nhl: observed.mock.calls.length });
beforeEach(() => { vi.stubEnv("LINES_ENTRY_SERVING_ENABLED", "true"); vi.stubEnv("LINES_OBSERVATIONS_ENABLED", "true"); vi.stubEnv("LINES_PP_CARRY_FORWARD_ENABLED", "true"); observed.mockClear(); });
afterEach(() => vi.unstubAllEnvs());

const freshDatabase = () => { const db = database(); db.tables.line_game_state_observations!.push({ ...states[0]!, state_id: "fresh", observed_at: "2026-11-08T00:58:00Z",
  payload: { ...states[0]!.payload, phase: "live", actualStart: "2026-11-08T00:07:00Z", observedAt: "2026-11-08T00:58:00Z" } }); return db; };

// Before the fix, same fixture: team route 10 queries / 4381 rows / 1 NHL read; game route 132 queries / 2763 rows / 1 NHL read.
describe("public GET load shape (game-night traffic, s-maxage=15)", () => {
  it("team route: a fixed handful of queries and rows, whatever the season's history", async () => {
    const db = database();
    const response = await readGameLines(db, { teamId: 14, now: NOW });
    expect(response.game).toMatchObject({ id: TONIGHT, phase: "live" });
    expect(count(db)).toEqual({ queries: 7, rows: 71, nhl: 1 });
    // The previous game's frozen entry is still the fallback, from inside the window.
    expect(response.teams[0]!.fallback).toMatchObject({ gameId: history[0]!.id, date: history[0]!.date });
  });
  it("game route: no per-claim game reads", async () => {
    const db = database();
    const response = await readGameLines(db, { gameId: TONIGHT, now: NOW });
    expect(response.teams.map((team) => team.teamId)).toEqual([3, 14]);
    expect(count(db).queries).toBeLessThanOrEqual(12); expect(count(db).rows).toBeLessThanOrEqual(90);
  });
  it("a stored state younger than 5 minutes is served without an NHL read", async () => {
    const team = freshDatabase();
    expect((await readGameLines(team, { teamId: 14, now: NOW })).game).toMatchObject({ id: TONIGHT, phase: "live" });
    const game = freshDatabase();
    await readGameLines(game, { gameId: TONIGHT, now: NOW });
    expect(observed).not.toHaveBeenCalled();
  });
  it("never writes", async () => {
    const db = freshDatabase();
    for (let index = 0; index < 4; index++) await readGameLines(db, { teamId: 14, now: NOW });
    expect(db.writes).toEqual([]); expect(db.rpc).not.toHaveBeenCalled();
  });
});
