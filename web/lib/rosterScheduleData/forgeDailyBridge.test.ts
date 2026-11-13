import { describe, expect, it, vi } from "vitest";
import { forecastCalendarPolicy, type AnyForecastCalendarPolicy } from "lib/player-forecasts/contributions";
import { candidateActivePoints, candidateHorizonPoints, forecastPointsReader, gameForecastPoints } from "lib/rosterScheduleOptimizer/planning";
import { withCurrentPlanningRead } from "lib/rosterScheduleOptimizer/currentPlanningRead";
import { currentRsoUsePolicy } from "lib/player-forecasts/rsoUsePolicy";
import type { PlanningData, PlanningGame, PlanningPlayer, PlanningSnapshot } from "lib/rosterScheduleOptimizer/planningTypes";
import { runHorizonFilter } from "lib/projections/releasedRunFence";
import { goalieWinPopulations, STARTER_DECISION_SHARE, teamWinProbability } from "lib/projections/goalie/goalieOutcomes";
import { buildGoalieCandidatesContract, type GoalieCandidateLine } from "lib/projections/goalie/goalieCandidates";
import { buildForgeDailyBridgeForecasts, FORGE_DAILY_BRIDGE_BYTE_BUDGET, FORGE_DAILY_BRIDGE_EXPANDED_BYTE_BUDGET, FORGE_DAILY_BRIDGE_SEASON_RATED, FORGE_DAILY_BRIDGE_VERSION, FORGE_RESERVE_EXPANDED_BYTE_BUDGET, loadForgeDailyBridgeForecasts, opponentTilts, teamStrengthPriors, teamWinProbability as ledgerTeamWin, type ForgeDailyBridgeInputs } from "./forgeDailyBridge";
import { league, now as weekNow, seasonId as weekSeasonId, type Shape } from "./forgeReservePayload.fixture";
import { bridgeRunProofs, compactBridgeForecasts, expandBridgeForecasts, fitBridgeWire, jsonUtf8Bytes, packPlanningSnapshots, RESERVE_FORECAST_NOTES, reserveCodeOf, unpackPlanningSnapshots, type BridgeForecastWire } from "./bridgeForecastWire";
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
/** A released per-candidate contract (forge_goalie_candidates_v1) as FORGE's goalie stage writes it: each candidate's own
 * line if he starts, his start probability, and credited Wins from FORGE's win populations. */
type Candidate = { goalieId: number; p: number; ifStarts?: Partial<GoalieCandidateLine>; creditedWin?: number | null };
const candidatesContract = (gameId: number, teamId: number, candidates: Candidate[], teamWin: number | null = 0.56, run = "r2") => {
  const lines = candidates.map(c => ({ ...c, line: { shotsAgainst: 27.5, saves: 25, goalsAllowed: 2.5, shutoutProbability: 0.05, modeledSavePct: 0.9091, ...c.ifStarts },
    credited: c.creditedWin === undefined ? 0.55 : c.creditedWin }));
  const wins = lines.every(c => c.credited !== null) ? goalieWinPopulations(lines.map(c => ({ goalieId: c.goalieId, startProbability: c.p,
    teamWinIfStarts: c.credited! / STARTER_DECISION_SHARE }))).goalies : null;
  return buildGoalieCandidatesContract({ gameId, teamId, teamWinProbability: teamWin, teamWinSource: "poisson_race",
    issuance: { run_id: run, as_of_date: "2026-10-19", issued_at: "2026-10-19T12:00:00Z", information_cutoff_at: null, starter_labels: null },
    candidates: lines.map((c, index) => ({ goalieId: c.goalieId, startProbability: c.p, startProbabilityStatus: "uncalibrated_model" as const,
      confirmationEvidenceIds: [], ifStarts: c.line, creditedWinIfStarts: c.credited, unconditionalCreditedWin: wins ? wins[index].unconditionalWin : null })) });
};
/** TOR's two candidates for a game (game 1 unless named): g1 (his own line) 0.8 and g2 (a different line of his own) 0.2. */
const torCandidates = (p1 = 0.8, p2 = 0.2, gameId = 1) => candidatesContract(gameId, 10, [{ goalieId: 201, p: p1 },
  { goalieId: 202, p: p2, ifStarts: { saves: 24.2, goalsAllowed: 3.3, shutoutProbability: 0.03, modeledSavePct: 0.88 }, creditedWin: 0.5 }]);
/** Adds the 10-19 run's contract for TOR's game 2 (production runs FORGE today..+6): g1 0.7, g2 0.3. */
const withGameTwo = <T extends { goalies: Record<string, any>[] }>(base: T): T => ({ ...base,
  goalies: [...base.goalies, { ...base.goalies[0], game_id: 2, goalie_candidates: torCandidates(0.7, 0.3, 2) }] });
