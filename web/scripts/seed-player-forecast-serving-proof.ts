import crypto from "crypto";
import dotenv from "dotenv";
import type { SupabaseClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env.development.local" });

import { getServiceRoleClient } from "../lib/supabase/server";
import { loadLatestPlayerForecastServingArtifact, playerForecastCanonicalHash } from "../lib/player-forecasts/serving";

function assertLocalOnly(): void {
  if (process.env.PLAYER_FORECAST_SERVING_PROOF_CONFIRM !== "local-only") {
    throw new Error("PLAYER_FORECAST_SERVING_PROOF_CONFIRM must equal local-only.");
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(url)) {
    throw new Error("Serving proof fixtures are restricted to local Supabase.");
  }
}

async function main(): Promise<void> {
  assertLocalOnly();
  const supabase = getServiceRoleClient() as SupabaseClient<any>;
  const gameId = 2999999001;
  const { artifactPayload: modelArtifact } = await loadLatestPlayerForecastServingArtifact(supabase);
  const validationChallenger =
    modelArtifact.contractVersion === "player-forecasts-research-v2-validation";
  const teamId = validationChallenger ? 901 : 902;
  const horizon = 1;
  const sourceHighWatermark = new Date().toISOString();

  if (!validationChallenger) {
    const snapshots = [
      { playerId: 2999999101, population: "forward" },
      { playerId: 2999999102, population: "defense" },
    ];
    for (const snapshot of snapshots) {
      const id = crypto.randomUUID();
      const targetModels = modelArtifact.segments[snapshot.population];
      const features = Object.fromEntries(
        Object.entries(targetModels).map(([targetKey, details]: [string, any]) => [
          targetKey,
          { [details.candidate]: targetKey === "time_on_ice_seconds" ? 1100 : 1.5, position_prior: 1 },
        ]),
      );
      const unsigned = {
        id,
        contractChecksum: modelArtifact.contractChecksum,
        sourceHighWatermark,
        rows: Object.entries(targetModels).map(([targetKey, details]: [string, any]) => ({
          playerId: snapshot.playerId,
          population: snapshot.population,
          targetKey,
          conditioning: "conditional_playing",
          features: features[targetKey],
          candidate: details.candidate,
        })),
      };
      const contentHash = playerForecastCanonicalHash(unsigned);
      const { error } = await supabase.from("player_forecast_feature_snapshots").insert({
        id,
        content_hash: contentHash,
        game_id: gameId,
        team_id: teamId,
        player_id: snapshot.playerId,
        population: snapshot.population,
        team_game_horizon: horizon,
        cutoff_at: sourceHighWatermark,
        feature_schema_version: modelArtifact.featureSchemaVersion,
        source_high_watermark: sourceHighWatermark,
        features,
        missingness: {},
        fallback_flags: ["local_serving_proof"],
        source_manifest: [],
      } as never);
      if (error) throw error;
    }
  }
  const scopeKey = `local-serving-proof:game:${gameId}:team:${teamId}`;
  const { error: queueError } = await supabase.rpc("enqueue_player_forecast_job", {
    p_scope_key: scopeKey,
    p_game_id: gameId,
    p_team_id: teamId,
    p_team_game_horizon: horizon,
    p_reason: "local_serving_proof",
    p_observed_at: sourceHighWatermark,
    p_not_before: sourceHighWatermark,
    p_metadata: { scheduledStartAt: "2026-11-01T03:00:00Z", fixture: true },
  } as never);
  if (queueError) throw queueError;
  process.stdout.write(`${JSON.stringify({ scopeKey, sourceHighWatermark, validationChallenger })}\n`);
}

main().catch((error) => {
  const message = error instanceof Error
    ? error.message
    : error && typeof error === "object" && "message" in error
      ? String(error.message)
      : "Serving proof fixture failed.";
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
