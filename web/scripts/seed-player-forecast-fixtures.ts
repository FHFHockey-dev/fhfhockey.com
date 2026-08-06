import dotenv from "dotenv";
import type { SupabaseClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env.development.local" });

import { getServiceRoleClient } from "../lib/supabase/server";
import { ensurePlayerForecastArtifactBucket } from "../lib/player-forecasts/artifacts";

const PRODUCTION_REF = "fyhftlxokyjtpndbkfse";

function assertSafeTarget() {
  if (process.env.PLAYER_FORECAST_FIXTURE_CONFIRM !== "local-only") {
    throw new Error("PLAYER_FORECAST_FIXTURE_CONFIRM must equal local-only.");
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const branchRef = process.env.PLAYER_FORECAST_FIXTURE_BRANCH_REF?.trim() ?? "";
  const local = /^https?:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(url);
  const approvedBranch = Boolean(branchRef && url.includes(branchRef));
  if (!url || url.includes(PRODUCTION_REF) || (!local && !approvedBranch)) {
    throw new Error("Fixtures are restricted to local Supabase or an explicitly identified branch.");
  }
}

async function upsertIgnore(table: string, rows: Record<string, unknown>[]) {
  const client = getServiceRoleClient() as SupabaseClient<any>;
  const { error } = await client
    .from(table)
    .upsert(rows as never, { onConflict: "id", ignoreDuplicates: true });
  if (error) throw new Error(`${table} fixture insert failed: ${error.code ?? "unknown"}`);
}

async function main() {
  assertSafeTarget();
  const supabase = getServiceRoleClient();
  await ensurePlayerForecastArtifactBucket(supabase);
  const gameId = 2999999001;
  const historyGameId = 2999999000;
  const homeTeamId = 901;
  const awayTeamId = 902;
  const forwardId = 2999999101;
  const defenseId = 2999999102;
  const goalieId = 2999999103;

  const baseWrites = [
    supabase.from("seasons").upsert({
      id: 20262027,
      startDate: "2026-09-20",
      endDate: "2027-06-30",
      regularSeasonEndDate: "2027-04-20",
      numberOfGames: 82,
    } as never),
    supabase.from("teams").upsert([
      { id: homeTeamId, name: "Fixture Home", abbreviation: "FXH" },
      { id: awayTeamId, name: "Fixture Away", abbreviation: "FXA" },
    ] as never),
  ];
  for (const write of baseWrites) {
    const { error } = await write;
    if (error) throw new Error(`Base fixture insert failed: ${error.code ?? "unknown"}`);
  }
  const { error: playerError } = await supabase.from("players").upsert([
    { id: forwardId, firstName: "Fixture", lastName: "Forward", fullName: "Fixture Forward", position: "C", birthDate: "2000-01-01", heightInCentimeters: 183, weightInKilograms: 86, team_id: homeTeamId },
    { id: defenseId, firstName: "Fixture", lastName: "Defense", fullName: "Fixture Defense", position: "D", birthDate: "2000-01-02", heightInCentimeters: 188, weightInKilograms: 91, team_id: homeTeamId },
    { id: goalieId, firstName: "Fixture", lastName: "Goalie", fullName: "Fixture Goalie", position: "G", birthDate: "1998-01-03", heightInCentimeters: 191, weightInKilograms: 93, team_id: homeTeamId },
  ] as never);
  if (playerError) throw new Error(`Player fixture insert failed: ${playerError.code ?? "unknown"}`);
  const { error: rosterError } = await supabase.from("rosters").upsert([
    { playerId: forwardId, seasonId: 20262027, teamId: homeTeamId, sweaterNumber: 91, is_current: true },
    { playerId: defenseId, seasonId: 20262027, teamId: homeTeamId, sweaterNumber: 92, is_current: true },
    { playerId: goalieId, seasonId: 20262027, teamId: homeTeamId, sweaterNumber: 93, is_current: true },
  ] as never);
  if (rosterError) throw new Error(`Roster fixture insert failed: ${rosterError.code ?? "unknown"}`);
  const { error: gameError } = await supabase.from("games").upsert([
    {
      id: historyGameId,
      date: "2026-08-01",
      seasonId: 20262027,
      startTime: "2026-08-01T23:00:00Z",
      type: 2,
      homeTeamId,
      awayTeamId,
    },
    {
      id: gameId,
      date: "2026-10-31",
      seasonId: 20262027,
      startTime: "2026-11-01T03:00:00Z",
      type: 2,
      homeTeamId,
      awayTeamId,
    },
  ] as never);
  if (gameError) throw new Error(`Game fixture insert failed: ${gameError.code ?? "unknown"}`);
  const { error: statsError } = await supabase.from("skatersGameStats").upsert([
    { playerId: forwardId, gameId: historyGameId, position: "C", goals: 1, assists: 1, points: 2, shots: 4, blockedShots: 1, hits: 2, pim: 0, toi: "18:32" },
    { playerId: defenseId, gameId: historyGameId, position: "D", goals: 0, assists: 1, points: 1, shots: 2, blockedShots: 3, hits: 1, pim: 2, toi: "21:05" },
  ] as never);
  if (statsError) throw new Error(`Stats fixture insert failed: ${statsError.code ?? "unknown"}`);
  const { error: gameRosterError } = await supabase.from("nhl_api_game_roster_spots").upsert([
    {
      game_id: historyGameId,
      season_id: 20262027,
      game_date: "2026-08-01",
      team_id: homeTeamId,
      player_id: forwardId,
      first_name: "Fixture",
      last_name: "Forward",
      position_code: "C",
      source_play_by_play_hash: "fixture-context-forward",
      parser_version: 1,
    },
    {
      game_id: historyGameId,
      season_id: 20262027,
      game_date: "2026-08-01",
      team_id: homeTeamId,
      player_id: defenseId,
      first_name: "Fixture",
      last_name: "Defense",
      position_code: "D",
      source_play_by_play_hash: "fixture-context-defense",
      parser_version: 1,
    },
  ] as never, { onConflict: "game_id,player_id" });
  if (gameRosterError) {
    throw new Error(`Game roster fixture insert failed: ${gameRosterError.code ?? "unknown"}`);
  }

  const artifactId = "81000000-0000-4000-8000-000000000001";
  await upsertIgnore("player_forecast_model_artifacts", [{
    id: artifactId,
    model_key: "fixture-shadow-model",
    model_version: "fixture-v1",
    feature_schema_version: "fixture-features-v1",
    calibration_version: "fixture-calibration-v1",
    population: "availability",
    target_keys: ["shots_on_goal", "starts"],
    horizon_min: 1,
    horizon_max: 10,
    artifact_uri: "fixture://no-model-artifact",
    artifact_checksum: "fixture-artifact-checksum",
    training_cutoff_at: "2026-01-02T23:59:59Z",
    code_version: "fixture",
    lifecycle_status: "shadow",
    evidence: { fixture: true, notModelAccuracy: true },
  }]);

  const players = [
    { id: forwardId, population: "forward" },
    { id: defenseId, population: "defense" },
    { id: goalieId, population: "goalie" },
  ];
  for (const player of players) {
    await upsertIgnore("player_forecast_feature_snapshots", [{
      id: `82000000-0000-4000-8000-00000000${String(player.id - 2999999000).padStart(4, "0")}`,
      content_hash: `fixture-feature-${player.id}`,
      game_id: gameId,
      team_id: homeTeamId,
      player_id: player.id,
      population: player.population,
      team_game_horizon: 10,
      cutoff_at: "2026-10-25T10:00:00Z",
      feature_schema_version: "fixture-features-v1",
      source_high_watermark: "2026-10-25T10:00:00Z",
      features: { fixture: true, priorRate: 1 },
      missingness: {},
      fallback_flags: ["fixture_only"],
      source_manifest: [],
    }]);
  }

  const vintages = [
    { suffix: "01", issuedAt: "2026-10-25T10:00:00Z", horizon: 10, forward: 2.4, defense: 1.6, goalie: 0.55 },
    { suffix: "02", issuedAt: "2026-10-29T15:00:00Z", horizon: 3, forward: 3.1, defense: 1.3, goalie: 0.72 },
    { suffix: "03", issuedAt: "2026-11-01T02:55:00Z", horizon: 1, forward: 2.8, defense: 1.8, goalie: 0.9 },
  ];
  for (const vintage of vintages) {
    const runId = `83000000-0000-4000-8000-0000000000${vintage.suffix}`;
    await upsertIgnore("player_forecast_runs", [{
      id: runId,
      idempotency_key: `fixture-run-${vintage.suffix}`,
      game_id: gameId,
      team_id: homeTeamId,
      team_game_horizon: vintage.horizon,
      model_artifact_id: artifactId,
      run_kind: "backtest",
      release_channel: "shadow",
      status: "succeeded",
      cutoff_at: vintage.issuedAt,
      issued_at: vintage.issuedAt,
      source_high_watermark: vintage.issuedAt,
      feature_schema_version: "fixture-features-v1",
      code_version: "fixture",
      research_gate: "approved",
      degraded: true,
      degraded_reasons: ["fixture_only"],
      metadata: { fixture: true, notModelAccuracy: true },
      completed_at: vintage.issuedAt,
    }]);
    await upsertIgnore("player_forecast_outputs", [
      {
        id: `84000000-0000-4000-8000-0000000001${vintage.suffix}`,
        run_id: runId,
        feature_snapshot_id: "82000000-0000-4000-8000-000000000101",
        game_id: gameId,
        team_id: homeTeamId,
        player_id: forwardId,
        population: "forward",
        target_key: "shots_on_goal",
        conditioning: "conditional_playing",
        team_game_horizon: vintage.horizon,
        point_estimate: vintage.forward,
        distribution_kind: "fixture",
        quantiles: { p10: 1, p50: vintage.forward, p90: 5 },
        source_high_watermark: vintage.issuedAt,
        fallback_flags: ["fixture_only"],
        issued_at: vintage.issuedAt,
      },
      {
        id: `84000000-0000-4000-8000-0000000002${vintage.suffix}`,
        run_id: runId,
        feature_snapshot_id: "82000000-0000-4000-8000-000000000102",
        game_id: gameId,
        team_id: homeTeamId,
        player_id: defenseId,
        population: "defense",
        target_key: "shots_on_goal",
        conditioning: "conditional_playing",
        team_game_horizon: vintage.horizon,
        point_estimate: vintage.defense,
        distribution_kind: "fixture",
        quantiles: { p10: 0, p50: vintage.defense, p90: 4 },
        source_high_watermark: vintage.issuedAt,
        fallback_flags: ["fixture_only"],
        issued_at: vintage.issuedAt,
      },
      {
        id: `84000000-0000-4000-8000-0000000003${vintage.suffix}`,
        run_id: runId,
        feature_snapshot_id: "82000000-0000-4000-8000-000000000103",
        game_id: gameId,
        team_id: homeTeamId,
        player_id: goalieId,
        population: "goalie",
        target_key: "starts",
        conditioning: "start_probability",
        team_game_horizon: vintage.horizon,
        probability: vintage.goalie,
        distribution_kind: "bernoulli",
        distribution: { p: vintage.goalie },
        source_high_watermark: vintage.issuedAt,
        fallback_flags: ["fixture_only"],
        issued_at: vintage.issuedAt,
      },
    ]);
  }

  const goalieObservationA = "85000000-0000-4000-8000-000000000001";
  const goalieObservationB = "85000000-0000-4000-8000-000000000002";
  await upsertIgnore("player_forecast_goalie_start_observations", [
    {
      id: goalieObservationA,
      game_id: gameId,
      team_id: homeTeamId,
      player_id: goalieId,
      observation_status: "confirmed",
      confidence: 0.95,
      raw_status: "Fixture Goalie confirmed",
      source_group: "fixture",
      source_key: "fixture-a",
      observed_at: "2026-11-01T02:00:00Z",
      available_at: "2026-11-01T02:00:00Z",
      parser_version: "fixture-v1",
      accepted: true,
      metadata: { fixture: true },
    },
    {
      id: goalieObservationB,
      game_id: gameId,
      team_id: homeTeamId,
      raw_player_name: "Fixture Alternate",
      observation_status: "confirmed",
      confidence: 0.8,
      raw_status: "Fixture Alternate confirmed",
      source_group: "fixture",
      source_key: "fixture-b",
      observed_at: "2026-11-01T02:05:00Z",
      available_at: "2026-11-01T02:05:00Z",
      parser_version: "fixture-v1",
      accepted: true,
      metadata: { fixture: true },
    },
    {
      id: "85000000-0000-4000-8000-000000000003",
      game_id: gameId,
      team_id: homeTeamId,
      player_id: goalieId,
      observation_status: "confirmed",
      raw_status: "Post-start fixture observation",
      source_group: "fixture",
      source_key: "fixture-post-start",
      observed_at: "2026-11-01T03:10:00Z",
      available_at: "2026-11-01T03:10:00Z",
      parser_version: "fixture-v1",
      accepted: true,
      metadata: { fixture: true, afterPuckDrop: true },
    },
  ]);
  const conflictId = "86000000-0000-4000-8000-000000000001";
  await upsertIgnore("player_forecast_observation_conflicts", [{
    id: conflictId,
    conflict_key: `fixture-goalie-${gameId}-${homeTeamId}`,
    conflict_version: 1,
    conflict_type: "goalie_start",
    game_id: gameId,
    team_id: homeTeamId,
    player_id: goalieId,
    detected_at: "2026-11-01T02:05:00Z",
    source_high_watermark: "2026-11-01T02:05:00Z",
    summary: "Fixture conflicting confirmed goalies.",
    metadata: { fixture: true, needsReview: true },
  }]);
  await upsertIgnore("player_forecast_conflict_members", [
    { id: "87000000-0000-4000-8000-000000000001", conflict_id: conflictId, observation_type: "goalie_start", observation_id: goalieObservationA, position: 1 },
    { id: "87000000-0000-4000-8000-000000000002", conflict_id: conflictId, observation_type: "goalie_start", observation_id: goalieObservationB, position: 2 },
  ]);

  const provisionalId = "88000000-0000-4000-8000-000000000001";
  await upsertIgnore("player_forecast_outcome_revisions", [
    {
      id: provisionalId,
      game_id: gameId,
      player_id: forwardId,
      target_key: "shots_on_goal",
      target_version: "fixture-v1",
      outcome_value: 3,
      outcome_payload: { fixture: true },
      source: "fixture",
      source_revision_key: "fixture-provisional",
      observed_at: "2026-11-02T10:00:00Z",
      available_at: "2026-11-02T10:00:00Z",
      finality: "provisional",
    },
    {
      id: "88000000-0000-4000-8000-000000000002",
      game_id: gameId,
      player_id: forwardId,
      target_key: "shots_on_goal",
      target_version: "fixture-v1",
      outcome_value: 4,
      outcome_payload: { fixture: true, correction: true },
      source: "fixture",
      source_revision_key: "fixture-corrected",
      observed_at: "2026-11-03T10:00:00Z",
      available_at: "2026-11-03T10:00:00Z",
      finality: "corrected",
      supersedes_id: provisionalId,
    },
  ]);

  await upsertIgnore("player_forecast_accountability_revisions", [
    {
      id: "89000000-0000-4000-8000-000000000001",
      slate_date: "2026-11-01",
      checkpoint_key: "H10",
      checkpoint_order: 10,
      model_artifact_id: artifactId,
      scoring_version: "fixture-score-v1",
      settlement_status: "provisional",
      evaluated_forecasts: 3,
      composite_skill_score: 48,
      metrics: { fixture: true, notModelAccuracy: true },
      baseline_metrics: { fixture: true },
      evaluated_at: "2026-11-02T10:00:00Z",
    },
    {
      id: "89000000-0000-4000-8000-000000000002",
      slate_date: "2026-11-01",
      checkpoint_key: "H3",
      checkpoint_order: 20,
      model_artifact_id: artifactId,
      scoring_version: "fixture-score-v1",
      settlement_status: "provisional",
      evaluated_forecasts: 3,
      composite_skill_score: 61,
      metrics: { fixture: true, notModelAccuracy: true },
      baseline_metrics: { fixture: true },
      evaluated_at: "2026-11-02T10:00:00Z",
    },
    {
      id: "89000000-0000-4000-8000-000000000003",
      slate_date: "2026-11-01",
      checkpoint_key: "final_pregame",
      checkpoint_order: 30,
      model_artifact_id: artifactId,
      scoring_version: "fixture-score-v1",
      settlement_status: "corrected",
      evaluated_forecasts: 3,
      composite_skill_score: 57,
      metrics: { fixture: true, notModelAccuracy: true },
      baseline_metrics: { fixture: true },
      evaluated_at: "2026-11-03T10:00:00Z",
    },
  ]);

  process.stdout.write(`${JSON.stringify({ success: true, fixtureGameId: gameId, players: [forwardId, defenseId, goalieId], conflictId }, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : "Fixture load failed."}\n`);
  process.exitCode = 1;
});
