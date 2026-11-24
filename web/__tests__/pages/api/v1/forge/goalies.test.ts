import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { FORGE_EXTERNAL_FANTASY_INPUT_CONTRACT } from "lib/projections/calibrationEligibility";
import { provenSnapshotRow } from "lib/projections/externalInputProof.fixtures";
const { fromMock, latestMock, proofState } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  latestMock: vi.fn(),
  // Runs whose snapshot carries no exclusion claim; every other run's snapshot proves it.
  proofState: { unproven: new Set<string>() }
}));
const CAPTURED = { rolling_player_history_contract: null, external_fantasy_input_contract: "excluded_from_native_inputs_v1",
  basis: "captured_snapshot" };

// Latest-run selection is the shared proof-aware lookup (tested with it); explicit and fallback admission run for real.
vi.mock("lib/projections/externalInputProof", async () => ({
  ...await vi.importActual<any>("lib/projections/externalInputProof"),
  requireLatestExternalInputProvenRun: latestMock
}));

type QueryResult = {
  data?: any;
  count?: number;
  error: null;
};

function createQueryBuilder(resolver: () => QueryResult, onEq?: (column: string, value: unknown) => void,
  onNot?: (column: string, operator: string, value: unknown) => void) {
  const state = {
    isHeadCount: false
  };
  const builder: any = {
    select(_columns: string, options?: { head?: boolean }) {
      state.isHeadCount = Boolean(options?.head);
      return builder;
    },
    eq(column: string, value: unknown) {
      onEq?.(column, value);
      return builder;
    },
    lte() {
      return builder;
    },
    gt() {
      return builder;
    },
    in(column: string, values: string[]) {
      builder.inValues = values;
      return builder;
    },
    not(column: string, operator: string, value: unknown) {
      onNot?.(column, operator, value);
      return builder;
    },
    order() {
      return builder;
    },
    limit() {
      return builder;
    },
    maybeSingle() {
      const out = resolver();
      const data = Array.isArray(out.data) ? (out.data[0] ?? null) : out.data ?? null;
      return Promise.resolve({ data, error: out.error });
    },
    then(resolve: (value: any) => any) {
      const out = resolver();
      if (state.isHeadCount) {
        return Promise.resolve(resolve({ count: out.count ?? 0, error: out.error }));
      }
      return Promise.resolve(resolve({ data: out.data ?? [], error: out.error }));
    }
  };
  return builder;
}

vi.mock("lib/supabase/server", () => ({
  default: {
    from: fromMock
  }
}));

import handler from "../../../../../pages/api/v1/forge/goalies";
import { buildGoalieCandidatesContract } from "lib/projections/goalie/goalieCandidates";
import { goalieBoardsFromRows } from "lib/projections/goalie/gameGridReader";
import { resolveGoalieCell } from "components/GameGrid/utils/goalieGameView";

function snapshotBuilder() {
  const builder = createQueryBuilder(() => ({ error: null,
    data: (builder.inValues ?? []).filter((id: string) => !proofState.unproven.has(id)).map(provenSnapshotRow) }));
  return builder;
}

type RunRow = { run_id: string; as_of_date: string; status: string; git_sha: string | null; metrics?: Record<string, unknown> };
const fallbackGoalie = { goalie_id: 5555, team_id: 3, opponent_team_id: 4, players: { fullName: "Fallback Goalie" },
  teams: { name: "Team C", abbreviation: "TMC" }, opponent: { name: "Team D", abbreviation: "TMD" }, starter_probability: 0.64,
  proj_shots_against: 26.8, proj_saves: 24.4, proj_goals_allowed: 2.4, proj_win_prob: 0.57, proj_shutout_prob: 0.08, uncertainty: {} };

/** forge_runs and forge_goalie_projections tables that honour the filters the reader sends; returns the run ids whose
 * goalie rows were read (head counts excluded). */
function installRuns(runs: RunRow[], goalieRows: Record<string, any[]>, scheduledGames = 6, gamesAfterDate = scheduledGames) {
  const prior = fromMock.getMockImplementation()!;
  const rowReads: string[] = [];
  fromMock.mockImplementation((table: string) => {
    if (table === "forge_runs") {
      let rows = [...runs], byId: string | undefined;
      const builder = createQueryBuilder(
        () => ({ data: byId !== undefined ? rows.find(row => row.run_id === byId) ?? null : rows, error: null }),
        (column, value) => { if (column === "run_id") byId = String(value); else rows = rows.filter((row: any) => row[column] === value); },
        (column, operator, value) => {
          expect(column).toBe("git_sha");
          if (operator === "is" && value === null) rows = rows.filter(row => row.git_sha !== null);
          else if (operator === "like" && value === "local:*") rows = rows.filter(row => row.git_sha !== null && !row.git_sha.startsWith("local:"));
          else throw new Error(`unexpected filter ${operator} ${String(value)}`);
        });
      builder.lte = (column: string, value: string) => { rows = rows.filter((row: any) => row[column] <= value); return builder; };
      return builder;
    }
    if (table === "forge_goalie_projections") {
      let runIds: string[] = [], head = false;
      const builder = createQueryBuilder(() => {
        if (!head) rowReads.push(...runIds);
        const data = runIds.flatMap(runId => (goalieRows[runId] ?? []).map(row => ({ run_id: runId, ...row })));
        return { data, count: data.length, error: null };
      }, (column, value) => { if (column === "run_id") runIds = [String(value)]; });
      const select = builder.select;
      builder.select = (columns: string, options?: { head?: boolean }) => { head = Boolean(options?.head); return select(columns, options); };
      builder.in = (column: string, values: string[]) => { if (column === "run_id") runIds = values.map(String); return builder; };
      return builder;
    }
    if (table === "games") {
      let after = false;
      const builder = createQueryBuilder(() => ({ count: after ? gamesAfterDate : scheduledGames, error: null }));
      builder.gt = () => { after = true; return builder; };
      return builder;
    }
    return prior(table);
  });
  return rowReads;
}
const released = (run_id: string, as_of_date: string, overrides: Partial<RunRow> = {}): RunRow =>
  ({ run_id, as_of_date, status: "succeeded", git_sha: "a".repeat(40), metrics: { goalie_rows: 1 }, ...overrides });
