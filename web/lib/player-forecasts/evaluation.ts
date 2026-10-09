/** Local, time-ordered evaluation inputs. Callers supply outcomes retained as observed. */
import type { SupabaseClient } from "@supabase/supabase-js";
import { exportFrozenBoardForecasts, type FrozenBoardSource } from "lib/projections/starterBoardDataset";
import { actualForOutput, parseTimeOnIceSeconds } from "./settlement";

export type IssuedObservation = {
  id: string;
  target: string;
  population?: "forward" | "defense" | "goalie";
  /** Calendar lead and team-game ordinal remain distinct evaluation dimensions. */
  calendarLeadDays?: number | null;
  teamGameOrdinal?: number | null;
  gameDate: string;
  gameType: "regular_season" | "preseason";
  evidenceClass: "captured_live" | "historical_reconstruction";
  issuedAt: string;
  gameStartAt: string;
  outcomeAvailableAt: string;
  conditioning: "unconditional" | "conditional_playing" | "conditional_start" | "playing_probability" | "start_probability";
  actual: number;
  forecast: number;
  baseline: number | null;
  baselineConditioning?: IssuedObservation["conditioning"];
};

type Cohort = { target: string; conditioning: IssuedObservation["conditioning"]; population: IssuedObservation["population"] | "unknown";
  calendarLeadDays: number | null; teamGameOrdinal: number | null };
type PointSummary = Cohort & { samples: number; mae: number; bias: number; pairedMae: number | null;
  pairedBias: number | null; baselineMae: number | null; baselineSamples: number };
type ParticipationSummary = Cohort & { samples: number; brier: number; pairedBrier: number | null;
  baselineBrier: number | null; baselineSamples: number };

const finite = (value: number | null): value is number => value !== null && Number.isFinite(value);
const protectedDate = (date: string) => date >= "2026-01-03" && date <= "2026-04-16";
const validTime = (value: string) => Number.isFinite(Date.parse(value));
function prospectiveRanges(args: { startDate: string; endDate: string; asOf: string }) {
  const validDate = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date)
    && Number.isFinite(Date.parse(`${date}T00:00:00Z`))
    && new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date;
  if (!validDate(args.startDate) || !validDate(args.endDate) || args.startDate > args.endDate || !validTime(args.asOf)
    || args.endDate > args.asOf.slice(0, 10) || Date.parse(`${args.endDate}T00:00:00Z`) - Date.parse(`${args.startDate}T00:00:00Z`) > 180 * 86400000) {
    throw new Error("Invalid prospective evaluation window");
  }
  return [
    { start: args.startDate, end: args.endDate < "2026-01-03" ? args.endDate : "2026-01-02" },
    { start: args.startDate > "2026-04-16" ? args.startDate : "2026-04-17", end: args.endDate },
  ].filter(range => range.start <= range.end);
}

