// @vitest-environment node
/**
 * FORGE projection-math audit fixes (2026-11-16) through the production writer on the parity fixture world (one game,
 * home team 10 against team 6, frozen clock). Read-only use of the pregame-capture harness; its oracle is not used here.
 */
import { describe, expect, it, vi } from "vitest";
import { captureProjectionInputs } from "lib/projections/inputCapture";
import { SCENARIOS, runWriterScenario } from "./pregameCapture/parity/scenarios";
import { activateWorld } from "./pregameCapture/parity/harness";
import { createCaptureTransport, DEFAULT_TRANSPORT_BUDGET } from "./pregameCapture/transport";
import { buildLeague, TARGET } from "./pregameCapture/__fixtures__/world/league";
import { createWorldClient, type World } from "./pregameCapture/__fixtures__/world/store";

vi.mock("lib/supabase/server", async () => (await import("./pregameCapture/parity/harness")).worldServerModule());
vi.mock("lib/projections/inputCapture", async (importOriginal) => {
  const original = await importOriginal<typeof import("lib/projections/inputCapture")>();
  const { writerCaptures } = await import("./pregameCapture/parity/harness");
  return {
    ...original,
    captureProjectionInputs: async (work: any, options: any) => {
      const result = await original.captureProjectionInputs(work, options);
      writerCaptures.push({ reads: result.reads, writes: result.writes });
      return result;
    },
  };
});
vi.mock("lib/projections/gameRevisions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("lib/projections/gameRevisions")>()),
  saveForgeInputSnapshot: async () => "fixture-snapshot",
  publishForgeGameRevisions: async () => 1,
}));

type Op = { method: string; args: unknown[] };
const NORMAL = SCENARIOS.find((scenario) => scenario.name === "normal-one-game")!;
const HOME = TARGET.homeTeamId;
const AWAY = TARGET.awayTeamId;
const homeId = (offset: number) => 8_470_000 + HOME * 100 + offset;
// Team 10's dressed lineup in the fixture: forwards +1..+12 and defense +21..+26; +13 and +27 are the extras.

function rowsOf(writes: Op[][], table: string): any[] {
  return writes.filter((ops) => ops[0]?.args[0] === table).flatMap((ops) => {
    const write = ops.find((op) => op.method === "upsert" || op.method === "insert" || op.method === "update");
    return Array.isArray(write?.args[0]) ? (write!.args[0] as any[]) : write ? [write.args[0]] : [];
  });
}

async function run(mutate?: (world: World) => void) {
  const { writes, reads } = await runWriterScenario(NORMAL, mutate);
  const w = writes as Op[][];
  const runs = rowsOf(w, "forge_runs");
  return {
    reads,
    players: rowsOf(w, "forge_player_projections").filter((row) => row.team_id === HOME),
    team: rowsOf(w, "forge_team_projections").find((row) => row.team_id === HOME),
    awayGoalie: rowsOf(w, "forge_goalie_projections").find((row) => row.team_id === AWAY),
    game: rowsOf(w, "game_prediction_outputs")[0],
    metrics: runs[runs.length - 1].metrics,
  };
}

/** Drops ids from team 10's newest lineup row; with `unrostered`, also removes their current roster rows. */
const withoutHomeSkaters = (ids: number[], unrostered: number[] = []) => (world: World) => {
  const dateOf = new Map(world.tables.games.map((game) => [game.id, game.date]));
  const latest = world.tables.lineCombinations.filter((row) => row.teamId === HOME)
    .sort((a, b) => String(dateOf.get(b.gameId)).localeCompare(String(dateOf.get(a.gameId))))[0];
  latest.forwards = latest.forwards.filter((id: number) => !ids.includes(id));
  latest.defensemen = latest.defensemen.filter((id: number) => !ids.includes(id));
  world.tables.rosters = world.tables.rosters.filter((row) => !unrostered.includes(row.playerId));
};

const totalToi = (row: any) => row.proj_toi_es_seconds + row.proj_toi_pp_seconds + (row.proj_toi_pk_seconds ?? 0);
const teamColumns = (row: any) => ({
  toi: [row.proj_toi_es_seconds, row.proj_toi_pp_seconds, row.proj_toi_pk_seconds],
  shots: [row.proj_shots_es, row.proj_shots_pp, row.proj_shots_pk],
});