const EXPLICIT = "11111111-1111-4111-8111-111111111111";

describe("Game Grid source integration", () => {
  const now = "2026-10-07T16:00:00Z";
  const game = { id: 103, seasonId: 20262027, date: "2026-10-07", startTime: "2026-10-07T23:00:00Z", homeTeamId: 6, awayTeamId: 8, type: 2 };
  const candidateContract = () => buildGoalieCandidatesContract({ gameId: game.id, teamId: 6, teamWinProbability: .72, teamWinSource: "fixture",
    issuance: { run_id: EXPLICIT, as_of_date: game.date, issued_at: "2026-10-07T15:00:00Z", information_cutoff_at: "2026-10-07T14:00:00Z", starter_labels: null },
    candidates: [10, 20, 30].map((goalieId, i) => ({ goalieId, startProbability: [.55, .25, .1][i], startProbabilityStatus: "uncalibrated_model", confirmationEvidenceIds: [],
      ifStarts: { shotsAgainst: 30, saves: 28, goalsAllowed: 2, shutoutProbability: .1, modeledSavePct: .92 }, creditedWinIfStarts: .61, unconditionalCreditedWin: .4 })) });
  const projection = () => ({ run_id: EXPLICIT, as_of_date: game.date, horizon_games: 1, game_id: game.id, team_id: 6, opponent_team_id: 8, goalie_id: 10,
    uncertainty: { goalie_candidates: candidateContract() } });
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(now); fromMock.mockReset(); });
  afterEach(() => vi.useRealTimers());

  function install(tables: Record<string, any[]>, coverageRowCap = Infinity) {
    const calls: { table: string; ops: unknown[][] }[] = [];
    fromMock.mockImplementation((table: string) => {
      if (!(table in tables)) throw new Error(`Unexpected source: ${table}`);
      let rows = [...tables[table]], limit = Infinity, coverageOnly = false, countRequested = false;
      const call = { table, ops: [] as unknown[][] }; calls.push(call);
      const chain: any = {};
      for (const method of ["select", "eq", "gte", "lte", "in", "not", "order", "or", "limit"]) chain[method] = (...args: any[]) => {
        call.ops.push([method, ...args]); const [column, value] = args;
        if (method === "select") { coverageOnly = column === "run_id,game_id"; countRequested = value?.count === "exact"; }
        if (method === "eq") rows = rows.filter(r => r[column] === value);
        if (method === "gte") rows = rows.filter(r => r[column] >= value);
        if (method === "lte") rows = rows.filter(r => r[column] <= value);
        if (method === "in") rows = rows.filter(r => value.includes(r[column]));
        if (method === "not") rows = rows.filter(r => value === "is" ? r[column] != null : !String(r[column]).startsWith("local:"));
        if (method === "limit") limit = column;
        if (method === "or" && column.startsWith("homeTeamId")) rows = rows.filter(r => r.homeTeamId === 6 || r.awayTeamId === 6);
        if (method === "or" && column.startsWith("and(run_id.eq.")) {
          const scopes = [...column.matchAll(/and\(run_id\.eq\.([^,]+),game_id\.in\.\(([\d,]+)\)\)/g)];
          rows = rows.filter(row => scopes.some((scope: RegExpMatchArray) => scope[1] === row.run_id && scope[2].split(",").map(Number).includes(row.game_id)));
        }
        return chain;
      };
      chain.range = (start: number, end: number) => Promise.resolve({ data: rows.slice(start, end + 1), count: rows.length, error: null });
      chain.then = (resolve: any) => Promise.resolve({ data: rows.slice(0, Math.min(limit, coverageOnly ? coverageRowCap : Infinity)),
        count: countRequested ? rows.length : null, error: null }).then(resolve);
      return chain;
    });
    return calls;
  }

  it("uses the stored selected goalie, retains all candidates, and withholds every unqualified percentage", () => {
    const row = projection(); row.goalie_id = 20; // Explicit selection, not inferred from rank 1.
    const boards = goalieBoardsFromRows([row], [game], new Map([[10, "One Goalie"], [20, "Two Goalie"], [30, "Three Goalie"]]), now);
    expect(boards[0].selectedPlayerId).toBe(20); expect(boards[0].candidates).toHaveLength(3);
    const view = resolveGoalieCell({ id: game.id, season: game.seasonId, gameDate: game.date, gameType: 2,
      startTimeUTC: game.startTime, homeTeam: { id: 6 }, awayTeam: { id: 8 }, gameState: "FUT", gameScheduleState: "OK" }, 6,
    { version: "goalie-grid-v1", contextKey: "scope", boards }, "scope", now);
    expect(view.candidate?.name).toBe("Two Goalie"); expect(view.start.value).toBeNull(); expect(view.win.value).toBeNull();
    expect(view.candidate?.source.observedAt).toBeNull(); expect(view.candidateCoverage).toBe("unknown");
    expect(view.unresolvedStartMass).toBeNull();
  });
  it("rejects legacy slots, duplicate selections, mismatched identities and post-cutoff issuance", () => {
    const names = new Map([[10, "One Goalie"]]);
    expect(goalieBoardsFromRows([{ ...projection(), uncertainty: {} }], [game], names, now)).toEqual([]);
    expect(goalieBoardsFromRows([projection(), projection()], [game], names, now)).toEqual([]);
    expect(goalieBoardsFromRows([{ ...projection(), opponent_team_id: 9 }], [game], names, now)).toEqual([]);
    const row = projection(); row.uncertainty.goalie_candidates.issuance.issued_at = "2026-10-07T17:00:00Z";
    expect(goalieBoardsFromRows([row], [game], names, now)).toEqual([]);
    row.uncertainty.goalie_candidates.issuance.issued_at = "2026-10-07T15:00:00Z";
    row.uncertainty.goalie_candidates.rows[1].start_probability_status = "confirmed_evidence";
    row.uncertainty.goalie_candidates.rows[1].confirmation_evidence_ids = ["confirmation"];
    expect(goalieBoardsFromRows([row], [game], names, now)[0].selectedPlayerId).toBeNull();
  });
  it("rejects post-cutoff and future issuance even within the same millisecond", () => {
    const row = projection(), names = new Map([[10, "One Goalie"]]);
    row.uncertainty.goalie_candidates.issuance.information_cutoff_at = "2026-10-07T15:00:00.000001Z";
    expect(goalieBoardsFromRows([row], [game], names, now)).toEqual([]);
    row.uncertainty.goalie_candidates.issuance.information_cutoff_at = "2026-10-07T14:00:00Z";
    row.uncertainty.goalie_candidates.issuance.issued_at = "2026-10-07T16:00:00.000001Z";
    expect(goalieBoardsFromRows([row], [game], names, now)).toEqual([]);
    expect(goalieBoardsFromRows([projection()], [game], names, "invalid")).toEqual([]);
  });
  it("retains exact scheduled-start precision through the source-to-cell path", () => {
    const row = projection(), scheduled = { ...game, startTime: "2026-10-07T23:00:00.000002Z" };
    row.uncertainty.goalie_candidates.issuance.issued_at = "2026-10-07T23:00:00.000001Z";
    const observed = "2026-10-07T23:00:00.000001Z";
    const boards = goalieBoardsFromRows([row], [scheduled], new Map([[10, "One Goalie"]]), observed);
    expect(boards).toHaveLength(1);
    expect(boards[0].startsAt).toBe(scheduled.startTime);
    expect(boards[0].candidates[0].source.expiresAt).toBe(scheduled.startTime);
    const view = resolveGoalieCell({ id: scheduled.id, season: scheduled.seasonId, gameDate: scheduled.date, gameType: 2,
      startTimeUTC: scheduled.startTime, homeTeam: { id: 6 }, awayTeam: { id: 8 }, gameState: "FUT", gameScheduleState: "OK" }, 6,
    { version: "goalie-grid-v1", contextKey: "scope", boards }, "scope", observed);
    expect(view.candidate?.name).toBe("One Goalie");
    expect(view.win.value).toBeNull(); expect(view.start.value).toBeNull();
  });
  it("serves bounded admitted candidate identities through the public read mode without legacy fallbacks", async () => {
    const calls = install({ games: [game], forge_runs: [{ run_id: EXPLICIT, as_of_date: game.date, status: "succeeded", git_sha: "a".repeat(40), created_at: "2026-10-07T14:00:00Z" }],
      player_forecast_source_observations: [provenSnapshotRow(EXPLICIT)], forge_goalie_projections: [projection()], players: [{ id: 10, fullName: "One Goalie" }] });
    const res = createMockRes();
    await handler({ method: "GET", query: { view: "game-grid", from: game.date, through: game.date } } as any, res);
    expect(res.statusCode).toBe(200); expect(res.body.boards[0].candidates[0]).toMatchObject({ playerId: 10, start: null, winIfStarting: null });
    expect(calls.find(c => c.table === "forge_runs")!.ops).toContainEqual(["limit", 30]);
    expect(calls.find(c => c.table === "forge_goalie_projections")!.ops).toContainEqual(["eq", "horizon_games", 1]);
    expect(calls.some(c => c.table === "forge_projection_calibration_daily")).toBe(false);
  });
  it("returns an empty board when no released run exists and rejects oversized or historical ranges before reads", async () => {
    install({ games: [game], forge_runs: [] });
    const res = createMockRes();
    await handler({ method: "GET", query: { view: "game-grid", from: game.date, through: game.date } } as any, res);
    expect(res.body.boards).toEqual([]);
    fromMock.mockClear();
    await handler({ method: "GET", query: { view: "game-grid", from: "2026-10-01", through: "2026-10-15" } } as any, res);
    expect(res.statusCode).toBe(400); expect(fromMock).not.toHaveBeenCalled();
    const past = createMockRes();
    await handler({ method: "GET", query: { view: "game-grid", from: "2026-10-01", through: "2026-10-02" } } as any, past);
    expect(past.body.boards).toEqual([]); expect(fromMock).not.toHaveBeenCalled();
    await handler({ method: "GET", query: { view: "game-grid", from: "2026-02-30", through: "2026-02-30" } } as any, res);
    expect(res.statusCode).toBe(400); expect(fromMock).not.toHaveBeenCalled();
  });
  it.each(["valid", "legacy", "post-cutoff", "unproven", "wrong-date", "local"])("keeps another game's proven slate row when a newer H1 run covers only one game (%s)", async scenario => {
    const olderRun = "22222222-2222-4222-8222-222222222222";
    const second = { ...game, id: 104, homeTeamId: 10, awayTeamId: 12 };
    const oldRow = (selectedGame = game) => {
      const contract = candidateContract();
      contract.game_id = selectedGame.id; contract.team_id = selectedGame.homeTeamId;
      contract.issuance.run_id = olderRun;
      return { ...projection(), run_id: olderRun, game_id: selectedGame.id, team_id: selectedGame.homeTeamId,
        opponent_team_id: selectedGame.awayTeamId, uncertainty: { goalie_candidates: contract } };
    };
    const newest = { ...projection(), goalie_id: 20 };
    if (scenario === "legacy") Object.assign(newest, { uncertainty: {} });
    if (scenario === "post-cutoff") newest.uncertainty.goalie_candidates.issuance.issued_at = "2026-10-07T17:00:00Z";
    const oldAway = oldRow(); oldAway.team_id = 8; oldAway.opponent_team_id = 6; oldAway.goalie_id = 30;
    oldAway.uncertainty.goalie_candidates.team_id = 8;
    const calls = install({ games: [game, second], forge_runs: [
      { run_id: EXPLICIT, as_of_date: scenario === "wrong-date" ? "2026-10-08" : game.date, status: "succeeded", git_sha: scenario === "local" ? "local:fixture" : "a".repeat(40), created_at: "2026-10-07T15:00:00Z" },
      { run_id: olderRun, as_of_date: game.date, status: "succeeded", git_sha: "b".repeat(40), created_at: "2026-10-07T14:00:00Z" },
    ], player_forecast_source_observations: [provenSnapshotRow(olderRun), ...(scenario === "unproven" ? [] : [provenSnapshotRow(EXPLICIT)])],
      forge_goalie_projections: [newest, oldRow(), oldAway, oldRow(second)], players: [{ id: 10, fullName: "Old Goalie" }, { id: 20, fullName: "New Goalie" }, { id: 30, fullName: "Other Goalie" }] });
    const res = createMockRes();
    await handler({ method: "GET", query: { view: "game-grid", from: game.date, through: "2026-10-08" } } as any, res);
    expect(res.statusCode).toBe(200);
    const expected = scenario === "valid" ? [[103, 6, 20], [104, 10, 10]]
      : ["legacy", "post-cutoff"].includes(scenario) ? [[104, 10, 10]] : [[103, 6, 10], [103, 8, 30], [104, 10, 10]];
    expect(res.body.boards.map((board: any) => [board.gameId, board.teamId, board.selectedPlayerId])).toEqual(expected);
    expect(res.body.boards.every((board: any) => board.candidates.every((candidate: any) => candidate.start === null && candidate.winIfStarting === null))).toBe(true);
    expect(res.body.boards.every((board: any) => board.candidates.every((candidate: any) => candidate.source.artifactId === (scenario === "valid" && board.gameId === 103 ? EXPLICIT : olderRun)))).toBe(true);
    const projectionReads = calls.filter(call => call.table === "forge_goalie_projections");
    expect(projectionReads).toHaveLength(2);
    expect(projectionReads[0].ops).toContainEqual(["select", "run_id,game_id", { count: "exact" }]);
    expect(projectionReads[0].ops).toContainEqual(["limit", ["unproven", "local"].includes(scenario) ? 5 : 9]);
    expect(projectionReads[1].ops).toContainEqual(["limit", 321]);
    if (scenario === "valid") expect(projectionReads[1].ops).toContainEqual(["or", `and(run_id.eq.${EXPLICIT},game_id.in.(103)),and(run_id.eq.${olderRun},game_id.in.(104))`]);
  });
  it("rejects oversized run coverage before reading any candidate payload", async () => {
    const calls = install({ games: [game], forge_runs: [{ run_id: EXPLICIT, as_of_date: game.date, status: "succeeded", git_sha: "a".repeat(40), created_at: "2026-10-07T15:00:00Z" }],
      player_forecast_source_observations: [provenSnapshotRow(EXPLICIT)], forge_goalie_projections: [projection(), projection(), projection()] });
    const res = createMockRes();
    await handler({ method: "GET", query: { view: "game-grid", from: game.date, through: game.date } } as any, res);
    expect(res.statusCode).toBe(500);
    const reads = calls.filter(call => call.table === "forge_goalie_projections");
    expect(reads).toHaveLength(1); expect(reads[0].ops).toContainEqual(["select", "run_id,game_id", { count: "exact" }]);
  });
  it("rejects server-truncated coverage instead of treating omitted games as absent", async () => {
    const calls = install({ games: [game], forge_runs: [{ run_id: EXPLICIT, as_of_date: game.date, status: "succeeded", git_sha: "a".repeat(40), created_at: "2026-10-07T15:00:00Z" }],
      player_forecast_source_observations: [provenSnapshotRow(EXPLICIT)], forge_goalie_projections: [projection()] }, 0);
    const res = createMockRes();
    await handler({ method: "GET", query: { view: "game-grid", from: game.date, through: game.date } } as any, res);
    expect(res.statusCode).toBe(500);
    expect(calls.filter(call => call.table === "forge_goalie_projections")).toHaveLength(1);
  });
  it("does not read projection rows from an unproven run", async () => {
    const calls = install({ games: [game], forge_runs: [{ run_id: EXPLICIT, as_of_date: game.date, status: "succeeded", git_sha: "a".repeat(40), created_at: "2026-10-07T14:00:00Z" }],
      player_forecast_source_observations: [] });
    const res = createMockRes();
    await handler({ method: "GET", query: { view: "game-grid", from: game.date, through: game.date } } as any, res);
    expect(res.body.boards).toEqual([]); expect(calls.some(c => c.table === "forge_goalie_projections")).toBe(false);
  });
  it("does not turn a missing season schedule into a known zero workload", async () => {
    install({ games: [] });
    const res = createMockRes();
    await handler({ method: "GET", query: { view: "game-grid-workload", season: "20262027", teamId: "6", through: "2026-10-07" } } as any, res);
    expect(res.statusCode).toBe(200); expect(res.body.games).toEqual([]); expect(res.body.scheduleComplete).toBe(false);
  });
  it("reuses exactly-one-game-end finality and official labels, preserving missing history as incomplete", async () => {
    const historyGames = [101, 102, 103].map(id => ({ ...game, id, date: "2026-10-06", startTime: "2026-10-06T23:00:00Z" }));
    const goalie = { goalie_id: 10, goalie_name: "One Goalie", season_id: 20262027, team_abbreviation: "BOS", date: "2026-10-06",
      game_id: 101, games_played: 1, games_started: 1, opponent_team_abbrev: "MTL", home_road: "H", wins: 0, losses: null, ot_losses: null,
      saves: 2, shots_against: 3, goals_against: 1, time_on_ice: 180, shutouts: 0, quality_start: null };
    const calls = install({ games: historyGames, pbp_plays: [{ gameid: 101, id: 1 }, { gameid: 103, id: 2 }, { gameid: 103, id: 3 }].map(row => ({ ...row, typedesckey: "game-end" })),
      wgo_team_stats: historyGames.map(g => ({ season_id: g.seasonId, date: g.date, game_id: g.id, team_id: 6, opponent_id: 8 })),
      wgo_goalie_stats: [goalie, { ...goalie, goalie_id: 20, games_started: 0, time_on_ice: 3400, wins: 1 }] });
    const res = createMockRes();
    await handler({ method: "GET", query: { view: "game-grid-workload", season: "20262027", teamId: "6", through: "2026-10-07" } } as any, res);
    expect(res.statusCode).toBe(200); expect(res.body.games.map((g: any) => g.gameId)).toEqual([101]);
    expect(res.body.games[0]).toMatchObject({ completedAt: null, finality: { basis: "single_stored_game_end" } });
    expect(res.body.scheduleComplete).toBe(false);
    expect(res.body.scheduleCoverage).toEqual({ version: "stored-team-schedule-v1", from: "2026-07-01", through: "2026-10-07",
      scheduledGames: 3, gaps: [{ gameId: 102, date: "2026-10-06", reason: "not_final" }, { gameId: 103, date: "2026-10-06", reason: "not_final" }] });
    expect(res.body.appearances.map((g: any) => g.started)).toEqual([true, false]);
    expect(calls.find(c => c.table === "games")!.ops).toContainEqual(["or", "homeTeamId.eq.6,awayTeamId.eq.6"]);
    expect(calls.find(c => c.table === "pbp_plays")!.ops).toContainEqual(["eq", "typedesckey", "game-end"]);
  });
});