const unconditional = (contract: ReturnType<typeof candidatesContract>, goalieId: number) => contract.rows.find(row => row.goalie_id === goalieId)!.unconditional;
const inputs = () => ({
  // The loader marks each run whose captured snapshot proves external fantasy inputs were excluded.
  runs: [{ run_id: "r1", as_of_date: "2026-10-18", created_at: "2026-10-18T12:00:00Z", git_sha: "abc", external_input_proven: true },
    { run_id: "r2", as_of_date: "2026-10-19", created_at: "2026-10-19T12:00:00Z", git_sha: "def", external_input_proven: true }],
  // s1 is in both runs; s2 only in the older one; s3's row is for a different team.
  skaters: [skater("r1", "2026-10-18", 0, 101, 10), skater("r2", "2026-10-19", 1, 101, 10), skater("r1", "2026-10-18", 0, 102, 10),
    skater("r2", "2026-10-19", 9, 103, 9)],
  goalies: [{ run_id: "r2", as_of_date: "2026-10-19", horizon_games: 1, game_id: 1, goalie_id: 201, team_id: 10, starter_probability: 0.8,
    proj_saves: 25, proj_goals_allowed: 2.5, proj_shots_against: 27.5, proj_win_prob: 0.55, proj_shutout_prob: 0.05,
    // The stored proj_* are the team's goalie slot; each goalie's own line and start chance are the candidate contract.
    goalie_candidates: torCandidates() as ReturnType<typeof candidatesContract> | null }],
});

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
    // Scratched from the latest run: a labelled unknown under his team's latest run (decisions 3, 47), no planning use,
    // his last line kept as "if he plays".
    const s2 = forecasts.filter(row => row.playerId === "s2");
    expect(s2.map(row => [row.gameId, reserveCodeOf(row), row.revisionId])).toEqual([["1", "skater:no_forge_line", `${FORGE_DAILY_BRIDGE_VERSION}:r2`],
      ["2", "skater:no_forge_line", `${FORGE_DAILY_BRIDGE_VERSION}:r2`]]);
    expect(s2.every(row => Object.values(row.stats).every(value => value === null) && row.conditionalStats?.GOALS === 0.35
      && Object.values(row.allowedUses!).every(use => use === false))).toBe(true);
    // Moved to a team with no proven FORGE run: still no forecast (nothing proves a 0 for his team).
    expect(forecasts.some(row => row.playerId === "s3")).toBe(false);
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
    expect(lines("s2")).toEqual([["1", `${FORGE_DAILY_BRIDGE_VERSION}:r2`], ["2", `${FORGE_DAILY_BRIDGE_VERSION}:r3`]]);
    // Game 2: r3 left him out, so he counts the labelled 0 there, not a re-aimed copy of r2's line.
    expect(reserveCodeOf(forecasts.find(row => row.playerId === "s2" && row.gameId === "2")!)).toBe("skater:no_forge_line");
    expect(limitations.some(line => line.includes("missing from their team's latest FORGE run"))).toBe(false);
    // s3's latest line is for another team.
    expect(limitations).toContain("1 skaters whose latest FORGE line is for a different team than their current one have no current FORGE line.");
    // Without r3's line for game 1, s2 has nothing issued for an upcoming game and counts as stale.
    expect(buildForgeDailyBridgeForecasts(inputs(), players, games, now, 20262027, policy).limitations)
      .toContain("1 skaters missing from their team's latest FORGE run have no current FORGE line (likely scratched, injured or moved).");
  });

  it("AF-05: withholds a lineup line missing one PK head and labels lines with no PK bucket", () => {
    const base = inputs();
    // s1's latest line (r2) models the penalty kill, but its PK goals head is blank: ES + PP is not his goals total.
    base.skaters = base.skaters.map(row => row.player_id === 101 && row.run_id === "r2"
      ? { ...row, proj_goals_pk: null, proj_assists_pk: 0.01, proj_shots_pk: 0.2 } as unknown as typeof row : row);
    const missing = buildForgeDailyBridgeForecasts(base, players, games, now, 20262027, policy);
    expect(missing.forecasts.some(row => row.playerId === "s1")).toBe(false);
    expect(missing.limitations).toContain("1 skaters have a FORGE line with blank even-strength goals, assists or shots, or a line that models the penalty kill with a blank penalty-kill head; such lines give no forecast.");
    // The same line with no PK bucket at all (ES holds all non-PP time) still serves, labelled.
    const plain = buildForgeDailyBridgeForecasts(inputs(), players, games, now, 20262027, policy);
    expect(plain.forecasts.find(row => row.playerId === "s1")!.stats.GOALS).toBe(0.35);
    expect(plain.limitations).toContain("Penalty kill not modelled for 1 skaters' lineup lines (written before FORGE's penalty-kill bucket, or for a team whose penalty-kill time FORGE could not model): their goals, assists, points and shots count even strength over all time outside the power play, at even-strength rates.");
    // The version marker decides: a row written under the PK contract ("even_strength") with all three PK heads blank
    // is withheld, never read as a pre-PK line; one marked "all_non_pp_time" serves as ES + PP, labelled.
    const marked = (es_definition: string) => { const data = inputs();
      data.skaters = data.skaters.map(row => row.player_id === 101 && row.run_id === "r2" ? { ...row, es_definition } : row);
      return buildForgeDailyBridgeForecasts(data, players, games, now, 20262027, policy); };
    expect(marked("even_strength").forecasts.some(row => row.playerId === "s1")).toBe(false);
    expect(marked("all_non_pp_time").forecasts.find(row => row.playerId === "s1")!.stats.GOALS).toBe(0.35);
  });

  it("names the coverage gaps: unknown heads, goalies with no start share, opponents with no team-strength prior", () => {
    const base = inputs();
    // s2's latest line has a blank even-strength head; s1 was projected against MTL and moves to SJS, neither with a prior.
    base.skaters.push({ ...skater("r2", "2026-10-19", 1, 102, 10), proj_goals_es: null } as unknown as ReturnType<typeof skater>);
    base.skaters = base.skaters.map(row => row.player_id === 101 && row.run_id === "r2" ? { ...row, opponent_team_id: 8 } : row);
    // The goalie line was projected against team 77, which has no abbreviation to look a prior up by.
    base.goalies = base.goalies.map(row => ({ ...row, opponent_team_id: 77 }));
    const opponentGames = games.map(game => game.id === "2" ? { ...game, opponent: "SJS" } : game.id === "1" ? { ...game, opponent: "MTL" } : game);
    const teamPriors = [{ team_abbrev: "TOR", date: "2026-10-19", games_played: 50, xga: 145, xga_per_game: 2.9, xgf_per_game: 3 }];
    const { forecasts, limitations } = buildForgeDailyBridgeForecasts({ ...base, teamPriors }, players, opponentGames, now, 20262027, policy);
    expect(forecasts.some(row => row.playerId === "s2")).toBe(false);
    expect(limitations).toContain("1 skaters have a FORGE line with blank even-strength goals, assists or shots, or a line that models the penalty kill with a blank penalty-kill head; such lines give no forecast.");
    expect(limitations.some(line => line.includes("power-play"))).toBe(false);
    // Game 2 has no candidate contract: start chance unknown, his own game-1 line moved as "if he starts" (AF-01).
    expect(reserveCodeOf(forecasts.find(row => row.playerId === "g2" && row.gameId === "2")!)).toBe("goalie:start_unknown");
    expect(limitations).toContain("1 team-games have no FORGE goalie-candidate contract (not projected yet, or projected before the contract), so goalie start chances there are unknown; a goalie's own latest line, moved to the game, is kept as his \"if he starts\" line and never counts.");
    expect(limitations).toContain("3 opponents have no team-strength prior, so lines projected against or moved to them skip the opponent adjustment.");
  });

  describe("goalie candidate contract (Astra AF-01, W1 P0 #20)", () => {
    const goalie = (forecasts: ReturnType<typeof buildForgeDailyBridgeForecasts>["forecasts"], id: string, gameId: string) =>
      forecasts.find(row => row.playerId === id && row.gameId === gameId)!;
    const withContract = (contract: ReturnType<typeof candidatesContract> | null, extra: Partial<ForgeDailyBridgeInputs> = {}) => {
      const base = inputs();
      base.goalies = base.goalies.map(row => ({ ...row, goalie_candidates: contract }));
      return buildForgeDailyBridgeForecasts({ ...base, ...extra }, players, games, now, 20262027, policy);
    };

    it("serves two candidates of one team their own distinct lines, start chances and unconditional values", () => {
      const contract = torCandidates();
      const { forecasts } = withContract(contract);
      const [g1, g2] = [goalie(forecasts, "g1", "1"), goalie(forecasts, "g2", "1")];
      expect([g1.startProbability, g2.startProbability]).toEqual([0.8, 0.2]);
      // Each "if he starts" line is his own candidate row, never the team's selected starter's (slot) line.
      expect(g1.conditionalStats).toMatchObject({ SAVES_GOALIE: 25, GOALS_AGAINST_GOALIE: 2.5, SHUTOUTS_GOALIE: 0.05, WINS_GOALIE: 0.55 });
      expect(g2.conditionalStats).toMatchObject({ SAVES_GOALIE: 24.2, GOALS_AGAINST_GOALIE: 3.3, SHUTOUTS_GOALIE: 0.03, WINS_GOALIE: 0.5 });
      expect(g2.conditionalStats!.SAVES_GOALIE).not.toBe(g1.conditionalStats!.SAVES_GOALIE);
      // Unconditional values are the contract's: P(start) × his line for counts; his credited Win includes his relief share.
      const row = (id: number) => contract.rows.find(candidate => candidate.goalie_id === id)!.unconditional;
      expect(g2.stats).toMatchObject({ SAVES_GOALIE: row(202).saves, GOALS_AGAINST_GOALIE: row(202).goals_allowed, SHOTS_AGAINST_GOALIE: row(202).shots_against,
        SHUTOUTS_GOALIE: row(202).shutout_prob, WINS_GOALIE: row(202).credited_win_prob, GAMES_STARTED: 0.2, LOSSES_GOALIE: null, OTL_GOALIE: null });
      expect(g1.stats.WINS_GOALIE).toBe(row(201).credited_win_prob);
      // Not team win × decision share: the team's win probability is served apart.
      expect(g1.stats.WINS_GOALIE).not.toBeCloseTo(0.8 * 0.56 * STARTER_DECISION_SHARE, 3);
      expect(reserveCodeOf(g1)).toBeNull();
      expect(reserveCodeOf(g2)).toBeNull();
    });

    it("leaves a goalie the contract does not list unknown, labelled, never on a teammate's line", () => {
      const { forecasts, limitations } = withContract(candidatesContract(1, 10, [{ goalieId: 201, p: 0.8 }]));
      const g2 = goalie(forecasts, "g2", "1");
      expect(g2.startProbability).toBeNull();
      expect(reserveCodeOf(g2)).toBe("goalie:start_unknown");
      expect(Object.values(g2.stats).every(value => value === null)).toBe(true);
      // No borrowed "if he starts" line: g1's 25 saves never appear on g2.
      expect(g2.conditionalStats).toBeUndefined();
      expect(g2.allowedUses).toMatchObject({ assignment: false, totals: false });
      expect(goalie(forecasts, "g1", "1").startProbability).toBe(0.8);
      expect(limitations).toContain("1 goalies are not among FORGE's start candidates for 1 team-games, so their start chance is unknown; only a line of their own, where FORGE has one, is kept as their \"if he starts\" line.");
    });

    it("keeps partial probability mass unassigned, never renormalising the listed goalies", () => {
      const contract = torCandidates(0.5, 0.3);
      expect(contract.unresolved_start_mass).toBeCloseTo(0.2, 6);
      const { forecasts, limitations } = withContract(contract);
      const [g1, g2] = [goalie(forecasts, "g1", "1"), goalie(forecasts, "g2", "1")];
      expect([g1.startProbability, g2.startProbability]).toEqual([0.5, 0.3]);
      expect(g1.stats.GAMES_STARTED! + g2.stats.GAMES_STARTED!).toBeCloseTo(0.8, 6);
      expect(g1.stats.SAVES_GOALIE).toBeCloseTo(0.5 * 25, 3);
      expect(limitations).toContain("1 team-games have goalie start chances that sum to less than 1; the rest stays unassigned, never spread over the listed goalies.");
    });

    it("treats a game no contract covers, and a pre-contract row, as unknown start chances with the goalie's own moved line", () => {
      // Game 2 has no contract: his own game-1 candidate line moves there as "if he starts" (its Win unknown), never counted.
      const g2 = goalie(withContract(torCandidates()).forecasts, "g2", "2");
      expect([g2.startProbability, reserveCodeOf(g2), g2.stats.SAVES_GOALIE]).toEqual([null, "goalie:start_unknown", null]);
      expect(g2.conditionalStats).toMatchObject({ SAVES_GOALIE: 24.2, WINS_GOALIE: null, LOSSES_GOALIE: null });
      // A pre-contract row's stored slot line is nobody's own line: neither goalie has a line, in either game.
      const legacy = withContract(null).forecasts;
      for (const [id, gameId] of [["g1", "1"], ["g2", "1"], ["g1", "2"], ["g2", "2"]]) {
        const row = goalie(legacy, id, gameId);
        expect([row.startProbability, reserveCodeOf(row), row.stats.SAVES_GOALIE, row.conditionalStats]).toEqual([null, "goalie:no_forge_line", null, undefined]);
      }
    });

    it("lets confirmed news settle the start, ruled-out news leave the freed chance unassigned, and floors scale others down only", () => {
      const news = (playerId: number, value: string) => ({ goalieNews: { conflicts: [], assertions: [{ gameId: 1, teamId: 10, playerId, dimension: "goalie" as const, value,
        evidenceId: "e", sourceKey: "gamedaygoalies", sourceUrl: null, publishedAt: "2026-10-19T15:00:00Z", receivedAt: "2026-10-19T15:00:01Z", confirmed: value === "confirmed" }] } });
      const confirmed = withContract(torCandidates(), news(202, "confirmed")).forecasts;
      expect(goalie(confirmed, "g2", "1")).toMatchObject({ startProbability: 1, confirmedStart: true });
      // Confirmed: his credited Win if he starts, under FORGE's own win populations; the other goalie 0.
      expect(goalie(confirmed, "g2", "1").stats.WINS_GOALIE).toBeCloseTo(0.5, 4);
      expect(goalie(confirmed, "g1", "1").stats).toMatchObject({ GAMES_STARTED: 0, SAVES_GOALIE: 0, WINS_GOALIE: 0 });
      const ruledOut = withContract(torCandidates(), news(201, "ruled_out"));
      expect([goalie(ruledOut.forecasts, "g1", "1").startProbability, goalie(ruledOut.forecasts, "g2", "1").startProbability]).toEqual([0, 0.2]);
      expect(ruledOut.limitations.some(line => line.startsWith("1 team-games have goalie start chances that sum to less than 1"))).toBe(true);
      const likely = withContract(torCandidates(0.5, 0.5), news(202, "likely")).forecasts;
      expect(goalie(likely, "g2", "1").startProbability).toBe(0.8);
      expect(goalie(likely, "g1", "1").startProbability).toBeCloseTo(0.2, 9);
    });

    it("reads the contract with each goalie row, and no last-10 start shares", async () => {
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
      expect(selects.get("forge_goalie_projections")?.split(",")).toContain("goalie_candidates:uncertainty->goalie_candidates");
      expect(selects.has("goalie_start_projections")).toBe(false);
      // AF-05: each lineup row's strength-accounting marker travels with it.
      expect(selects.get("forge_player_projections")?.split(",")).toContain("es_definition:uncertainty->model->skater_selection->strength_accounting->>es_definition");
    });
  });

  it("reads FORGE's per-row availability state: out is 0 for that game, uncertain or unknown is unknown (L9c, decision 132)", () => {
    const withState = (state?: string, gameId = 1) => {
      const base = inputs();
      base.skaters = base.skaters.map(row => row.player_id === 101 && row.run_id === "r2"
        ? { ...row, ...(state ? { availability_state: state, availability_game_id: String(gameId) } : {}) } : row);
      const { forecasts } = buildForgeDailyBridgeForecasts(base, players, games, now, 20262027, policy);
      return ["1", "2"].map(gameId => forecasts.find(row => row.playerId === "s1" && row.gameId === gameId)!)
        .map(row => ({ goals: row.stats.GOALS, code: reserveCodeOf(row), ifPlays: row.conditionalStats?.GOALS ?? null, totals: row.allowedUses?.totals }));
    };
    const line = { goals: 0.35, code: null, ifPlays: null, totals: true };
    // Older runs (no field) and a projected lineup read the line as today.
    expect(withState()).toEqual([line, line]);
    expect(withState("projected_lineup")).toEqual([line, line]);
    // Out for game 1: a real 0 there with his "if he plays" line kept; game 2 is unknown, never his full line.
    expect(withState("confirmed_out")).toEqual([{ goals: 0, code: "skater:roster_out", ifPlays: 0.35, totals: true },
      { goals: null, code: "skater:availability_unknown", ifPlays: 0.35, totals: false }]);
    // Day-to-day (no qualified participation chance) and unknown: unknown unconditional, line kept as "if he plays".
    expect(withState("uncertain").map(row => [row.goals, row.code, row.ifPlays, row.totals]))
      .toEqual([[null, "skater:availability_uncertain", 0.35, false], [null, "skater:availability_uncertain", 0.35, false]]);
    expect(withState("unknown").map(row => [row.goals, row.code])).toEqual([[null, "skater:availability_unknown"], [null, "skater:availability_unknown"]]);
  });

  it("keeps goalie regulation losses and OT losses unknown, never L = 1 − W (W1 P0 #28, decision 46)", () => {
    const { forecasts, limitations } = buildForgeDailyBridgeForecasts(inputs(), players, games, now, 20262027, policy);
    const g1 = forecasts.find(row => row.playerId === "g1" && row.gameId === "1")!;
    // If he starts: credited W 0.55 (his contract value). The other 0.45 is regulation L + OT/SO L + no decision;
    // with no fitted overtime split and Yahoo's L/OTL mapping unverified, neither L nor OTL is known.
    expect(g1.conditionalStats!.WINS_GOALIE).toBe(0.55);
    expect(g1.conditionalStats!.LOSSES_GOALIE).toBeNull();
    expect(g1.conditionalStats!.OTL_GOALIE).toBeNull();
    // Unconditional: his contract credited Win (start chance × 0.55 plus relief); L and OTL stay unknown rather than 0.8 × 0.45.
    const unconditionalWin = torCandidates().rows[0].unconditional.credited_win_prob!;
    expect(g1.stats.WINS_GOALIE).toBe(unconditionalWin);
    expect(g1.stats.LOSSES_GOALIE).toBeNull();
    expect(g1.stats.OTL_GOALIE).toBeNull();
    // Conservation: the known decision mass never exceeds the start probability (no mass invented for L).
    expect(g1.stats.WINS_GOALIE! + (g1.stats.LOSSES_GOALIE ?? 0) + (g1.stats.OTL_GOALIE ?? 0)).toBeLessThanOrEqual(g1.startProbability! + 1e-9);
    expect(limitations.some(text => text.startsWith("Goalie losses: regulation L and OT/SO L are unknown"))).toBe(true);
    // At the planner reader: a league scoring W reads the goalie's points; one scoring L reads them as unknown, not 1 − W.
    const snapshot = { players, forecasts, context: { asOf: now.toISOString() },
      rules: { scoring: { mode: "points", weights: { WINS_GOALIE: 5 }, categories: [] } } } as unknown as PlanningSnapshot;
    expect(forecastPointsReader(snapshot)("g1", "1")).toBeCloseTo(5 * unconditionalWin, 6);
    snapshot.rules.scoring.weights = { WINS_GOALIE: 5, LOSSES_GOALIE: -2 };
    expect(forecastPointsReader(snapshot)("g1", "1")).toBeNull();
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
      expect(buildForgeDailyBridgeForecasts(data, players, games, now, 20262027, policy)).toEqual({ forecasts: [], teamWins: [], runProofs: [],
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

    it("reads runs dated through seven days ahead, and lets a later run of a date supersede an earlier one", async () => {
      // Two proven runs of 10-21 (game 2): the one written later wins for that game.
      const runRows = [
        { run_id: "r-new", as_of_date: "2026-10-21", created_at: "2026-10-19T17:00:00Z", git_sha: "abc" },
        { run_id: "r-old", as_of_date: "2026-10-21", created_at: "2026-10-18T11:00:00Z", git_sha: "abc" },
      ];
      const { db, runIdReads } = proofDb(runRows, [provenSnapshotRow("r-new"), provenSnapshotRow("r-old")],
        [{ ...skater("r-new", "2026-10-21", 2, 101, 10), proj_goals_es: 0.5 }, { ...skater("r-old", "2026-10-21", 2, 101, 10), proj_goals_es: 0.1 }]);
      const windows: unknown[][] = [];
      const from = db.from;
      db.from = (table: string) => {
        const builder = from(table);
        if (table !== "forge_runs") return builder;
        const record: any = new Proxy(builder, { get: (target, property) => property === "gte" || property === "lte"
          ? (...args: unknown[]) => { windows.push([property, ...args]); return record; }
          : typeof target[property] === "function" ? (...args: unknown[]) => { const out = target[property](...args); return out === target ? record : out; }
          : target[property] });
        return record;
      };
      const result = await loadForgeDailyBridgeForecasts(db as never, players, games, now, 20262027, Date.now() + 5000, policy);
      expect(windows).toEqual(expect.arrayContaining([["gte", "as_of_date", "2026-10-12"], ["lte", "as_of_date", "2026-10-26"]]));
      expect(runIdReads).toEqual([["r-new"], ["r-new"]]);
      const s1 = result.forecasts.find(row => row.playerId === "s1" && row.gameId === "2");
      expect(s1).toMatchObject({ revisionId: `${FORGE_DAILY_BRIDGE_VERSION}:r-new`, stats: expect.objectContaining({ GOALS: 0.6 }) });
    });

    it("withholds an unproven future run: an older proven run of that date stands, and with none the date has no line", async () => {
      const runRows = [
        { run_id: "future-legacy", as_of_date: "2026-10-21", created_at: "2026-10-19T17:00:00Z", git_sha: "abc" },
        { run_id: "future-clean", as_of_date: "2026-10-21", created_at: "2026-10-18T11:00:00Z", git_sha: "abc" },
      ];
      const rows = [{ ...skater("future-legacy", "2026-10-21", 2, 101, 10), proj_goals_es: 0.9 }, skater("future-clean", "2026-10-21", 2, 101, 10)];
      const withProof = proofDb(runRows, [unprovenSnapshotRow("future-legacy"), provenSnapshotRow("future-clean")], rows);
      const served = await loadForgeDailyBridgeForecasts(withProof.db as never, players, games, now, 20262027, Date.now() + 5000, policy);
      expect(withProof.runIdReads).toEqual([["future-clean"], ["future-clean"]]);
      expect(new Set(served.forecasts.map(row => row.revisionId))).toEqual(new Set([`${FORGE_DAILY_BRIDGE_VERSION}:future-clean`]));
      const none = proofDb(runRows, [unprovenSnapshotRow("future-legacy"), unprovenSnapshotRow("future-clean")], rows);
      const empty = await loadForgeDailyBridgeForecasts(none.db as never, players, games, now, 20262027, Date.now() + 5000, policy);
      expect(empty.forecasts).toEqual([]);
      expect(empty.limitations[0]).toContain("no FORGE run in the last week can prove it excluded third-party fantasy projections (2 withheld)");
    });

    it("lets the day-of run supersede one written days ahead, before its lineups existed: the early lines never win", async () => {
      // Written on 10-16 for 10-21 (s2 then expected to dress); the day-of run of 10-21 has s1 only (s2 scratched).
      const runRows = [
        { run_id: "day-of", as_of_date: "2026-10-21", created_at: "2026-10-19T17:30:00Z", git_sha: "abc" },
        { run_id: "early", as_of_date: "2026-10-21", created_at: "2026-10-16T10:00:00Z", git_sha: "abc" },
      ];
      const { db, runIdReads } = proofDb(runRows, [provenSnapshotRow("day-of"), provenSnapshotRow("early")], [
        { ...skater("day-of", "2026-10-21", 2, 101, 10), proj_goals_es: 0.45 },
        { ...skater("early", "2026-10-21", 2, 101, 10), proj_goals_es: 0.05 }, skater("early", "2026-10-21", 2, 102, 10)]);
      const result = await loadForgeDailyBridgeForecasts(db as never, players, games, now, 20262027, Date.now() + 5000, policy);
      // Only the day-of run is read at all.
      expect(runIdReads).toEqual([["day-of"], ["day-of"]]);
      expect(result.forecasts.find(row => row.playerId === "s1" && row.gameId === "2")).toMatchObject({
        revisionId: `${FORGE_DAILY_BRIDGE_VERSION}:day-of`, stats: expect.objectContaining({ GOALS: 0.55 }) });
      // s2 was only in the superseded early run: no current line, so a labelled 0 with no "if he plays" line.
      expect(result.forecasts.filter(row => row.playerId === "s2").every(row => reserveCodeOf(row) === "skater:no_forge_line" && !row.conditionalStats)).toBe(true);
    });

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
      // The run's proof (as externalInputProof's runProofDiagnostics reports it) travels with the result for the wire.
      expect(served.runProofs).toEqual([{ runId: "clean", basis: "captured_snapshot", releaseSha: null, closureSha256: null }]);
      const failing = proofDb(runRows, []);
      const from = failing.db.from;
      failing.db.from = (table: string) => table === "player_forecast_source_observations"
        ? { select: () => ({ eq: () => ({ eq: () => ({ in: async () => ({ data: null, error: { message: "denied" } }) }) }) }) } as never : from(table);
      await expect(loadForgeDailyBridgeForecasts(failing.db as never, players, games, now, 20262027, Date.now() + 5000, policy)).rejects.toEqual({ message: "denied" });
    });
  });

  it("is empty with a plain reason when no run exists, and trims to the byte budget", () => {
    expect(buildForgeDailyBridgeForecasts({ runs: [], skaters: [], goalies: [] }, players, games, now, 20262027, policy))
      .toEqual({ forecasts: [], teamWins: [], runProofs: [], limitations: [expect.stringContaining("no successful FORGE run")] });
    // The budget counts compact wire bytes, the size the projections actually travel at.
    const trimmed = buildForgeDailyBridgeForecasts(withGameTwo(inputs()), players, games, now, 20262027, policy, 1000);
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
    const capped = buildForgeDailyBridgeForecasts(withGameTwo(inputs()), players, games, now, 20262027, policy, 1_000_000, 3000);
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

  it("applies accepted IFTTT goalie news over FORGE's candidate start chances", () => {
    const assertion = (gameId: number, playerId: number, value: string) => ({ gameId, teamId: 10, playerId, dimension: "goalie" as const, value,
      evidenceId: `e-${gameId}`, sourceKey: "gamedaygoalies", sourceUrl: null, publishedAt: "2026-10-19T15:00:00Z", receivedAt: "2026-10-19T15:00:01Z", confirmed: value === "confirmed" });
    const goalieNews = { assertions: [assertion(1, 202, "confirmed"), assertion(2, 202, "likely")], conflicts: [] };
    const { forecasts, limitations } = buildForgeDailyBridgeForecasts({ ...inputs(), goalieNews }, players, games, now, 20262027, policy);
    const goalie = (id: string, gameId: string) => forecasts.find(row => row.playerId === id && row.gameId === gameId)!;
    expect(goalie("g2", "1")).toMatchObject({ startProbability: 1, confirmedStart: true });
    expect(goalie("g1", "1")).toMatchObject({ startProbability: 0, confirmedStart: false });
    // Game 2 has no contract: the floor sets the named goalie's chance; his teammate's stays unknown, never 1 − 0.8.
    expect(goalie("g2", "2").startProbability).toBe(0.8);
    expect(goalie("g1", "2").startProbability).toBeNull();
    expect(reserveCodeOf(goalie("g1", "2"))).toBe("goalie:start_unknown");
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
    // g2's own candidate line, never the team starter's.
    expect(row.conditionalStats).toMatchObject({ SAVES_GOALIE: 24.2, GOALS_AGAINST_GOALIE: 3.3 });
    expect(row.stats.SAVES_GOALIE).toBeCloseTo(24.2 * expected);
    expect(row.stats.GOALS_AGAINST_GOALIE).toBeCloseTo(3.3 * expected);
    // A ruled-out goalie's chance is never handed to his teammate: it stays unassigned.
    expect(forecasts.find(row => row.playerId === "g1" && row.gameId === "1")!.startProbability).toBeCloseTo(status === "ruled_out" ? 0.8 : 1 - expected);
  });

  it("keeps SA = SV + GA when a goalie line is moved to a new opponent (BC W1-11 A re-aim, Astra PR1)", () => {
    const base = inputs();
    // FORGE projected g1's 10-19 game against MTL; game 2 (10-21) is against SJS, a stronger attack.
    base.goalies = base.goalies.map(row => ({ ...row, opponent_team_id: 8 }));
    const opponentGames = games.map(game => game.id === "2" ? { ...game, opponent: "SJS" } : game.id === "1" ? { ...game, opponent: "MTL" } : game);
    const prior = (team_abbrev: string, xga_per_game: number, xgf_per_game: number) =>
      ({ team_abbrev, date: "2026-10-19", games_played: 50, xga: 50 * xga_per_game, xga_per_game, xgf_per_game });
    const teamPriors = [prior("TOR", 2.9, 3), prior("MTL", 2.6, 2.4), prior("SJS", 3.5, 3.7)];
    const { forecasts } = buildForgeDailyBridgeForecasts({ ...base, teamPriors }, players, opponentGames, now, 20262027, policy);
    const g1 = forecasts.find(row => row.playerId === "g1" && row.gameId === "2")!;
    const line = g1.conditionalStats!;
    // Re-aimed: shots and goals against move by different factors.
    expect(line.SHOTS_AGAINST_GOALIE).not.toBe(27.5);
    expect(line.GOALS_AGAINST_GOALIE! / 2.5).not.toBeCloseTo(line.SHOTS_AGAINST_GOALIE! / 27.5, 3);
    expect(line.GOALS_AGAINST_GOALIE!).toBeLessThanOrEqual(line.SHOTS_AGAINST_GOALIE!);
    expect(line.SAVES_GOALIE! + line.GOALS_AGAINST_GOALIE! - line.SHOTS_AGAINST_GOALIE!).toBeCloseTo(0, 9);
    // No contract covers game 2, so the moved line is only his "if he starts" line: the unconditional values are unknown.
    expect(g1.stats.SAVES_GOALIE).toBeNull();
  });

  it("follows the calendar policy's date basis: v2 counts a late game by its NHL schedule date (decision 127)", () => {
    // TOR's 10-19 game starts 03:00Z on 10-20 (a late start). At 18:00Z on 10-19 with a one-day window, v1 (UTC days) puts
    // it at lead 1, outside; v2 uses its schedule date 10-19, lead 0, inside.
    const late = [game("1", "TOR", "2026-10-20T03:00:00Z")].map(row => ({ ...row, date: "2026-10-19" }));
    const s1 = (calendar: AnyForecastCalendarPolicy) => buildForgeDailyBridgeForecasts(inputs(), players, late, now, 20262027, calendar)
      .forecasts.filter(row => row.playerId === "s1").map(row => row.gameId);
    expect(s1(forecastCalendarPolicy(1, "forecast-calendar-v1"))).toEqual([]);
    expect(s1(forecastCalendarPolicy(1, "forecast-calendar-v2"))).toEqual(["1"]);
  });

  it("emits unrounded start probabilities, so a rounded-up group never exceeds 1 (W2-8 D2)", () => {
    const base = inputs();
    const g3 = member("g3", 203, "TOR", 10, "goalie");
    // Astra's .33337 / .33337 / .33326 group: rounding each to 4 decimals gives 1.0001, which the resolver rejects.
    base.goalies = base.goalies.map(row => ({ ...row, goalie_candidates: candidatesContract(1, 10, [{ goalieId: 201, p: 0.33337 }, { goalieId: 202, p: 0.33337 }, { goalieId: 203, p: 0.33326 }]) }));
    const { forecasts } = buildForgeDailyBridgeForecasts(base, [...players, g3], games, now, 20262027, policy);
    const group = forecasts.filter(row => row.gameId === "1" && ["g1", "g2", "g3"].includes(row.playerId));
    expect(group.map(row => row.startProbability)).toEqual([0.33337, 0.33337, 0.33326].map(value => expect.closeTo(value, 12)));
    const mass = group.reduce((sum, row) => sum + row.startProbability!, 0);
    expect(mass).toBeLessThanOrEqual(1 + 1e-12);
    // Through the wire too: the client rebuilds the same unrounded values.
    const { wire } = compactBridgeForecasts(forecasts, { players: [...players, g3], games }, 20262027);
    const rebuilt = expandBridgeForecasts(JSON.parse(JSON.stringify(wire)), { players: [...players, g3], games });
    expect(rebuilt.filter(row => row.gameId === "1" && row.playerId.startsWith("g")).reduce((sum, row) => sum + row.startProbability!, 0)).toBeLessThanOrEqual(1 + 1e-12);
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

  it("re-aims home ice and rest with FORGE's rest model, and never invents a goalie's start chance on a back-to-back", () => {
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
    // No contract covers the second night: start chances stay unknown, never a fixed back-to-back split of a share.
    expect([stat(tired, "g1", "2").startProbability, stat(tired, "g2", "2").startProbability]).toEqual([null, null]);
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

  // Decision 136: the tilt only redistributes. At the league's reference mix, D and F factors keep the team total
  // (share_D × f_D + share_F × f_F = 1), even when a clamp binds (the old mirror leaked to 0.95 here).
  it("conserves the team total after clamping, for points and shots (decision 136, Astra PR5B)", () => {
    const allowed = (opponent: string, dPoints: number, dShots: number) => [
      { season_id: 20262027, opponent, position_group: "F", games: 60, points: (3 - dPoints) * 60, shots: (28 - dShots) * 60 },
      { season_id: 20262027, opponent, position_group: "D", games: 60, points: dPoints * 60, shots: dShots * 60 }];
    const rows = [...allowed("SJS", 2.4, 20), ...allowed("MTL", 0.3, 4), ...allowed("TOR", 0.3, 4)];
    const tilts = opponentTilts(rows, 20262027);
    const reference = { points: (2.4 / 3 + 0.1 + 0.1) / 3, shots: (20 / 28 + 4 / 28 + 4 / 28) / 3 };
    for (const team of ["SJS", "MTL", "TOR"]) for (const stat of ["points", "shots"] as const) {
      const d = tilts.get(`${team}|D`)![stat], f = tilts.get(`${team}|F`)![stat], share = reference[stat];
      expect(share * d + (1 - share) * f, `${team} ${stat}`).toBeCloseTo(1, 12);
      for (const factor of [d, f]) { expect(factor).toBeGreaterThanOrEqual(0.85 - 1e-12); expect(factor).toBeLessThanOrEqual(1.15 + 1e-12); }
    }
    // The clamp still binds on SJS's defence side.
    expect(tilts.get("SJS|D")!.points).toBe(1.15);
    // Row order never changes a factor.
    expect(opponentTilts([...rows].reverse(), 20262027)).toEqual(tilts);
  });

  // W1-6 D19 (decision 136): FORGE never applied a positional tilt for the opponent it projected, so a moved line takes
  // the destination's tilt alone; it is never divided by the source opponent's.
  it("moves a line by the destination's tilt only, never dividing by one FORGE did not apply", () => {
    const base = inputs();
    base.skaters = base.skaters.map(row => row.player_id === 101 && row.run_id === "r2" ? { ...row, opponent_team_id: 8 } : row);
    const allowed = (opponent: string, dPoints: number) => [
      { season_id: 20262027, opponent, position_group: "F", games: 60, points: (3 - dPoints) * 60, shots: 20 * 60 },
      { season_id: 20262027, opponent, position_group: "D", games: 60, points: dPoints * 60, shots: 8 * 60 }];
    const positionAllowed = [...allowed("SJS", 1.2), ...allowed("MTL", 0.6), ...allowed("TOR", 0.9)];
    const sjsForwards = opponentTilts(positionAllowed, 20262027).get("SJS|F")!;
    const goals = (sourceOpponent: string) => buildForgeDailyBridgeForecasts({ ...base, positionAllowed }, players,
      games.map(game => game.id === "2" ? { ...game, opponent: "SJS" } : game.id === "1" ? { ...game, opponent: sourceOpponent } : game), now, 20262027, policy)
      .forecasts.find(row => row.playerId === "s1" && row.gameId === "2")!.stats.GOALS!;
    // No team-strength priors or schedule here, so only the tilt moves his 0.35 goals.
    expect(goals("MTL")).toBeCloseTo(0.35 * sjsForwards.points, 4);
    // A source opponent with no tilt data no longer blocks the destination's tilt.
    expect(goals("XXX")).toBeCloseTo(0.35 * sjsForwards.points, 4);
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

  it("serves FORGE's paired team win probability, kept apart from each goalie's credited wins", () => {
    const base: ForgeDailyBridgeInputs = inputs();
    // Each contract states its team's win probability; two runs' values (0.58 + 0.44) are normalised to sum to 1.
    const tor = candidatesContract(1, 10, [{ goalieId: 201, p: 0.8 }, { goalieId: 202, p: 0.2, creditedWin: 0.5 }], 0.58);
    const mtl = candidatesContract(1, 8, [{ goalieId: 301, p: 0.9 }], 0.44);
    base.goalies = [{ ...base.goalies[0], opponent_team_id: 8, goalie_candidates: tor },
      { ...base.goalies[0], goalie_id: 301, team_id: 8, opponent_team_id: 10, starter_probability: 0.9, proj_win_prob: 0.4, goalie_candidates: mtl }];
    const { forecasts, teamWins } = buildForgeDailyBridgeForecasts(base, players, games, now, 20262027, policy);
    // Team population: one probability per team-game, denominator the team's games.
    expect(teamWins).toEqual([{ gameId: "1", team: "TOR", probability: 0.58 / 1.02, source: "forge" }]);
    // Goalie population: each goalie's own credited Win from the contract, never the team probability × decision share.
    const goalie = (id: string, gameId: string) => forecasts.find(row => row.playerId === id && row.gameId === gameId)!;
    expect([goalie("g1", "1").conditionalStats!.WINS_GOALIE, goalie("g2", "1").conditionalStats!.WINS_GOALIE]).toEqual([0.55, 0.5]);
    expect([goalie("g1", "1").stats.WINS_GOALIE, goalie("g2", "1").stats.WINS_GOALIE]).toEqual([unconditional(tor, 201).credited_win_prob, unconditional(tor, 202).credited_win_prob]);
    // Game 2 has no contract: wins stay unknown, never 0.5 or a team-probability product.
    expect(goalie("g1", "2").stats.WINS_GOALIE).toBeNull();
    expect(goalie("g1", "2").conditionalStats!.WINS_GOALIE).toBeNull();
    // Pre-contract rows keep the slot-Win pairing (0.55 + 0.40).
    const legacy = buildForgeDailyBridgeForecasts({ ...base, goalies: base.goalies.map(row => ({ ...row, goalie_candidates: null })) }, players, games, now, 20262027, policy);
    expect(legacy.teamWins).toEqual([{ gameId: "1", team: "TOR", probability: 0.55 / 0.95, source: "forge" }]);
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
    // MTL's contract lists g3 but states no team win probability, so the slot row's Win is paired as before.
    base.goalies = [{ ...base.goalies[0], run_id: "r1", as_of_date: "2026-10-18", game_id: 0, opponent_team_id: 8, goalie_candidates: null },
      { ...base.goalies[0], goalie_id: 203, team_id: 8, opponent_team_id: 10, proj_win_prob: 0.4, goalie_candidates: candidatesContract(1, 8, [{ goalieId: 203, p: 1 }], null) }];
    const { teamWins, forecasts } = buildForgeDailyBridgeForecasts({ ...base, teamPriors }, [...players, g3], paired, now, 20262027, policy);
    const win = (gameId: string, team: string) => teamWins.find(row => row.gameId === gameId && row.team === team);
    expect(win("1", "TOR")).toEqual({ gameId: "1", team: "TOR", probability: 1 - 0.4 / STARTER_DECISION_SHARE, source: "forge_paired" });
    const priors = teamStrengthPriors(teamPriors), tor = priors.get("TOR")!, mtl = priors.get("MTL")!;
    const torGoals = (tor.xgfPerGame! + mtl.xgaPerGame!) / 2, mtlGoals = (mtl.xgfPerGame! + tor.xgaPerGame!) / 2;
    expect(win("5", "TOR")).toEqual({ gameId: "5", team: "TOR", probability: teamWinProbability(torGoals, mtlGoals), source: "forge_model" });
    expect(win("5", "TOR")!.probability + win("5", "MTL")!.probability).toBeCloseTo(1, 12);
    // No goalie Win is the team probability × decision share: g3 has no candidate line, so his game-5 Win is unknown.
    const g3Row = forecasts.find(row => row.playerId === "g3" && row.gameId === "5")!;
    expect([g3Row.stats.WINS_GOALIE, g3Row.conditionalStats?.WINS_GOALIE ?? null]).toEqual([null, null]);
  });

  it("joins nhl_team_data on its NST season once migration 129 adds it, and reads the old shape as before (W2-1 C2)", () => {
    // Current season lags a game (xga / per-game = 49 vs 50 GP); an old season row matches GP exactly.
    const current = { team_abbrev: "TOR", date: "2026-10-19", games_played: 50, xga: 147, xga_per_game: 3, xgf_per_game: 3.1, nst_season: 20262027 };
    const old = { team_abbrev: "TOR", date: "2026-10-19", games_played: 50, xga: 125, xga_per_game: 2.5, xgf_per_game: 2.8, nst_season: 20252026 };
    for (const rows of [[current, old], [old, current]]) expect(teamStrengthPriors(rows, [], 20262027).get("TOR")).toMatchObject({ xgaPerGame: 3, xgfPerGame: 3.1 });
    // No row for this season (or a null NST season): no prior, never last season's row.
    expect(teamStrengthPriors([old, { ...current, team_abbrev: "MTL", nst_season: null }], [], 20262027).size).toBe(0);
    // Pre-129 rows have no nst_season: the games-played inference stays.
    const legacy = [current, old].map(({ nst_season: _season, ...row }) => row);
    expect(teamStrengthPriors(legacy, [], 20262027).get("TOR")).toMatchObject({ xgaPerGame: 2.5 });
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
    const { forecasts } = buildForgeDailyBridgeForecasts(withGameTwo({ ...inputs(), seasonTotals }), players, games, now, 20262027, policy);
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
      // g1: each game's contract unconditional saves and credited Win.
      expect(points.get("g1")).toBeCloseTo([torCandidates(), torCandidates(0.7, 0.3, 2)]
        .reduce((sum, contract) => sum + unconditional(contract, 201).saves * 0.2 + unconditional(contract, 201).credited_win_prob! * 4, 0), 3);
      // No current FORGE line: unknown, never a fabricated 0 (decisions 3, 47 supersede TJ's option B).
      expect(points.get("s2")).toBeNull();
    } finally { vi.useRealTimers(); vi.unstubAllGlobals(); }
  });

  it("preserves current bridge values when a Yahoo snapshot carries a Not Starting label", async () => {
    const { forecasts } = buildForgeDailyBridgeForecasts(withGameTwo(inputs()), players, games, now, 20262027, policy);
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
      expect(row(yahoo.rows, "g2", "1").startProbability).toBeCloseTo(0.2, 12);
      expect(row(yahoo.rows, "g1", "2").startProbability).toBe(0.7);
      // Only the unchanged current server rows receive authority; serialized labels cannot change either goalie.
      expect(plain.points.get("g1")).toBeCloseTo(0.8 * 25 * 0.2 + 0.7 * 25 * 0.2);
      expect(yahoo.points.get("g1")).toBeCloseTo(plain.points.get("g1")!);
      expect(plain.points.get("g2")).toBeCloseTo(0.2 * 24.2 * 0.2 + 0.3 * 24.2 * 0.2);
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

describe("No FORGE line: labelled unknown (decisions 3, 47; supersedes TJ's option B 0)", () => {
  const withheldRun = { run_id: "r3", as_of_date: "2026-10-20", created_at: "2026-10-20T12:00:00Z", git_sha: "ghi", external_input_proven: false };
  const s2Rows = (extra: Partial<ForgeDailyBridgeInputs> = {}) => buildForgeDailyBridgeForecasts({ ...inputs(), ...extra }, players, games, now, 20262027, policy);

  it("keeps the last proven line as \"if he plays\", visible but never counted", () => {
    const { forecasts, limitations } = s2Rows();
    const rows = forecasts.filter(row => row.playerId === "s2");
    expect(rows.map(row => reserveCodeOf(row))).toEqual(["skater:no_forge_line", "skater:no_forge_line"]);
    for (const row of rows) {
      expect(row.conditionalStats).toMatchObject({ GOALS: 0.35, ASSISTS: 0.45 });
      // Every key unknown, season-rated ones included, and no planning use: the plan reads him as unknown, never 0.
      expect(Object.values(row.stats).every(value => value === null)).toBe(true);
      expect(row.allowedUses).toEqual({ assignment: false, totals: false, comparison: false, conditionalTieBreak: false });
      expect(row.appearanceProbability).toBeNull();
      expect(row.startProbability).toBeNull();
      expect(row.limitations.at(-1)).toBe(RESERVE_FORECAST_NOTES["skater:no_forge_line"]);
    }
    expect(limitations.some(text => text.startsWith("No FORGE line: 1 players (2 player-games)"))).toBe(true);
  });

  it("gives no 0 when a withheld run may hold his team's newer line, and says so", () => {
    // r3 (unproven, dated after the team's latest proven run) might list him: no forecast, never a masking 0.
    const withheld = s2Rows({ runs: [...inputs().runs, withheldRun] });
    expect(withheld.forecasts.some(row => row.playerId === "s2")).toBe(false);
    // s2, and s3 (whose new team has no proven run the withheld one might cover).
    expect(withheld.limitations).toContain("2 players have no proven FORGE line because a newer run for their team cannot prove it excluded third-party fantasy projections; they get no forecast rather than a 0.");
    // A real line is never affected.
    expect(withheld.forecasts.filter(row => row.playerId === "s1").every(row => reserveCodeOf(row) === null)).toBe(true);
    // When the schedule shows his team has no game on the withheld run's date, that run cannot hold his line: the 0 applies.
    const teamGames = [{ id: "1", date: "2026-10-19", homeTeamId: 10, awayTeamId: 99 }, { id: "2", date: "2026-10-21", homeTeamId: 10, awayTeamId: 99 },
      { id: "3", date: "2026-10-20", homeTeamId: 8, awayTeamId: 99 }];
    const elsewhere = s2Rows({ runs: [...inputs().runs, withheldRun], teamGames });
    expect(elsewhere.forecasts.filter(row => row.playerId === "s2").map(row => reserveCodeOf(row))).toEqual(["skater:no_forge_line", "skater:no_forge_line"]);
    // Every run withheld: schedule-only, as before.
    expect(s2Rows({ runs: inputs().runs.map(row => ({ ...row, external_input_proven: false })) }).forecasts).toEqual([]);
  });

  it("still counts a confirmed out as 0 and leaves players with real lines unchanged", () => {
    const before = s2Rows();
    const out = { gameId: 1, teamId: 10, playerId: 102, dimension: "availability" as const, value: "out", evidenceId: "e", sourceKey: "fixture",
      sourceUrl: null, publishedAt: "2026-10-19T15:00:00Z", receivedAt: "2026-10-19T15:00:00Z", confirmed: true };
    const after = s2Rows({ goalieNews: { assertions: [out], conflicts: [] } });
    const out1 = after.forecasts.find(row => row.playerId === "s2" && row.gameId === "1")!;
    // A confirmed out is a real 0 (W2-8 D3) that keeps his "if he plays" line; his other game stays unknown.
    expect(out1).toMatchObject({ stats: { GOALS: 0 }, conditionalStats: { GOALS: 0.35 }, appearanceProbability: 0 });
    expect(reserveCodeOf(out1)).toBe("skater:confirmed_out");
    expect(out1.allowedUses?.totals).toBe(true);
    expect(after.forecasts.find(row => row.playerId === "s2" && row.gameId === "2")!.stats.GOALS).toBeNull();
    const real = (rows: typeof before.forecasts) => JSON.stringify(rows.filter(row => !reserveCodeOf(row)));
    expect(real(after.forecasts)).toBe(real(before.forecasts));
  });
});

describe("FORGE run proofs on the bridge wire", () => {
  const proofOf = (runId: string) => ({ runId, basis: "verified_release" as const, releaseSha: "f".repeat(40), closureSha256: null });
  const withProofs = () => ({ ...inputs(), runs: inputs().runs.map(row => ({ ...row, proof: proofOf(row.run_id) })) });

  it("returns each served run's proof and carries it on the wire only for the runs the wire carries", () => {
    const result = buildForgeDailyBridgeForecasts(withProofs(), players, games, now, 20262027, policy);
    const served = new Set(result.forecasts.map(row => row.revisionId.split(":")[1]));
    expect(result.runProofs.map(proof => proof.runId).sort()).toEqual([...served].sort());
    const { wire } = compactBridgeForecasts(result.forecasts, { players, games }, 20262027, [...result.runProofs, proofOf("not-served")]);
    expect(bridgeRunProofs(JSON.parse(JSON.stringify(wire)))).toEqual(result.runProofs);
    // A malformed or missing list yields none and never touches the forecasts.
    expect(bridgeRunProofs({ ...wire, proofs: [{ runId: "", basis: "x" }, null, "x"] })).toEqual([]);
    expect(bridgeRunProofs(null)).toEqual([]);
    expect(expandBridgeForecasts(wire, { players, games })).toEqual(result.forecasts);
  });

  it("leaves everything else byte-identical: forecasts, limitations and wire apart from the proofs field", () => {
    const plain = buildForgeDailyBridgeForecasts(inputs(), players, games, now, 20262027, policy);
    const proven = buildForgeDailyBridgeForecasts(withProofs(), players, games, now, 20262027, policy);
    expect(plain.runProofs).toEqual([]);
    expect(JSON.stringify({ ...proven, runProofs: [] })).toBe(JSON.stringify(plain));
    const before = compactBridgeForecasts(plain.forecasts, { players, games }, 20262027);
    const after = compactBridgeForecasts(proven.forecasts, { players, games }, 20262027, proven.runProofs);
    const { proofs, ...rest } = after.wire!;
    expect(proofs).toHaveLength(proven.runProofs.length);
    expect(JSON.stringify(rest)).toBe(JSON.stringify(before.wire));
  });

  it("never lets a proof enter a workspace save", () => {
    const result = buildForgeDailyBridgeForecasts(withProofs(), players, games, now, 20262027, policy);
    const upcoming = games.filter(row => row.date >= "2026-10-19");
    const { wire } = compactBridgeForecasts(result.forecasts, { players, games: upcoming }, 20262027, result.runProofs);
    // The client rebuilds from the response wire, then saves its snapshot packed, as the workspace route does.
    const forecasts = expandBridgeForecasts(JSON.parse(JSON.stringify(wire)), { players, games: upcoming });
    const snapshot = { id: "snap", context: { seasonId: 20262027 }, players, games: upcoming, forecasts, roster: [], lockedAssignments: [], realized: {} };
    const saved = JSON.stringify(packPlanningSnapshots({ workspace: { version: 1 }, snapshot }));
    expect(saved).not.toContain("proofs");
    expect(saved).not.toContain("verified_release");
    expect(JSON.stringify(unpackPlanningSnapshots(JSON.parse(saved)))).not.toContain("verified_release");
    expect(JSON.stringify(forecasts)).not.toContain("verified_release");
  });
});

describe("FORGE reserve lines in the bridge", () => {
  const reserveSkater = (run: string, asOf: string, gameId: number, playerId: number, teamId: number, reason = "not_in_lineup") => {
    const { proj_goals_pk, proj_assists_pk, proj_shots_pk, proj_toi_pk_seconds, proj_pim, proj_plus_minus, ...row } = skater(run, asOf, gameId, playerId, teamId);
    return { ...row, player_class: "skater", conditioning: "if_dressed", reserve_reason: reason, proj_goals_es: 0.1, proj_assists_es: 0.12 };
  };
  const reserveGoalie = (run: string, asOf: string, gameId: number, playerId: number, teamId: number) => ({ run_id: run, as_of_date: asOf,
    horizon_games: 1, game_id: gameId, player_id: playerId, team_id: teamId, player_class: "goalie", conditioning: "if_starts",
    reserve_reason: "backup_goalie", proj_saves: 22, proj_goals_allowed: 3.1, proj_shots_against: 25.1, proj_shutout_prob: 0.03 });
  const lineupNews = (gameId: number, playerId: number, dimension: "ev" | "availability", value: string, confirmed: boolean) => ({
    gameId, teamId: 10, playerId, dimension, value, evidenceId: `e-${gameId}-${playerId}`, sourceKey: "fixture", sourceUrl: null,
    publishedAt: "2026-10-19T15:00:00Z", receivedAt: "2026-10-19T15:00:00Z", confirmed });
  const g3 = member("g3", 203, "TOR", 10, "goalie");
  const reserveInputs = (extra: Partial<ForgeDailyBridgeInputs> = {}): ForgeDailyBridgeInputs => ({ ...inputs(),
    goalieNews: { assertions: [], conflicts: [] },
    // s2 is out of r2's lineup and in its reserve; s1 is in r2's lineup, so a reserve row for him must never be used;
    // r1's reserve row for s2 is from an older run than his team's latest.
    reserves: [reserveSkater("r2", "2026-10-19", 1, 102, 10), reserveSkater("r2", "2026-10-19", 1, 101, 10),
      { ...reserveSkater("r1", "2026-10-18", 0, 102, 10), proj_goals_es: 9 }, reserveGoalie("r2", "2026-10-19", 1, 202, 10), reserveGoalie("r2", "2026-10-19", 1, 203, 10)],
    ...extra });
  const note = (forecast: { limitations: string[] }) => forecast.limitations.at(-1);
  const points = (stats: Record<string, number | null>) => stats.POINTS;

  it("gives a player outside the lineup his conditional line, counting 0 with a labelled unknown participation", () => {
    const { forecasts, limitations } = buildForgeDailyBridgeForecasts(reserveInputs(), players, games, now, 20262027, policy);
    const s2 = forecasts.filter(row => row.playerId === "s2");
    expect(s2.map(row => row.gameId)).toEqual(["1", "2"]);
    for (const row of s2) {
      expect(row.conditionalStats).toMatchObject({ GOALS: 0.2, ASSISTS: 0.27, POINTS: 0.47 });
      expect(Object.values(row.stats).every(value => value === null || value === 0)).toBe(true);
      expect(row.appearanceProbability).toBeNull();
      expect(row.startProbability).toBeNull();
      expect(note(row)).toBe(RESERVE_FORECAST_NOTES["skater:no_lineup_evidence"]);
      expect(row.revisionId).toBe(`${FORGE_DAILY_BRIDGE_VERSION}:r2`);
    }
    // The lineup line wins for s1: no reserve label and his own expectation.
    const s1 = forecasts.filter(row => row.playerId === "s1");
    expect(s1.every(row => reserveCodeOf(row) === null && points(row.stats)! > 0)).toBe(true);
    expect(limitations.some(text => text.startsWith("FORGE reserve lines: 1 skaters"))).toBe(true);
  });

  it("settles dressing only on confirmed news for that game, and names every other state", () => {
    const state = (news: ReturnType<typeof lineupNews>[], extra: Partial<ForgeDailyBridgeInputs> = {}) => {
      const { forecasts } = buildForgeDailyBridgeForecasts(reserveInputs({ goalieNews: { assertions: news, conflicts: [] }, ...extra }), players, games, now, 20262027, policy);
      const row = forecasts.find(item => item.playerId === "s2" && item.gameId === "1")!;
      return { code: reserveCodeOf(row), appearance: row.appearanceProbability, points: points(row.stats) };
    };
    expect(state([lineupNews(1, 102, "ev", "L4", true)])).toEqual({ code: "skater:confirmed_lineup", appearance: 1, points: 0.47 });
    expect(state([lineupNews(1, 102, "ev", "L4", false)])).toEqual({ code: "skater:projected_lineup", appearance: null, points: null });
    expect(state([lineupNews(1, 102, "availability", "out", true)])).toEqual({ code: "skater:confirmed_out", appearance: 0, points: 0 });
    expect(state([lineupNews(1, 102, "availability", "out", false)])).toEqual({ code: "skater:projected_scratch", appearance: null, points: null });
    expect(state([lineupNews(1, 102, "availability", "return", true)])).toEqual({ code: "skater:return_reported", appearance: null, points: null });
    expect(state([lineupNews(1, 102, "availability", "uncertain", false)])).toEqual({ code: "skater:uncertain", appearance: null, points: null });
    // News for another game does not carry over.
    expect(state([lineupNews(2, 102, "ev", "L4", true)]).code).toBe("skater:no_lineup_evidence");
    expect(state([], { goalieNews: undefined }).code).toBe("skater:evidence_unavailable");
    const conflicts = [{ gameId: 1, teamId: 10, playerId: 102, dimension: "ev", evidenceIds: ["a", "b"] }];
    const { forecasts } = buildForgeDailyBridgeForecasts(reserveInputs({ goalieNews: { assertions: [lineupNews(1, 102, "ev", "L4", true)], conflicts } }), players, games, now, 20262027, policy);
    expect(reserveCodeOf(forecasts.find(item => item.playerId === "s2" && item.gameId === "1")!)).toBe("skater:disputed");
    const ruledOut = buildForgeDailyBridgeForecasts(reserveInputs({ reserves: [reserveSkater("r2", "2026-10-19", 1, 102, 10, "ruled_out")] }), players, games, now, 20262027, policy);
    expect(reserveCodeOf(ruledOut.forecasts.find(item => item.playerId === "s2")!)).toBe("skater:ruled_out_at_run");
  });

  it("lets confirmed lineup news outrank an unconfirmed scratch report, in either order; a confirmed out still counts 0 (N2)", () => {
    const state = (news: ReturnType<typeof lineupNews>[]) => {
      const { forecasts } = buildForgeDailyBridgeForecasts(reserveInputs({ goalieNews: { assertions: news, conflicts: [] } }), players, games, now, 20262027, policy);
      const row = forecasts.find(item => item.playerId === "s2" && item.gameId === "1")!;
      return { code: reserveCodeOf(row), appearance: row.appearanceProbability, points: points(row.stats) };
    };
    const confirmedIn = lineupNews(1, 102, "ev", "L4", true), maybeIn = lineupNews(1, 102, "ev", "L4", false);
    const maybeOut = lineupNews(1, 102, "availability", "out", false), out = lineupNews(1, 102, "availability", "out", true);
    for (const news of [[maybeOut, confirmedIn], [confirmedIn, maybeOut]])
      expect(state(news)).toEqual({ code: "skater:confirmed_lineup", appearance: 1, points: 0.47 });
    for (const news of [[out, confirmedIn], [confirmedIn, out]])
      expect(state(news)).toEqual({ code: "skater:confirmed_out", appearance: 0, points: 0 });
    for (const news of [[maybeOut, maybeIn], [maybeIn, maybeOut]]) expect(state(news).code).toBe("skater:projected_scratch");
    // Of two availability reports, the confirmed one speaks: a confirmed return beside an unconfirmed out.
    const back = lineupNews(1, 102, "availability", "return", true);
    for (const news of [[maybeOut, back], [back, maybeOut]]) expect(state(news).code).toBe("skater:return_reported");
  });

  it("never puts a goalie on his team starter's line: one the contract does not list is unknown, labelled (AF-01 supersedes N4)", () => {
    // g3 is not among game 1's candidates and has no line of his own; g2 is a candidate with his own line.
    const noOwn = reserveInputs({ reserves: [reserveSkater("r2", "2026-10-19", 1, 102, 10)] });
    const { forecasts } = buildForgeDailyBridgeForecasts(noOwn, [...players, g3], games, now, 20262027, policy);
    const g2 = forecasts.find(row => row.playerId === "g2" && row.gameId === "1")!, g3Row = forecasts.find(row => row.playerId === "g3" && row.gameId === "1")!;
    expect(reserveCodeOf(g2)).toBeNull();
    expect(g2.conditionalStats).toMatchObject({ SAVES_GOALIE: 24.2 });
    expect(reserveCodeOf(g3Row)).toBe("goalie:start_unknown");
    expect(g3Row).toMatchObject({ startProbability: null, stats: { SAVES_GOALIE: null } });
    expect(g3Row.conditionalStats).toBeUndefined();
    // The team-line labels are never issued again (they stay readable for saved snapshots).
    expect(forecasts.some(row => ["goalie:team_line", "goalie:start_unknown_team_line"].includes(reserveCodeOf(row) ?? ""))).toBe(false);
    const { wire } = compactBridgeForecasts(forecasts, { players: [...players, g3], games }, 20262027);
    expect(expandBridgeForecasts(wire, { players: [...players, g3], games })).toEqual(forecasts);
  });

  it("uses each goalie's own reserve line; an unknown start chance stays unknown, never 0 starts", () => {
    const { forecasts } = buildForgeDailyBridgeForecasts(reserveInputs(), [...players, g3], games, now, 20262027, policy);
    const g2 = forecasts.find(row => row.playerId === "g2" && row.gameId === "1")!, g3Row = forecasts.find(row => row.playerId === "g3" && row.gameId === "1")!;
    // g2 is a contract candidate: his candidate line and start chance, not his reserve-pass line.
    expect(g2.conditionalStats).toMatchObject({ SAVES_GOALIE: 24.2, GOALS_AGAINST_GOALIE: 3.3 });
    expect(g2.startProbability).toBe(0.2);
    expect(reserveCodeOf(g2)).toBeNull();
    expect(g3Row).toMatchObject({ startProbability: null, confirmedStart: false, conditionalStats: { SAVES_GOALIE: 22, GAMES_STARTED: 1 },
      stats: { SAVES_GOALIE: null, GAMES_STARTED: null } });
    expect(g3Row.appearanceProbability).toBeUndefined();
    expect(note(g3Row)).toBe(RESERVE_FORECAST_NOTES["goalie:start_unknown"]);
    // The pass off: no reserve rows are read, so g3 has no line of his own: unknown where the contract omits him, "no FORGE
    // line" where no contract exists; s2 gets the "no FORGE line" unknown with his last line kept.
    const legacy = buildForgeDailyBridgeForecasts({ ...reserveInputs(), reserves: undefined }, [...players, g3], games, now, 20262027, policy);
    expect(new Set(legacy.forecasts.filter(row => row.playerId === "g3").map(reserveCodeOf))).toEqual(new Set(["goalie:start_unknown", "goalie:no_forge_line"]));
    expect(new Set(legacy.forecasts.filter(row => row.playerId === "s2").map(reserveCodeOf))).toEqual(new Set(["skater:no_forge_line"]));
  });

  it("says so when the reserve rows could not be read", () => {
    const { forecasts, limitations } = buildForgeDailyBridgeForecasts(reserveInputs({ reserves: null }), players, games, now, 20262027, policy);
    expect(forecasts.filter(row => row.playerId === "s2").every(row => reserveCodeOf(row) === "skater:no_forge_line")).toBe(true);
    expect(limitations).toContain("FORGE reserve lines could not be read, so players outside FORGE's projected lineups have no \"if he dresses\" line.");
  });

  it("keeps a strong reserve pickup among candidates with its conditional line, never adding that line to compared totals", async () => {
    // s2 is a reserve with a strong "if he dresses" line (2 goals, 1 assist a game); s1, a lineup skater, is rostered
    // with an open second C slot, so an added s2 would play every game.
    const strong = { ...reserveSkater("r2", "2026-10-19", 1, 102, 10), proj_goals_es: 2, proj_goals_pp: 0, proj_assists_es: 1, proj_assists_pp: 0 };
    const intent = { revision: 1, steps: [], protectedPlayerIds: [], excludedPlayerIds: [], goalieCoverage: "accept_risk" as const,
      goalieWindow: "any" as const, goalieSplit: "mon_wed" as const, alternativeCount: 5 as const, objective: "outcome" as const };
    const plan = async (news: ReturnType<typeof lineupNews>[]) => {
      const { forecasts } = buildForgeDailyBridgeForecasts(reserveInputs({ reserves: [strong], goalieNews: { assertions: news, conflicts: [] } }),
        players, games, now, 20262027, policy);
      const upcoming = games.filter(row => row.date >= "2026-10-19");
      const { wire } = compactBridgeForecasts(forecasts, { players, games: upcoming }, 20262027);
      const revisions = [...new Set(forecasts.map(row => row.revisionId))].sort();
      const data: PlanningData = { players, games: upcoming, forecasts: [], baselineSources: [], participationSources: [],
        evidence: { schedule: { source: "fixture", asOf: now.toISOString(), seasonId: 20262027, completeness: "complete", limitations: [] } },
        forecastManifest: { version: "planning-forecasts-v1", id: "current-read", seasonId: 20262027, asOf: now.toISOString(),
          scheduleRevision: "schedule", rosterRevision: "roster", issuedRevisionIds: revisions, baselineChecksum: null,
          requiredOpportunities: forecasts.length, forecastedOpportunities: forecasts.length, exclusionCounts: {},
          rsoUsePolicy: { version: "rso-target-use-v1", revision: currentRsoUsePolicy().revision, bridgeRevisionIds: revisions } } };
      const snapshot: PlanningSnapshot = { id: "snap", context: { provider: "manual", seasonId: 20262027, leagueId: "l", teamId: "t",
        startDate: "2026-10-19", endDate: "2026-10-25", timeZone: "UTC", asOf: now.toISOString() },
        players, games: upcoming, forecasts: [], roster: [{ playerId: "s1", position: "active" }], lockedAssignments: [], realized: {}, opponent: null,
        rules: { lineupMode: "daily", rosterSlots: { C: 2, BN: 1 }, acquisitionTiming: "next_day", acquisitionCost: 1, periods: [],
          scoring: { mode: "points", weights: { GOALS: 3, ASSISTS: 2 }, categories: [] },
          goalieMinimum: { required: null, credited: null, counts: "unknown", penalty: "none" }, unsupported: [] },
        evidence: { schedule: { source: "fixture", asOf: now.toISOString(), seasonId: 20262027, completeness: "complete", limitations: [] } } };
      vi.useFakeTimers(); vi.setSystemTime(now);
      vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => ({ ok: true, json: async () => JSON.parse(JSON.stringify({
        success: true, data, bridgeForecasts: wire, read: {
          nonce: (init.headers as Record<string, string>)["X-RSO-Read-Nonce"], evaluatedAt: now.toISOString() } })) }) as Response));
      try {
        return await withCurrentPlanningRead(snapshot, {}, currentRsoUsePolicy().revision, new AbortController().signal,
          (current, _data, readError) => { expect(readError).toBeNull();
            const horizon = candidateHorizonPoints(current);
            return { horizon, active: candidateActivePoints(current, intent, horizon), rows: current.forecasts }; });
      } finally { vi.useRealTimers(); vi.unstubAllGlobals(); }
    };
    const unknown = await plan([]);
    // Dressing unknown: his value is unknown (decisions 3, 47), never a fabricated 0 and never his 2-goal line.
    expect(unknown.horizon.get("s2")).toBeNull();
    expect(unknown.active.get("s2")).toBeNull();
    expect(unknown.horizon.get("s1")).toBeCloseTo(2 * (0.35 * 3 + 0.45 * 2));
    // The conditional line and its label reach the planner intact for the candidate card.
    const rows = unknown.rows.filter(row => row.playerId === "s2");
    expect(rows.map(row => row.gameId)).toEqual(["1", "2"]);
    for (const row of rows) {
      expect(row.conditionalStats).toMatchObject({ GOALS: 2, ASSISTS: 1, POINTS: 3 });
      expect(row.appearanceProbability).toBeNull();
      expect(reserveCodeOf(row)).toBe("skater:no_lineup_evidence");
    }
    // Control: once accepted news confirms him in both lineups, the same open slot credits his full line (2 x 8 points).
    const confirmed = await plan([lineupNews(1, 102, "ev", "L4", true), lineupNews(2, 102, "ev", "L4", true)]);
    expect(confirmed.horizon.get("s2")).toBeCloseTo(16);
    expect(confirmed.active.get("s2")).toBeCloseTo(16);
  });

  it("round-trips reserve rows through the compact wire exactly, and withholds all of them together when they do not fit", () => {
    const built = buildForgeDailyBridgeForecasts(reserveInputs(), [...players, g3], games, now, 20262027, policy);
    const { forecasts: left, wire } = compactBridgeForecasts(built.forecasts, { players: [...players, g3], games }, 20262027);
    expect(left).toEqual([]);
    expect(wire!.rows.filter(row => row.length === 9).length).toBe(built.forecasts.filter(row => reserveCodeOf(row)).length);
    expect(expandBridgeForecasts(wire, { players: [...players, g3], games })).toEqual(built.forecasts);
    // A response budget that fits the lineup rows but not the reserves drops every reserve row, not the late games.
    const envelope = (value: BridgeForecastWire | null) => ({ bridgeForecasts: value });
    const lineupOnly = { ...wire!, rows: wire!.rows.filter(row => row.length !== 9) };
    const fitted = fitBridgeWire(wire, envelope, JSON.stringify(envelope(lineupOnly)).length + 400)!;
    expect(fitted.bridgeForecasts!.rows).toEqual(lineupOnly.rows);
    expect(fitted.bridgeForecasts!.limitations.at(-1)).toMatch(/^FORGE reserve lines for \d+ player-games were withheld/);
    // The same rule in the bridge's own transport budget.
    const full = built.forecasts.reduce((sum, row) => sum + jsonUtf8Bytes(row) + 1, 0);
    const lineupBytes = built.forecasts.filter(row => !reserveCodeOf(row)).reduce((sum, row) => sum + jsonUtf8Bytes(row) + 1, 0);
    const tight = buildForgeDailyBridgeForecasts(reserveInputs(), [...players, g3], games, now, 20262027, policy, undefined, Math.floor((full + lineupBytes) / 2));
    expect(tight.forecasts.some(row => reserveCodeOf(row))).toBe(false);
    expect(tight.forecasts.length).toBe(built.forecasts.filter(row => !reserveCodeOf(row)).length);
    expect(tight.limitations.some(text => /^FORGE reserve lines for \d+ player-games were withheld/.test(text))).toBe(true);
  });

  describe("a week of runs, one per date (FORGE_PROJECTION_DAYS_AHEAD = 6)", () => {
    // The production-shaped league fixture, but with one FORGE run per game day projecting that day's games: every
    // forecast is an exact line from its own date's run instead of a re-aimed one.
    function weekOfRuns(days: number, shape: Shape, withReserves: boolean) {
      const { players: weekPlayers, games: weekGames, inputs } = league(days, shape);
      const runOf = (date: string) => ({ run_id: `run-${date}`, as_of_date: date, created_at: "2026-10-26T10:00:00Z", git_sha: "a".repeat(40),
        external_input_proven: true });
      const dates = [...new Set(weekGames.map(game => game.date))].sort();
      const teamGames = new Map<number, PlanningGame[]>();
      for (const game of weekGames) {
        const team = weekPlayers.find(player => player.teamAbbreviation === game.teamAbbreviation)?.nhlTeamId;
        if (team) teamGames.set(team, [...(teamGames.get(team) ?? []), game]);
      }
      const perGame = (rows: Record<string, any>[]) => rows.flatMap(row =>
        (teamGames.get(row.team_id) ?? []).map(game => ({ ...row, run_id: `run-${game.date}`, as_of_date: game.date, game_id: Number(game.id) })));
      // The fixture already has one goalie row (and candidate contract) per team-game: each moves to its own date's run.
      const gameDate = new Map(weekGames.map(game => [Number(game.id), game.date]));
      const week: ForgeDailyBridgeInputs = { ...inputs, runs: dates.map(runOf), skaters: perGame(inputs.skaters),
        goalies: inputs.goalies.map(row => ({ ...row, run_id: `run-${gameDate.get(row.game_id)}`, as_of_date: gameDate.get(row.game_id) })),
        reserves: withReserves ? perGame(inputs.reserves ?? []) : undefined };
      const result = buildForgeDailyBridgeForecasts(week, weekPlayers, weekGames, weekNow, weekSeasonId, forecastCalendarPolicy(days + 1));
      const opportunities = (withReserves ? weekPlayers.filter(player => player.teamAbbreviation)
        : weekPlayers.filter(player => player.teamAbbreviation && week.skaters.concat(week.goalies)
          .some(row => (row.player_id ?? row.goalie_id) === player.nhlId)))
        .reduce((sum, player) => sum + weekGames.filter(game => game.teamAbbreviation === player.teamAbbreviation).length, 0);
      return { result, dates, opportunities, weekPlayers, weekGames,
        bytes: { wire: jsonUtf8Bytes(compactBridgeForecasts(result.forecasts, { players: weekPlayers, games: weekGames }, weekSeasonId).wire),
          expanded: result.forecasts.reduce((sum, row) => sum + jsonUtf8Bytes(row) + 1, 0) } };
    }

    it.each([["typical", false], ["typical", true], ["maximal", false], ["maximal", true]] as const)(
      "fits a %s week (reserve pass %s) inside the existing budgets with every game's exact line, no lineup line trimmed", (shape, withReserves) => {
        const week = weekOfRuns(7, shape, withReserves);
        expect(week.dates).toHaveLength(7);
        // Lineup skaters and each game's projected starter get the exact line from their own date's run. Reserve lines
        // (team's latest run) and goalies without a starter row of their own for the game (their latest line, else the
        // team's) follow the bridge's existing rules: always the newest run, never an older one.
        const lineup = week.result.forecasts.filter(row => !reserveCodeOf(row) && (week.weekPlayers.find(player => player.id === row.playerId)?.playerClass === "skater"
          || row.issuedContext!.nhlPlayerId % 100 === 30));
        expect(lineup.length).toBeGreaterThan(0);
        for (const row of lineup) expect(row.revisionId).toBe(`${FORGE_DAILY_BRIDGE_VERSION}:run-${row.issuedContext!.scheduledAt.slice(0, 10)}`);
        for (const row of week.result.forecasts) expect(row.revisionId >= `${FORGE_DAILY_BRIDGE_VERSION}:run-${row.issuedContext!.scheduledAt.slice(0, 10)}`).toBe(true);
        // No lineup line is ever trimmed. Reserve lines are all or nothing (the existing rule): a maximal week with the
        // pass on withholds all of them together, never the late games only.
        expect(week.result.limitations.some(text => /trimmed/.test(text))).toBe(false);
        const reservesWithheld = week.result.limitations.some(text => /^FORGE reserve lines for \d+ player-games were withheld/.test(text));
        // "No FORGE line" zeros join the same all-or-nothing group, so a maximal week withholds them with the pass off too.
        expect(reservesWithheld).toBe(shape === "maximal");
        if (reservesWithheld) expect(week.result.forecasts.some(row => reserveCodeOf(row))).toBe(false);
        const byDate = new Map<string, number>();
        for (const row of week.result.forecasts) byDate.set(row.issuedContext!.scheduledAt.slice(0, 10), (byDate.get(row.issuedContext!.scheduledAt.slice(0, 10)) ?? 0) + 1);
        expect([...byDate.keys()].sort()).toEqual(week.dates);
        expect(week.bytes.wire).toBeLessThanOrEqual(FORGE_DAILY_BRIDGE_BYTE_BUDGET);
        expect(week.bytes.expanded).toBeLessThanOrEqual(withReserves ? FORGE_RESERVE_EXPANDED_BYTE_BUDGET : FORGE_DAILY_BRIDGE_EXPANDED_BYTE_BUDGET);
      });
  });
});

