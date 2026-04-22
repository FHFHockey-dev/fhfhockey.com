import supabase from "lib/supabase/server";
import type { Database } from "lib/supabase/database-generated.types";
import { teamsInfo } from "lib/teamsInfo";
import {
  type SandboxBandRow,
  SANDBOX_ENTITY_CONFIG,
  type SandboxEntityType,
  type SandboxExpectationState,
  type SandboxScoreRow,
  deriveLegacyExpectationState,
  getSandboxMetricLabel
} from "./entitySurface";

type PlayerRow = Database["public"]["Tables"]["players"]["Row"];
type LegacyScoreRow = Database["public"]["Tables"]["sustainability_scores"]["Row"];
type LegacyBandRow =
  Database["public"]["Tables"]["sustainability_trend_bands"]["Row"];
type PlayerBaselineRow =
  Database["public"]["Tables"]["player_baselines"]["Row"];
type UnifiedScoreRow =
  Database["public"]["Tables"]["entity_sustainability_scores_daily"]["Row"];
type UnifiedBandRow =
  Database["public"]["Tables"]["entity_sustainability_bands_daily"]["Row"];

export type SandboxEntityOption = {
  id: number;
  name: string;
  subtitle: string | null;
  imageUrl: string | null;
};

export type SandboxScoresPayload = {
  entityType: SandboxEntityType;
  requestedDate: string;
  snapshotDate: string | null;
  windowCode: string;
  totalRows: number;
  rows: SandboxScoreRow[];
  selectedRow: SandboxScoreRow | null;
};

export type SandboxBandsPayload = {
  entityType: SandboxEntityType;
  requestedDate: string;
  snapshotDate: string | null;
  windowCode: string;
  currentRows: SandboxBandRow[];
  historyRows: SandboxBandRow[];
};

