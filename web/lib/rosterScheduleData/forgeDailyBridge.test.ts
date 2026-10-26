import { describe, expect, it, vi } from "vitest";
import { forecastCalendarPolicy } from "lib/player-forecasts/contributions";
import { candidateHorizonPoints, gameForecastPoints } from "lib/rosterScheduleOptimizer/planning";
import { withCurrentPlanningRead } from "lib/rosterScheduleOptimizer/currentPlanningRead";
import { currentRsoUsePolicy } from "lib/player-forecasts/rsoUsePolicy";
import type { PlanningData, PlanningGame, PlanningPlayer, PlanningSnapshot } from "lib/rosterScheduleOptimizer/planningTypes";
import { runHorizonFilter } from "lib/projections/releasedRunFence";
import { STARTER_DECISION_SHARE, teamWinProbability } from "lib/projections/goalie/goalieOutcomes";
import { buildForgeDailyBridgeForecasts, FORGE_DAILY_BRIDGE_SEASON_RATED, FORGE_DAILY_BRIDGE_VERSION, loadForgeDailyBridgeForecasts, opponentTilts, teamStrengthPriors, teamWinProbability as ledgerTeamWin, type ForgeDailyBridgeInputs } from "./forgeDailyBridge";
import { compactBridgeForecasts, expandBridgeForecasts, fitBridgeWire, packPlanningSnapshots, unpackPlanningSnapshots, type BridgeForecastWire } from "./bridgeForecastWire";
import { preservationJson } from "lib/rosterScheduleOptimizer/workspace";
import { resolveDailyBoardEvidence, type BoardGoalieEvidence } from "lib/projections/dailyBoardEvidence";
import { provenSnapshotRow, unprovenSnapshotRow } from "lib/projections/externalInputProof.fixtures";

const now = new Date("2026-10-19T18:00:00Z");
const policy = forecastCalendarPolicy(14);
const member = (id: string, nhlId: number, team: string, nhlTeamId: number, playerClass: "skater" | "goalie" = "skater"): PlanningPlayer => ({
  id, nhlId, nhlTeamId, rosterRevision: `roster-${id}`, name: id, teamAbbreviation: team, eligiblePositions: [playerClass === "goalie" ? "G" : "C"],
  eligibilityVerified: true, playerClass, availability: "free_agent", ownership: null, canDrop: true, holdValue: null, reserveEligibility: [] });
const game = (id: string, team: string, startsAt: string, status: PlanningGame["status"] = "scheduled"): PlanningGame => ({
  id, scheduleRevision: `schedule-${id}-${team}`, date: startsAt.slice(0, 10), startsAt, teamAbbreviation: team, opponent: "X", home: true, status });
const players = [member("s1", 101, "TOR", 10), member("s2", 102, "TOR", 10), member("s3", 103, "MTL", 8),
  member("g1", 201, "TOR", 10, "goalie"), member("g2", 202, "TOR", 10, "goalie")];
const games = [game("0", "TOR", "2026-10-18T23:00:00Z", "final"), game("1", "TOR", "2026-10-19T23:00:00Z"),
  game("2", "TOR", "2026-10-21T23:00:00Z"), game("3", "MTL", "2026-10-20T23:00:00Z")];
const skater = (run: string, asOf: string, gameId: number, playerId: number, teamId: number) => ({ run_id: run, as_of_date: asOf, horizon_games: 1,
  game_id: gameId, player_id: playerId, team_id: teamId, proj_goals_es: 0.25, proj_goals_pp: 0.1, proj_goals_pk: null, proj_assists_es: 0.3,
  proj_assists_pp: 0.15, proj_assists_pk: null, proj_shots_es: 2.5, proj_shots_pp: 0.6, proj_shots_pk: null, proj_toi_es_seconds: 900,
  proj_toi_pp_seconds: 180, proj_toi_pk_seconds: null, proj_hits: 1.2, proj_blocks: 0.5, proj_pim: null, proj_plus_minus: null });
const inputs = () => ({
  // The loader marks each run whose captured snapshot proves external fantasy inputs were excluded.
  runs: [{ run_id: "r1", as_of_date: "2026-10-18", created_at: "2026-10-18T12:00:00Z", git_sha: "abc", external_input_proven: true },
    { run_id: "r2", as_of_date: "2026-10-19", created_at: "2026-10-19T12:00:00Z", git_sha: "def", external_input_proven: true }],
  // s1 is in both runs; s2 only in the older one; s3's row is for a different team.
  skaters: [skater("r1", "2026-10-18", 0, 101, 10), skater("r2", "2026-10-19", 1, 101, 10), skater("r1", "2026-10-18", 0, 102, 10),
    skater("r2", "2026-10-19", 9, 103, 9)],
  goalies: [{ run_id: "r2", as_of_date: "2026-10-19", horizon_games: 1, game_id: 1, goalie_id: 201, team_id: 10, starter_probability: 0.8,
    proj_saves: 25, proj_goals_allowed: 2.5, proj_shots_against: 27.5, proj_win_prob: 0.55, proj_shutout_prob: 0.05 }],
  // Start-share rows carry the goalie's team and a real NHL game id, whose first four digits name the season.
  goalieShares: [{ player_id: 201, team_id: 10, game_id: 2026020001, game_date: "2026-10-19", l10_start_pct: 0.7, season_start_pct: 0.6, updated_at: "2026-10-19T10:00:00Z" },
    { player_id: 202, team_id: 10, game_id: 2026020001, game_date: "2026-10-19", l10_start_pct: 0.3, season_start_pct: 0.4, updated_at: "2026-10-19T10:00:00Z" }],
});
type ShareRow = ReturnType<typeof inputs>["goalieShares"][number];
const shareRow = (player_id: number, team_id: number, game_id: number, game_date: string, l10_start_pct: number): ShareRow =>
  ({ player_id, team_id, game_id, game_date, l10_start_pct, season_start_pct: l10_start_pct, updated_at: `${game_date}T10:00:00Z` });

