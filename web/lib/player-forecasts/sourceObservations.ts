import { tweetPipelineFlags, type TweetInterpretation } from "lib/sources/tweetInterpretation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { starterBoardFlags } from "lib/projections/starterBoardFlags";

import { PLAYER_FORECAST_DEBOUNCE_MS } from "./contracts";
import { buildNextTenGameScopes, type PlayerForecastScheduleGame } from "./schedule";

export type ForecastLineSourceRow = {
  capture_key: string;
  source_group: string;
  source_key: string;
  source_account: string | null;
  source_url: string | null;
  quoted_tweet_id?: string | null;
  quoted_tweet_url?: string | null;
  quoted_author_handle?: string | null;
  primary_text_source?: string | null;
  quoted_enriched_text?: string | null;
  quoted_raw_text?: string | null;
  raw_text: string | null;
  enriched_text: string | null;
  classification: string | null;
  game_id: number | null;
  team_id: number | null;
  status: string;
  nhl_filter_status: string;
  observed_at: string;
  tweet_posted_at: string | null;
  line_1_player_ids: Array<number | null> | null;
  line_1_player_names: string[] | null;
  line_2_player_ids: Array<number | null> | null;
  line_2_player_names: string[] | null;
  line_3_player_ids: Array<number | null> | null;
  line_3_player_names: string[] | null;
  line_4_player_ids: Array<number | null> | null;
  line_4_player_names: string[] | null;
  pair_1_player_ids: Array<number | null> | null;
  pair_1_player_names: string[] | null;
  pair_2_player_ids: Array<number | null> | null;
  pair_2_player_names: string[] | null;
  pair_3_player_ids: Array<number | null> | null;
  pair_3_player_names: string[] | null;
  goalie_1_player_id: number | null;
  goalie_1_name: string | null;
  goalie_2_player_id: number | null;
  goalie_2_name: string | null;
  scratches_player_ids: Array<number | null> | null;
  scratches_player_names: string[] | null;
  injured_player_ids: Array<number | null> | null;
  injured_player_names: string[] | null;
  metadata?: Record<string, unknown> | null;
};

type CaptureSummary = {
  goalieObservations: number;
  lineupSnapshots: number;
  lineupAssignments: number;
  conflicts: number;
  jobsQueued: number;
};

function isDuplicate(error: { code?: string } | null): boolean {
  return error?.code === "23505";
}

function validDate(value: string | null | undefined): string {
  const parsed = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date().toISOString();
}

function availableAt(row: ForecastLineSourceRow): string {
  const observed = validDate(row.observed_at);
  const posted = row.tweet_posted_at ? validDate(row.tweet_posted_at) : observed;
  return Date.parse(observed) >= Date.parse(posted) ? observed : posted;
}

function sourceTiming(row: ForecastLineSourceRow) {
  const known = (value: string | null) => value && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null;
  const usesQuote = row.primary_text_source === "quoted_oembed";
  const sourceUrl = usesQuote ? row.quoted_tweet_url : row.source_url;
  const tweetId = (usesQuote ? row.quoted_tweet_id : null) ?? sourceUrl?.match(/\/status(?:es)?\/(\d+)/i)?.[1];
  return { sourcePublishedAt: known(row.tweet_posted_at), receivedAt: known(row.observed_at),
    sourceReference: tweetId ? `tweet:${tweetId}` : sourceUrl || null };
}

function primaryReportText(row: ForecastLineSourceRow): string | null {
  return row.primary_text_source === "quoted_oembed"
    ? row.quoted_enriched_text ?? row.quoted_raw_text ?? null
    : row.enriched_text ?? row.raw_text;
}

export function goalieObservationStatus(
  text: string | null | undefined,
): "confirmed" | "likely" | "projected" | "unconfirmed" | "ruled_out" {
  const normalized = String(text ?? "").toLowerCase();
  if (/\b(ruled out|will not start|not starting)\b/.test(normalized)) return "ruled_out";
  if (/\b(confirmed|will start|gets the start|starting tonight|starts tonight)\b/.test(normalized)) {
    return "confirmed";
  }
  if (/\b(likely|probable)\b/.test(normalized)) return "likely";
  if (/\b(projected|expected)\b/.test(normalized)) return "projected";
  return "unconfirmed";
}

