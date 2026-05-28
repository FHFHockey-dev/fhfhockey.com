export type TransitionFeatureRow = {
  feature_version: number;
  game_id: number;
  event_id: number;
  season_id: number | null;
  game_date: string | null;
  event_owner_team_id: number | null;
  shooter_player_id: number | null;
  is_unblocked_shot_attempt: boolean;
  is_rebound_shot: boolean;
  is_penalty_shot_event: boolean;
  is_shootout_event: boolean;
  is_rush_shot: boolean;
  rush_source_event_id: number | null;
  rush_source_type_desc_key: string | null;
  rush_time_since_source_seconds: number | null;
  previous_event_id: number | null;
  previous_event_type_desc_key: string | null;
  previous_event_same_team: boolean | null;
  time_since_previous_event_seconds: number | null;
  feature_payload?: {
    possessionSequenceId?: string | null;
    possessionEventCount?: number | null;
    possessionDurationSeconds?: number | null;
    possessionStartEventId?: number | null;
    possessionStartTypeDescKey?: string | null;
    possessionStartZoneCode?: string | null;
    possessionRegainedFromOpponent?: boolean | null;
    possessionRegainEventTypeDescKey?: string | null;
    possessionEnteredOffensiveZone?: boolean | null;
    rushSourceTeamRelativeZoneCode?: string | null;
  } | null;
};

export type TransitionPredictionRow = {
  model_version: string;
  prediction_type: string;
  feature_version: number;
  game_id: number;
  event_id: number;
  xg: number;
  model_approved: boolean;
};