describe("H4: an incomplete skater pool is capped at its lineup share (TJ 2026-11-16)", () => {
  it("a full 18-skater pool keeps the canonical budget and reports no missing coverage", async () => {
    const full = await run();
    expect(full.players).toHaveLength(18);
    expect(full.players.reduce((sum, row) => sum + totalToi(row), 0)).toBeCloseTo(18000, -1);
    expect(full.team.uncertainty.missing_skater_coverage).toBeUndefined();
    expect(full.metrics.data_quality.skater_pool_emergency_toi_target_caps_applied).toBe(0);
  });

  it.each([
    // 17: one depth forward out of the lineup. 15: three dressed skaters without roster rows (Utah, 11-16).
    // 14: four of them plus both extras, so pool recovery has no current-roster candidate left.
    { count: 17, mutate: withoutHomeSkaters([homeId(12)]) },
    { count: 15, mutate: withoutHomeSkaters([], [homeId(10), homeId(11), homeId(26)]) },
    { count: 14, mutate: withoutHomeSkaters([], [homeId(9), homeId(10), homeId(11), homeId(26), homeId(13), homeId(27)]) },
  ])("$count skaters: players stay within pool/18 of the budget; team, game and opposing-goalie totals keep the full team", async ({ count, mutate }) => {
    const full = await run();
    const short = await run(mutate);
    expect(short.players).toHaveLength(count);

    // Players: never more than 1,000 s (16.7 min) each on average; the remainder is reported, not reallocated.
    const modeledSeconds = short.players.reduce((sum, row) => sum + totalToi(row), 0);
    // Each row rounds its own seconds, so allow half a second per row.
    expect(modeledSeconds).toBeLessThanOrEqual((18000 * count) / 18 + count / 2);
    const coverage = short.team.uncertainty.missing_skater_coverage;
    expect(coverage).toMatchObject({ projected_skater_count: count, full_pool_skater_count: 18 });
    expect(coverage.modeled_share).toBeLessThanOrEqual(Number((count / 18).toFixed(4)));
    const unmodeledSeconds = coverage.unmodeled_toi_seconds.es + coverage.unmodeled_toi_seconds.pp + coverage.unmodeled_toi_seconds.pk;
    expect(modeledSeconds + unmodeledSeconds).toBeCloseTo(18000, -1);
    for (const row of short.players) {
      expect(row.uncertainty.model.skater_selection.strength_accounting.team_budget).toMatchObject({
        projected_skater_count: count, modeled_share: coverage.modeled_share,
      });
    }

    // Team row and the opposing goalie's shots against: the full-team figure, as for a full pool.
    expect(teamColumns(short.team)).toEqual(teamColumns(full.team));
    expect(short.awayGoalie.proj_shots_against).toBe(full.awayGoalie.proj_shots_against);
    // Team goals: the modeled skaters' goals scaled back to the team's shots (absent skaters at the pool's rate).
    const playerGoalsEs = short.players.reduce((sum, row) => sum + row.proj_goals_es, 0);
    expect(short.team.proj_goals_es).toBeCloseTo(playerGoalsEs * coverage.goal_scale.es, 2);
    expect(short.team.proj_goals_es).toBeGreaterThan(playerGoalsEs);
    expect(short.game.home_expected_goals).toBeCloseTo(short.team.proj_goals_es + short.team.proj_goals_pp + short.team.proj_goals_pk, 2);
    expect(short.metrics.data_quality.skater_pool_emergency_toi_target_caps_applied).toBe(1);
    expect(short.metrics.warnings).toContain(
      `skater pool coverage cap for game=${TARGET.gameId} team=${HOME}; projected_count=${count} of 18 canonical_target=18000 pool_ceiling=${Math.round((18000 * count) / 18)} capped_target=${18000 - unmodeledSeconds}`,
    );
  });
  it("17 skaters whose own minutes are below the ceiling keep them: never scaled up, shots not raised to the cap", async () => {
    // Team 10's rolling minutes cut by a quarter, so the pool's own exposure is below 17/18 of the budget.
    const shortMinutes = (world: World) => {
      for (const row of world.tables.rolling_player_game_metrics) {
        if (row.team_id !== HOME) continue;
        for (const key of ["toi_seconds_avg_last5", "toi_seconds_avg_all", "toi_seconds_total_all", "toi_seconds_total_last5"]) {
          row[key] = Number((row[key] * 0.75).toFixed(1));
        }
      }
    };
    const full = await run(shortMinutes);
    const short = await run((world) => { shortMinutes(world); withoutHomeSkaters([homeId(12)])(world); });
    expect(short.players).toHaveLength(17);
    const coverage = short.team.uncertainty.missing_skater_coverage;
    const budget = short.players[0].uncertainty.model.skater_selection.strength_accounting.team_budget;
    // The target is the pool's own exposure, below the 17,000 s ceiling, and the players carry about that much.
    expect(budget.total_seconds).toBeLessThan(17000);
    expect(coverage.modeled_share).toBeLessThan(Number((17 / 18).toFixed(4)));
    const modeledSeconds = short.players.reduce((sum, row) => sum + totalToi(row), 0);
    expect(Math.abs(modeledSeconds - budget.total_seconds)).toBeLessThanOrEqual(17);
    // Shots stay at the pool's own level: well below team shots x 17/18 at even strength.
    const fullShotsEs = short.team.proj_shots_es;
    expect(coverage.unmodeled_shots.es).toBeGreaterThan(fullShotsEs * (1 - 17 / 18) + 0.5);
    // Team row and the opposing goalie keep the full-team figure.
    expect(teamColumns(short.team)).toEqual(teamColumns(full.team));
    expect(short.awayGoalie.proj_shots_against).toBe(full.awayGoalie.proj_shots_against);
  });
});

