import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("./gameState", async (load) => ({ ...await load<object>(), observeLineGame: async (game: unknown) => game }));
import { readGameLines } from "./service";
import { lineTestDatabase } from "./testDatabase";
import { fixtureClaim, fixtureGame, fixtureNext, fixtureNow, fixturePP, fixtureResponse } from "./testFixtures";

export function serviceDatabase() {
  const response = fixtureResponse();
  const row = (game: typeof fixtureGame) => ({ id: game.id, date: game.date, startTime: game.scheduledStart, homeTeamId: game.homeTeamId, awayTeamId: game.awayTeamId, home: { abbreviation: game.homeAbbreviation }, away: { abbreviation: game.awayAbbreviation } });
  return lineTestDatabase({
    games: [row(fixtureGame), row(fixtureNext)],
    line_game_state_observations: [fixtureGame, fixtureNext].map((game) => ({ game_id: game.id, state_id: `state${game.id}`, observed_at: game.observedAt, payload: game })),
    line_claim_revisions: [fixtureClaim(), fixturePP(1), fixturePP(2), fixtureClaim("unknown", { gameId: null, reviewReasons: ["missing_timezone"] })].map((claim) => ({ team_id: claim.teamId, claim_id: claim.id, interpreted_at: claim.time.interpretedAt, payload: claim })),
    line_entry_revisions: [{ entry_id: response.teams[0]!.entry!.id, team_id: 14, game_id: fixtureGame.id, revision: 1, payload: response.teams[0]!.entry }],
    line_pp_decisions: [],
  });
}
beforeEach(() => { vi.stubEnv("LINES_ENTRY_SERVING_ENABLED", "true"); vi.stubEnv("LINES_OBSERVATIONS_ENABLED", "true"); vi.stubEnv("LINES_PP_CARRY_FORWARD_ENABLED", "true"); });
afterEach(() => vi.unstubAllEnvs());
describe("shared game/team response", () => {
  it("defaults to live, keeps teams separated and never writes on GET", async () => {
    const db = serviceDatabase();
    const response = await readGameLines(db, { teamId: 14, now: fixtureNow });
    expect(response.game?.id).toBe(fixtureGame.id); expect(response.teams).toHaveLength(1);
    expect(response.teams[0]!.entry?.status).toBe("frozen"); expect(response.teams[0]!.observations).toHaveLength(2);
    expect(response.teams[0]!.unresolved[0]!.reasons).toContain("missing_timezone");
    expect(db.writes).toHaveLength(0);
    const both = await readGameLines(db, { gameId: fixtureGame.id, now: fixtureNow });
    expect(both.teams.map((team) => team.teamId)).toEqual([14, 3]); expect(both.teams[1]!.entry).toBeNull();
    expect(both.teams[1]!.observations).toHaveLength(0);
  });
  it("selects next scheduled after final and labels previous-entry fallback and carried PP", async () => {
    const db = serviceDatabase(); db.tables.line_game_state_observations![0]!.payload.phase = "final";
    const response = await readGameLines(db, { teamId: 14, now: fixtureNow });
    expect(response.game?.id).toBe(fixtureNext.id); expect(response.teams[0]!.fallback?.gameId).toBe(fixtureGame.id);
    expect(response.teams[0]!.ppDefaults.every((decision) => decision.selection?.designation === "carried")).toBe(true);
    expect(db.writes).toHaveLength(0);
  });
  it("scope mismatch cannot return the other team's lineup", async () => {
    expect((await readGameLines(serviceDatabase(), { teamId: 99, gameId: fixtureGame.id, now: fixtureNow })).game).toBeNull();
  });
  it("separate controls disable serving and observation history independently", async () => {
    const db = serviceDatabase(); vi.stubEnv("LINES_ENTRY_SERVING_ENABLED", "false");
    expect((await readGameLines(db, { teamId: 14, now: fixtureNow })).status).toBe("disabled"); expect(db.from).not.toHaveBeenCalled();
    vi.stubEnv("LINES_ENTRY_SERVING_ENABLED", "true"); vi.stubEnv("LINES_OBSERVATIONS_ENABLED", "false");
    const response = await readGameLines(db, { teamId: 14, now: fixtureNow });
    expect(response.teams[0]!.observations).toHaveLength(0); expect(response.teams[0]!.history).toHaveLength(0); expect(response.teams[0]!.entry).not.toBeNull();
  });
});