export type TransitionSourceEventRow = {
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

export type TransitionEventType =
  | "controlled_entry_proxy"
  | "dump_in_entry_proxy"
  | "controlled_exit_proxy"
  | "failed_exit_against_proxy"
  | "entry_assist_proxy"
  | "transition_created_shot";

export type TransitionEventRow = {
  model_version: string;
  feature_version: number;
  game_id: number;
  event_id: number;
  transition_type: TransitionEventType;
  season_id: number | null;
  game_date: string | null;
  team_id: number | null;
  player_id: number | null;
  source_event_id: number | null;
  source_event_type_desc_key: string | null;
  confidence: number;
  confidence_tier: "low" | "medium" | "high";
  shot_event_id: number;
  shot_xg: number;
  transition_created_xg: number;
  provenance: Record<string, unknown>;
  updated_at: string;
};

export type TransitionAggregateRow = {
  model_version: string;
  feature_version: number;
  season_id: number | null;
  game_id: number;
  game_date: string | null;
  entity_type: "team" | "player";
  entity_id: number;
  controlled_entries: number;
  controlled_exits: number;
  failed_exits_against: number;
  entry_assists: number;
  transition_created_shots: number;
  transition_created_xg: number;
  provenance: Record<string, unknown>;
  updated_at: string;
};

function roundMetric(value: number): number {
  return Number(value.toFixed(6));
}

function eventKey(gameId: number, eventId: number): string {
  return `${gameId}:${eventId}`;
}

function confidenceTier(confidence: number): "low" | "medium" | "high" {
  if (confidence >= 0.7) return "high";
  if (confidence >= 0.45) return "medium";
  return "low";
}

function normalizeZone(zone: string | null | undefined): string | null {
  if (!zone) return null;
  const normalized = zone.trim().toUpperCase();
  return normalized.length ? normalized : null;
}

function sourceActor(row: TransitionSourceEventRow | null): number | null {
  if (!row) return null;
  if (row.type_desc_key === "takeaway") return row.player_id;
  if (row.type_desc_key === "hit") return row.hitting_player_id ?? row.player_id;
  if (row.type_desc_key === "blocked-shot") return row.blocking_player_id ?? row.player_id;
  return (
    row.player_id ??
    row.shooting_player_id ??
    row.scoring_player_id ??
    row.winning_player_id ??
    row.hitting_player_id ??
    row.blocking_player_id ??
    null
  );
}

function isControlledSource(type: string | null): boolean {
  return (
    type !== "faceoff" &&
    type !== "giveaway" &&
    type !== "blocked-shot" &&
    type !== "failed-shot-attempt" &&
    type !== "shot-on-goal" &&
    type !== "missed-shot" &&
    type !== "goal"
  );
}

function isDumpInSource(type: string | null): boolean {
  const normalized = type?.trim().toLowerCase() ?? "";
  return normalized.includes("dump");
}

function isTransitionShot(feature: TransitionFeatureRow): boolean {
  if (!feature.is_unblocked_shot_attempt) return false;
  if (feature.is_rebound_shot) return false;
  if (feature.is_penalty_shot_event || feature.is_shootout_event) return false;
  if (feature.is_rush_shot) return true;
  return (
    feature.feature_payload?.possessionEnteredOffensiveZone === true &&
    (feature.feature_payload.possessionDurationSeconds ?? 999) <= 15
  );
}

function predictionKey(row: TransitionPredictionRow): string {
  return `${row.model_version}:${row.feature_version}:${row.game_id}:${row.event_id}`;
}

function featurePredictionKey(modelVersion: string, feature: TransitionFeatureRow): string {
  return `${modelVersion}:${feature.feature_version}:${feature.game_id}:${feature.event_id}`;
}

function addAggregateMetric(
  map: Map<string, TransitionAggregateRow>,
  args: {
    event: TransitionEventRow;
    entityType: "team" | "player";
    entityId: number | null;
  }
) {
  if (args.entityId == null) return;
  const key = [
    args.event.model_version,
    args.event.feature_version,
    args.event.game_id,
    args.entityType,
    args.entityId,
  ].join(":");
  const current =
    map.get(key) ??
    ({
      model_version: args.event.model_version,
      feature_version: args.event.feature_version,
      season_id: args.event.season_id,
      game_id: args.event.game_id,
      game_date: args.event.game_date,
      entity_type: args.entityType,
      entity_id: args.entityId,
      controlled_entries: 0,
      controlled_exits: 0,
      failed_exits_against: 0,
      entry_assists: 0,
      transition_created_shots: 0,
      transition_created_xg: 0,
      provenance: {
        source: "nhl_xg_transition_events",
        heuristicVersion: 1,
      },
      updated_at: args.event.updated_at,
    } satisfies TransitionAggregateRow);

  if (args.event.transition_type === "controlled_entry_proxy") {
    current.controlled_entries += 1;
  } else if (args.event.transition_type === "controlled_exit_proxy") {
    current.controlled_exits += 1;
  } else if (args.event.transition_type === "dump_in_entry_proxy") {
    current.controlled_entries += 1;
  } else if (args.event.transition_type === "failed_exit_against_proxy") {
    current.failed_exits_against += 1;
  } else if (args.event.transition_type === "entry_assist_proxy") {
    current.entry_assists += 1;
  } else if (args.event.transition_type === "transition_created_shot") {
    current.transition_created_shots += 1;
    current.transition_created_xg = roundMetric(
      current.transition_created_xg + args.event.transition_created_xg
    );
  }

  map.set(key, current);
}

export function buildTransitionRows(args: {
  features: TransitionFeatureRow[];
  predictions: TransitionPredictionRow[];
  sourceEvents: TransitionSourceEventRow[];
  modelVersion: string;
  generatedAt?: string;
}): { events: TransitionEventRow[]; aggregates: TransitionAggregateRow[] } {
  const generatedAt = args.generatedAt ?? new Date().toISOString();
  const predictionByKey = new Map(
    args.predictions
      .filter(
        (row) =>
          row.prediction_type === "shot_goal" &&
          row.model_approved === true &&
          Number.isFinite(row.xg)
      )
      .map((row) => [predictionKey(row), row])
  );
  const sourceByKey = new Map(
    args.sourceEvents.map((row) => [eventKey(row.game_id, row.event_id), row])
  );
  const events: TransitionEventRow[] = [];

  for (const feature of args.features) {
    if (!isTransitionShot(feature)) continue;
    const prediction = predictionByKey.get(featurePredictionKey(args.modelVersion, feature));
    if (!prediction) continue;

    const rushSource =
      feature.rush_source_event_id == null
        ? null
        : sourceByKey.get(eventKey(feature.game_id, feature.rush_source_event_id)) ?? null;
    const possessionStartId = feature.feature_payload?.possessionStartEventId ?? null;
    const possessionSource =
      possessionStartId == null
        ? null
        : sourceByKey.get(eventKey(feature.game_id, possessionStartId)) ?? null;
    const previousSource =
      feature.previous_event_id == null
        ? null
        : sourceByKey.get(eventKey(feature.game_id, feature.previous_event_id)) ?? null;

    const transitionSource = rushSource ?? possessionSource ?? previousSource ?? null;
    const transitionActor = sourceActor(transitionSource);
    const sourceZone = normalizeZone(
      feature.feature_payload?.rushSourceTeamRelativeZoneCode ??
        feature.feature_payload?.possessionStartZoneCode ??
        transitionSource?.zone_code ??
        null
    );
    const sourceEventId =
      transitionSource?.event_id ??
      feature.rush_source_event_id ??
      possessionStartId ??
      feature.previous_event_id ??
      null;
    const sourceType =
      transitionSource?.type_desc_key ??
      feature.rush_source_type_desc_key ??
      feature.feature_payload?.possessionStartTypeDescKey ??
      feature.previous_event_type_desc_key ??
      null;

    if (sourceType === "faceoff") continue;

    const baseConfidence = feature.is_rush_shot ? 0.7 : 0.5;
    const transitionCreatedConfidence =
      sourceZone === "D" || sourceZone === "N" ? baseConfidence : baseConfidence - 0.15;

    const baseEvent = {
      model_version: prediction.model_version,
      feature_version: feature.feature_version,
      game_id: feature.game_id,
      event_id: feature.event_id,
      season_id: feature.season_id,
      game_date: feature.game_date,
      team_id: feature.event_owner_team_id,
      source_event_id: sourceEventId,
      source_event_type_desc_key: sourceType,
      shot_event_id: feature.event_id,
      shot_xg: prediction.xg,
      provenance: {
        source: "nhl_xg_shot_features+nhl_xg_shot_predictions+nhl_api_pbp_events",
        heuristicVersion: 1,
        note: "Public-PBP transition proxy, not puck-tracking zone-entry data.",
      },
      updated_at: generatedAt,
    };

    events.push({
      ...baseEvent,
      transition_type: "transition_created_shot",
      player_id: feature.shooter_player_id,
      confidence: roundMetric(transitionCreatedConfidence),
      confidence_tier: confidenceTier(transitionCreatedConfidence),
      transition_created_xg: roundMetric(prediction.xg * transitionCreatedConfidence),
    });

    if (
      (sourceZone === "N" || sourceZone === "D") &&
      isControlledSource(sourceType) &&
      transitionSource?.event_owner_team_id === feature.event_owner_team_id
    ) {
      const entryConfidence = feature.is_rush_shot ? 0.7 : 0.5;
      events.push({
        ...baseEvent,
        transition_type: "controlled_entry_proxy",
        player_id: transitionActor,
        confidence: roundMetric(entryConfidence),
        confidence_tier: confidenceTier(entryConfidence),
        transition_created_xg: roundMetric(prediction.xg * entryConfidence),
      });
    }

    if (isDumpInSource(sourceType)) {
      events.push({
        ...baseEvent,
        transition_type: "dump_in_entry_proxy",
        player_id: transitionActor,
        confidence: 0.3,
        confidence_tier: "low",
        transition_created_xg: roundMetric(prediction.xg * 0.3),
      });
    }

    if (
      sourceZone === "D" &&
      isControlledSource(sourceType) &&
      transitionSource?.event_owner_team_id === feature.event_owner_team_id
    ) {
      events.push({
        ...baseEvent,
        transition_type: "controlled_exit_proxy",
        player_id: transitionActor,
        confidence: feature.is_rush_shot ? 0.65 : 0.45,
        confidence_tier: confidenceTier(feature.is_rush_shot ? 0.65 : 0.45),
        transition_created_xg: roundMetric(prediction.xg * (feature.is_rush_shot ? 0.65 : 0.45)),
      });
    }

    if (
      transitionActor != null &&
      transitionActor !== feature.shooter_player_id &&
      feature.previous_event_same_team === true &&
      isControlledSource(sourceType) &&
      transitionSource?.event_owner_team_id === feature.event_owner_team_id &&
      feature.time_since_previous_event_seconds != null &&
      feature.time_since_previous_event_seconds <= 8
    ) {
      events.push({
        ...baseEvent,
        transition_type: "entry_assist_proxy",
        player_id: transitionActor,
        confidence: 0.45,
        confidence_tier: "medium",
        transition_created_xg: roundMetric(prediction.xg * 0.45),
      });
    }

    if (
      feature.feature_payload?.possessionRegainedFromOpponent === true &&
      sourceType === "giveaway"
    ) {
      events.push({
        ...baseEvent,
        transition_type: "failed_exit_against_proxy",
        team_id: transitionSource?.event_owner_team_id ?? null,
        player_id: sourceActor(transitionSource),
        confidence: 0.35,
        confidence_tier: "low",
        transition_created_xg: roundMetric(prediction.xg * 0.35),
      });
    }
  }

  const aggregateByKey = new Map<string, TransitionAggregateRow>();
  for (const event of events) {
    addAggregateMetric(aggregateByKey, {
      event,
      entityType: "team",
      entityId: event.team_id,
    });
    addAggregateMetric(aggregateByKey, {
      event,
      entityType: "player",
      entityId: event.player_id,
    });
  }

  return {
    events: events.sort((left, right) =>
      `${left.game_id}:${left.event_id}:${left.transition_type}`.localeCompare(
        `${right.game_id}:${right.event_id}:${right.transition_type}`
      )
    ),
    aggregates: Array.from(aggregateByKey.values()).sort((left, right) =>
      `${left.game_id}:${left.entity_type}:${left.entity_id}`.localeCompare(
        `${right.game_id}:${right.entity_type}:${right.entity_id}`
      )
    ),
  };
}