describe("FORGE daily bridge", () => {
  it("reuses each skater's latest line for his team's upcoming games only", () => {
    const { forecasts } = buildForgeDailyBridgeForecasts(inputs(), players, games, now, 20262027, policy);
    const s1 = forecasts.filter(row => row.playerId === "s1");
    expect(s1.map(row => row.gameId)).toEqual(["1", "2"]);
    expect(s1[0]).toMatchObject({ revisionId: `${FORGE_DAILY_BRIDGE_VERSION}:r2`, sourceKind: "detailed", conditioning: "unconditional",
      issuedAt: "2026-10-19T12:00:00.000Z", expiresAt: "2026-10-19T23:00:00.000Z",
      stats: { GOALS: 0.35, ASSISTS: 0.45, POINTS: 0.8, PP_POINTS: 0.25, SHOTS_ON_GOAL: 3.1, HITS: 1.2, BLOCKED_SHOTS: 0.5,
        TIME_ON_ICE_PER_GAME: 18, PENALTY_MINUTES: null, PLUS_MINUS: null, FACEOFFS_WON: null } });
    expect(s1[0].issuedContext).toMatchObject({ playerId: "s1", gameId: "1", nhlPlayerId: 101, teamId: 10, scheduleRevision: "schedule-1-TOR", rosterRevision: "roster-s1" });
    // Scratched from the latest run, or moved teams: no forecast.
    expect(forecasts.some(row => row.playerId === "s2" || row.playerId === "s3")).toBe(false);
  });

  it("prefers the line FORGE issued for the game itself over a re-aimed line from an earlier game", () => {
    // r3 (issued later) projects s1 for game 2 directly; game 1 still comes from r2's own row, re-aimed nowhere.
    const data = inputs();
    data.runs.push({ run_id: "r3", as_of_date: "2026-10-21", created_at: "2026-10-19T18:00:00Z", git_sha: "ghi", external_input_proven: true });
    data.skaters.push({ ...skater("r3", "2026-10-21", 2, 101, 10), proj_goals_es: 0.5, proj_goals_pp: 0.2 });
    const { forecasts } = buildForgeDailyBridgeForecasts(data, players, games, now, 20262027, policy);
    const s1 = forecasts.filter(row => row.playerId === "s1");
    expect(s1.map(row => [row.gameId, row.revisionId])).toEqual([["1", `${FORGE_DAILY_BRIDGE_VERSION}:r2`], ["2", `${FORGE_DAILY_BRIDGE_VERSION}:r3`]]);
    expect(s1[0].stats.GOALS).toBe(0.35);
    expect(s1[1].stats.GOALS).toBe(0.7);
    expect(s1[1].issuedAt).toBe("2026-10-19T18:00:00.000Z");
  });

  it("keeps a complete exact-game forecast when the newer game's learned head is missing", () => {
    const data = inputs();
    data.runs.push({ run_id: "r3", as_of_date: "2026-10-21", created_at: "2026-10-19T17:00:00Z", git_sha: "ghi", external_input_proven: true });
    data.skaters.push({ ...skater("r3", "2026-10-21", 2, 101, 10), proj_assists_es: null } as unknown as ReturnType<typeof skater>);
    const { forecasts } = buildForgeDailyBridgeForecasts(data, players, games, now, 20262027, policy);
    const rows = forecasts.filter(row => row.playerId === "s1");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ gameId: "1", revisionId: `${FORGE_DAILY_BRIDGE_VERSION}:r2`, stats: { GOALS: 0.35, ASSISTS: 0.45 } });
  });

  it("keeps a skater's own-game line when his team's newer run omits him, withholding only re-aimed copies", () => {
    // r2 (day D) projects s1 and s2 for game 1; r3 (D+1) projects only s1, for game 2.
    const data = inputs();
    data.runs.push({ run_id: "r3", as_of_date: "2026-10-20", created_at: "2026-10-19T15:00:00Z", git_sha: "ghi", external_input_proven: true });
    data.skaters.push(skater("r2", "2026-10-19", 1, 102, 10), skater("r3", "2026-10-20", 2, 101, 10));
    const { forecasts, limitations } = buildForgeDailyBridgeForecasts(data, players, games, now, 20262027, policy);
    const lines = (id: string) => forecasts.filter(row => row.playerId === id).map(row => [row.gameId, row.revisionId]);
    expect(lines("s1")).toEqual([["1", `${FORGE_DAILY_BRIDGE_VERSION}:r2`], ["2", `${FORGE_DAILY_BRIDGE_VERSION}:r3`]]);
    expect(lines("s2")).toEqual([["1", `${FORGE_DAILY_BRIDGE_VERSION}:r2`]]);
    expect(limitations.some(line => line.includes("missing from their team's latest FORGE run"))).toBe(false);
    // s3's latest line is for another team.
    expect(limitations).toContain("1 skaters whose latest FORGE line is for a different team than their current one get no forecast.");
    // Without r3's line for game 1, s2 has nothing issued for an upcoming game and counts as stale.
    expect(buildForgeDailyBridgeForecasts(inputs(), players, games, now, 20262027, policy).limitations)
      .toContain("1 skaters missing from their team's latest FORGE run get no forecast (likely scratched, injured or moved).");
  });

  it("names the coverage gaps: unknown heads, goalies with no start share, opponents with no team-strength prior", () => {
    const base = inputs();
    // s2's latest line has a blank even-strength head; s1 was projected against MTL and moves to SJS, neither with a prior.
    base.skaters.push({ ...skater("r2", "2026-10-19", 1, 102, 10), proj_goals_es: null } as unknown as ReturnType<typeof skater>);
    base.skaters = base.skaters.map(row => row.player_id === 101 && row.run_id === "r2" ? { ...row, opponent_team_id: 8 } : row);
    // The goalie line was projected against team 77, which has no abbreviation to look a prior up by.
    base.goalies = base.goalies.map(row => ({ ...row, opponent_team_id: 77 }));
    base.goalieShares = base.goalieShares.filter(row => row.player_id !== 202);
    const opponentGames = games.map(game => game.id === "2" ? { ...game, opponent: "SJS" } : game.id === "1" ? { ...game, opponent: "MTL" } : game);
    const teamPriors = [{ team_abbrev: "TOR", date: "2026-10-19", games_played: 50, xga: 145, xga_per_game: 2.9, xgf_per_game: 3 }];
    const { forecasts, limitations } = buildForgeDailyBridgeForecasts({ ...base, teamPriors }, players, opponentGames, now, 20262027, policy);
    expect(forecasts.some(row => row.playerId === "s2")).toBe(false);
    expect(limitations).toContain("1 skaters have a FORGE line with blank even-strength goals, assists or shots; such lines give no forecast.");
    expect(limitations.some(line => line.includes("power-play"))).toBe(false);
    expect(forecasts.some(row => row.playerId === "g2" && row.gameId === "2")).toBe(false);
    expect(limitations).toContain("1 goalies with no start share get no forecast for games FORGE has not projected for them.");
    expect(limitations).toContain("3 opponents have no team-strength prior, so lines projected against or moved to them skip the opponent adjustment.");
  });

  it("normalises start shares that sum to less than one when FORGE has not projected the game", () => {
    const base = inputs();
    base.goalieShares = [{ ...base.goalieShares[0], l10_start_pct: 0.4 }, { ...base.goalieShares[1], l10_start_pct: 0.2 }];
    const { forecasts } = buildForgeDailyBridgeForecasts(base, players, games, now, 20262027, policy);
    const goalie = (id: string, gameId: string) => forecasts.find(row => row.playerId === id && row.gameId === gameId)!;
    expect(goalie("g1", "2").startProbability).toBeCloseTo(2 / 3, 3);
    expect(goalie("g2", "2").startProbability).toBeCloseTo(1 / 3, 3);
    // The projected game keeps FORGE's starter probability.
    expect(goalie("g1", "1").startProbability).toBe(0.8);
  });

  it("keeps FORGE's starter probability for a projected game and splits the rest by start share", () => {
    const { forecasts } = buildForgeDailyBridgeForecasts(inputs(), players, games, now, 20262027, policy);
    const goalie = (id: string, gameId: string) => forecasts.find(row => row.playerId === id && row.gameId === gameId)!;
    expect(goalie("g1", "1").startProbability).toBe(0.8);
    expect(goalie("g2", "1").startProbability).toBeCloseTo(0.2);
    // g2 has no FORGE line of his own, so the team's latest per-start line applies.
    expect(goalie("g2", "1").stats.SAVES_GOALIE).toBeCloseTo(5);
    expect(goalie("g1", "1").conditionalStats).toMatchObject({ SAVES_GOALIE: 25, WINS_GOALIE: 0.55, LOSSES_GOALIE: 0.45 });
    expect([goalie("g1", "2").startProbability, goalie("g2", "2").startProbability]).toEqual([0.7, 0.3]);
  });

  describe("external-input exclusion proof", () => {
    it("never builds a forecast from an unproven run: its players are unavailable, with a limitation, never zero", () => {
      const data = inputs();
      data.runs[1].external_input_proven = false;
      const { forecasts, limitations } = buildForgeDailyBridgeForecasts(data, players, games, now, 20262027, policy);
      expect(forecasts.some(row => row.revisionId.endsWith(":r2"))).toBe(false);
      // s1 falls back to r1's proven line; the goalies' only lines are r2's, so they get no forecast at all.
      expect(forecasts.filter(row => row.playerId === "s1").map(row => row.revisionId)).toEqual([`${FORGE_DAILY_BRIDGE_VERSION}:r1`, `${FORGE_DAILY_BRIDGE_VERSION}:r1`]);
      expect(forecasts.some(row => row.playerId === "g1" || row.playerId === "g2")).toBe(false);
      expect(forecasts.every(row => Object.values(row.stats).some(value => value !== 0))).toBe(true);
      expect(limitations).toContain("1 FORGE runs in the last week cannot prove they excluded third-party fantasy projections, so they are withheld; players covered only by them get no forecast.");
    });

    it.each([[false], [undefined]])("is schedule-only, saying why, when no run is proven (flag %s)", flag => {
      const data = inputs();
      for (const run of data.runs) (run as Record<string, unknown>).external_input_proven = flag;
      expect(buildForgeDailyBridgeForecasts(data, players, games, now, 20262027, policy)).toEqual({ forecasts: [], teamWins: [],
        limitations: ["Interim FORGE projections: no FORGE run in the last week can prove it excluded third-party fantasy projections (2 withheld), so planning is schedule-only."] });
    });

    // forge_runs rows newest first; each run's snapshot (or none) decides whether it is proven.
    function proofDb(runRows: Record<string, any>[], snapshots: Record<string, any>[], skaterRows: Record<string, any>[] = []) {
      const runIdReads: unknown[] = [], proofReads: unknown[] = [], attributionReads: unknown[] = [];
      const db = { from: (table: string) => {
        let rows: Record<string, any>[] = table === "forge_runs" ? [...runRows] : table === "forge_player_projections" ? [...skaterRows]
          : table === "player_forecast_source_observations" ? [...snapshots] : [];
        const builder: any = new Proxy({}, { get: (_target, property) => {
          if (property === "then") return (resolve: (value: unknown) => unknown) => Promise.resolve(resolve({ data: rows, count: rows.length, error: null }));
          if (property === "in") return (column: string, values: unknown[]) => {
            if (column === "run_id") (table === "forge_runs" ? attributionReads : runIdReads).push(values);
            if (column === "entity_key") proofReads.push(values);
            rows = rows.filter(row => values.includes(row[column]));
            return builder;
          };
          return () => builder;
        } });
        return builder;
      } };
      return { db, runIdReads, proofReads, attributionReads };
    }

    it("selects, per date, the latest proven run and reads no row of a newer unproven one", async () => {
      const runRows = [
        { run_id: "uncaptured", as_of_date: "2026-10-19", created_at: "2026-10-19T16:00:00Z", git_sha: "abc" },
        { run_id: "legacy", as_of_date: "2026-10-19", created_at: "2026-10-19T14:00:00Z", git_sha: "abc" },
        { run_id: "clean", as_of_date: "2026-10-19", created_at: "2026-10-19T12:00:00Z", git_sha: "abc" },
        { run_id: "legacy-old", as_of_date: "2026-10-18", created_at: "2026-10-18T12:00:00Z", git_sha: "abc" },
      ];
      const { db, runIdReads, proofReads, attributionReads } = proofDb(runRows, [unprovenSnapshotRow("legacy"), provenSnapshotRow("clean"), unprovenSnapshotRow("legacy-old")],
        [skater("clean", "2026-10-19", 1, 101, 10), skater("legacy", "2026-10-19", 1, 101, 10), skater("legacy-old", "2026-10-18", 0, 102, 10)]);
      const result = await loadForgeDailyBridgeForecasts(db as never, players, games, now, 20262027, Date.now() + 5000, policy);
      expect(proofReads).toEqual([["uncaptured", "legacy", "clean", "legacy-old"]]);
      // Only the snapshot-less run's attribution is read; its "abc" SHA is no verified release.
      expect(attributionReads).toEqual([["uncaptured"]]);
      expect(runIdReads).toEqual([["clean"], ["clean"]]);
      expect(new Set(result.forecasts.map(row => row.revisionId))).toEqual(new Set([`${FORGE_DAILY_BRIDGE_VERSION}:clean`]));
      expect(result.limitations).toContain("3 FORGE runs in the last week cannot prove they excluded third-party fantasy projections, so they are withheld; players covered only by them get no forecast.");
    });

    it("serves an uncaptured run of the verified release, single invocation only, and never a resumed one", async () => {
      const release = "538100d41ee87e721d2764b694f7bac8c2f2bb34";
      const runRows = [
        { run_id: "resumed", as_of_date: "2026-10-19", created_at: "2026-10-19T14:00:00Z", git_sha: release, status: "succeeded", invocations: "2" },
        { run_id: "single", as_of_date: "2026-10-19", created_at: "2026-10-19T12:00:00Z", git_sha: release, status: "succeeded", invocations: "1" },
      ];
      const { db, runIdReads } = proofDb(runRows, [], [skater("resumed", "2026-10-19", 1, 101, 10), skater("single", "2026-10-19", 1, 101, 10)]);
      const result = await loadForgeDailyBridgeForecasts(db as never, players, games, now, 20262027, Date.now() + 5000, policy);
      expect(runIdReads).toEqual([["single"], ["single"]]);
      expect(new Set(result.forecasts.map(row => row.revisionId))).toEqual(new Set([`${FORGE_DAILY_BRIDGE_VERSION}:single`]));
    });

    it("serves a clean run proven by its snapshot, and fails closed when proof cannot be read", async () => {
      const runRows = [{ run_id: "clean", as_of_date: "2026-10-19", created_at: "2026-10-19T12:00:00Z", git_sha: "abc" }];
      const proven = proofDb(runRows, [provenSnapshotRow("clean")], [skater("clean", "2026-10-19", 1, 101, 10)]);
      const served = await loadForgeDailyBridgeForecasts(proven.db as never, players, games, now, 20262027, Date.now() + 5000, policy);
      expect(served.forecasts.filter(row => row.playerId === "s1").map(row => row.gameId)).toEqual(["1", "2"]);
      const failing = proofDb(runRows, []);
      const from = failing.db.from;
      failing.db.from = (table: string) => table === "player_forecast_source_observations"
        ? { select: () => ({ eq: () => ({ eq: () => ({ in: async () => ({ data: null, error: { message: "denied" } }) }) }) }) } as never : from(table);
      await expect(loadForgeDailyBridgeForecasts(failing.db as never, players, games, now, 20262027, Date.now() + 5000, policy)).rejects.toEqual({ message: "denied" });
    });
  });

  it("is empty with a plain reason when no run exists, and trims to the byte budget", () => {
    expect(buildForgeDailyBridgeForecasts({ runs: [], skaters: [], goalies: [], goalieShares: [] }, players, games, now, 20262027, policy))
      .toEqual({ forecasts: [], teamWins: [], limitations: [expect.stringContaining("no successful FORGE run")] });
    // The budget counts compact wire bytes, the size the projections actually travel at.
    const trimmed = buildForgeDailyBridgeForecasts(inputs(), players, games, now, 20262027, policy, 1000);
    expect(trimmed.forecasts.length).toBeGreaterThan(0);
    expect(trimmed.limitations.at(-1)).toMatch(/trimmed to the first \d+ of 6 player-games/);
  });

  it("travels compactly and is rebuilt exactly, leaving anything it cannot rebuild as it is", () => {
    const { forecasts } = buildForgeDailyBridgeForecasts(inputs(), players, games, now, 20262027, policy);
    const { forecasts: kept, wire } = compactBridgeForecasts(forecasts, { players, games }, 20262027);
    expect(kept).toEqual([]);
    const sent = JSON.parse(JSON.stringify(wire));
    expect(expandBridgeForecasts(sent, { players, games })).toEqual(forecasts);
    expect(JSON.stringify(wire).length).toBeLessThan(JSON.stringify(forecasts).length * 0.5);
    // A row whose identity no longer matches, and any non-bridge forecast, stay in full.
    const moved = { ...forecasts[0], issuedContext: { ...forecasts[0].issuedContext!, rosterRevision: "other" } };
    const other = { ...forecasts[1], revisionId: "issued-revision" };
    const mixed = compactBridgeForecasts([moved, other, ...forecasts.slice(2)], { players, games }, 20262027);
    expect(mixed.forecasts).toEqual([moved, other]);
    expect(expandBridgeForecasts(mixed.wire, { players, games })).toEqual(forecasts.slice(2));
    // Nothing usable comes from a missing, foreign or malformed wire.
    expect(expandBridgeForecasts(undefined, { players, games })).toEqual([]);
    expect(expandBridgeForecasts({ ...sent, version: "other" }, { players, games })).toEqual([]);
    expect(expandBridgeForecasts({ ...sent, rows: [["s1", "1", 9, "x", {}, 2, "no", null]] }, { players, games })).toEqual([]);
  });

  it("packs bridge rows in every snapshot of a save or backup, restoring them exactly", () => {
    const { forecasts } = buildForgeDailyBridgeForecasts(inputs(), players, games, now, 20262027, policy);
    const snapshot = { id: "s", context: { seasonId: 20262027, startDate: "2026-10-19" }, players, games, forecasts, roster: [] };
    const save = { workspace: { version: 1 }, snapshot, expectedVersion: null };
    const backup = { backup: { remote: { row: { workspace: { version: 1 }, snapshot } }, provider: { connected: snapshot } }, exported: false };
    for (const body of [save, backup]) {
      const packed = JSON.parse(JSON.stringify(packPlanningSnapshots(body)));
      expect(JSON.stringify(packed)).not.toContain("issuedContext");
      const restored = unpackPlanningSnapshots(packed);
      expect(restored).toEqual(body);
      // Backup checksums hash the same canonical JSON before and after the round trip.
      expect(preservationJson(restored)).toBe(preservationJson(body));
    }
    expect(JSON.stringify(packPlanningSnapshots(save)).length).toBeLessThan(JSON.stringify(save).length * 0.6);
    // Full-size payloads from before packing, and snapshots with any other forecast, pass through unchanged.
    expect(unpackPlanningSnapshots(save)).toEqual(save);
    const mixed = { ...save, snapshot: { ...snapshot, forecasts: [...forecasts, { ...forecasts[0], revisionId: "issued-revision" }] } };
    expect(packPlanningSnapshots(mixed)).toEqual(mixed);
    // A packed snapshot that cannot be rebuilt in full is refused, never restored partially.
    const broken = JSON.parse(JSON.stringify(packPlanningSnapshots(save)));
    broken.snapshot.players = [];
    expect(() => unpackPlanningSnapshots(broken)).toThrow("could not be restored");
  });

  it("also caps the bytes projections take once rebuilt", () => {
    const capped = buildForgeDailyBridgeForecasts(inputs(), players, games, now, 20262027, policy, 1_000_000, 3000);
    expect(capped.forecasts.length).toBeGreaterThan(0);
    expect(JSON.stringify(capped.forecasts).length).toBeLessThanOrEqual(3000);
    expect(capped.limitations.at(-1)).toMatch(/trimmed to the first \d+ of 6 player-games/);
  });

  describe("blank power-play heads", () => {
    const withPowerPlay = (patch: Record<string, unknown>) => {
      const base = inputs();
      base.skaters = base.skaters.map(row => row.player_id === 101 && row.run_id === "r2" ? { ...row, ...patch } as unknown as typeof row : row);
      return buildForgeDailyBridgeForecasts(base, players, games, now, 20262027, policy);
    };
    const blankLine = { proj_goals_pp: null, proj_assists_pp: null, proj_shots_pp: null };

    it.each([0, 6])("count as zero production by declared policy when FORGE stores %i s of power-play time", seconds => {
      const { forecasts, limitations } = withPowerPlay({ ...blankLine, proj_toi_pp_seconds: seconds });
      const s1 = forecasts.filter(row => row.playerId === "s1");
      expect(s1.map(row => row.gameId)).toEqual(["1", "2"]);
      expect(s1[0].stats).toMatchObject({ GOALS: 0.25, ASSISTS: 0.3, PP_GOALS: 0, PP_ASSISTS: 0, PP_POINTS: 0, SHOTS_ON_GOAL: 2.5,
        TIME_ON_ICE_PER_GAME: (900 + seconds) / 60 });
      expect(limitations).toContain("1 skaters with no FORGE power-play line and at most 6 s of projected power-play time count 0 power-play production.");
    });

    // Real (over 6 s) or unrecorded (null) power-play time.
    it.each([7, 120, null])("stay unknown with %s s of power-play time", seconds => {
      const { forecasts, limitations } = withPowerPlay({ ...blankLine, proj_toi_pp_seconds: seconds });
      expect(forecasts.some(row => row.playerId === "s1")).toBe(false);
      expect(limitations).toContain("1 skaters have no FORGE power-play line and real or unrecorded power-play time, so they get no forecast.");
      expect(limitations.some(line => line.includes("count 0 power-play production"))).toBe(false);
    });

    it("leave a known power-play line standing when only its time is unrecorded, with time on ice unknown", () => {
      const { forecasts, limitations } = withPowerPlay({ proj_toi_pp_seconds: null });
      expect(forecasts.find(row => row.playerId === "s1")!.stats).toMatchObject({ PP_GOALS: 0.1, PP_ASSISTS: 0.15, PP_POINTS: 0.25, TIME_ON_ICE_PER_GAME: null });
      expect(limitations.some(line => line.includes("power-play"))).toBe(false);
    });

    it("never rescue a blank even-strength line", () => {
      expect(withPowerPlay({ ...blankLine, proj_toi_pp_seconds: 0, proj_goals_es: null }).forecasts.some(row => row.playerId === "s1")).toBe(false);
    });
  });

  it("fills the stats FORGE does not project from blended season rates", () => {
    const totals = (playerId: number, season: string, gp: number, pim: number, fow: number, fol: number, goals: number, gwg: number) =>
      ({ player_id: playerId, season, games_played: gp, penalty_minutes: pim, plus_minus: 0, sh_goals: 0, sh_assists: 0, sh_points: 0, total_fow: fow, total_fol: fol, goals, gw_goals: gwg });
    const seasonTotals = [totals(101, "20262027", 10, 10, 50, 40, 4, 2), totals(101, "20252026", 80, 40, 600, 500, 20, 4), totals(102, "20262027", 10, 30, 0, 0, 1, 0)];
    const { forecasts, limitations } = buildForgeDailyBridgeForecasts({ ...inputs(), seasonTotals }, players, games, now, 20262027, policy);
    const stats = forecasts.find(row => row.playerId === "s1")!.stats;
    // Faceoffs are not pulled toward the league: (50 + 0.5 × 600) / (10 + 0.5 × 80).
    expect(stats.FACEOFFS_WON).toBe(7);
    expect(stats.FACEOFFS_LOST).toBe(5.8);
    // Game-winning goals: projected goals × (2 + 0.5 × 4 + 0.16 × 10) / (4 + 0.5 × 20 + 10).
    expect(stats.GAME_WINNING_GOALS).toBeCloseTo(0.35 * 5.6 / 24, 4);
    expect(stats.PENALTY_MINUTES).toBeGreaterThan(30 / 50);
    expect(limitations).toContain("Penalty minutes, plus-minus, shorthanded points, game-winning goals and faceoffs are season per-game rates (this season plus half of last, pulled toward league rates), not FORGE projections.");
  });

  describe("season-rate supplements", () => {
    const totals = (player_id: number, season: string, patch: Record<string, number | null> = {}) => ({ player_id, season, games_played: 10,
      penalty_minutes: 5, plus_minus: 0, sh_goals: 0, sh_assists: 0, sh_points: 0, total_fow: 0, total_fol: 0, goals: 2, gw_goals: 0, ...patch });
    const s1Stats = (data: ForgeDailyBridgeInputs) => {
      const result = buildForgeDailyBridgeForecasts(data, players, games, now, 20262027, policy);
      return { stats: result.forecasts.find(row => row.playerId === "s1")!.stats, limitations: result.limitations };
    };

    it("are unknown, never 0, when season totals cannot be read", () => {
      const { stats, limitations } = s1Stats(inputs());
      for (const key of FORGE_DAILY_BRIDGE_SEASON_RATED) expect(stats[key]).toBeNull();
      expect(limitations).toContain("Season rates could not be read, so penalty minutes, plus-minus, shorthanded points, game-winning goals and faceoffs are unknown; totals that score them are withheld.");
      expect(limitations.some(line => line.includes("count as 0"))).toBe(false);
      // FORGE's own penalty minutes and plus-minus still stand where its writers store them, a stored 0 included.
      const data = inputs();
      data.skaters = data.skaters.map(row => ({ ...row, proj_pim: 0.4, proj_plus_minus: 0 }) as unknown as typeof row);
      expect(s1Stats(data).stats).toMatchObject({ PENALTY_MINUTES: 0.4, PLUS_MINUS: 0, FACEOFFS_WON: null, GAME_WINNING_GOALS: null });
    });

    it("are unknown for a skater with no season totals, while a rate read as zero stays 0", () => {
      const missing = s1Stats({ ...inputs(), seasonTotals: [totals(102, "20262027")] });
      for (const key of FORGE_DAILY_BRIDGE_SEASON_RATED) expect(missing.stats[key]).toBeNull();
      expect(missing.limitations).toContain("1 skaters have no season totals this season or last, so their penalty minutes, plus-minus, shorthanded points, game-winning goals and faceoffs are unknown.");
      const read = s1Stats({ ...inputs(), seasonTotals: [totals(101, "20262027")] });
      expect(read.stats).toMatchObject({ PLUS_MINUS: 0, SH_GOALS: 0, SH_ASSISTS: 0, SH_POINTS: 0, FACEOFFS_WON: 0, FACEOFFS_LOST: 0, PENALTY_MINUTES: 0.5 });
      // No game-winners in 2 goals, pulled toward the 0.16 share: 0.35 × 1.6 / 12.
      expect(read.stats.GAME_WINNING_GOALS).toBeCloseTo(0.35 * 1.6 / 12, 4);
      expect(read.limitations.some(line => line.includes("no season totals"))).toBe(false);
    });

    it("count only the rows that record a stat, leaving it unknown when none do", () => {
      // This season left faceoffs unrecorded; last season's 600 in 80 games (half weight) is all that is known of them.
      const seasonTotals = [totals(101, "20262027", { total_fow: null, total_fol: null, gw_goals: null }),
        totals(101, "20252026", { games_played: 80, total_fow: 600, total_fol: null, gw_goals: null })];
      const { stats } = s1Stats({ ...inputs(), seasonTotals });
      expect(stats.FACEOFFS_WON).toBe(7.5);
      expect(stats.FACEOFFS_LOST).toBeNull();
      expect(stats.GAME_WINNING_GOALS).toBeNull();
      // Penalty minutes were recorded both seasons: (5 + 0.5 × 5) / (10 + 0.5 × 80), the league rate being his own.
      expect(stats.PENALTY_MINUTES).toBe(0.15);
    });

    it("withhold a points total that weights an unknown supplement instead of scoring it 0", () => {
      const { forecasts } = buildForgeDailyBridgeForecasts(inputs(), players, games, now, 20262027, policy);
      const row = forecasts.find(item => item.playerId === "s1")!;
      const score = (weights: Record<string, number>) => gameForecastPoints({ id: "snap", players, games, forecasts, roster: [], lockedAssignments: [],
        realized: {}, opponent: null, evidence: {}, context: { provider: "manual", seasonId: 20262027, leagueId: "l", teamId: "t",
          startDate: "2026-10-19", endDate: "2026-10-25", timeZone: "UTC", asOf: now.toISOString() },
        rules: { lineupMode: "daily", rosterSlots: { C: 1, BN: 1 }, acquisitionTiming: "next_day", acquisitionCost: 1, periods: [],
          scoring: { mode: "points", weights, categories: [] }, goalieMinimum: { required: null, credited: null, counts: "unknown", penalty: "none" }, unsupported: [] } }, row);
      expect(score({ GOALS: 3 }).expected).toBeCloseTo(1.05);
      expect(score({ GOALS: 3, FACEOFFS_WON: 0.1 }).expected).toBeNull();
    });
  });

  describe("goalie start shares", () => {
    // Real NHL game ids for TOR tonight, tomorrow and the day after; FORGE projected none of them.
    const tor = [game("2026020101", "TOR", "2026-10-19T23:00:00Z"), game("2026020102", "TOR", "2026-10-20T23:00:00Z"),
      game("2026020103", "TOR", "2026-10-21T23:00:00Z")];
    const starts = (goalieShares: ShareRow[]) => {
      const { forecasts, limitations } = buildForgeDailyBridgeForecasts({ ...inputs(), goalieShares }, players, tor, now, 20262027, policy);
      const chance = (id: string, gameId: string) => forecasts.find(row => row.playerId === id && row.gameId === gameId)?.startProbability ?? null;
      return { chances: (gameId: string) => [chance("g1", gameId), chance("g2", gameId)], limitations };
    };

    it("use rows for the goalie's current team this season", () => {
      const { chances, limitations } = starts([shareRow(201, 10, 2026020090, "2026-10-17", 0.7), shareRow(202, 10, 2026020090, "2026-10-17", 0.3)]);
      for (const { id } of tor) expect(chances(id)).toEqual([0.7, 0.3]);
      expect(limitations.some(line => line.includes("another team or season"))).toBe(false);
    });

    it("ignore a traded goalie's rows from his old team, even newer ones", () => {
      // g2 came over from MTL (8): his newest row is MTL's, where he started 90%.
      const { chances, limitations } = starts([shareRow(201, 10, 2026020090, "2026-10-17", 0.7), shareRow(202, 10, 2026020090, "2026-10-17", 0.3),
        shareRow(202, 8, 2026020095, "2026-10-19", 0.9)]);
      for (const { id } of tor) expect(chances(id)).toEqual([0.7, 0.3]);
      expect(limitations.some(line => line.includes("another team or season"))).toBe(false);
    });

    it("ignore rows from another season", () => {
      const { chances } = starts([shareRow(201, 10, 2026020090, "2026-10-17", 0.7), shareRow(202, 10, 2026020090, "2026-10-17", 0.3),
        shareRow(201, 10, 2025030417, "2026-10-19", 0.2)]);
      for (const { id } of tor) expect(chances(id)).toEqual([0.7, 0.3]);
    });

    it("leave a goalie with no current-team, current-season row unknown", () => {
      const { chances, limitations } = starts([shareRow(201, 10, 2026020090, "2026-10-17", 0.7),
        shareRow(202, 8, 2026020095, "2026-10-19", 0.9), shareRow(202, 10, 2025021300, "2026-10-18", 0.4)]);
      for (const { id } of tor) expect(chances(id)[1]).toBeNull();
      expect(limitations).toContain("1 goalies have start shares only from another team or season; those are ignored, so their start chance is unknown.");
      expect(limitations).toContain("1 goalies with no start share get no forecast for games FORGE has not projected for them.");
    });

    it("prefer the row for the game itself, falling back to the latest row for games without one", () => {
      const { chances, limitations } = starts([shareRow(201, 10, 2026020101, "2026-10-19", 0.6), shareRow(202, 10, 2026020101, "2026-10-19", 0.4),
        shareRow(201, 10, 2026020102, "2026-10-20", 0.9), shareRow(202, 10, 2026020102, "2026-10-20", 0.1)]);
      expect(chances("2026020101")).toEqual([0.6, 0.4]);
      expect(chances("2026020102")).toEqual([0.9, 0.1]);
      expect(chances("2026020103")).toEqual([0.9, 0.1]);
      expect(limitations).toContain("Goalie starts use each goalie's last-10 start share (season share when missing) from start rows for his current team this season: the row for that game when one exists, otherwise his latest. FORGE's own starter probability applies to an already projected game. Per-start lines come from his latest FORGE line, or his team's when he has none.");
    });

    describe("never scaled up past a teammate whose share is unknown", () => {
      const g3 = member("g3", 203, "TOR", 10, "goalie");
      const run = (goalieShares: ShareRow[], roster: PlanningPlayer[], extra: Partial<ForgeDailyBridgeInputs> = {}) => {
        const { forecasts, limitations } = buildForgeDailyBridgeForecasts({ ...inputs(), goalieShares, ...extra }, roster, tor, now, 20262027, policy);
        const chance = (id: string, gameId = "2026020102") => forecasts.find(row => row.playerId === id && row.gameId === gameId)?.startProbability ?? null;
        return { chance, limitations };
      };
      const known = (...values: [number, number][]) => values.map(([id, value]) => shareRow(id, 10, 2026020090, "2026-10-17", value));
      const openLine = "3 team-games have a goalie with no start share; the others keep their own shares, never scaled up, so start chances there sum to less than 1.";

      it("renormalise when every goalie's share is known", () => {
        const { chance, limitations } = run(known([201, 0.4], [202, 0.2]), players);
        expect(chance("g1")).toBeCloseTo(2 / 3, 3);
        expect(chance("g2")).toBeCloseTo(1 / 3, 3);
        expect(limitations.some(line => line.includes("never scaled up"))).toBe(false);
      });

      it("keep a known share as read beside an unknown teammate, scaling down only past 1", () => {
        const pair = run(known([201, 0.7]), players);
        expect([pair.chance("g1"), pair.chance("g2")]).toEqual([0.7, null]);
        expect(pair.limitations).toContain(openLine);
        const trio = run(known([201, 0.6], [202, 0.3]), [...players, g3]);
        expect([trio.chance("g1"), trio.chance("g2"), trio.chance("g3")]).toEqual([0.6, 0.3, null]);
        const over = run(known([201, 0.8], [202, 0.5]), [...players, g3]);
        expect(over.chance("g1")! + over.chance("g2")!).toBeCloseTo(1, 3);
        expect(over.chance("g1")).toBeCloseTo(0.8 / 1.3, 3);
      });

      it("leave every start chance unknown when no share is known", () => {
        const { chance } = run([], players);
        for (const { id } of tor) expect([chance("g1", id), chance("g2", id)]).toEqual([null, null]);
      });

      it("split what FORGE's starter leaves without scaling the others up", () => {
        const goalies = [{ ...inputs().goalies[0], game_id: 2026020102 }];
        expect(run(known([202, 0.15]), players, { goalies }).chance("g2")).toBeCloseTo(0.2);
        const { chance } = run(known([202, 0.15]), [...players, g3], { goalies });
        expect([chance("g1"), chance("g2"), chance("g3")]).toEqual([0.8, 0.15, null]);
      });

      it("hand a ruled-out goalie's chance to known teammates only when none is unknown", () => {
        const goalieNews = { conflicts: [], assertions: [{ gameId: 2026020102, teamId: 10, playerId: 201, dimension: "goalie" as const, value: "ruled_out",
          evidenceId: "e", sourceKey: "gamedaygoalies", sourceUrl: null, publishedAt: "2026-10-19T15:00:00Z", receivedAt: "2026-10-19T15:00:01Z", confirmed: false }] };
        expect(run(known([201, 0.6], [202, 0.3]), players, { goalieNews }).chance("g2")).toBe(1);
        const { chance } = run(known([201, 0.6], [202, 0.3]), [...players, g3], { goalieNews });
        expect([chance("g1"), chance("g2"), chance("g3")]).toEqual([0, 0.3, null]);
      });

      it("thin the starter on a back-to-back without handing his chance to known teammates past an unknown one", () => {
        const teamGames = [{ id: 2026020101, date: "2026-10-19", homeTeamId: 10, awayTeamId: 8 }, { id: 2026020102, date: "2026-10-20", homeTeamId: 10, awayTeamId: 8 }];
        const all = run(known([201, 0.6], [202, 0.4]), players, { teamGames });
        expect([all.chance("g1"), all.chance("g2")]).toEqual([0.33, 0.67]);
        const { chance } = run(known([201, 0.6], [202, 0.3]), [...players, g3], { teamGames });
        expect([chance("g1"), chance("g2"), chance("g3")]).toEqual([0.33, 0.3, null]);
      });

      it("count a goalie with no current NHL team, who keeps the team his latest row names from being scaled up", () => {
        const { nhlTeamId: _team, rosterRevision: _roster, ...rest } = member("g2", 202, "TOR", 10, "goalie");
        const teamless: PlanningPlayer = { ...rest, teamAbbreviation: null };
        const { chance, limitations } = run(known([201, 0.7], [202, 0.3]), [players[0], players[1], players[2], players[3], teamless]);
        expect(chance("g1")).toBe(0.7);
        expect(limitations).toContain("1 goalies have no current NHL team, so their start chances are unknown; the team their latest start row or FORGE line names keeps its other goalies' shares unscaled.");
      });
    });

    it("are read with their team, so the bridge can bind them", async () => {
      const selects = new Map<string, string>();
      // Every query chain resolves to its table's rows: one released run, nothing else.
      const db = { from: (table: string) => {
        const rows = table === "forge_runs" ? [{ run_id: "r", as_of_date: "2026-10-19", created_at: "2026-10-19T12:00:00Z", git_sha: "abc", metrics: { horizon_games: 1 } }]
          : table === "player_forecast_source_observations" ? [provenSnapshotRow("r")] : [];
        const chain: any = new Proxy({}, { get: (_target, property) => property === "then"
          ? (resolve: (value: unknown) => unknown) => Promise.resolve(resolve({ data: rows, count: rows.length, error: null }))
          : property === "select" ? (columns: string) => { selects.set(table, columns); return chain; } : () => chain });
        return chain;
      } };
      await loadForgeDailyBridgeForecasts(db as never, players, games, now, 20262027, Date.now() + 5000, policy);
      expect(selects.get("goalie_start_projections")?.split(",")).toEqual(expect.arrayContaining(["player_id", "team_id", "game_id", "game_date"]));
    });
  });

  it("applies accepted IFTTT goalie news over start shares", () => {
    const assertion = (gameId: number, playerId: number, value: string) => ({ gameId, teamId: 10, playerId, dimension: "goalie" as const, value,
      evidenceId: `e-${gameId}`, sourceKey: "gamedaygoalies", sourceUrl: null, publishedAt: "2026-10-19T15:00:00Z", receivedAt: "2026-10-19T15:00:01Z", confirmed: value === "confirmed" });
    const goalieNews = { assertions: [assertion(1, 202, "confirmed"), assertion(2, 202, "likely")], conflicts: [] };
    const { forecasts, limitations } = buildForgeDailyBridgeForecasts({ ...inputs(), goalieNews }, players, games, now, 20262027, policy);
    const goalie = (id: string, gameId: string) => forecasts.find(row => row.playerId === id && row.gameId === gameId)!;
    expect(goalie("g2", "1")).toMatchObject({ startProbability: 1, confirmedStart: true });
    expect(goalie("g1", "1")).toMatchObject({ startProbability: 0, confirmedStart: false });
    expect(goalie("g2", "2").startProbability).toBe(0.8);
    expect(goalie("g1", "2").startProbability).toBeCloseTo(0.2);
    expect(limitations.some(line => line.startsWith("Goalie news (IFTTT, accepted automatically): 1 confirmed, 1 likely or projected"))).toBe(true);
    const disputed = buildForgeDailyBridgeForecasts({ ...inputs(), goalieNews: { ...goalieNews,
      conflicts: [{ gameId: 1, teamId: 10, playerId: null, dimension: "goalie", evidenceIds: ["a", "b"] }] } }, players, games, now, 20262027, policy);
    expect(disputed.forecasts.find(row => row.playerId === "g1" && row.gameId === "1")!.startProbability).toBe(0.8);
  });

  it.each([
    ["confirmed", {}, 1],
    ["ruled_out", {}, 0],
    ["likely", {}, 0.8],
    ["projected", {}, 0.65],
    ["unknown", {}, 0.2],
    ["confirmed", { accepted: false }, 0.2],
    ["confirmed", { expires_at: now.toISOString() }, 0.2],
    ["confirmed", { available_at: "2026-10-19T19:00:00Z" }, 0.2],
    ["confirmed", { game_id: 99 }, 0.2],
    ["confirmed", { team_id: 8 }, 0.2],
    ["confirmed", { player_id: 999 }, 0.2],
  ] as const)("scopes trusted %s evidence %j and scales participation only", (status, overrides, expected) => {
    const observation: BoardGoalieEvidence = { id: "server-observation", game_id: 1, team_id: 10, player_id: 202,
      observed_at: "2026-10-19T15:00:00Z", available_at: "2026-10-19T15:00:01Z", created_at: "2026-10-19T15:00:02Z",
      expires_at: "2026-10-19T23:00:00Z", accepted: true, source_key: "accepted-server-feed", observation_status: status, ...overrides };
    const goalieNews = resolveDailyBoardEvidence({ cutoff: now.toISOString(), goalies: [observation], lineups: [], conflicts: [] });
    const { forecasts } = buildForgeDailyBridgeForecasts({ ...inputs(), goalieNews }, players, games, now, 20262027, policy);
    const row = forecasts.find(row => row.playerId === "g2" && row.gameId === "1")!;
    expect(row.startProbability).toBeCloseTo(expected);
    expect(row.confirmedStart).toBe(expected === 1);
    expect(row.conditionalStats).toMatchObject({ SAVES_GOALIE: 25, GOALS_AGAINST_GOALIE: 2.5 });
    expect(row.stats.SAVES_GOALIE).toBeCloseTo(25 * expected);
    expect(row.stats.GOALS_AGAINST_GOALIE).toBeCloseTo(2.5 * expected);
    expect(forecasts.find(row => row.playerId === "g1" && row.gameId === "1")!.startProbability).toBeCloseTo(1 - expected);
  });

  it("moves future games to their opponent with FORGE's team-strength adjustment", () => {
    const base = inputs();
    // FORGE projected s1's 10-19 game against MTL; game 2 (10-21) is against a leakier defence.
    base.skaters = base.skaters.map(row => row.player_id === 101 && row.run_id === "r2" ? { ...row, opponent_team_id: 8 } : row);
    const opponentGames = games.map(game => game.id === "2" ? { ...game, opponent: "SJS" } : game.id === "1" ? { ...game, opponent: "MTL" } : game);
    const prior = (team_abbrev: string, xga_per_game: number, rows = 1) => Array.from({ length: rows }, (_, index) =>
      ({ team_abbrev, date: "2026-10-19", games_played: 50, xga: index ? 999 : 50 * xga_per_game, xga_per_game, xgf_per_game: 3 }));
    // TOR has an extra non-matching row, as the live table does; the season-to-date row is still chosen.
    const teamPriors = [...prior("TOR", 2.9, 2), ...prior("MTL", 2.6), ...prior("SJS", 3.5)];
    const { forecasts, limitations } = buildForgeDailyBridgeForecasts({ ...base, teamPriors }, players, opponentGames, now, 20262027, policy);
    const s1 = (gameId: string) => forecasts.find(row => row.playerId === "s1" && row.gameId === gameId)!.stats;
    expect(s1("1").GOALS).toBe(0.35);
    expect(s1("2").GOALS!).toBeGreaterThan(0.35);
    expect(s1("2").HITS).toBe(s1("1").HITS);
    expect(limitations.some(line => line.startsWith("Future games move each FORGE line to that game's opponent"))).toBe(true);
    expect(buildForgeDailyBridgeForecasts(base, players, opponentGames, now, 20262027, policy).forecasts
      .find(row => row.playerId === "s1" && row.gameId === "2")!.stats.GOALS).toBe(0.35);
  });

  it("blends last season into thin early-season team priors, strengthening the opponent effect", () => {
    const base = inputs();
    base.skaters = base.skaters.map(row => row.player_id === 101 && row.run_id === "r2" ? { ...row, opponent_team_id: 8 } : row);
    const opponentGames = games.map(game => game.id === "2" ? { ...game, opponent: "SJS" } : game.id === "1" ? { ...game, opponent: "MTL" } : game);
    // Nine games in: tiny xGA totals, so FORGE's sample weight keeps the adjustment small.
    const early = (team_abbrev: string, xga_per_game: number) => ({ team_abbrev, date: "2026-10-19", games_played: 9, xga: 9 * xga_per_game, xga_per_game, xgf_per_game: 3 });
    const teamPriors = [early("TOR", 2.9), early("MTL", 2.6), early("SJS", 3.5)];
    const lastSeasonTeams = [["TOR", 2.9], ["MTL", 2.6], ["SJS", 3.6]].map(([team_abbreviation, perGame]) =>
      ({ team_abbreviation, season: 20252026, situation: "all", gp: 70, xga: 70 * Number(perGame), xgf: 70 * 3 }));
    const goals = (extra: object) => buildForgeDailyBridgeForecasts({ ...base, teamPriors, ...extra }, players, opponentGames, now, 20262027, policy)
      .forecasts.find(row => row.playerId === "s1" && row.gameId === "2")!.stats.GOALS!;
    expect(goals({ lastSeasonTeams }) - 0.35).toBeGreaterThan(goals({}) - 0.35);
    expect(goals({ lastSeasonTeams })).toBeGreaterThan(0.35);
  });

  it("re-aims home ice and rest with FORGE's rest model, and thins the starter's chance on a back-to-back", () => {
    const base = inputs();
    // FORGE projected 10-19 at home on two days' rest; 10-21 is away, the second night of a back-to-back.
    const teamGames = [{ id: 0, date: "2026-10-17", homeTeamId: 10, awayTeamId: 8 }, { id: 1, date: "2026-10-19", homeTeamId: 10, awayTeamId: 8 },
      { id: 7, date: "2026-10-20", homeTeamId: 10, awayTeamId: 8 }, { id: 2, date: "2026-10-21", homeTeamId: 8, awayTeamId: 10 }];
    const build = (extra: object) => buildForgeDailyBridgeForecasts({ ...base, ...extra }, players, games, now, 20262027, policy).forecasts;
    const rested = build({}), tired = build({ teamGames });
    const stat = (rows: typeof rested, id: string, gameId: string) => rows.find(row => row.playerId === id && row.gameId === gameId)!;
    expect(stat(tired, "s1", "1").stats.GOALS).toBe(0.35);
    expect(stat(tired, "s1", "2").stats.GOALS!).toBeLessThan(stat(rested, "s1", "2").stats.GOALS!);
    expect(stat(tired, "s1", "2").stats.POINTS).toBeCloseTo(stat(tired, "s1", "2").stats.GOALS! + stat(tired, "s1", "2").stats.ASSISTS!, 3);
    // Usual starter (70% share) keeps 55% of it on the second night; the backup picks up the rest.
    expect(stat(tired, "g1", "2").startProbability).toBeCloseTo(0.385, 3);
    expect(stat(tired, "g2", "2").startProbability).toBeCloseTo(0.615, 3);
  });

  it("reads each opponent's tilt toward forwards or defencemen against the league share, shrunk", () => {
    const allowed = (opponent: string, dPoints: number) => [
      { season_id: 20262027, opponent, position_group: "F", games: 60, points: (3 - dPoints) * 60, shots: 20 * 60 },
      { season_id: 20262027, opponent, position_group: "D", games: 60, points: dPoints * 60, shots: 8 * 60 }];
    // League D share is 30% of points; SJS gives defencemen 35%, MTL 25%.
    const tilts = opponentTilts([...allowed("SJS", 1.05), ...allowed("MTL", 0.75), ...allowed("TOR", 0.9)], 20262027);
    expect(tilts.get("SJS|D")!.points).toBeGreaterThan(1);
    expect(tilts.get("SJS|F")!.points).toBeLessThan(1);
    expect(tilts.get("MTL|D")!.points).toBeLessThan(1);
    // 60 games against 30 of shrinkage keeps two thirds of the raw tilt, inside the ±15% clamp.
    expect(tilts.get("SJS|D")!.points).toBeCloseTo(1 + (0.35 / 0.3 - 1) * 60 / 90, 3);
    // An extreme tilt is clamped to ±15%.
    expect(opponentTilts([...allowed("SJS", 2.4), ...allowed("MTL", 0.3), ...allowed("TOR", 0.3)], 20262027).get("SJS|D")!.points).toBe(1.15);
    expect(tilts.get("TOR|D")!.points).toBeCloseTo(1, 3);
    expect(opponentTilts([], 20262027).size).toBe(0);
  });

  it("re-aims a skater line by the opponent's positional tilt", () => {
    const base = inputs();
    base.skaters = base.skaters.map(row => row.player_id === 101 && row.run_id === "r2" ? { ...row, opponent_team_id: 8 } : row);
    const opponentGames = games.map(game => game.id === "2" ? { ...game, opponent: "SJS" } : game.id === "1" ? { ...game, opponent: "MTL" } : game);
    const allowed = (opponent: string, dPoints: number) => [
      { season_id: 20262027, opponent, position_group: "F", games: 60, points: (3 - dPoints) * 60, shots: 20 * 60 },
      { season_id: 20262027, opponent, position_group: "D", games: 60, points: dPoints * 60, shots: 8 * 60 }];
    const positionAllowed = [...allowed("SJS", 1.2), ...allowed("MTL", 0.6), ...allowed("TOR", 0.9)];
    const goals = (extra: object) => buildForgeDailyBridgeForecasts({ ...base, ...extra }, players, opponentGames, now, 20262027, policy)
      .forecasts.find(row => row.playerId === "s1" && row.gameId === "2")!.stats.GOALS!;
    // s1 is a centre: MTL feeds forwards, SJS feeds defencemen, so his line drops for the SJS game.
    expect(goals({ positionAllowed })).toBeLessThan(goals({}));
  });

  it("serves FORGE's paired team win probability, kept apart from each goalie's unconditional wins", () => {
    const base: ForgeDailyBridgeInputs = inputs();
    // Pre-7.2 rows are not paired (0.55 + 0.40): a game with both teams' rows is normalised to sum to 1.
    base.goalies = [{ ...base.goalies[0], opponent_team_id: 8 }, { ...base.goalies[0], goalie_id: 301, team_id: 8, opponent_team_id: 10,
      starter_probability: 0.9, proj_win_prob: 0.4 }];
    const { forecasts, teamWins, limitations } = buildForgeDailyBridgeForecasts(base, players, games, now, 20262027, policy);
    // Team population: one probability per team-game, denominator the team's games.
    expect(teamWins).toEqual([{ gameId: "1", team: "TOR", probability: 0.55 / 0.95, source: "forge" }]);
    // Goalie population: per-start W is the decision share of the team's wins; expected W adds his start chance.
    const goalie = (id: string, gameId: string) => forecasts.find(row => row.playerId === id && row.gameId === gameId)!;
    for (const id of ["g1", "g2"]) expect(goalie(id, "1").conditionalStats!.WINS_GOALIE).toBeCloseTo(STARTER_DECISION_SHARE * 0.55 / 0.95, 4);
    const teamGoalieWins = goalie("g1", "1").stats.WINS_GOALIE! + goalie("g2", "1").stats.WINS_GOALIE!;
    expect(goalie("g1", "1").startProbability! + goalie("g2", "1").startProbability!).toBeCloseTo(1, 4);
    expect(teamGoalieWins).toBeCloseTo(STARTER_DECISION_SHARE * 0.55 / 0.95, 3);
    // Game 2 is not projected and this fixture has no team-strength priors: wins stay unknown, never 0.5.
    expect(goalie("g1", "2").stats.WINS_GOALIE).toBeNull();
    expect(goalie("g1", "2").conditionalStats!.WINS_GOALIE).toBeNull();
    expect(goalie("g1", "2").stats.SAVES_GOALIE).not.toBeNull();
    expect(limitations).toContain("2 goalie-games have no team win probability (FORGE left it blank, or a team-strength prior is missing), so their wins are unknown.");
  });

  it("pairs a one-sided game and moves unprojected games to FORGE's win model, both teams summing to 1", () => {
    const prior = (team_abbrev: string, xga_per_game: number, xgf_per_game: number) =>
      ({ team_abbrev, date: "2026-10-19", games_played: 50, xga: 50 * xga_per_game, xga_per_game, xgf_per_game });
    const teamPriors = [prior("TOR", 2.9, 3.2), prior("MTL", 3.3, 2.7)];
    const g3 = member("g3", 203, "MTL", 8, "goalie");
    // TOR's goalies have only an older line; only MTL's FORGE row exists for game 1; game 5 (TOR at MTL) is unprojected.
    const paired = [game("1", "TOR", "2026-10-19T23:00:00Z"), game("5", "TOR", "2026-10-23T23:00:00Z"), game("5", "MTL", "2026-10-23T23:00:00Z")]
      .map(row => ({ ...row, opponent: row.teamAbbreviation === "TOR" ? "MTL" : "TOR" }));
    const base: ForgeDailyBridgeInputs = inputs();
    base.goalies = [{ ...base.goalies[0], run_id: "r1", as_of_date: "2026-10-18", game_id: 0, opponent_team_id: 8 },
      { ...base.goalies[0], goalie_id: 203, team_id: 8, opponent_team_id: 10, proj_win_prob: 0.4 }];
    base.goalieShares = [...base.goalieShares, { player_id: 203, team_id: 8, game_id: 2026020005, game_date: "2026-10-23", l10_start_pct: 1, season_start_pct: 1, updated_at: "2026-10-19T10:00:00Z" }];
    const { teamWins, forecasts } = buildForgeDailyBridgeForecasts({ ...base, teamPriors }, [...players, g3], paired, now, 20262027, policy);
    const win = (gameId: string, team: string) => teamWins.find(row => row.gameId === gameId && row.team === team);
    expect(win("1", "TOR")).toEqual({ gameId: "1", team: "TOR", probability: 1 - 0.4 / STARTER_DECISION_SHARE, source: "forge_paired" });
    const priors = teamStrengthPriors(teamPriors), tor = priors.get("TOR")!, mtl = priors.get("MTL")!;
    const torGoals = (tor.xgfPerGame! + mtl.xgaPerGame!) / 2, mtlGoals = (mtl.xgfPerGame! + tor.xgaPerGame!) / 2;
    expect(win("5", "TOR")).toEqual({ gameId: "5", team: "TOR", probability: teamWinProbability(torGoals, mtlGoals), source: "forge_model" });
    expect(win("5", "TOR")!.probability + win("5", "MTL")!.probability).toBeCloseTo(1, 12);
    expect(forecasts.find(row => row.playerId === "g3" && row.gameId === "5")!.conditionalStats!.WINS_GOALIE)
      .toBeCloseTo(STARTER_DECISION_SHARE * win("5", "MTL")!.probability, 4);
  });

  it("keeps the ledger's legacy xG win chance, which bridge forecasts no longer use", () => {
    const even = { source: "nhl_team_data" as const, sourceDate: null, xga: 90, xgaPerGame: 3, xgfPerGame: 3 };
    expect(ledgerTeamWin(even, even, true)).toBeGreaterThan(0.52);
    expect(ledgerTeamWin(even, even, true)).toBeLessThan(0.56);
    expect(ledgerTeamWin(even, even, false)).toBeCloseTo(1 - ledgerTeamWin(even, even, true), 2);
    expect(ledgerTeamWin({ ...even, xgfPerGame: 3.6, xgaPerGame: 2.6 }, even, false)).toBeGreaterThan(ledgerTeamWin(even, even, false) + 0.05);
    expect(ledgerTeamWin(undefined, even, true)).toBe(0.5);
  });

  it("produces forecasts the planner accepts for league points", async () => {
    // Season totals give s1 a faceoff rate, so every weighted skater stat has an input: (50 + 0.5 × 600) / (10 + 0.5 × 80) = 7.
    const seasonTotals = [{ player_id: 101, season: "20262027", games_played: 10, penalty_minutes: 0, plus_minus: 0, sh_goals: 0,
      sh_assists: 0, sh_points: 0, total_fow: 50, total_fol: 40, goals: 4, gw_goals: 0 }, { player_id: 101, season: "20252026",
      games_played: 80, penalty_minutes: 0, plus_minus: 0, sh_goals: 0, sh_assists: 0, sh_points: 0, total_fow: 600, total_fol: 500, goals: 20, gw_goals: 0 }];
    // Team-strength priors give g1's unprojected game 2 a win probability from FORGE's win model.
    const teamPriors = [{ team_abbrev: "TOR", date: "2026-10-19", games_played: 50, xga: 145, xga_per_game: 2.9, xgf_per_game: 3.2 },
      { team_abbrev: "X", date: "2026-10-19", games_played: 50, xga: 150, xga_per_game: 3, xgf_per_game: 3 }];
    const priors = teamStrengthPriors(teamPriors), tor = priors.get("TOR")!, x = priors.get("X")!;
    const gameTwoWin = Math.round(STARTER_DECISION_SHARE * teamWinProbability((tor.xgfPerGame! + x.xgaPerGame!) / 2,
      (x.xgfPerGame! + tor.xgaPerGame!) / 2) * 10000) / 10000;
    const { forecasts } = buildForgeDailyBridgeForecasts({ ...inputs(), seasonTotals, teamPriors }, players, games, now, 20262027, policy);
    const upcoming = games.filter(row => row.date >= "2026-10-19");
    const { wire } = compactBridgeForecasts(forecasts, { players, games: upcoming }, 20262027);
    const revisions = [...new Set(forecasts.map(row => row.revisionId))].sort();
    // The bridge is only admitted through a current read whose manifest names its revisions.
    const data: PlanningData = { players, games: upcoming, forecasts: [], baselineSources: [], participationSources: [],
      evidence: { schedule: { source: "fixture", asOf: now.toISOString(), seasonId: 20262027, completeness: "complete", limitations: [] } },
      forecastManifest: { version: "planning-forecasts-v1", id: "current-read", seasonId: 20262027, asOf: now.toISOString(),
        scheduleRevision: "schedule", rosterRevision: "roster", issuedRevisionIds: revisions, baselineChecksum: null,
        requiredOpportunities: forecasts.length, forecastedOpportunities: forecasts.length, exclusionCounts: {},
        rsoUsePolicy: { version: "rso-target-use-v1", revision: currentRsoUsePolicy().revision, bridgeRevisionIds: revisions } } };
    const snapshot: PlanningSnapshot = { id: "snap", context: { provider: "manual", seasonId: 20262027, leagueId: "l", teamId: "t",
      startDate: "2026-10-19", endDate: "2026-10-25", timeZone: "UTC", asOf: now.toISOString() },
      players, games: upcoming, forecasts, roster: [], lockedAssignments: [], realized: {}, opponent: null,
      rules: { lineupMode: "daily", rosterSlots: { C: 1, G: 1, BN: 1 }, acquisitionTiming: "next_day", acquisitionCost: 1, periods: [],
        scoring: { mode: "points", weights: { GOALS: 3, ASSISTS: 2, PP_POINTS: 1, SHOTS_ON_GOAL: 0.5, FACEOFFS_WON: 0.1, SAVES_GOALIE: 0.2, WINS_GOALIE: 4 }, categories: [] },
        goalieMinimum: { required: null, credited: null, counts: "unknown", penalty: "none" }, unsupported: [] },
      evidence: { schedule: { source: "fixture", asOf: now.toISOString(), seasonId: 20262027, completeness: "complete", limitations: [] } } };
    // Literal rows carry no current-read authority, so the planner withholds their value.
    expect(candidateHorizonPoints(snapshot).get("s1")).toBeNull();
    vi.useFakeTimers(); vi.setSystemTime(now);
    // A JSON round trip, as over HTTP: the bridge reuses one stats line across a skater's games, which the wire unshares.
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => ({ ok: true, json: async () => JSON.parse(JSON.stringify({
      success: true, data, bridgeForecasts: wire, read: {
        nonce: (init.headers as Record<string, string>)["X-RSO-Read-Nonce"], evaluatedAt: now.toISOString() } })) }) as Response));
    try {
      const points = await withCurrentPlanningRead({ ...snapshot, forecasts: [] }, {}, currentRsoUsePolicy().revision,
        new AbortController().signal, (input, _data, readError) => { expect(readError).toBeNull(); return candidateHorizonPoints(input); });
      expect(points.get("s1")).toBeCloseTo(2 * (0.35 * 3 + 0.45 * 2 + 0.25 + 3.1 * 0.5 + 7 * 0.1));
      expect(points.get("g1")).toBeCloseTo(0.8 * (25 * 0.2 + 0.55 * 4) + 0.7 * (25 * 0.2 + gameTwoWin * 4), 3);
      expect(points.get("s2")).toBeNull();
    } finally { vi.useRealTimers(); vi.unstubAllGlobals(); }
  });

  it("preserves current bridge values when a Yahoo snapshot carries a Not Starting label", async () => {
    const { forecasts } = buildForgeDailyBridgeForecasts(inputs(), players, games, now, 20262027, policy);
    const upcoming = games.filter(row => row.date >= "2026-10-19");
    const { wire } = compactBridgeForecasts(forecasts, { players, games: upcoming }, 20262027);
    const revisions = [...new Set(forecasts.map(row => row.revisionId))].sort();
    const data: PlanningData = { players, games: upcoming, forecasts: [], baselineSources: [], participationSources: [],
      evidence: { schedule: { source: "fixture", asOf: now.toISOString(), seasonId: 20262027, completeness: "complete", limitations: [] } },
      forecastManifest: { version: "planning-forecasts-v1", id: "current-read", seasonId: 20262027, asOf: now.toISOString(),
        scheduleRevision: "schedule", rosterRevision: "roster", issuedRevisionIds: revisions, baselineChecksum: null,
        requiredOpportunities: forecasts.length, forecastedOpportunities: forecasts.length, exclusionCounts: {},
        rsoUsePolicy: { version: "rso-target-use-v1", revision: currentRsoUsePolicy().revision, bridgeRevisionIds: revisions } } };
    // g1 (FORGE: 0.8 to start game 1) is on the Yahoo roster marked Not Starting tonight; g2 is his only teammate.
    const marked = players.map(player => player.id === "g1" ? { ...player, availability: "rostered" as const,
      startingStatus: { source: "yahoo" as const, date: "2026-10-19", isStarting: false, observedAt: "2026-10-19T17:30:00.000Z" } } : player);
    const snapshot: PlanningSnapshot = { id: "snap", context: { provider: "yahoo", seasonId: 20262027, leagueId: "l", teamId: "t",
      startDate: "2026-10-19", endDate: "2026-10-25", timeZone: "UTC", asOf: now.toISOString() },
      players: marked, games: upcoming, forecasts: [], roster: [{ playerId: "g1", position: "active" }], lockedAssignments: [], realized: {}, opponent: null,
      rules: { lineupMode: "daily", rosterSlots: { G: 1, BN: 1 }, acquisitionTiming: "next_day", acquisitionCost: 1, periods: [],
        scoring: { mode: "points", weights: { SAVES_GOALIE: 0.2 }, categories: [] },
        goalieMinimum: { required: null, credited: null, counts: "unknown", penalty: "none" }, unsupported: [] },
      evidence: { schedule: { source: "fixture", asOf: now.toISOString(), seasonId: 20262027, completeness: "complete", limitations: [] } } };
    vi.useFakeTimers(); vi.setSystemTime(now);
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => ({ ok: true, json: async () => JSON.parse(JSON.stringify({
      success: true, data, bridgeForecasts: wire, read: {
        nonce: (init.headers as Record<string, string>)["X-RSO-Read-Nonce"], evaluatedAt: now.toISOString() } })) }) as Response));
    const read = (input: PlanningSnapshot) => withCurrentPlanningRead(input, {}, currentRsoUsePolicy().revision, new AbortController().signal,
      (current, _data, readError) => { expect(readError).toBeNull(); return { points: candidateHorizonPoints(current), rows: current.forecasts }; });
    try {
      const [yahoo, plain] = [await read(snapshot), await read({ ...snapshot, players })];
      const row = (rows: typeof forecasts, id: string, gameId: string) => rows.find(item => item.playerId === id && item.gameId === gameId)!;
      expect(row(yahoo.rows, "g1", "1")).toMatchObject({ startProbability: 0.8, confirmedStart: false, stats: { SAVES_GOALIE: 20 } });
      expect(row(yahoo.rows, "g2", "1").startProbability).toBe(0.2);
      expect(row(yahoo.rows, "g1", "2").startProbability).toBe(0.7);
      // Only the unchanged current server rows receive authority; serialized labels cannot change either goalie.
      expect(plain.points.get("g1")).toBeCloseTo(0.8 * 25 * 0.2 + 0.7 * 25 * 0.2);
      expect(yahoo.points.get("g1")).toBeCloseTo(plain.points.get("g1")!);
      expect(plain.points.get("g2")).toBeCloseTo(0.2 * 25 * 0.2 + 0.3 * 25 * 0.2);
      expect(yahoo.points.get("g2")).toBeCloseTo(plain.points.get("g2")!);
    } finally { vi.useRealTimers(); vi.unstubAllGlobals(); }
  });

  it.each([
    ["only off-release runs exist", [] as string[], []],
    ["a newer null or local run shares the released run's date", ["released"], []],
    // The daily h5 cron run is the newest succeeded run for the date.
    ["a newer released h5 run shares the released h1 run's date", ["released"],
      [{ run_id: "h5-run", as_of_date: "2026-10-19", created_at: "2026-10-19T17:00:00Z", git_sha: "abc", metrics: { horizon_games: 5 } }]],
  ])("reads no null-sha, local or h5 run when %s", async (_label, expected, extraRuns) => {
    const runRows: Record<string, any>[] = [
      { run_id: "null-run", as_of_date: "2026-10-19", created_at: "2026-10-19T15:00:00Z", git_sha: null },
      { run_id: "local-run", as_of_date: "2026-10-19", created_at: "2026-10-19T16:00:00Z", git_sha: "local:unknown" },
      ...(expected.length ? [{ run_id: "released", as_of_date: "2026-10-19", created_at: "2026-10-19T12:00:00Z", git_sha: "abc", metrics: { horizon_games: 1 } }] : []),
      ...extraRuns,
    ];
    const runIdReads: unknown[] = [];
    // Applies the forge_runs git_sha filters the reader sends; every other table is empty.
    const db = { from: (table: string) => {
      // Every run this test reads is proven; the fences under test are the run filters.
      let rows: Record<string, any>[] = table === "forge_runs" ? [...runRows]
        : table === "player_forecast_source_observations" ? runRows.map(row => provenSnapshotRow(row.run_id)) : [];
      const keep = (test: (sha: string | null) => boolean) => { rows = rows.filter(row => test(row.git_sha)); };
      const builder: any = {
        select: () => builder, eq: () => builder, gte: () => builder, lte: () => builder, abortSignal: () => builder,
        in: (column: string, values: unknown[]) => { if (column === "run_id") runIdReads.push(values); return builder; },
        order: (column: string, options?: { ascending?: boolean }) => {
          if (column === "created_at") rows.sort((a, b) => (a.created_at < b.created_at ? 1 : -1) * (options?.ascending === false ? 1 : -1));
          return builder;
        },
        not: (column: string, operator: string, value: unknown) => {
          if (column !== "git_sha") throw new Error(column);
          if (operator === "is" && value === null) keep(sha => sha !== null);
          else if (operator === "like" && value === "local:*") keep(sha => sha !== null && !sha.startsWith("local:"));
          else throw new Error(`${operator} ${value}`);
          return builder;
        },
        or: (expression: string) => {
          if (expression !== runHorizonFilter(1)) throw new Error(expression);
          rows = rows.filter(row => (row.metrics?.horizon_games ?? 1) === 1);
          return builder;
        },
        range: () => builder,
        then: (resolve: (value: unknown) => unknown) => Promise.resolve(resolve({ data: rows, count: rows.length, error: null })),
      };
      return builder;
    } };
    const result = await loadForgeDailyBridgeForecasts(db as never, players, games, now, 20262027, Date.now() + 5000, policy);
    expect(runIdReads).toEqual(expected.length ? [expected, expected] : []);
    if (!expected.length) expect(result.limitations[0]).toContain("no successful FORGE run");
  });

  describe("fitting the full response envelope in exact UTF-8 bytes", () => {
    const jsonUtf8Bytes = (value: unknown) => Buffer.byteLength(JSON.stringify(value), "utf8");
    const wireOf = (rows: number, limitations = ["Interim FORGE projection."]): BridgeForecastWire => ({
      version: "forge-daily-bridge-wire-v1", seasonId: 20262027, limitations,
      runs: [["forge-daily-bridge-v1:r", "forge-daily-bridge-v1:r", "forge-daily-bridge-v1:abc", "2026-10-19T12:00:00.000Z", "2026-10-19T12:00:00.000Z"]],
      rows: Array.from({ length: rows }, (_, index) => [`p${index}`, "2026020101", 0, "2026-10-20T23:00:00.000Z", { GOALS: 0.25, SHOTS: 2.5 }, null, false, null]) });
    const envelopeWith = (metadata: unknown) => (wire: BridgeForecastWire | null) => ({ success: true, data: metadata, ...(wire ? { bridgeForecasts: wire } : {}) });
    const rowsOnly = (wire: BridgeForecastWire) => wire.rows.reduce((sum, row) => sum + JSON.stringify(row).length + 1, 0);
    const expectMaximalTrim = (wire: BridgeForecastWire, envelope: ReturnType<typeof envelopeWith>, budget: number) => {
      const body = fitBridgeWire(wire, envelope, budget) as any;
      expect(jsonUtf8Bytes(body)).toBeLessThanOrEqual(budget);
      const kept = body.bridgeForecasts.rows.length;
      expect(kept).toBeGreaterThan(0);
      expect(body.bridgeForecasts.rows).toEqual(wire.rows.slice(0, kept));
      expect(body.bridgeForecasts.limitations).toEqual([...wire.limitations,
        `Interim projections were trimmed to the first ${kept} of ${wire.rows.length} player-games to fit the planning response; later games stay schedule-only.`]);
      // One more row would not have fit.
      const next = envelope({ ...wire, rows: wire.rows.slice(0, kept + 1), limitations: [...wire.limitations,
        `Interim projections were trimmed to the first ${kept + 1} of ${wire.rows.length} player-games to fit the planning response; later games stay schedule-only.`] });
      expect(jsonUtf8Bytes(next)).toBeGreaterThan(budget);
      return body;
    };

    it("counts envelope metadata and wire limitations that a row-only tally leaves out", () => {
      const wire = wireOf(60, Array.from({ length: 40 }, (_, index) => `Limitation ${index}: ${"metadata ".repeat(20)}`));
      const envelope = envelopeWith({ evidence: { forge: { limitations: Array.from({ length: 50 }, () => "evidence ".repeat(20)) } } });
      const budget = 20_000;
      expect(rowsOnly(wire)).toBeLessThan(budget);
      expect(jsonUtf8Bytes(envelope(wire))).toBeGreaterThan(budget);
      expectMaximalTrim(wire, envelope, budget);
    });

    it("measures non-ASCII names in UTF-8 bytes, not string length", () => {
      const wire = wireOf(80);
      const envelope = envelopeWith({ players: Array.from({ length: 30 }, (_, index) => ({ id: String(index), name: "Žigmund Pálffy Ståhlberg Łukasz ".repeat(4) })) });
      const budget = JSON.stringify(envelope(wire)).length;
      expect(jsonUtf8Bytes(envelope(wire))).toBeGreaterThan(budget);
      expectMaximalTrim(wire, envelope, budget);
    });

    it("keeps a full payload exactly at the limit and trims one byte past it", () => {
      const wire = wireOf(100), envelope = envelopeWith({ players: [{ name: "Örjan Lindström" }] });
      const exact = jsonUtf8Bytes(envelope(wire));
      expect(fitBridgeWire(wire, envelope, exact)).toEqual(envelope(wire));
      const body = expectMaximalTrim(wire, envelope, exact - 1);
      expect(expandBridgeForecasts(body.bridgeForecasts, { players: [], games: [] })).toEqual([]);
    });

    it("drops the bridge when no row fits, and rejects an envelope that cannot fit at all", () => {
      const wire = wireOf(5), envelope = envelopeWith({ players: [{ name: "Ведерников" }] });
      const bare = jsonUtf8Bytes(envelope(null));
      expect(fitBridgeWire(wire, envelope, bare)).toEqual(envelope(null));
      expect(fitBridgeWire(wire, envelope, bare - 1)).toBeNull();
      expect(fitBridgeWire(null, envelope, bare - 1)).toBeNull();
    });
  });
});