/** Research holdout stays excluded, including from retrospective local comparisons. */
export function evaluateIssuedObservations(rows: IssuedObservation[], asOf: string): {
  points: PointSummary[];
  participation: ParticipationSummary[];
  excluded: Record<string, number>;
} {
  const points = new Map<string, PointSummary>();
  const participation = new Map<string, ParticipationSummary>();
  const excluded: Record<string, number> = {};
  const seen = new Set<string>();
  const exclude = (reason: string) => { excluded[reason] = (excluded[reason] ?? 0) + 1; };
  for (const row of rows) {
    if (seen.has(row.id)) { exclude("duplicate_output"); continue; }
    seen.add(row.id);
    if (protectedDate(row.gameDate)) { exclude("protected_holdout"); continue; }
    if (row.evidenceClass !== "captured_live" || row.gameType !== "regular_season") { exclude("non_prospective_regular_season"); continue; }
    if (![row.issuedAt, row.gameStartAt, row.outcomeAvailableAt, asOf].every(validTime)
      || Date.parse(row.issuedAt) >= Date.parse(row.gameStartAt)
      || Date.parse(row.gameStartAt) > Date.parse(row.outcomeAvailableAt)
      || Date.parse(row.outcomeAvailableAt) > Date.parse(asOf)) { exclude("invalid_cutoff"); continue; }
    if (!finite(row.actual) || !finite(row.forecast)) { exclude("missing_value"); continue; }
    if (row.calendarLeadDays != null && (!Number.isInteger(row.calendarLeadDays) || row.calendarLeadDays < 0)
      || row.teamGameOrdinal != null && (!Number.isInteger(row.teamGameOrdinal) || row.teamGameOrdinal < 1)) {
      exclude("invalid_horizon"); continue;
    }
    const cohort: Cohort = { target: row.target, conditioning: row.conditioning, population: row.population ?? "unknown",
      calendarLeadDays: row.calendarLeadDays ?? null, teamGameOrdinal: row.teamGameOrdinal ?? null };
    const key = JSON.stringify(cohort);
    const paired = finite(row.baseline) && row.baselineConditioning === row.conditioning;
    const probability = row.conditioning === "playing_probability" || row.conditioning === "start_probability";
    if (probability) {
      if (![0, 1].includes(row.actual) || row.forecast < 0 || row.forecast > 1) { exclude("invalid_probability"); continue; }
      const summary = participation.get(key) ?? { ...cohort, samples: 0, brier: 0, pairedBrier: null, baselineBrier: null, baselineSamples: 0 };
      summary.brier += (row.forecast - row.actual) ** 2;
      summary.samples++;
      if (paired && row.baseline! >= 0 && row.baseline! <= 1) {
        summary.pairedBrier = (summary.pairedBrier ?? 0) + (row.forecast - row.actual) ** 2;
        summary.baselineBrier = (summary.baselineBrier ?? 0) + (row.baseline! - row.actual) ** 2;
        summary.baselineSamples++;
      }
      participation.set(key, summary);
    } else {
      const summary = points.get(key) ?? { ...cohort, samples: 0, mae: 0, bias: 0, pairedMae: null, pairedBias: null,
        baselineMae: null, baselineSamples: 0 };
      summary.mae += Math.abs(row.forecast - row.actual);
      summary.bias += row.forecast - row.actual;
      summary.samples++;
      if (paired) {
        summary.pairedMae = (summary.pairedMae ?? 0) + Math.abs(row.forecast - row.actual);
        summary.pairedBias = (summary.pairedBias ?? 0) + row.forecast - row.actual;
        summary.baselineMae = (summary.baselineMae ?? 0) + Math.abs(row.baseline! - row.actual);
        summary.baselineSamples++;
      }
      points.set(key, summary);
    }
  }
  for (const summary of points.values()) {
    summary.mae /= summary.samples;
    summary.bias /= summary.samples;
    if (summary.baselineMae !== null) {
      summary.pairedMae! /= summary.baselineSamples;
      summary.pairedBias! /= summary.baselineSamples;
      summary.baselineMae /= summary.baselineSamples;
    }
  }
  for (const summary of participation.values()) {
    summary.brier /= summary.samples;
    if (summary.baselineBrier !== null) {
      summary.pairedBrier! /= summary.baselineSamples;
      summary.baselineBrier /= summary.baselineSamples;
    }
  }
  const order = (a: Cohort, b: Cohort) => JSON.stringify(a).localeCompare(JSON.stringify(b));
  return { points: [...points.values()].sort(order), participation: [...participation.values()].sort(order), excluded };
}

export type PairedPointDecision = {
  id: string;
  gameDate: string;
  issuedAt: string;
  lockAt: string;
  outcomeAvailableAt: string;
  evidenceClass: "captured_live" | "historical_reconstruction";
  /** Eligibility covers all competing players and required targets, including bench alternatives. */
  comparableCoverage: boolean;
  scoringWeights: Record<string, number>;
  outcomes: Record<string, Record<string, number | null>>;
  plans: { candidate: string[]; noMove: string[]; agp: string[] };
};