const DEFAULT_LIMIT = 60;

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function parseJsonObject(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function resolveTeamMetaById(teamId: number | null | undefined) {
  if (teamId == null) return null;
  return (
    Object.values(teamsInfo).find((team) => team.id === Number(teamId)) ?? null
  );
}

function buildPlayerSubtitle(player: {
  team_id?: number | null;
  position?: string | null;
}) {
  const team = resolveTeamMetaById(player.team_id ?? null);
  const parts = [team?.abbrev ?? null, player.position ?? null].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}

async function fetchPlayersByIds(playerIds: number[]) {
  if (!playerIds.length) return new Map<number, PlayerRow>();
  const { data, error } = await supabase
    .from("players")
    .select("id, fullName, position, team_id, image_url")
    .in("id", Array.from(new Set(playerIds)));

  if (error) {
    throw new Error(`Failed to load player metadata: ${error.message}`);
  }

  return new Map(
    ((data ?? []) as PlayerRow[]).map((player) => [Number(player.id), player])
  );
}

async function fetchPlayerBaselinesForSnapshot(snapshotDate: string) {
  const { data, error } = await supabase
    .from("player_baselines")
    .select("player_id, player_name, position_code, snapshot_date")
    .eq("snapshot_date", snapshotDate);

  if (error) {
    throw new Error(`Failed to load player baselines: ${error.message}`);
  }

  return new Map(
    ((data ?? []) as PlayerBaselineRow[]).map((row) => [Number(row.player_id), row])
  );
}

async function resolveLegacySnapshotDate(args: {
  requestedDate: string;
  windowCode: string;
  entityId?: number | null;
}) {
  let query = supabase
    .from("sustainability_scores")
    .select("snapshot_date")
    .eq("window_code", args.windowCode)
    .lte("snapshot_date", args.requestedDate)
    .order("snapshot_date", { ascending: false })
    .limit(1);

  if (args.entityId != null) {
    query = query.eq("player_id", args.entityId);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to resolve skater snapshot date: ${error.message}`);
  }

  if (data?.[0]?.snapshot_date) {
    return String(data[0].snapshot_date);
  }

  const latest = await supabase
    .from("sustainability_scores")
    .select("snapshot_date")
    .eq("window_code", args.windowCode)
    .order("snapshot_date", { ascending: false })
    .limit(1);

  if (latest.error) {
    throw new Error(
      `Failed to resolve latest skater snapshot date: ${latest.error.message}`
    );
  }

  return latest.data?.[0]?.snapshot_date
    ? String(latest.data[0].snapshot_date)
    : null;
}

async function resolveUnifiedSnapshotDate(args: {
  entityType: "team" | "goalie";
  requestedDate: string;
  windowCode: string;
  entityId?: number | null;
}) {
  let query = supabase
    .from("entity_sustainability_scores_daily")
    .select("snapshot_date")
    .eq("entity_type", args.entityType)
    .eq("window_code", args.windowCode)
    .lte("snapshot_date", args.requestedDate)
    .order("snapshot_date", { ascending: false })
    .limit(1);

  if (args.entityId != null) {
    query = query.eq("entity_id", args.entityId);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(
      `Failed to resolve ${args.entityType} snapshot date: ${error.message}`
    );
  }

  if (data?.[0]?.snapshot_date) {
    return String(data[0].snapshot_date);
  }

  const latest = await supabase
    .from("entity_sustainability_scores_daily")
    .select("snapshot_date")
    .eq("entity_type", args.entityType)
    .eq("window_code", args.windowCode)
    .order("snapshot_date", { ascending: false })
    .limit(1);

  if (latest.error) {
    throw new Error(
      `Failed to resolve latest ${args.entityType} snapshot date: ${latest.error.message}`
    );
  }

  return latest.data?.[0]?.snapshot_date
    ? String(latest.data[0].snapshot_date)
    : null;
}

function buildUnifiedExpectationState(
  value: string | null | undefined
): SandboxExpectationState {
  if (value === "overperforming" || value === "underperforming") {
    return value;
  }
  return "stable";
}

function normalizeLegacyScoreRow(args: {
  row: LegacyScoreRow;
  player: PlayerRow | undefined;
  baseline: PlayerBaselineRow | undefined;
}): SandboxScoreRow {
  const playerName =
    args.baseline?.player_name ??
    (args.player as unknown as { fullName?: string | null })?.fullName ??
    `Player ${args.row.player_id}`;

  return {
    entityType: "skater",
    entityId: Number(args.row.player_id),
    entityName: playerName,
    entitySubtitle: buildPlayerSubtitle(args.player ?? {}),
    teamId:
      args.player?.team_id != null ? Number(args.player.team_id) : null,
    playerId: Number(args.row.player_id),
    snapshotDate: args.row.snapshot_date,
    seasonId: args.row.season_id != null ? Number(args.row.season_id) : null,
    metricScope: "overall",
    windowCode: args.row.window_code,
    baselineValue: null,
    recentValue: null,
    expectedValue: null,
    zScore: null,
    rawScore: Number(args.row.s_raw),
    score: Number(args.row.s_100),
    expectationState: deriveLegacyExpectationState(Number(args.row.s_raw)),
    components: parseJsonObject(args.row.components),
    provenance: {},
    computedAt: args.row.computed_at
  };
}

function normalizeUnifiedScoreRow(args: {
  row: UnifiedScoreRow;
  player: PlayerRow | undefined;
}): SandboxScoreRow {
  const teamMeta = resolveTeamMetaById(args.row.team_id);
  const playerName =
    (args.player as unknown as { fullName?: string | null })?.fullName ?? null;
  const entityName =
    args.row.entity_type === "team"
      ? teamMeta?.name ?? `Team ${args.row.entity_id}`
      : playerName ?? `Player ${args.row.entity_id}`;
  const entitySubtitle =
    args.row.entity_type === "team"
      ? teamMeta?.abbrev ?? null
      : buildPlayerSubtitle(args.player ?? {});

  return {
    entityType: args.row.entity_type as SandboxEntityType,
    entityId: Number(args.row.entity_id),
    entityName,
    entitySubtitle,
    teamId: args.row.team_id != null ? Number(args.row.team_id) : null,
    playerId: args.row.player_id != null ? Number(args.row.player_id) : null,
    snapshotDate: args.row.snapshot_date,
    seasonId: args.row.season_id != null ? Number(args.row.season_id) : null,
    metricScope: args.row.metric_scope,
    windowCode: args.row.window_code,
    baselineValue:
      typeof args.row.baseline_value === "number" ? args.row.baseline_value : null,
    recentValue:
      typeof args.row.recent_value === "number" ? args.row.recent_value : null,
    expectedValue:
      typeof args.row.expected_value === "number" ? args.row.expected_value : null,
    zScore: typeof args.row.z_score === "number" ? args.row.z_score : null,
    rawScore: Number(args.row.s_raw),
    score: Number(args.row.s_100),
    expectationState: buildUnifiedExpectationState(args.row.expectation_state),
    components: parseJsonObject(args.row.components),
    provenance: parseJsonObject(args.row.provenance),
    computedAt: args.row.computed_at
  };
}

function normalizeLegacyBandRow(args: {
  row: LegacyBandRow;
  player: PlayerRow | undefined;
  baseline: PlayerBaselineRow | undefined;
}): SandboxBandRow {
  const playerName =
    args.baseline?.player_name ??
    (args.player as unknown as { fullName?: string | null })?.fullName ??
    `Player ${args.row.player_id}`;

  return {
    entityType: "skater",
    entityId: Number(args.row.player_id),
    entityName: playerName,
    metricKey: args.row.metric_key,
    metricLabel: getSandboxMetricLabel("skater", args.row.metric_key),
    windowCode: args.row.window_code,
    snapshotDate: args.row.snapshot_date,
    seasonId: args.row.season_id != null ? Number(args.row.season_id) : null,
    baseline:
      typeof args.row.baseline === "number" ? args.row.baseline : null,
    ewma: typeof args.row.ewma === "number" ? args.row.ewma : null,
    value: Number(args.row.value),
    ciLower: Number(args.row.ci_lower),
    ciUpper: Number(args.row.ci_upper),
    zScore: typeof args.row.z_score === "number" ? args.row.z_score : null,
    percentile:
      typeof args.row.percentile === "number" ? args.row.percentile : null,
    exposure: typeof args.row.exposure === "number" ? args.row.exposure : null,
    distribution: parseJsonObject(args.row.distribution),
    provenance: {}
  };
}

function normalizeUnifiedBandRow(args: {
  row: UnifiedBandRow;
  player: PlayerRow | undefined;
}): SandboxBandRow {
  const teamMeta = resolveTeamMetaById(args.row.team_id);
  const playerName =
    (args.player as unknown as { fullName?: string | null })?.fullName ?? null;
  const entityName =
    args.row.entity_type === "team"
      ? teamMeta?.name ?? `Team ${args.row.entity_id}`
      : playerName ?? `Player ${args.row.entity_id}`;

  return {
    entityType: args.row.entity_type as SandboxEntityType,
    entityId: Number(args.row.entity_id),
    entityName,
    metricKey: args.row.metric_key,
    metricLabel: getSandboxMetricLabel(
      args.row.entity_type as SandboxEntityType,
      args.row.metric_key
    ),
    windowCode: args.row.window_code,
    snapshotDate: args.row.snapshot_date,
    seasonId: args.row.season_id != null ? Number(args.row.season_id) : null,
    baseline: typeof args.row.baseline === "number" ? args.row.baseline : null,
    ewma: typeof args.row.ewma === "number" ? args.row.ewma : null,
    value: Number(args.row.value),
    ciLower: Number(args.row.ci_lower),
    ciUpper: Number(args.row.ci_upper),
    zScore: typeof args.row.z_score === "number" ? args.row.z_score : null,
    percentile:
      typeof args.row.percentile === "number" ? args.row.percentile : null,
    exposure: typeof args.row.exposure === "number" ? args.row.exposure : null,
    distribution: parseJsonObject(args.row.distribution),
    provenance: parseJsonObject(args.row.provenance)
  };
}

export async function searchSandboxEntities(args: {
  entityType: SandboxEntityType;
  query?: string;
  limit?: number;
}): Promise<SandboxEntityOption[]> {
  const limit = args.limit ?? 12;

  if (args.entityType === "team") {
    const query = (args.query ?? "").trim().toLowerCase();
    return Object.values(teamsInfo)
      .filter((team) => {
        if (!query) return true;
        return (
          team.name.toLowerCase().includes(query) ||
          team.shortName.toLowerCase().includes(query) ||
          team.abbrev.toLowerCase().includes(query)
        );
      })
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, limit)
      .map((team) => ({
        id: team.id,
        name: team.name,
        subtitle: team.abbrev,
        imageUrl: `/teamLogos/${team.abbrev}.png`
      }));
  }

  const query = (args.query ?? "").trim();
  if (query.length < 2) {
    return [];
  }

  let playerQuery = supabase
    .from("players")
    .select("id, fullName, position, team_id, image_url")
    .ilike("fullName", `%${query}%`)
    .order("fullName", { ascending: true })
    .limit(limit);

  if (args.entityType === "goalie") {
    playerQuery = playerQuery.eq("position", "G");
  } else {
    playerQuery = playerQuery.neq("position", "G");
  }

  const { data, error } = await playerQuery;
  if (error) {
    throw new Error(`Failed to search ${args.entityType}s: ${error.message}`);
  }

  return ((data ?? []) as PlayerRow[]).map((player) => ({
    id: Number(player.id),
    name: (player as unknown as { fullName?: string | null }).fullName ?? "Unknown",
    subtitle: buildPlayerSubtitle(player),
    imageUrl: player.image_url ?? null
  }));
}

export async function fetchSandboxScores(args: {
  entityType: SandboxEntityType;
  entityId?: number | null;
  requestedDate?: string;
  windowCode?: string;
  limit?: number;
}): Promise<SandboxScoresPayload> {
  const requestedDate = args.requestedDate ?? todayIso();
  const windowCode = args.windowCode ?? "l5";
  const limit = args.limit ?? DEFAULT_LIMIT;

  if (args.entityType === "skater") {
    const snapshotDate = await resolveLegacySnapshotDate({
      requestedDate,
      windowCode,
      entityId: args.entityId
    });

    if (!snapshotDate) {
      return {
        entityType: "skater",
        requestedDate,
        snapshotDate: null,
        windowCode,
        totalRows: 0,
        rows: [],
        selectedRow: null
      };
    }

    const { data, error, count } = await supabase
      .from("sustainability_scores")
      .select("*", { count: "exact" })
      .eq("snapshot_date", snapshotDate)
      .eq("window_code", windowCode)
      .order("s_100", { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to load skater sustainability rows: ${error.message}`);
    }

    const legacyRows = (data ?? []) as LegacyScoreRow[];
    const playerIds = legacyRows.map((row) => Number(row.player_id));
    const [playersById, baselinesById] = await Promise.all([
      fetchPlayersByIds(playerIds),
      fetchPlayerBaselinesForSnapshot(snapshotDate)
    ]);

    const rows = legacyRows.map((row) =>
      normalizeLegacyScoreRow({
        row,
        player: playersById.get(Number(row.player_id)),
        baseline: baselinesById.get(Number(row.player_id))
      })
    );

    let selectedRow =
      args.entityId != null
        ? rows.find((row) => row.entityId === args.entityId) ?? null
        : null;

    if (args.entityId != null && !selectedRow) {
      const selectedResult = await supabase
        .from("sustainability_scores")
        .select("*")
        .eq("snapshot_date", snapshotDate)
        .eq("window_code", windowCode)
        .eq("player_id", args.entityId)
        .limit(1)
        .single();

      if (selectedResult.error && selectedResult.error.code !== "PGRST116") {
        throw new Error(
          `Failed to load selected skater sustainability row: ${selectedResult.error.message}`
        );
      }

      if (selectedResult.data) {
        const selectedPlayerMap = await fetchPlayersByIds([args.entityId]);
        selectedRow = normalizeLegacyScoreRow({
          row: selectedResult.data as LegacyScoreRow,
          player: selectedPlayerMap.get(args.entityId),
          baseline: baselinesById.get(args.entityId)
        });
      }
    }

    return {
      entityType: "skater",
      requestedDate,
      snapshotDate,
      windowCode,
      totalRows: Number(count ?? rows.length),
      selectedRow,
      rows
    };
  }

  const snapshotDate = await resolveUnifiedSnapshotDate({
    entityType: args.entityType,
    requestedDate,
    windowCode,
    entityId: args.entityId
  });

  if (!snapshotDate) {
    return {
      entityType: args.entityType,
      requestedDate,
      snapshotDate: null,
      windowCode,
      totalRows: 0,
      rows: [],
      selectedRow: null
    };
  }

  const query = supabase
    .from("entity_sustainability_scores_daily")
    .select("*", { count: "exact" })
    .eq("entity_type", args.entityType)
    .eq("snapshot_date", snapshotDate)
    .eq("window_code", windowCode)
    .order("s_100", { ascending: false })
    .limit(limit);

  const { data, error, count } = await query;
  if (error) {
    throw new Error(
      `Failed to load ${args.entityType} sustainability rows: ${error.message}`
    );
  }

  const unifiedRows = (data ?? []) as UnifiedScoreRow[];
  const playerIds = unifiedRows
    .map((row) => (row.player_id != null ? Number(row.player_id) : null))
    .filter((value): value is number => value != null);
  const playersById = await fetchPlayersByIds(playerIds);
  const rows = unifiedRows.map((row) =>
    normalizeUnifiedScoreRow({
      row,
      player:
        row.player_id != null ? playersById.get(Number(row.player_id)) : undefined
      })
  );

  let selectedRow =
    args.entityId != null
      ? rows.find((row) => row.entityId === args.entityId) ?? null
      : null;

  if (args.entityId != null && !selectedRow) {
    const selectedResult = await supabase
      .from("entity_sustainability_scores_daily")
      .select("*")
      .eq("entity_type", args.entityType)
      .eq("snapshot_date", snapshotDate)
      .eq("window_code", windowCode)
      .eq("entity_id", args.entityId)
      .limit(1)
      .single();

    if (selectedResult.error && selectedResult.error.code !== "PGRST116") {
      throw new Error(
        `Failed to load selected ${args.entityType} sustainability row: ${selectedResult.error.message}`
      );
    }

    if (selectedResult.data) {
      const selectedPlayerId =
        selectedResult.data.player_id != null
          ? Number(selectedResult.data.player_id)
          : null;
      const selectedPlayers = await fetchPlayersByIds(
        selectedPlayerId != null ? [selectedPlayerId] : []
      );
      selectedRow = normalizeUnifiedScoreRow({
        row: selectedResult.data as UnifiedScoreRow,
        player:
          selectedPlayerId != null
            ? selectedPlayers.get(selectedPlayerId)
            : undefined
      });
    }
  }

  return {
    entityType: args.entityType,
    requestedDate,
    snapshotDate,
    windowCode,
    totalRows: Number(count ?? rows.length),
    selectedRow,
    rows
  };
}

