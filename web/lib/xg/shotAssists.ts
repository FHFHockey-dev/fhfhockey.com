export type ShotAssistFeatureRow = {
  feature_version: number;
  game_id: number;
  event_id: number;
  season_id: number | null;
  game_date: string | null;
  event_owner_team_id: number | null;
  shooter_player_id: number | null;
  shot_event_type: string | null;
  is_unblocked_shot_attempt: boolean;
  is_rebound_shot: boolean;
  is_penalty_shot_event: boolean;
  is_shootout_event: boolean;
  previous_event_id: number | null;
  previous_event_type_desc_key: string | null;
  previous_event_team_id: number | null;
  previous_event_same_team: boolean | null;
  time_since_previous_event_seconds: number | null;
  distance_from_previous_event: number | null;
  feature_payload?: {
    possessionSequenceId?: string | null;
    possessionEventCount?: number | null;
    possessionDurationSeconds?: number | null;
    possessionEnteredOffensiveZone?: boolean | null;
    possessionRegainedFromOpponent?: boolean | null;
  } | null;
};

export type ShotAssistPredictionRow = {
  model_version: string;
  prediction_type: string;
  feature_version: number;
  game_id: number;
  event_id: number;
  xg: number;
  model_approved: boolean;
};

export type ShotAssistPriorEventRow = {
  game_id: number;
  event_id: number;
  type_desc_key: string | null;
  event_owner_team_id: number | null;
  player_id: number | null;
  shooting_player_id: number | null;
  scoring_player_id: number | null;
  winning_player_id: number | null;
  hitting_player_id: number | null;
  blocking_player_id: number | null;
  zone_code: string | null;
};

export type ShotAssistCandidateRow = {
  model_version: string;
  feature_version: number;
  game_id: number;
  event_id: number;
  season_id: number | null;
  game_date: string | null;
  event_owner_team_id: number | null;
  shooter_player_id: number | null;
  shot_assist_player_id: number;
  source_event_id: number;
  source_event_type_desc_key: string | null;
  candidate_rank: 1;
  confidence: number;
  confidence_tier: "low" | "medium" | "high";
  xg: number;
  expected_primary_assists: number;
  heuristic_reason: string;
  provenance: Record<string, unknown>;
  updated_at: string;
};

const MAX_SHOT_ASSIST_WINDOW_SECONDS = 8;
const EXCLUDED_SOURCE_EVENT_TYPES = new Set([
  "faceoff",
  "goal",
  "shot-on-goal",
  "missed-shot",
  "blocked-shot",
  "failed-shot-attempt",
  "stoppage",
  "period-start",
  "period-end",
  "game-start",
  "game-end",
  "penalty",
  "delayed-penalty",
  "giveaway",
  "line-change",
  "player-change",
]);
const LOW_CONFIDENCE_SOURCE_TYPES = new Set([
  "hit",
]);

function eventKey(args: { gameId: number; eventId: number }): string {
  return `${args.gameId}:${args.eventId}`;
}