/** Scores every plan against the same observed player/game values. Points leagues only. */
export function evaluatePairedPointDecisions(rows: PairedPointDecision[], asOf: string) {
  const evaluated: Array<{ id: string; candidate: number; noMove: number; agp: number; opportunityLoss: number }> = [];
  const excluded: Record<string, number> = {};
  const exclude = (reason: string) => { excluded[reason] = (excluded[reason] ?? 0) + 1; };
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.id)) { exclude("duplicate_decision"); continue; }
    seen.add(row.id);
    if (protectedDate(row.gameDate)) { exclude("protected_holdout"); continue; }
    if (row.evidenceClass !== "captured_live") { exclude("non_prospective"); continue; }
    if (![row.issuedAt, row.lockAt, row.outcomeAvailableAt, asOf].every(validTime)
      || Date.parse(row.issuedAt) >= Date.parse(row.lockAt)
      || Date.parse(row.lockAt) > Date.parse(row.outcomeAvailableAt)
      || Date.parse(row.outcomeAvailableAt) > Date.parse(asOf)) { exclude("invalid_cutoff"); continue; }
    if (!row.comparableCoverage) { exclude("incomplete_coverage"); continue; }
    const weights = Object.entries(row.scoringWeights).filter(([, weight]) => weight !== 0);
    if (!weights.length || weights.some(([, weight]) => !finite(weight))) { exclude("unsupported_scoring"); continue; }
    const score = (keys: string[]) => {
      if (new Set(keys).size !== keys.length) return null;
      let total = 0;
      for (const key of keys) {
        const stats = row.outcomes[key];
        if (!stats) return null;
        for (const [stat, weight] of weights) {
          const value = stats[stat];
          if (!finite(value)) return null;
          total += value * weight;
        }
      }
      return total;
    };
    const candidate = score(row.plans.candidate), noMove = score(row.plans.noMove), agp = score(row.plans.agp);
    if (candidate === null || noMove === null || agp === null) { exclude("missing_outcome"); continue; }
    evaluated.push({ id: row.id, candidate, noMove, agp, opportunityLoss: Math.max(0, Math.max(noMove, agp) - candidate) });
  }
  return { evaluated, excluded, meanOpportunityLoss: evaluated.length
    ? evaluated.reduce((sum, row) => sum + row.opportunityLoss, 0) / evaluated.length : null };
}

const MAX_EVALUATION_ROWS = 50_000;

async function readPages(build: () => any): Promise<any[]> {
  const rows: any[] = [];
  let expectedCount: number | null = null;
  for (;;) {
    const { data, error, count } = await build().range(rows.length, rows.length + 999);
    if (error) throw error;
    if (!Array.isArray(data) || !Number.isSafeInteger(count) || count < 0
      || expectedCount !== null && count !== expectedCount || data.length > 1000
      || rows.length + data.length > count || !data.length && rows.length < count) {
      throw new Error("Prospective evaluation read was incomplete or changed during pagination");
    }
    if (count >= MAX_EVALUATION_ROWS) throw new Error("Prospective evaluation query row cap reached");
    expectedCount = count;
    rows.push(...data);
    if (rows.length === count) return rows;
  }
}

async function readByIds(ids: Array<number | string>, build: (batch: Array<number | string>) => any): Promise<any[]> {
  const rows: any[] = [];
  for (let index = 0; index < ids.length; index += 100) {
    rows.push(...await readPages(() => build(ids.slice(index, index + 100))));
    if (rows.length >= MAX_EVALUATION_ROWS) throw new Error("Prospective evaluation query row cap reached");
  }
  return rows;
}