export function injuryObservationStatus(text: string | null | undefined): "observed" | "confirmed" | "ruled_out" {
  const value = String(text ?? "").toLowerCase();
  if (/\b(not (?:yet )?ruled out|hasn't been ruled out|not out tonight|not cleared|could|might|may|if)\b/.test(value)) return "observed";
  if (/\b(ruled out|will not play|won't play|will not return|won't return|out tonight|out for tonight|placed on (?:injured reserve|ir|ltir))\b/.test(value)) return "ruled_out";
  if (/\b(will play|will return|returns tonight|cleared to play)\b/.test(value)) return "confirmed";
  return "observed";
}

export function assignmentsFor(row: ForecastLineSourceRow) {
  const result: Array<{
    player_id: number | null;
    raw_player_name: string | null;
    unit_type: string;
    unit_number: number | null;
    slot_number: number | null;
    assignment_status: string;
  }> = [];
  const addGroup = (
    ids: Array<number | null> | null,
    names: string[] | null,
    unitType: string,
    unitNumber: number | null,
    status = "observed",
  ) => {
    const length = Math.max(ids?.length ?? 0, names?.length ?? 0);
    for (let index = 0; index < length; index += 1) {
      const playerId = ids?.[index] ?? null;
      const rawName = names?.[index]?.trim() || null;
      if (playerId == null && !rawName) continue;
      result.push({
        player_id: Number.isFinite(playerId) ? Number(playerId) : null,
        raw_player_name: rawName,
        unit_type: unitType,
        unit_number: unitNumber,
        slot_number: index + 1,
        assignment_status: status,
      });
    }
  };

  const interpretation = row.metadata?.interpretation as TweetInterpretation | undefined;
  if (interpretation) {
    if (interpretation.context !== "game") return result;
    const complete = interpretation.units.filter((unit) => unit.complete && !unit.group);
    const forwards = complete.filter((unit) => unit.situation === "es_forward");
    const defense = complete.filter((unit) => unit.situation === "es_defense");
    if (forwards.length === 4 && defense.length === 3 && new Set([...forwards, ...defense].flatMap((unit) => unit.players.map((player) => player.playerId))).size === 18) {
      for (const unit of [...forwards, ...defense]) addGroup(unit.players.map((player) => player.playerId), unit.players.map((player) => player.name), unit.situation === "es_forward" ? "forward_line" : "defense_pair", unit.number);
    }
    for (const situation of ["pp", "pk"] as const) {
      const units = complete.filter((unit) => unit.situation === situation);
      if (units.length === 2 && units.some((unit) => unit.number === 1) && units.some((unit) => unit.number === 2)) {
        for (const unit of units) addGroup(unit.players.map((player) => player.playerId), unit.players.map((player) => player.name), situation === "pp" ? "power_play" : "penalty_kill", unit.number);
      }
    }
    for (const event of interpretation.events ?? []) {
      if (event.kind === "injury" && event.availability !== "available") addGroup([event.playerId], [event.playerName], "injury", null, event.availability === "out" ? "ruled_out" : "observed");
      if (event.kind === "goalie" && event.state !== "ruled_out") addGroup([event.playerId], [event.playerName], "goalie_order", null, event.state === "confirmed" ? "confirmed" : "observed");
    }
    return result;
  }

  [1, 2, 3, 4].forEach((line) =>
    addGroup(
      row[`line_${line}_player_ids` as keyof ForecastLineSourceRow] as Array<number | null> | null,
      row[`line_${line}_player_names` as keyof ForecastLineSourceRow] as string[] | null,
      "forward_line",
      line,
    ),
  );
  [1, 2, 3].forEach((pair) =>
    addGroup(
      row[`pair_${pair}_player_ids` as keyof ForecastLineSourceRow] as Array<number | null> | null,
      row[`pair_${pair}_player_names` as keyof ForecastLineSourceRow] as string[] | null,
      "defense_pair",
      pair,
    ),
  );
  // The parser preserves PP units independently of forward lines/defense pairs.
  const ppIds = row.metadata?.powerPlayUnitPlayerIds;
  const ppNames = row.metadata?.powerPlayUnits;
  const ppLabels = row.metadata?.powerPlayUnitLabels;
  if (Array.isArray(ppIds) && Array.isArray(ppNames)) {
    ppIds.forEach((ids, index) => {
      const label = Array.isArray(ppLabels) ? ppLabels[index] : null;
      const unit = label === "pp1" ? 1 : label === "pp2" ? 2 : null;
      if (unit != null && Array.isArray(ids) && Array.isArray(ppNames[index])) {
        addGroup(ids, ppNames[index], "power_play", unit);
      }
    });
  }
  addGroup(
    [row.goalie_1_player_id, row.goalie_2_player_id],
    [row.goalie_1_name ?? "", row.goalie_2_name ?? ""],
    "goalie_order",
    null,
  );
  addGroup(row.scratches_player_ids, row.scratches_player_names, "scratch", null, "ruled_out");
  // Ambiguous multi-player reports cannot safely attach one sentence's status
  // to every mentioned player. Mere injury mentions are not exclusions.
  const injuryCount = Math.max(row.injured_player_ids?.length ?? 0, row.injured_player_names?.length ?? 0);
  addGroup(row.injured_player_ids, row.injured_player_names, "injury", null,
    injuryCount === 1 ? injuryObservationStatus(primaryReportText(row)) : "observed");
  return result;
}

async function recordGoalieConflict(args: {
  supabase: SupabaseClient<any>;
  row: ForecastLineSourceRow;
  currentObservationId: string;
  currentPlayerId: number | null;
  watermark: string;
}): Promise<boolean> {
  if (args.currentPlayerId == null) return false;
  const { data: observations, error } = await args.supabase
    .from("player_forecast_goalie_start_observations")
    .select("id,player_id,available_at,observed_at,source_account,source_key")
    .eq("game_id", args.row.game_id!)
    .eq("team_id", args.row.team_id!)
    .eq("accepted", true)
    .eq("observation_status", "confirmed")
    .neq("player_id", args.currentPlayerId)
    .order("available_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  // A reporter correcting their own earlier starter assertion is supersession,
  // not independent conflicting confirmation. Retain both immutable records.
  const reporter = args.row.source_account || args.row.source_key;
  const currentPublished = Date.parse(args.row.tweet_posted_at || args.watermark);
  const prior = observations?.find((item) => !(
    reporter && (item.source_account || item.source_key) === reporter &&
    Date.parse(item.observed_at) <= currentPublished
  ));
  if (!prior?.id || prior.player_id == null) return false;

  const conflictKey = `goalie:${args.row.game_id}:${args.row.team_id}`;
  const { data: latest, error: latestError } = await args.supabase
    .from("player_forecast_observation_conflicts")
    .select("conflict_version,source_high_watermark")
    .eq("conflict_key", conflictKey)
    .order("conflict_version", { ascending: false })
    .limit(1);
  if (latestError) throw latestError;
  if (latest?.[0]?.source_high_watermark === args.watermark) return false;

  const { data: conflict, error: conflictError } = await args.supabase
    .from("player_forecast_observation_conflicts")
    .insert({
      conflict_key: conflictKey,
      conflict_version: Number(latest?.[0]?.conflict_version ?? 0) + 1,
      conflict_type: "goalie_start",
      game_id: args.row.game_id,
      team_id: args.row.team_id,
      player_id: args.currentPlayerId,
      detected_at: new Date().toISOString(),
      source_high_watermark: args.watermark,
      summary: `Conflicting confirmed goalie observations for game ${args.row.game_id}, team ${args.row.team_id}.`,
      metadata: { needsReview: true },
    })
    .select("id")
    .single();
  if (conflictError) {
    if (isDuplicate(conflictError)) return false;
    throw conflictError;
  }
  const { error: memberError } = await args.supabase
    .from("player_forecast_conflict_members")
    .insert([
      {
        conflict_id: conflict.id,
        observation_type: "goalie_start",
        observation_id: prior.id,
        position: 1,
      },
      {
        conflict_id: conflict.id,
        observation_type: "goalie_start",
        observation_id: args.currentObservationId,
        position: 2,
      },
    ]);
  if (memberError) throw memberError;
  return true;
}

async function enqueueGameScope(args: {
  supabase: SupabaseClient<any>;
  row: ForecastLineSourceRow;
  watermark: string;
}): Promise<void> {
  const notBefore = new Date(Date.parse(args.watermark) + PLAYER_FORECAST_DEBOUNCE_MS).toISOString();
  const { error } = await args.supabase.rpc("enqueue_player_forecast_job", {
    p_scope_key: `game:${args.row.game_id}:team:${args.row.team_id}`,
    p_game_id: args.row.game_id,
    p_team_id: args.row.team_id,
    p_team_game_horizon: null,
    p_reason: `source:${args.row.source_key}:${args.row.classification ?? "other"}`,
    p_observed_at: args.watermark,
    p_not_before: notBefore,
    p_metadata: { sourceCaptureKey: args.row.capture_key },
  } as never);
  if (error) throw error;
}

async function enqueueTeamHorizon(args: {
  supabase: SupabaseClient<any>;
  row: ForecastLineSourceRow;
  watermark: string;
}): Promise<number> {
  const now = new Date(args.watermark);
  const { data, error } = await args.supabase
    .from("games")
    .select("id,seasonId,date,startTime,homeTeamId,awayTeamId,type")
    .gte("date", now.toISOString().slice(0, 10))
    .order("date", { ascending: true })
    .order("startTime", { ascending: true })
    .limit(100);
  if (error) throw error;
  const scopes = buildNextTenGameScopes({
    games: (data ?? []) as PlayerForecastScheduleGame[],
    now,
    teamId: args.row.team_id!,
  });
  const notBefore = new Date(now.getTime() + PLAYER_FORECAST_DEBOUNCE_MS).toISOString();
  for (const scope of scopes) {
    const { error: queueError } = await args.supabase.rpc("enqueue_player_forecast_job", {
      p_scope_key: scope.scopeKey,
      p_game_id: scope.gameId,
      p_team_id: scope.teamId,
      p_team_game_horizon: scope.teamGameHorizon,
      p_reason: `source:${args.row.source_key}:injury`,
      p_observed_at: args.watermark,
      p_not_before: notBefore,
      p_metadata: { sourceCaptureKey: args.row.capture_key, teamWide: true },
    } as never);
    if (queueError) throw queueError;
  }
  return scopes.length;
}

export async function capturePlayerForecastSourceRows(args: {
  supabase: SupabaseClient<any>;
  rows: ForecastLineSourceRow[];
  parserVersion?: string;
}): Promise<CaptureSummary> {
  const summary: CaptureSummary = {
    goalieObservations: 0,
    lineupSnapshots: 0,
    lineupAssignments: 0,
    conflicts: 0,
    jobsQueued: 0,
  };

  for (const sourceRow of args.rows) {
    const usesQuote = sourceRow.primary_text_source === "quoted_oembed";
    const quoteAuthor = sourceRow.quoted_author_handle?.replace(/^@/, "");
    const row = usesQuote ? { ...sourceRow,
      source_account: quoteAuthor && /^[A-Za-z0-9_]{1,15}$/.test(quoteAuthor) ? quoteAuthor.toLowerCase() : sourceRow.source_account,
      source_url: sourceRow.quoted_tweet_url ?? sourceRow.source_url,
      metadata: { ...sourceRow.metadata, relaySourceAccount: sourceRow.source_account, relaySourceUrl: sourceRow.source_url,
        originalAuthorKnown: Boolean(quoteAuthor && /^[A-Za-z0-9_]{1,15}$/.test(quoteAuthor)) },
    } : sourceRow;
    if (
      row.status !== "observed" ||
      row.nhl_filter_status !== "accepted" ||
      row.game_id == null ||
      row.team_id == null
    ) continue;

    const interpretation = row.metadata?.interpretation as TweetInterpretation | undefined;
    if (interpretation && !tweetPipelineFlags().publishing) continue;
    const parserVersion = args.parserVersion ?? interpretation?.version ?? "line-source-v2";
    const watermark = availableAt(row);
    const observedAt = row.tweet_posted_at ? validDate(row.tweet_posted_at) : watermark;
    const text = primaryReportText(row);

    if (row.classification === "goalie_start") {
      const parsedStatus = goalieObservationStatus(text);
      const goalies = [
        { playerId: row.goalie_1_player_id, name: row.goalie_1_name },
        { playerId: row.goalie_2_player_id, name: row.goalie_2_name },
      ].filter((goalie) => goalie.playerId != null || goalie.name);
      // A sentence about one starter must not confirm every mentioned goalie.
      const status = goalies.length === 1 ? parsedStatus : "unconfirmed";
      const observations = goalies.map((goalie) => ({
        game_id: row.game_id,
        team_id: row.team_id,
        player_id: goalie.playerId,
        raw_player_name: goalie.name,
        observation_status: interpretation?.events?.find((event) => event.kind === "goalie" && event.playerId === goalie.playerId)?.state ?? status,
        confidence: null,
        raw_status: text,
        source_group: row.source_group,
        source_key: row.source_key,
        source_account: row.source_account,
        source_capture_key: row.capture_key,
        source_url: row.source_url,
        observed_at: observedAt,
        available_at: watermark,
        expires_at: null,
        parser_version: parserVersion,
        accepted: true,
        metadata: { ...row.metadata, sourceTiming: sourceTiming(row) },
      }));
      if ((starterBoardFlags().capture || interpretation) && observations.length) {
        const { data: captured, error } = await args.supabase.rpc("capture_starter_board_goalies", { p_observations: observations });
        if (error) throw error;
        summary.goalieObservations += captured.insertedObservations;
        summary.conflicts += captured.insertedConflicts;
      } else for (const observation of observations) {
        const { data, error } = await args.supabase
          .from("player_forecast_goalie_start_observations")
          .insert(observation)
          .select("id")
          .single();
        if (error) {
          if (isDuplicate(error)) continue;
          throw error;
        }
        summary.goalieObservations += 1;
        if (
          status === "confirmed" &&
          await recordGoalieConflict({
            supabase: args.supabase,
            row,
            currentObservationId: data.id,
            currentPlayerId: observation.player_id,
            watermark,
          })
        ) summary.conflicts += 1;
      }
    }

    if (["lineup", "practice_lines", "power_play", "injury"].includes(row.classification ?? "")) {
      const assignments = assignmentsFor(row);
      if (interpretation && !assignments.length) continue;
      const denominator = row.classification === "injury" ? Math.max(1, assignments.length) : 20;
      const snapshot = {
        game_id: row.game_id,
        team_id: row.team_id,
        source_group: row.source_group,
        source_key: row.source_key,
        source_account: row.source_account,
        source_capture_key: row.capture_key,
        source_url: row.source_url,
        classification: row.classification,
        observed_at: observedAt,
        available_at: watermark,
        expires_at: null,
        completeness: Math.min(1, assignments.length / denominator),
        accepted: true,
        parser_version: parserVersion,
        metadata: { ...row.metadata, sourceTiming: sourceTiming(row) },
      };
      if (starterBoardFlags().capture || interpretation) {
        const { data: captured, error: captureError } = await args.supabase.rpc("capture_starter_board_lineup", {
          p_snapshot: snapshot, p_assignments: assignments,
        });
        if (captureError) throw captureError;
        summary.lineupSnapshots += captured.insertedSnapshot ? 1 : 0;
        summary.lineupAssignments += captured.insertedAssignments;
      } else {
        let snapshotId: string | null = null;
        const { data, error } = await args.supabase
          .from("player_forecast_lineup_snapshots")
          .insert(snapshot)
          .select("id")
          .single();
        if (error && !isDuplicate(error)) throw error;
        if (data?.id) {
          snapshotId = data.id;
          summary.lineupSnapshots += 1;
        } else {
          const { data: existing, error: existingError } = await args.supabase
            .from("player_forecast_lineup_snapshots")
            .select("id")
            .eq("source_capture_key", row.capture_key)
            .eq("team_id", row.team_id)
            .single();
          if (existingError) throw existingError;
          snapshotId = existing.id;
        }
        if (snapshotId && assignments.length > 0 && data?.id) {
          const { error: assignmentError } = await args.supabase
            .from("player_forecast_lineup_assignments")
            .insert(assignments.map((assignment) => ({ ...assignment, snapshot_id: snapshotId })));
          if (assignmentError && !isDuplicate(assignmentError)) throw assignmentError;
          if (!assignmentError) summary.lineupAssignments += assignments.length;
        }
      }
    }

    if (row.classification === "injury") {
      summary.jobsQueued += await enqueueTeamHorizon({
        supabase: args.supabase,
        row,
        watermark,
      });
    } else {
      await enqueueGameScope({ supabase: args.supabase, row, watermark });
      summary.jobsQueued += 1;
    }
  }

  return summary;
}