function roundMetric(value: number): number {
  return Number(value.toFixed(6));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function confidenceTier(confidence: number): "low" | "medium" | "high" {
  if (confidence >= 0.7) return "high";
  if (confidence >= 0.45) return "medium";
  return "low";
}

function resolvePriorEventActor(row: ShotAssistPriorEventRow): number | null {
  const type = row.type_desc_key ?? "";
  if (type === "takeaway") return row.player_id;
  if (type === "hit") return row.hitting_player_id ?? row.player_id;
  if (type === "blocked-shot") return row.blocking_player_id ?? row.player_id;
  if (type === "faceoff") return row.winning_player_id ?? row.player_id;
  return (
    row.player_id ??
    row.shooting_player_id ??
    row.scoring_player_id ??
    row.hitting_player_id ??
    row.blocking_player_id ??
    row.winning_player_id ??
    null
  );
}

function scoreShotAssistConfidence(
  feature: ShotAssistFeatureRow,
  priorEvent: ShotAssistPriorEventRow
): { confidence: number; reason: string } {
  const time = feature.time_since_previous_event_seconds;
  const distance = feature.distance_from_previous_event;
  let confidence = 0.35;
  const reasons = ["previous_same_team_controlled_event"];

  if (time != null && time <= 3) {
    confidence += 0.25;
    reasons.push("quick_release_window");
  } else if (time != null && time <= 5) {
    confidence += 0.15;
    reasons.push("moderate_release_window");
  }

  if (distance != null && distance <= 35) {
    confidence += 0.15;
    reasons.push("nearby_source_event");
  } else if (distance != null && distance <= 70) {
    confidence += 0.05;
    reasons.push("same_sequence_source_event");
  }

  if (feature.feature_payload?.possessionEnteredOffensiveZone === true) {
    confidence += 0.1;
    reasons.push("same_possession_entry_context");
  }
  if (feature.feature_payload?.possessionRegainedFromOpponent === true) {
    confidence += 0.05;
    reasons.push("same_possession_regain_context");
  }
  if (LOW_CONFIDENCE_SOURCE_TYPES.has(priorEvent.type_desc_key ?? "")) {
    confidence -= 0.2;
    reasons.push("low_confidence_source_event_type");
  }

  return {
    confidence: roundMetric(clamp(confidence, 0.1, 0.85)),
    reason: reasons.join("+"),
  };
}

export function buildShotAssistCandidateRows(args: {
  features: ShotAssistFeatureRow[];
  predictions: ShotAssistPredictionRow[];
  priorEvents: ShotAssistPriorEventRow[];
  generatedAt?: string;
}): ShotAssistCandidateRow[] {
  const generatedAt = args.generatedAt ?? new Date().toISOString();
  const predictionByKey = new Map(
    args.predictions
      .filter(
        (row) =>
          row.prediction_type === "shot_goal" &&
          row.model_approved === true &&
          Number.isFinite(row.xg)
      )
      .map((row) => [
        `${row.model_version}:${row.feature_version}:${row.game_id}:${row.event_id}`,
        row,
      ])
  );
  const predictionKeysByFeature = new Map<string, string[]>();
  for (const prediction of args.predictions) {
    const featureKey = `${prediction.feature_version}:${prediction.game_id}:${prediction.event_id}`;
    const keys = predictionKeysByFeature.get(featureKey) ?? [];
    keys.push(
      `${prediction.model_version}:${prediction.feature_version}:${prediction.game_id}:${prediction.event_id}`
    );
    predictionKeysByFeature.set(featureKey, keys);
  }
  const priorEventByKey = new Map(
    args.priorEvents.map((row) => [eventKey({ gameId: row.game_id, eventId: row.event_id }), row])
  );
  const candidates: ShotAssistCandidateRow[] = [];

  for (const feature of args.features) {
    if (!feature.is_unblocked_shot_attempt) continue;
    if (feature.is_rebound_shot) continue;
    if (feature.is_penalty_shot_event || feature.is_shootout_event) continue;
    if (feature.previous_event_id == null) continue;
    if (feature.previous_event_same_team !== true) continue;
    if (
      feature.time_since_previous_event_seconds == null ||
      feature.time_since_previous_event_seconds <= 0 ||
      feature.time_since_previous_event_seconds > MAX_SHOT_ASSIST_WINDOW_SECONDS
    ) {
      continue;
    }
    if (EXCLUDED_SOURCE_EVENT_TYPES.has(feature.previous_event_type_desc_key ?? "")) {
      continue;
    }

    const priorEvent = priorEventByKey.get(
      eventKey({ gameId: feature.game_id, eventId: feature.previous_event_id })
    );
    if (!priorEvent) continue;
    if (priorEvent.event_owner_team_id !== feature.event_owner_team_id) continue;

    const shotAssistPlayerId = resolvePriorEventActor(priorEvent);
    if (shotAssistPlayerId == null || shotAssistPlayerId === feature.shooter_player_id) {
      continue;
    }

    const predictionKeys =
      predictionKeysByFeature.get(`${feature.feature_version}:${feature.game_id}:${feature.event_id}`) ??
      [];
    for (const predictionKey of predictionKeys) {
      const approvedPrediction = predictionByKey.get(predictionKey);
      if (!approvedPrediction) continue;

      const scored = scoreShotAssistConfidence(feature, priorEvent);
      candidates.push({
        model_version: approvedPrediction.model_version,
        feature_version: feature.feature_version,
        game_id: feature.game_id,
        event_id: feature.event_id,
        season_id: feature.season_id,
        game_date: feature.game_date,
        event_owner_team_id: feature.event_owner_team_id,
        shooter_player_id: feature.shooter_player_id,
        shot_assist_player_id: shotAssistPlayerId,
        source_event_id: priorEvent.event_id,
        source_event_type_desc_key: priorEvent.type_desc_key,
        candidate_rank: 1,
        confidence: scored.confidence,
        confidence_tier: confidenceTier(scored.confidence),
        xg: approvedPrediction.xg,
        expected_primary_assists: roundMetric(approvedPrediction.xg * scored.confidence),
        heuristic_reason: scored.reason,
        provenance: {
          source: "nhl_xg_shot_features+nhl_xg_shot_predictions+nhl_api_pbp_events",
          heuristicVersion: 1,
          note: "Inferred candidate, not official tracked pass data.",
        },
        updated_at: generatedAt,
      });
    }
  }

  return candidates.sort((left, right) =>
    `${left.game_id}:${left.event_id}:${left.shot_assist_player_id}`.localeCompare(
      `${right.game_id}:${right.event_id}:${right.shot_assist_player_id}`
    )
  );
}