/** Read retained issued forecasts and final outcomes for local evidence reporting. Never publishes or promotes. */
export async function runProspectiveEvaluation(db: SupabaseClient<any>, args: {
  startDate: string; endDate: string; asOf: string;
}) {
  const ranges = prospectiveRanges(args);
  const games = (await Promise.all(ranges.map(range => readPages(() => db.from("games").select("id,date,startTime,type", { count: "exact" })
    .eq("type", 2).gte("date", range.start).lte("date", range.end).order("id"))))).flat();
  const gameById = new Map(games.map(game => [Number(game.id), game]));
  if (games.length >= MAX_EVALUATION_ROWS) throw new Error("Prospective evaluation query row cap reached");
  const gameIds = [...gameById.keys()];
  const [outputs, outcomes] = await Promise.all([
    readByIds(gameIds, batch => db.from("player_forecast_outputs")
      .select("id,run_id,game_id,player_id,population,target_key,conditioning,team_game_horizon,point_estimate,probability,distribution,source_high_watermark,issued_at", { count: "exact" })
      .in("game_id", batch).lte("issued_at", args.asOf).order("id")),
    readByIds(gameIds, batch => db.from("player_forecast_outcome_revisions")
      .select("id,game_id,player_id,target_key,target_version,outcome_value,available_at,finality,source", { count: "exact" })
      .in("game_id", batch).eq("target_version", "research-contract-v1")
      .lte("available_at", args.asOf).order("available_at", { ascending: false }).order("id", { ascending: false })),
  ]);
  const runIds = [...new Set(outputs.map(row => String(row.run_id)))];
  const runs = await readByIds(runIds, batch => db.from("player_forecast_runs")
    .select("id,game_id,status,run_kind,cutoff_at,issued_at,metadata", { count: "exact" })
    .in("id", batch).order("id"));
  const runById = new Map(runs.map(run => [String(run.id), run]));
  const outcomeByKey = new Map<string, any>();
  for (const outcome of outcomes.sort((a, b) => Date.parse(b.available_at) - Date.parse(a.available_at)
    || String(b.id).localeCompare(String(a.id)))) {
    const key = `${outcome.game_id}:${outcome.player_id}:${outcome.target_key}`;
    if (!outcomeByKey.has(key)) outcomeByKey.set(key, outcome);
  }
  const excluded: Record<string, number> = {};
  const exclude = (reason: string) => { excluded[reason] = (excluded[reason] ?? 0) + 1; };
  const observations: IssuedObservation[] = [];
  const settledGames = new Set<number>(), settledSlates = new Set<string>();
  for (const output of outputs) {
    const game = gameById.get(Number(output.game_id)), run = runById.get(String(output.run_id));
    if (!game || !run || Number(run.game_id) !== Number(output.game_id)) { exclude("missing_game_or_run"); continue; }
    if (protectedDate(game.date)) { exclude("protected_holdout"); continue; }
    if (run.status !== "succeeded" || run.run_kind === "backtest" || run.metadata?.evidenceClass !== "captured_live") {
      exclude("prospective_capture_unverified"); continue;
    }
    if (![run.cutoff_at, output.issued_at, game.startTime, output.source_high_watermark].every(validTime)
      || Date.parse(output.source_high_watermark) > Date.parse(run.cutoff_at)
      || Date.parse(run.cutoff_at) > Date.parse(output.issued_at)
      || Date.parse(output.issued_at) >= Date.parse(game.startTime)) { exclude("invalid_issue_cutoff"); continue; }
    const outcome = outcomeByKey.get(`${output.game_id}:${output.player_id}:${output.target_key}`);
    if (!outcome || !["final", "corrected"].includes(outcome.finality)
      || !["nhl_game_stats", "nhl_raw_boxscore"].includes(outcome.source)) { exclude("final_outcome_missing"); continue; }
    const requiredParticipationTarget = output.conditioning === "conditional_start" ? "starts"
      : output.conditioning === "conditional_playing" ? "plays" : null;
    if (requiredParticipationTarget) {
      const participation = outcomeByKey.get(`${output.game_id}:${output.player_id}:${requiredParticipationTarget}`);
      if (!participation || !["final", "corrected"].includes(participation.finality)
        || !["nhl_game_stats", "nhl_raw_boxscore"].includes(participation.source)
        || Number(participation.outcome_value) !== 1) { exclude("conditioning_outcome_unverified"); continue; }
    }
    const actual = Number(outcome.outcome_value);
    const forecast = Number(output.conditioning === "playing_probability" || output.conditioning === "start_probability"
      ? output.probability : output.point_estimate);
    if (outcome.outcome_value === null || (output.conditioning === "playing_probability" || output.conditioning === "start_probability"
      ? output.probability === null : output.point_estimate === null)
      || !Number.isFinite(actual) || !Number.isFinite(forecast)) { exclude("value_missing"); continue; }
    const baseline = output.distribution?.baselinePointEstimate;
    const calendarLeadDays = Math.floor((Date.parse(`${String(game.startTime).slice(0, 10)}T00:00:00Z`)
      - Date.parse(`${String(output.issued_at).slice(0, 10)}T00:00:00Z`)) / 86400000);
    if (!Number.isInteger(calendarLeadDays) || calendarLeadDays < 0 || !Number.isInteger(output.team_game_horizon)
      || output.team_game_horizon < 1 || !["unconditional", "conditional_playing", "conditional_start", "playing_probability", "start_probability"].includes(output.conditioning)
      || !validTime(outcome.available_at) || Date.parse(outcome.available_at) < Date.parse(game.startTime)
      || (["playing_probability", "start_probability"].includes(output.conditioning)
        && (![0, 1].includes(actual) || forecast < 0 || forecast > 1))) { exclude("invalid_observation"); continue; }
    const row: IssuedObservation = { id: String(output.id), target: String(output.target_key),
      population: output.population, teamGameOrdinal: output.team_game_horizon,
      calendarLeadDays,
      gameDate: game.date, gameType: "regular_season", evidenceClass: "captured_live",
      issuedAt: output.issued_at, gameStartAt: game.startTime, outcomeAvailableAt: outcome.available_at,
      conditioning: output.conditioning, actual, forecast,
      baseline: typeof baseline === "number" && Number.isFinite(baseline) ? baseline : null,
      baselineConditioning: output.distribution?.baselineConditioning,
    };
    observations.push(row);
    settledGames.add(Number(output.game_id));
    settledSlates.add(game.date);
  }
  const metrics = evaluateIssuedObservations(observations, args.asOf);
  const gamesCount = settledGames.size, slatesCount = settledSlates.size;
  for (const [reason, count] of Object.entries(metrics.excluded)) excluded[reason] = (excluded[reason] ?? 0) + count;
  return { metrics, excluded, progress: {
    settledGames: gamesCount, settledSlates: slatesCount, settledForecasts: observations.length,
    starterBoardMinimums: { gamesRequired: 200, slatesRequired: 30,
      sampleMinimumMet: gamesCount >= 200 && slatesCount >= 30 },
    releaseDecision: "not_assessed" as const,
    limitations: ["Sample counts alone do not satisfy the frozen Starter Board review policy or activate a component.",
      "Participation, point error, and decision quality require separate evidence."],
  } };
}