export async function fetchSandboxBands(args: {
  entityType: SandboxEntityType;
  entityId: number;
  requestedDate?: string;
  windowCode?: string;
  metricKey?: string;
  limit?: number;
}): Promise<SandboxBandsPayload> {
  const requestedDate = args.requestedDate ?? todayIso();
  const windowCode = args.windowCode ?? "l5";
  const metricKey =
    args.metricKey ?? SANDBOX_ENTITY_CONFIG[args.entityType].metrics[0]?.key;
  const limit = args.limit ?? 160;

  if (args.entityType === "skater") {
    const snapshotDate = await resolveLegacySnapshotDate({
      requestedDate,
      windowCode,
      entityId: args.entityId
    });

    if (!snapshotDate) {
      return {
        entityType: "skater",
        requestedDate,
        snapshotDate: null,
        windowCode,
        currentRows: [],
        historyRows: []
      };
    }

    const [currentResult, historyResult, playersById, baselinesById] =
      await Promise.all([
        supabase
          .from("sustainability_trend_bands")
          .select("*")
          .eq("player_id", args.entityId)
          .eq("snapshot_date", snapshotDate)
          .eq("window_code", windowCode),
        supabase
          .from("sustainability_trend_bands")
          .select("*")
          .eq("player_id", args.entityId)
          .eq("metric_key", metricKey)
          .eq("window_code", windowCode)
          .order("snapshot_date", { ascending: true })
          .limit(limit),
        fetchPlayersByIds([args.entityId]),
        fetchPlayerBaselinesForSnapshot(snapshotDate)
      ]);

    if (currentResult.error) {
      throw new Error(
        `Failed to load skater band snapshot: ${currentResult.error.message}`
      );
    }
    if (historyResult.error) {
      throw new Error(
        `Failed to load skater band history: ${historyResult.error.message}`
      );
    }

    const player = playersById.get(args.entityId);
    const baseline = baselinesById.get(args.entityId);

    return {
      entityType: "skater",
      requestedDate,
      snapshotDate,
      windowCode,
      currentRows: ((currentResult.data ?? []) as LegacyBandRow[]).map((row) =>
        normalizeLegacyBandRow({ row, player, baseline })
      ),
      historyRows: ((historyResult.data ?? []) as LegacyBandRow[]).map((row) =>
        normalizeLegacyBandRow({ row, player, baseline })
      )
    };
  }

  const snapshotDate = await resolveUnifiedSnapshotDate({
    entityType: args.entityType,
    requestedDate,
    windowCode,
    entityId: args.entityId
  });

  if (!snapshotDate) {
    return {
      entityType: args.entityType,
      requestedDate,
      snapshotDate: null,
      windowCode,
      currentRows: [],
      historyRows: []
    };
  }

  const [currentResult, historyResult] = await Promise.all([
    supabase
      .from("entity_sustainability_bands_daily")
      .select("*")
      .eq("entity_type", args.entityType)
      .eq("entity_id", args.entityId)
      .eq("snapshot_date", snapshotDate)
      .eq("window_code", windowCode),
    supabase
      .from("entity_sustainability_bands_daily")
      .select("*")
      .eq("entity_type", args.entityType)
      .eq("entity_id", args.entityId)
      .eq("metric_key", metricKey)
      .eq("window_code", windowCode)
      .order("snapshot_date", { ascending: true })
      .limit(limit)
  ]);

  if (currentResult.error) {
    throw new Error(
      `Failed to load ${args.entityType} band snapshot: ${currentResult.error.message}`
    );
  }
  if (historyResult.error) {
    throw new Error(
      `Failed to load ${args.entityType} band history: ${historyResult.error.message}`
    );
  }

  const playerIds = [
    ...((currentResult.data ?? []) as UnifiedBandRow[]).map((row) =>
      row.player_id != null ? Number(row.player_id) : null
    ),
    ...((historyResult.data ?? []) as UnifiedBandRow[]).map((row) =>
      row.player_id != null ? Number(row.player_id) : null
    )
  ].filter((value): value is number => value != null);

  const playersById = await fetchPlayersByIds(playerIds);

  return {
    entityType: args.entityType,
    requestedDate,
    snapshotDate,
    windowCode,
    currentRows: ((currentResult.data ?? []) as UnifiedBandRow[]).map((row) =>
      normalizeUnifiedBandRow({
        row,
        player:
          row.player_id != null ? playersById.get(Number(row.player_id)) : undefined
      })
    ),
    historyRows: ((historyResult.data ?? []) as UnifiedBandRow[]).map((row) =>
      normalizeUnifiedBandRow({
        row,
        player:
          row.player_id != null ? playersById.get(Number(row.player_id)) : undefined
      })
    )
  };
}