function createMockRes() {
  const res: any = {
    statusCode: 200,
    headers: {} as Record<string, string | string[]>,
    body: null as any,
    setHeader(key: string, value: string | string[]) {
      this.headers[key] = value;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    }
  };
  return res;
}

describe("/api/v1/forge/goalies", () => {
  describe("external-input exclusion proof (Astra F4)", () => {
    it.each([[true], [false]])("never serves a neighboring date's run, proven or not (H6; fallbackToLatestWithData %s)", async fallback => {
      latestMock.mockRejectedValueOnce(Object.assign(new Error("no proven run"), { statusCode: 404 }));
      proofState.unproven = new Set(["legacy-run"]);
      const reads = installRuns([released("legacy-run", "2026-02-06"), released("run-121", "2026-02-05"),
        released("run-tomorrow", "2026-02-08"), released("run-local", "2026-02-06", { git_sha: "local:unknown" }),
        released("run-failed", "2026-02-06", { status: "failed" })],
      { "legacy-run": [fallbackGoalie], "run-121": [fallbackGoalie], "run-tomorrow": [fallbackGoalie], "run-local": [fallbackGoalie],
        "run-failed": [fallbackGoalie] });
      const res = createMockRes();
      await handler({ method: "GET", query: { date: "2026-02-07", fallbackToLatestWithData: String(fallback) } } as any, res);
      expect(res.statusCode).toBe(200);
      expect(res.body).toMatchObject({ runId: null, asOfDate: "2026-02-07", requestedDate: "2026-02-07", fallbackApplied: false,
        reason: "no_proven_run_for_date", message: "FORGE goalie projections are not available for the 2026-02-07 slate.", data: [],
        serving: { resolvedDate: "2026-02-07", strategy: "requested_date" }, scanSummary: { status: "empty", blockingIssueCount: 1 },
        diagnostics: { runProof: null, fallback: { enabled: false, applied: false },
          emptyResultAnalysis: { isEmpty: true, reason: "no_proven_run_for_date", verifiedScheduledGames: 6 } } });
      expect(reads).toEqual([]);
    });

    it("keeps a proven goalie run with no rows on its scheduled date (H6)", async () => {
      const date = "2026-02-07";
      latestMock.mockResolvedValueOnce({ runId: "run-123", proof: CAPTURED });
      const reads = installRuns(
        [
          released("run-123", date, { metrics: { goalie_rows: 0 } }),
          released("run-122", "2026-02-06"),
          released("run-124", "2026-02-08"),
        ],
        { "run-122": [fallbackGoalie], "run-124": [fallbackGoalie] },
        6,
        40,
      );
      const res = createMockRes();
      await handler({ method: "GET", query: { date, fallbackToLatestWithData: "true" } } as any, res);

      expect(res.statusCode).toBe(200);
      expect(res.body).toMatchObject({
        runId: "run-123", asOfDate: date, requestedDate: date, fallbackApplied: false,
        reason: "proven_run_has_no_rows", data: [],
        serving: { resolvedDate: date, strategy: "requested_date" },
        scanSummary: { status: "empty", blockingIssueCount: 1 },
        diagnostics: { fallback: { enabled: false, applied: false },
          runProof: { runId: "run-123", basis: "captured_snapshot" },
          emptyResultAnalysis: { isEmpty: true, reason: "proven_run_has_no_rows", verifiedScheduledGames: 6 } },
      });
      expect(latestMock.mock.calls).toEqual([[date]]);
      expect(fromMock.mock.calls.filter(([table]) => table === "forge_runs")).toHaveLength(1);
      expect(reads).toEqual(["run-123"]);
    });

    it.each([
      ["a verified off-day", 0, 40, "no_games", "No NHL games are scheduled on 2026-02-07."],
      ["a date whose schedule is not stored", 0, 0, "no_proven_run_for_date", "FORGE goalie projections are not available for the 2026-02-07 slate."],
    ])("serves %s empty with its reason", async (_label, onDate, afterDate, reason, message) => {
      latestMock.mockRejectedValueOnce(Object.assign(new Error("no proven run"), { statusCode: 404 }));
      const reads = installRuns([released("run-122", "2026-02-06")], { "run-122": [fallbackGoalie] }, onDate, afterDate);
      const res = createMockRes();
      await handler({ method: "GET", query: { date: "2026-02-07" } } as any, res);
      expect(res.statusCode).toBe(200);
      expect(res.body).toMatchObject({ runId: null, reason, message, data: [], scanSummary: { status: "empty", blockingIssueCount: 0 } });
      expect(reads).toEqual([]);
    });

    it.each([
      ["an unproven run", released(EXPLICIT, "2026-02-07"), true, "lacks external fantasy exclusion provenance"],
      ["a failed run", released(EXPLICIT, "2026-02-07", { status: "failed" }), false, "not a succeeded released run"],
      ["a running run", released(EXPLICIT, "2026-02-07", { status: "running" }), false, "not a succeeded released run"],
    ])("refuses an explicit request for %s before reading its rows", async (_label, run, unproven, message) => {
      if (unproven) proofState.unproven = new Set([EXPLICIT]);
      const reads = installRuns([run], { [EXPLICIT]: [fallbackGoalie] });
      const res = createMockRes();
      await handler({ method: "GET", query: { date: "2026-02-07", runId: EXPLICIT } } as any, res);
      expect(res.statusCode).toBe(422);
      expect(res.body.error).toContain(message);
      expect(reads).toEqual([]);
    });

    it("serves an explicit proven succeeded release", async () => {
      const reads = installRuns([released(EXPLICIT, "2026-02-07")], { [EXPLICIT]: [fallbackGoalie] });
      const res = createMockRes();
      await handler({ method: "GET", query: { date: "2026-02-07", runId: EXPLICIT } } as any, res);
      expect(res.statusCode).toBe(200);
      expect(res.body.runId).toBe(EXPLICIT);
      expect(res.body.diagnostics.runProof).toMatchObject({ runId: EXPLICIT, basis: "captured_snapshot" });
      expect(reads).toEqual([EXPLICIT]);
    });

    it("keeps a missing starter chance or line unknown (null), never a projected zero", async () => {
      const blank = { ...fallbackGoalie, starter_probability: null, proj_shots_against: null, proj_saves: null,
        proj_goals_allowed: null, proj_win_prob: null, proj_shutout_prob: null };
      installRuns([released(EXPLICIT, "2026-02-07")], { [EXPLICIT]: [blank] });
      const res = createMockRes();
      await handler({ method: "GET", query: { date: "2026-02-07", runId: EXPLICIT } } as any, res);
      expect(res.body.data[0]).toMatchObject({ starter_probability: null, proj_shots_against: null, proj_saves: null,
        proj_goals_allowed: null, proj_win_prob: null, proj_shutout_prob: null });
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
    proofState.unproven = new Set();
    latestMock.mockResolvedValue({ runId: "run-123", proof: CAPTURED });
    fromMock.mockImplementation((table: string) => {
      if (table === "player_forecast_source_observations") return snapshotBuilder();
      if (table === "forge_goalie_projections") {
        return createQueryBuilder(() => ({
          data: [
            {
              goalie_id: 8474593,
              team_id: 1,
              opponent_team_id: 2,
              players: { fullName: "Jacob Markstrom" },
              teams: { name: "Devils", abbreviation: "NJD" },
              opponent: { name: "Islanders", abbreviation: "NYI" },
              starter_probability: 0.61,
              proj_shots_against: 27.2,
              proj_saves: 24.1,
              proj_goals_allowed: 3.1,
              proj_win_prob: 0.53,
              proj_shutout_prob: 0.05,
              uncertainty: {
                model: {
                  save_pct: 0.892,
                  volatility_index: 1.18,
                  blowup_risk: 0.22,
                  confidence_tier: "MEDIUM",
                  quality_tier: "ABOVE_AVERAGE",
                  reliability_tier: "MODERATE",
                  recommendation: "START",
                  scenario_metadata: {
                    model_version: "starter-scenario-v1",
                    top2_scenario_count: 2
                  },
                  starter_selection: {
                    scenario_projection_count: 2
                  }
                }
              }
            }
          ],
          error: null
        }));
      }
      if (table === "forge_runs") {
        return createQueryBuilder(() => ({
          data: {
            run_id: "run-123",
            as_of_date: "2026-02-07",
            status: "succeeded",
            git_sha: "a".repeat(40),
            created_at: "2026-02-07T10:05:00.000Z",
            metrics: {
              goalie_rows: 32,
              input_provenance: { external_fantasy_input_contract: FORGE_EXTERNAL_FANTASY_INPUT_CONTRACT }
            }
          },
          error: null
        }));
      }
      if (table === "games") {
        return createQueryBuilder(() => ({
          count: 8,
          error: null
        }));
      }
      if (table === "forge_projection_calibration_daily") {
        return createQueryBuilder(() => ({
          data: {
            date: "2026-02-06",
            projection_date: "2026-02-07",
            metrics: {
              probability: {
                starter_probability: { brier_score: 0.19 },
                win_probability: { brier_score: 0.21 },
                shutout_probability: { brier_score: 0.07 }
              },
              intervals: {
                saves: { p10_p90_hit_rate: 0.79 },
                goals_allowed: { p10_p90_hit_rate: 0.75 }
              },
              stats: {
                saves: { rolling_30d: { player_count: 142, mae: 3.88 } },
                goals_against: { rolling_30d: { mae: 1.22 } }
              }
            }
          },
          error: null
        }));
      }
      return createQueryBuilder(() => ({ data: [], error: null }));
    });
  });

  it("returns stable response shape with model/scenario/calibration metadata", async () => {
    const req: any = {
      method: "GET",
      query: {
        date: "2026-02-07",
        horizon: "1"
      }
    };
    const res = createMockRes();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      runId: "run-123",
      asOfDate: "2026-02-07",
      requestedDate: "2026-02-07",
      fallbackApplied: false,
      scanSummary: {
        surface: "forge_goalies_reader",
        requestedDate: "2026-02-07",
        activeDataDate: "2026-02-07",
        fallbackApplied: false,
        status: "ready",
        rowCounts: {
          returned: 1,
          requested: 1,
          scheduledGamesOnDate: 8
        },
        blockingIssueCount: 0
      },
      compatibilityInventory: {
        inventoryVersion: "forge-compatibility-inventory-v2",
        canonicalRoute: "/api/v1/forge/goalies",
        legacyRoute: "/api/v1/projections/goalies",
        status: "canonical_preferred",
        goalieStartTable: {
          decisionVersion: "goalie-start-ownership-v1",
          table: "goalie_start_projections",
          decision: "retain_shared_table_name_for_now",
          canonicalWriterRoute: "/api/v1/db/update-goalie-projections-v2",
          canonicalWriterStatus: "single_writer",
          renameDeferred: true
        }
      },
      serving: {
        requestedDate: "2026-02-07",
        resolvedDate: "2026-02-07",
        fallbackApplied: false,
        isSameDay: true,
        state: "same_day",
        strategy: "requested_date",
        gapDays: 0,
        severity: "none",
        status: "requested_date",
        message: null
      },
      modelVersion: "starter-scenario-v1",
      scenarioCount: 2,
      calibrationHints: {
        starterBrier: 0.19,
        winBrier: 0.21,
        shutoutBrier: 0.07
      },
      diagnostics: {
        requested: expect.any(Object),
        resolved: expect.any(Object),
        fallback: expect.any(Object),
        emptyResultAnalysis: expect.any(Object),
        notes: expect.any(Array)
      }
    });
    expect(res.body.data[0]).toMatchObject({
      goalie_id: 8474593,
      goalie_name: "Jacob Markstrom",
      starter_probability: 0.61
    });

    expect(res.body).toMatchSnapshot();
  });

  function installGoalieRows(rows: any[], players: Array<{ id: number; fullName: string }> = []) {
    fromMock.mockImplementation((table: string) => {
      if (table === "forge_goalie_projections") return createQueryBuilder(() => ({ data: rows, error: null }));
      if (table === "players") return createQueryBuilder(() => ({ data: players, error: null }));
      if (table === "forge_runs") {
        return createQueryBuilder(() => ({ data: { run_id: "run-123", as_of_date: "2026-02-07", status: "succeeded",
          created_at: "2026-02-07T10:05:00.000Z", metrics: { goalie_rows: rows.length,
            input_provenance: { external_fantasy_input_contract: FORGE_EXTERNAL_FANTASY_INPUT_CONTRACT } } }, error: null }));
      }
      if (table === "games") return createQueryBuilder(() => ({ count: 1, error: null }));
      if (table === "forge_projection_calibration_daily") return createQueryBuilder(() => ({ data: null, error: null }));
      return createQueryBuilder(() => ({ data: [], error: null }));
    });
  }
  const slotRow = (id: number, team: number, opponent: number, uncertainty: Record<string, unknown> = {}) => ({
    goalie_id: id, team_id: team, opponent_team_id: opponent, players: { fullName: `Goalie ${id}` },
    teams: { name: `Team ${team}`, abbreviation: `T${team}` }, opponent: { name: `Team ${opponent}`, abbreviation: `T${opponent}` },
    // The stored team slot: a start-weighted mixture with the slot's credited win (0.384), not goalie 1001's own Win.
    starter_probability: 0.62, proj_shots_against: 28, proj_saves: 25.2, proj_goals_allowed: 2.8,
    proj_win_prob: 0.384, proj_shutout_prob: 0.04, uncertainty });
  const contract = (team: number, teamWin: number) => buildGoalieCandidatesContract({
    gameId: 2025020500, teamId: team, teamWinProbability: teamWin, teamWinSource: "poisson_race",
    issuance: { run_id: "run-123", as_of_date: "2026-02-07", issued_at: "2026-02-07T10:00:00.000Z", information_cutoff_at: null, starter_labels: null },
    candidates: [
      { goalieId: team * 1000 + 1, startProbability: 0.62, startProbabilityStatus: "uncalibrated_model", confirmationEvidenceIds: [],
        ifStarts: { shotsAgainst: 28, saves: 25.6, goalsAllowed: 2.4, shutoutProbability: 0.06, modeledSavePct: 0.914 },
        creditedWinIfStarts: 0.42, unconditionalCreditedWin: 0.27 },
      { goalieId: team * 1000 + 2, startProbability: 0.38, startProbabilityStatus: "uncalibrated_model", confirmationEvidenceIds: [],
        ifStarts: { shotsAgainst: 28, saves: 24.6, goalsAllowed: 3.4, shutoutProbability: 0.03, modeledSavePct: 0.879 },
        creditedWinIfStarts: 0.33, unconditionalCreditedWin: 0.13 },
    ] });

  it("serves one row per candidate with his own line, start chance, unconditional product and a separate team win (P0 #20)", async () => {
    installGoalieRows([
      slotRow(1001, 1, 2, { goalie_candidates: contract(1, 0.45) }),
      slotRow(2001, 2, 1, { goalie_candidates: contract(2, 0.55) }),
    ], [{ id: 1002, fullName: "Backup A" }, { id: 2002, fullName: "Backup B" }]);
    const res = createMockRes();
    await handler({ method: "GET", query: { date: "2026-02-07", horizon: "1" } } as any, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.map((row: any) => row.goalie_id)).toEqual([1001, 1002, 2001, 2002]);
    const backup = res.body.data.find((row: any) => row.goalie_id === 1002);
    expect(backup).toMatchObject({ goalie_name: "Backup A", row_basis: "candidate_goalie_game", conditioning: "if_starts",
      starter_probability: 0.38, proj_saves: 24.6, proj_goals_allowed: 3.4, proj_win_prob: 0.33, team_win_prob: 0.45,
      is_projected_starter: false, unconditional: { saves: 9.348, credited_win_prob: 0.13 },
      relief_basis: { counts: "zero_relief_assumption" } });
    // No slot rescale: each goalie's own Win is served as computed, and the opposing team wins stay paired.
    expect(res.body.data.find((row: any) => row.goalie_id === 1001).proj_win_prob).toBe(0.42);
    expect(res.body.data.find((row: any) => row.goalie_id === 2001).proj_win_prob).toBe(0.42);
    expect(res.body.data.find((row: any) => row.goalie_id === 1001).team_win_prob
      + res.body.data.find((row: any) => row.goalie_id === 2001).team_win_prob).toBeCloseTo(1, 6);
  });

  it("serves a pre-contract row as the labelled team slot and withholds its slot win", async () => {
    installGoalieRows([
      slotRow(1001, 1, 2, { win_populations: { team: { win_probability: 0.47 } } }),
      { ...slotRow(1002, 2, 1), proj_win_prob: null },
    ]);
    const res = createMockRes();
    await handler({ method: "GET", query: { date: "2026-02-07", horizon: "1" } } as any, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.map((row: any) => row.proj_win_prob)).toEqual([null, null]);
    expect(res.body.data.map((row: any) => row.team_win_prob)).toEqual([0.47, null]);
    expect(res.body.data.every((row: any) => row.row_basis === "team_goalie_slot_legacy")).toBe(true);
    expect(res.body.diagnostics.notes.join(" ")).toContain("predate per-candidate goalie rows");
  });

  it("serves each game from its newest proven run: a single-game rerun only for its own game (H3)", async () => {
    const game = (gameId: number, goalieId: number, name: string) => ({ ...fallbackGoalie, game_id: gameId, goalie_id: goalieId,
      players: { fullName: name } });
    latestMock.mockResolvedValueOnce({ runId: "slate-run", proof: CAPTURED, runsByGame: { baseRunId: "slate-run",
      overlays: [{ runId: "rerun", proof: CAPTURED, gameIds: [2026020302] }] } });
    const reads = installRuns([released("slate-run", "2026-02-07"), released("rerun", "2026-02-07")], {
      "slate-run": [game(2026020301, 1, "Slate A"), game(2026020302, 2, "Slate B (superseded)"), game(2026020303, 3, "Slate C")],
      rerun: [game(2026020302, 4, "Rerun B")],
    });
    const res = createMockRes();
    await handler({ method: "GET", query: { date: "2026-02-07" } } as any, res);
    expect(res.statusCode).toBe(200);
    expect(reads).toEqual(["slate-run", "rerun"]);
    expect(res.body.data.map((row: any) => row.goalie_name)).toEqual(["Slate A", "Slate C", "Rerun B"]);
    expect(res.body).toMatchObject({ runId: "slate-run", reason: null,
      diagnostics: { gameRuns: [{ runId: "rerun", gameIds: [2026020302], basis: "captured_snapshot" }] } });
  });

  it("defaults the date to the Eastern-time slate, not the UTC date (L3)", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-17T03:30:00Z"));
    try {
      const res = createMockRes();
      await handler({ method: "GET", query: {} } as any, res);
      expect(latestMock).toHaveBeenCalledWith("2026-11-16");
      expect(res.body.requestedDate).toBe("2026-11-16");
    } finally {
      vi.useRealTimers();
    }
  });

  it.each([null, "local:unknown", `local:${"b".repeat(40)}`])("rejects an explicit off-release run %j with a clear 422", async gitSha => {
    const prior = fromMock.getMockImplementation()!;
    fromMock.mockImplementation((table: string) => table === "forge_runs"
      ? createQueryBuilder(() => ({ data: { run_id: "11111111-1111-4111-8111-111111111111", as_of_date: "2026-02-07",
        status: "succeeded", git_sha: gitSha, metrics: { goalie_rows: 32,
          input_provenance: { external_fantasy_input_contract: FORGE_EXTERNAL_FANTASY_INPUT_CONTRACT } } }, error: null }))
      : prior(table));
    const res = createMockRes();
    await handler({ method: "GET", query: { date: "2026-02-07", runId: "11111111-1111-4111-8111-111111111111" } } as any, res);
    expect(res.statusCode).toBe(422);
    expect(res.body.data).toBeUndefined();
    expect(res.body.error).toContain("not a succeeded released run");
  });
});