/** Evaluate hash-checked, frozen FORGE single-game revisions against retained final NHL boxscores. */
export async function runForgeProspectiveEvaluation(db: SupabaseClient<any>, args: {
  startDate: string; endDate: string; asOf: string;
}) {
  const ranges = prospectiveRanges(args);
  const games = (await Promise.all(ranges.map(range => readPages(() => db.from("games")
    .select("id,date,type,seasonId,startTime,homeTeamId,awayTeamId", { count: "exact" })
    .eq("type", 2).gte("date", range.start).lte("date", range.end).order("id"))))).flat();
  if (games.length >= MAX_EVALUATION_ROWS) throw new Error("Prospective evaluation query row cap reached");
  const gameById = new Map(games.map(game => [Number(game.id), game]));
  const frozen = await readByIds([...gameById.keys()], batch => db.from("forge_final_pregame_revisions")
    .select("game_id,revision_id,scheduled_start_at,frozen_at", { count: "exact" }).in("game_id", batch).order("game_id"));
  const revisions = await readByIds([...new Set(frozen.map(row => String(row.revision_id)))], batch => db.from("forge_game_revisions")
    .select("id,game_id,run_id,input_snapshot_id,slate_date,decision_as_of,published_at,payload", { count: "exact" })
    .in("id", batch).lte("published_at", args.asOf).order("id"));
  const observations = await readByIds([...new Set(revisions.map(row => String(row.input_snapshot_id)))], batch => db.from("player_forecast_source_observations")
    .select("id,provider,dataset_key,entity_key,available_at,payload_hash,payload", { count: "exact" })
    .in("id", batch).order("id"));
  const rawRows = await readByIds([...new Set(frozen.map(row => Number(row.game_id)))], batch => db.from("nhl_api_game_payloads_raw")
    .select("id,game_id,season_id,payload_hash,payload,fetched_at", { count: "exact" })
    .in("game_id", batch).eq("endpoint", "boxscore").lte("fetched_at", args.asOf)
    .order("fetched_at", { ascending: false }).order("id", { ascending: false }));
  const revisionById = new Map(revisions.map(row => [String(row.id), row]));
  const observationById = new Map(observations.map(row => [String(row.id), row]));
  const boxscoreByGame = new Map<number, any>();
  for (const row of rawRows.sort((a, b) => Date.parse(b.fetched_at) - Date.parse(a.fetched_at) || Number(b.id) - Number(a.id))) {
    const gameId = Number(row.game_id), game = gameById.get(gameId);
    if (!boxscoreByGame.has(gameId) && game && Number(row.season_id) === Number(game.seasonId)
      && Number(row.payload?.id) === gameId && Number(row.payload?.season) === Number(game.seasonId)
      && ["OFF", "FINAL"].includes(row.payload?.gameState)) boxscoreByGame.set(gameId, row);
  }
  const excluded: Record<string, number> = {};
  const exclude = (reason: string) => { excluded[reason] = (excluded[reason] ?? 0) + 1; };
  const issued: IssuedObservation[] = [];
  const settledGames = new Set<number>(), settledSlates = new Set<string>();
  for (const selected of frozen) {
    const game = gameById.get(Number(selected.game_id));
    const revision = revisionById.get(String(selected.revision_id));
    const observation = revision ? observationById.get(String(revision.input_snapshot_id)) : null;
    const boxscore = boxscoreByGame.get(Number(selected.game_id));
    if (!game || !revision || !observation) { exclude("frozen_source_missing"); continue; }
    if (!boxscore || Number(boxscore.payload.homeTeam?.id) !== Number(game.homeTeamId)
      || Number(boxscore.payload.awayTeam?.id) !== Number(game.awayTeamId)) { exclude("final_boxscore_missing"); continue; }
    let exported: ReturnType<typeof exportFrozenBoardForecasts>;
    try { exported = exportFrozenBoardForecasts({ game, frozen: selected, revision, observation } as FrozenBoardSource); }
    catch { exclude("frozen_source_invalid"); continue; }
    const stats = boxscore.payload.playerByGameStats;
    for (const row of exported.rows) {
      const allStrengthPrefix = { GOALS: "proj_goals", ASSISTS: "proj_assists", SHOTS_ON_GOAL: "proj_shots" }[row.target_key as "GOALS" | "ASSISTS" | "SHOTS_ON_GOAL"];
      if (row.population === "skater" && allStrengthPrefix) {
        const source = revision.payload.players.find((player: any) => player.player_id === row.player_id);
        if (!["es", "pp", "pk"].every(strength => typeof source?.[`${allStrengthPrefix}_${strength}`] === "number"
          && Number.isFinite(source[`${allStrengthPrefix}_${strength}`]))) {
          exclude("all_strength_source_incomplete"); continue;
        }
      }
      const side = Number(boxscore.payload.homeTeam?.id) === row.team_id ? stats?.homeTeam
        : Number(boxscore.payload.awayTeam?.id) === row.team_id ? stats?.awayTeam : null;
      if (!side || !Array.isArray(side.forwards) || !Array.isArray(side.defense) || !Array.isArray(side.goalies)) {
        exclude("boxscore_team_mismatch"); continue;
      }
      const skater = [...side.forwards, ...side.defense].find((player: any) => player.playerId === row.player_id);
      const goalie = side.goalies.find((player: any) => player.playerId === row.player_id);
      const synthetic = { id: row.revision_id, game_id: row.game_id, team_id: row.team_id, player_id: row.player_id,
        population: row.population === "goalie" ? "goalie" : "forward", target_key: "", conditioning: row.conditioning,
        point_estimate: null, probability: null, distribution: null, quantiles: null } as any;
      const rawSource = { payload: boxscore.payload, payloadHash: String(boxscore.payload_hash),
        fetchedAt: String(boxscore.fetched_at), seasonId: Number(boxscore.season_id) };
      let actual: number | null = null;
      let conditioning: IssuedObservation["conditioning"];
      if (row.conditioning === "probability") {
        conditioning = row.population === "goalie" ? "start_probability" : "playing_probability";
        synthetic.conditioning = conditioning;
        synthetic.target_key = row.population === "goalie" ? "starts" : "plays";
        actual = actualForOutput(synthetic, skater, goalie, rawSource)?.value ?? null;
      } else {
        conditioning = row.conditioning;
        if (row.population === "goalie") {
          const targets: Record<string, string> = { SAVES_GOALIE: "saves", SHOTS_AGAINST_GOALIE: "shots_against",
            GOALS_AGAINST_GOALIE: "goals_against", WINS_GOALIE: "wins" };
          const target = targets[String(row.target_key)];
          if (target) {
            synthetic.target_key = target;
            if (conditioning === "conditional_start" && goalie?.starter !== true) { exclude("conditioning_outcome_unverified"); continue; }
            synthetic.conditioning = target === "wins" ? conditioning : conditioning === "conditional_start" ? "conditional_playing" : conditioning;
            actual = actualForOutput(synthetic, undefined, goalie, rawSource)?.value ?? null;
          }
        } else {
          const targets: Record<string, string> = { GOALS: "goals", ASSISTS: "assists", SHOTS_ON_GOAL: "shots_on_goal",
            HITS: "hits", BLOCKED_SHOTS: "blocked_shots", PENALTY_MINUTES: "penalty_minutes",
            TIME_ON_ICE_PER_GAME: "time_on_ice_seconds" };
          const target = targets[String(row.target_key)];
          if (target) {
            synthetic.target_key = target;
            const observed = skater ? { ...skater, shots: skater.sog } : undefined;
            actual = actualForOutput(synthetic, observed)?.value ?? null;
            if (actual !== null && target === "time_on_ice_seconds") actual /= 60;
          }
        }
      }
      if (actual === null) { exclude("supported_final_outcome_missing"); continue; }
      const estimate = row.estimates?.forge;
      if (typeof estimate !== "number" || !Number.isFinite(estimate) || !validTime(boxscore.fetched_at)
        || Date.parse(boxscore.fetched_at) < Date.parse(row.scheduled_start_at)
        || (["playing_probability", "start_probability"].includes(conditioning)
          && (![0, 1].includes(actual) || estimate < 0 || estimate > 1))) { exclude("invalid_observation"); continue; }
      issued.push({ id: `${row.revision_id}:${row.player_id}:${row.target_key}:${row.conditioning}`,
        target: row.target_key, population: row.population === "goalie" ? "goalie"
          : row.segments?.position === "D" ? "defense" : "forward",
        calendarLeadDays: Math.floor((Date.parse(`${String(row.scheduled_start_at).slice(0, 10)}T00:00:00Z`)
          - Date.parse(`${String(row.issued_at).slice(0, 10)}T00:00:00Z`)) / 86400000), teamGameOrdinal: null,
        gameDate: game.date, gameType: "regular_season", evidenceClass: "captured_live",
        issuedAt: row.issued_at, gameStartAt: row.scheduled_start_at, outcomeAvailableAt: boxscore.fetched_at,
        conditioning, actual, forecast: estimate, baseline: null });
      settledGames.add(Number(game.id)); settledSlates.add(game.date);
    }
  }
  const metrics = evaluateIssuedObservations(issued, args.asOf);
  for (const [reason, count] of Object.entries(metrics.excluded)) excluded[reason] = (excluded[reason] ?? 0) + count;
  return { metrics, excluded, progress: { producer: "FORGE" as const, settledGames: settledGames.size,
    settledSlates: settledSlates.size, settledForecasts: issued.length,
    starterBoardMinimums: { gamesRequired: 200, slatesRequired: 30,
      sampleMinimumMet: settledGames.size >= 200 && settledSlates.size >= 30 },
    releaseDecision: "not_assessed" as const,
    limitations: ["Frozen paired baseline and protected-metric reviews are still required for Starter Board promotion.",
      "Unsupported PP points, fantasy-point totals and awarded goalie shutouts are excluded."] } };
}