describe("M3: dressed skaters without a current roster row are counted and named", () => {
  it("counts and lists each dropped lineup skater, and stays silent for a clean lineup", async () => {
    const clean = await run();
    expect(clean.metrics.data_quality.filtered_skater_not_on_team_current_roster).toBeUndefined();

    const dropped = [homeId(10), homeId(11), homeId(26)];
    const utahLike = await run(withoutHomeSkaters([], dropped));
    expect(utahLike.players.map((row) => row.player_id)).not.toEqual(expect.arrayContaining([dropped[0]]));
    expect(utahLike.metrics.data_quality.filtered_skater_not_on_team_current_roster).toBe(3);
    expect(utahLike.metrics.data_quality.filtered_skater_not_on_team_current_roster_ids).toEqual(
      dropped.map((playerId) => ({ game_id: TARGET.gameId, team_id: HOME, player_id: playerId })),
    );
    expect(utahLike.metrics.warnings.some((warning: string) => warning.startsWith(
      `lineup skaters not on the team's current roster were dropped for game=${TARGET.gameId} team=${HOME}; player_ids=${dropped.join(",")}`,
    ))).toBe(true);
  });
});

describe("L1: completeness checks each team's previous game, not the pregame target", () => {
  const pbpGameIds = (reads: Array<{ request: unknown }>) => reads
    .map((read) => read.request as Op[])
    .filter((ops) => ops[0]?.args[0] === "pbp_games")
    .map((ops) => Number(ops.find((op) => op.method === "eq" && op.args[0] === "id")?.args[1]));

  it("reads both teams' last played games and never the target game", async () => {
    const result = await run();
    const checked = pbpGameIds(result.reads);
    expect(checked).toHaveLength(2);
    expect(checked).not.toContain(TARGET.gameId);
    // The fixture stores no plays, so both previous games are reported as incomplete, with their ids.
    expect(result.metrics.data_quality.missing_pbp_games).toBe(2);
    for (const gameId of checked) {
      expect(result.metrics.warnings.some((warning: string) => warning.startsWith(`previous game ${gameId} of team=`))).toBe(true);
    }
  });

  const previousGames = (world: World, before: string) => [HOME, AWAY].map((teamId) => world.tables.games
    .filter((game) => (game.homeTeamId === teamId || game.awayTeamId === teamId) && game.date < before)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))[0]);

  it("moves a previous game with complete stored PBP on to the shift-total check", async () => {
    let previous: number[] = [];
    const result = await run((world) => {
      const games = previousGames(world, TARGET.slateDate);
      previous = games.map((game) => game.id);
      for (const game of games) {
        (world.tables.pbp_games ??= []).push({ id: game.id, date: game.date, hometeamid: game.homeTeamId,
          awayteamid: game.awayTeamId, type: 2, season: String(TARGET.seasonId), hometeamabbrev: "TOR", awayteamabbrev: "BOS",
          hometeamscore: 3, awayteamscore: 2 });
        (world.tables.pbp_plays ??= []).push({ id: game.id * 10 + 1, gameid: game.id, typedesckey: "shot-on-goal" },
          { id: game.id * 10 + 2, gameid: game.id, typedesckey: "game-end" });
      }
    });
    expect(pbpGameIds(result.reads).sort()).toEqual([...previous].sort());
    expect(result.metrics.data_quality.missing_pbp_games).toBe(0);
    // The fixture has no shift charts for them: each previous game is counted once as missing shift totals.
    expect(result.metrics.data_quality.missing_shift_totals).toBe(2);
  });

  it("bounds the previous game by the information cutoff for a forward-dated run", async () => {
    // A 06:00 ET cutoff on 11-10 for the 11-14 slate: only games before 11-10 have been played.
    const cutoff = "2026-11-10T11:00:00.000Z";
    let expected: number[] = [];
    const { reads } = await runWriterScenario({ ...NORMAL, decisionAsOf: cutoff },
      (world) => { expected = previousGames(world, "2026-11-10").map((game) => game.id); });
    const checked = pbpGameIds(reads as Array<{ request: unknown }>);
    expect(checked.sort()).toEqual([...expected].sort());
    const lowerBounds = (reads as Array<{ request: unknown }>).map((read) => read.request as Op[])
      .filter((ops) => ops[0]?.args[0] === "games" && ops.some((op) => op.method === "or") && ops.some((op) => op.method === "lt"))
      .map((ops) => ops.find((op) => op.method === "lt")!.args[1]);
    expect(lowerBounds).toContain("2026-11-10");
  });
  /** Complete stored PBP and shift totals (six skaters a side) for each slate team's previous game. */
  const completePreviousGames = (world: World) => {
    for (const game of previousGames(world, TARGET.slateDate)) {
      (world.tables.pbp_games ??= []).push({ id: game.id, date: game.date, hometeamid: game.homeTeamId, awayteamid: game.awayTeamId,
        type: 2, season: String(TARGET.seasonId), hometeamabbrev: `T${game.homeTeamId}`, awayteamabbrev: `T${game.awayTeamId}`,
        hometeamscore: 3, awayteamscore: 2 });
      (world.tables.pbp_plays ??= []).push({ id: game.id * 10 + 1, gameid: game.id, typedesckey: "shot-on-goal" },
        { id: game.id * 10 + 2, gameid: game.id, typedesckey: "game-end" });
      for (const [side, teamId, opponentId] of [["home", game.homeTeamId, game.awayTeamId], ["away", game.awayTeamId, game.homeTeamId]] as const) {
        for (let index = 1; index <= 6; index += 1) {
          (world.tables.shift_charts ??= []).push({ id: game.id * 100 + (side === "home" ? 0 : 50) + index, game_id: game.id,
            player_id: 9_000_000 + teamId * 100 + index, team_id: teamId, opponent_team_id: opponentId, season_id: TARGET.seasonId,
            game_date: game.date, game_type: "2", home_or_away: side, team_abbreviation: `T${teamId}`,
            opponent_team_abbreviation: `T${opponentId}`, total_es_toi: "15:00", total_pp_toi: "1:30", total_pk_toi: "1:30" });
        }
      }
    }
  };

  it("counts nothing on a healthy slate, and the capture's strict transport accepts the previous-game reads", async () => {
    const healthy = await run(completePreviousGames);
    expect(healthy.metrics.data_quality).toMatchObject({ missing_pbp_games: 0, missing_shift_totals: 0 });

    const world = buildLeague({});
    completePreviousGames(world);
    activateWorld(world);
    const deadlineMs = Date.now() + 600_000;
    const transport = createCaptureTransport({
      target: { gameId: TARGET.gameId, slateDate: TARGET.slateDate, homeTeamId: TARGET.homeTeamId, awayTeamId: TARGET.awayTeamId,
        homeAbbrev: TARGET.homeAbbrev, awayAbbrev: TARGET.awayAbbrev },
      budget: { ...DEFAULT_TRANSPORT_BUDGET, deadlineMs }, restBaseUrl: "https://fixture.invalid/rest/v1",
      createClient: () => createWorldClient(world), now: () => Date.now(),
    });
    const { collectNativePregameInputs } = await import("./pregameCapture/nativeInputs");
    const collected = await captureProjectionInputs(() => collectNativePregameInputs({
      slateDate: TARGET.slateDate, gameId: TARGET.gameId, inputCutoff: NORMAL.decisionAsOf!, deadlineMs,
    }), { transport, deadlineMs });
    expect(transport.usage.refusals).toEqual([]);
    // Per team: one previous-game lookup, three PBP reads and one shift-chart page (10 per game; 3 before L1).
    const relationOf = (read: { request: unknown }) => String((read.request as Op[])[0]?.args[0]);
    const completenessReads = collected.reads.filter((read) => ["pbp_games", "pbp_plays", "shift_charts"].includes(relationOf(read)));
    expect(completenessReads.map(relationOf).sort()).toEqual(
      ["pbp_games", "pbp_games", "pbp_plays", "pbp_plays", "pbp_plays", "pbp_plays", "shift_charts", "shift_charts"]);
  });
});
