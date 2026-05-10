import type { TeamPowerSnapshot, TeamPowerSnapshotLike } from "./teamContext";

export const toFiniteNumber = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const toStringOrNull = (value: unknown): string | null => {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
};

export const toArray = <T>(value: unknown): T[] => {
  return Array.isArray(value) ? (value as T[]) : [];
};

export type NormalizedServingContract = {
  requestedDate: string | null;
  resolvedDate: string | null;
  fallbackApplied: boolean;
  isSameDay: boolean;
  state: "same_day" | "fallback" | "unknown";
  strategy:
    | "requested_date"
    | "latest_available_with_data"
    | "previous_date_with_games"
    | null;
  gapDays: number | null;
  severity: "none" | "warn" | "error";
  status: "requested_date" | "fallback_recent" | "degraded" | "blocked";
  message: string | null;
  requestedScheduledGames: number | null;
  resolvedScheduledGames: number | null;
  requestedHadGames: boolean | null;
  resolvedHadGames: boolean | null;
};

const normalizeServingContract = (
  value: unknown
): NormalizedServingContract | null => {
  if (!value || typeof value !== "object") return null;
  const root = value as Record<string, unknown>;
  return {
    requestedDate: toStringOrNull(root.requestedDate),
    resolvedDate: toStringOrNull(root.resolvedDate),
    fallbackApplied: Boolean(root.fallbackApplied),
    isSameDay: Boolean(root.isSameDay),
    state:
      (toStringOrNull(root.state) as
        | "same_day"
        | "fallback"
        | "unknown"
        | null) ?? "unknown",
    strategy:
      (toStringOrNull(root.strategy) as
        | "requested_date"
        | "latest_available_with_data"
        | "previous_date_with_games"
        | null) ?? null,
    gapDays: toFiniteNumber(root.gapDays),
    severity:
      (toStringOrNull(root.severity) as
        | "none"
        | "warn"
        | "error"
        | null) ?? "none",
    status:
      (toStringOrNull(root.status) as
        | "requested_date"
        | "fallback_recent"
        | "degraded"
        | "blocked"
        | null) ?? "requested_date",
    message: toStringOrNull(root.message),
    requestedScheduledGames: toFiniteNumber(root.requestedScheduledGames),
    resolvedScheduledGames: toFiniteNumber(root.resolvedScheduledGames),
    requestedHadGames:
      typeof root.requestedHadGames === "boolean" ? root.requestedHadGames : null,
    resolvedHadGames:
      typeof root.resolvedHadGames === "boolean" ? root.resolvedHadGames : null
  };
};

export type NormalizedTeamRatingRow = TeamPowerSnapshot & {
  teamAbbr: string;
  date: string;
  ppTier: 1 | 2 | 3;
  pkTier: 1 | 2 | 3;
  finishingRating: number | null;
  goalieRating: number | null;
  dangerRating: number | null;
  specialRating: number | null;
  disciplineRating: number | null;
  varianceFlag: number | null;
};

const toTier = (value: unknown): 1 | 2 | 3 => {
  const n = toFiniteNumber(value);
  if (n === 1 || n === 2 || n === 3) return n;
  return 2;
};

export const normalizeTeamRatings = (payload: unknown): NormalizedTeamRatingRow[] => {
  return toArray<Record<string, unknown>>(payload)
    .map((row) => {
      const teamAbbr = toStringOrNull(row.teamAbbr) ?? toStringOrNull(row.team_abbreviation);
      const date = toStringOrNull(row.date);
      const offRating = toFiniteNumber(row.offRating ?? row.off_rating);
      const defRating = toFiniteNumber(row.defRating ?? row.def_rating);
      const paceRating = toFiniteNumber(row.paceRating ?? row.pace_rating);
      const trend10 = toFiniteNumber(row.trend10);
      const finishingRating = toFiniteNumber(
        row.finishingRating ?? row.finishing_rating
      );
      const goalieRating = toFiniteNumber(row.goalieRating ?? row.goalie_rating);
      const dangerRating = toFiniteNumber(row.dangerRating ?? row.danger_rating);
      const specialRating = toFiniteNumber(
        row.specialRating ?? row.special_rating
      );
      const disciplineRating = toFiniteNumber(
        row.disciplineRating ?? row.discipline_rating
      );
      const varianceFlag = toFiniteNumber(row.varianceFlag ?? row.variance_flag);
      if (!teamAbbr || !date || offRating == null || defRating == null || paceRating == null) {
        return null;
      }

      return {
        teamAbbr,
        date,
        offRating,
        defRating,
        paceRating,
        ppTier: toTier(row.ppTier ?? row.pp_tier),
        pkTier: toTier(row.pkTier ?? row.pk_tier),
        trend10: trend10 ?? 0,
        finishingRating,
        goalieRating,
        dangerRating,
        specialRating,
        disciplineRating,
        varianceFlag
      };
    })
    .filter((row): row is NormalizedTeamRatingRow => Boolean(row));
};

export type NormalizedSustainabilityRow = {
  player_id: number;
  player_name: string | null;
  position_group: string;
  position_code: string | null;
  window_code: string;
  s_100: number;
  luck_pressure: number;
  z_shp: number | null;
  z_oishp: number | null;
  z_ipp: number | null;
  z_ppshp: number | null;
  guardrail_state: string | null;
  guardrail_warnings: string[];
};

export type NormalizedSustainabilityResponse = {
  requested_snapshot_date: string | null;
  snapshot_date: string | null;
  serving: NormalizedServingContract | null;
  rows: NormalizedSustainabilityRow[];
};

export const normalizeSustainabilityResponse = (
  payload: unknown
): NormalizedSustainabilityResponse => {
  const root = (payload ?? {}) as Record<string, unknown>;
  const rows = toArray<Record<string, unknown>>(root.rows)
    .map((row) => {
      const playerId = toFiniteNumber(row.player_id);
      const s100 = toFiniteNumber(row.s_100);
      const luckPressure = toFiniteNumber(row.luck_pressure);
      if (playerId == null || s100 == null || luckPressure == null) return null;
      return {
        player_id: playerId,
        player_name: toStringOrNull(row.player_name),
        position_group: toStringOrNull(row.position_group) ?? "",
        position_code: toStringOrNull(row.position_code),
        window_code: toStringOrNull(row.window_code) ?? "",
        s_100: s100,
        luck_pressure: luckPressure,
        z_shp: toFiniteNumber(row.z_shp),
        z_oishp: toFiniteNumber(row.z_oishp),
        z_ipp: toFiniteNumber(row.z_ipp),
        z_ppshp: toFiniteNumber(row.z_ppshp),
        guardrail_state: toStringOrNull(row.guardrail_state),
        guardrail_warnings: toArray<unknown>(row.guardrail_warnings).filter(
          (warning): warning is string => typeof warning === "string"
        )
      };
    })
    .filter((row): row is NormalizedSustainabilityRow => Boolean(row));

  return {
    requested_snapshot_date: toStringOrNull(root.requested_snapshot_date),
    snapshot_date: toStringOrNull(root.snapshot_date),
    serving: normalizeServingContract(root.serving),
    rows
  };
};

export type NormalizedCtpiTeamRow = {
  team: string;
  ctpi_0_to_100: number;
  offense: number;
  defense: number;
  luck: number;
  sparkSeries: Array<{ date: string; value: number }>;
};

export type NormalizedCtpiResponse = {
  generatedAt: string | null;
  teams: NormalizedCtpiTeamRow[];
};

export const normalizeCtpiResponse = (payload: unknown): NormalizedCtpiResponse => {
  const root = (payload ?? {}) as Record<string, unknown>;
  const teams = toArray<Record<string, unknown>>(root.teams)
    .map((row) => {
      const team = toStringOrNull(row.team);
      const ctpi = toFiniteNumber(row.ctpi_0_to_100);
      if (!team || ctpi == null) return null;
      const sparkSeries = toArray<Record<string, unknown>>(row.sparkSeries)
        .map((point) => {
          const date = toStringOrNull(point.date);
          const value = toFiniteNumber(point.value);
          if (!date || value == null) return null;
          return { date, value };
        })
        .filter((point): point is { date: string; value: number } => Boolean(point));

      return {
        team,
        ctpi_0_to_100: ctpi,
        offense: toFiniteNumber(row.offense) ?? 0,
        defense: toFiniteNumber(row.defense) ?? 0,
        luck: toFiniteNumber(row.luck) ?? 0,
        sparkSeries
      };
    })
    .filter((row): row is NormalizedCtpiTeamRow => Boolean(row));

  return {
    generatedAt: toStringOrNull(root.generatedAt),
    teams
  };
};

export type NormalizedGoalieProjectionRow = {
  goalie_id: number;
  goalie_name: string;
  team_abbreviation: string | null;
  team_name: string;
  opponent_team_abbreviation: string | null;
  opponent_team_name: string;
  starter_probability: number | null;
  proj_win_prob: number | null;
  proj_shutout_prob: number | null;
  modeled_save_pct: number | null;
  volatility_index: number | null;
  blowup_risk: number | null;
  confidence_tier: string | null;
  quality_tier: string | null;
  reliability_tier: string | null;
  recommendation: string | null;
  starter_selection: {
    is_back_to_back: boolean | null;
    opponent_is_weak: boolean | null;
    days_since_last_played: number | null;
    l10_starts: number | null;
    opponent_context_adjustment_pct: number | null;
  } | null;
};

export type NormalizedGoalieResponse = {
  asOfDate: string | null;
  requestedDate: string | null;
  fallbackApplied: boolean;
  serving: NormalizedServingContract | null;
  data: NormalizedGoalieProjectionRow[];
};

export const normalizeGoalieResponse = (payload: unknown): NormalizedGoalieResponse => {
  const root = (payload ?? {}) as Record<string, unknown>;
  const data = toArray<Record<string, unknown>>(root.data)
    .map((row) => {
      const goalieId = toFiniteNumber(row.goalie_id);
      const goalieName = toStringOrNull(row.goalie_name);
      if (goalieId == null || !goalieName) return null;
      const model = (
        row.uncertainty &&
        typeof row.uncertainty === "object" &&
        (row.uncertainty as Record<string, unknown>).model &&
        typeof (row.uncertainty as Record<string, unknown>).model === "object"
      )
        ? ((row.uncertainty as Record<string, unknown>).model as Record<string, unknown>)
        : null;
      const starterSelection = (
        model?.starter_selection && typeof model.starter_selection === "object"
      )
        ? (model.starter_selection as Record<string, unknown>)
        : null;
      const candidateGoalies = toArray<Record<string, unknown>>(
        starterSelection?.candidate_goalies
      );
      const selectedGoalie =
        candidateGoalies.find(
          (candidate) => toFiniteNumber(candidate.goalie_id) === goalieId
        ) ?? null;
      const modelContext =
        starterSelection?.model_context &&
        typeof starterSelection.model_context === "object"
          ? (starterSelection.model_context as Record<string, unknown>)
          : null;
      const opponentContext =
        starterSelection?.opponent_offense_context &&
        typeof starterSelection.opponent_offense_context === "object"
          ? (starterSelection.opponent_offense_context as Record<string, unknown>)
          : null;
      return {
        goalie_id: goalieId,
        goalie_name: goalieName,
        team_abbreviation: toStringOrNull(row.team_abbreviation),
        team_name: toStringOrNull(row.team_name) ?? "",
        opponent_team_abbreviation: toStringOrNull(row.opponent_team_abbreviation),
        opponent_team_name: toStringOrNull(row.opponent_team_name) ?? "",
        starter_probability: toFiniteNumber(row.starter_probability),
        proj_win_prob: toFiniteNumber(row.proj_win_prob),
        proj_shutout_prob: toFiniteNumber(row.proj_shutout_prob),
        modeled_save_pct: toFiniteNumber(row.modeled_save_pct),
        volatility_index: toFiniteNumber(row.volatility_index),
        blowup_risk: toFiniteNumber(row.blowup_risk),
        confidence_tier: toStringOrNull(row.confidence_tier),
        quality_tier: toStringOrNull(row.quality_tier),
        reliability_tier: toStringOrNull(row.reliability_tier),
        recommendation: toStringOrNull(row.recommendation),
        starter_selection: starterSelection
          ? {
              is_back_to_back:
                typeof modelContext?.is_back_to_back === "boolean"
                  ? (modelContext.is_back_to_back as boolean)
                  : null,
              opponent_is_weak:
                typeof modelContext?.opponent_is_weak === "boolean"
                  ? (modelContext.opponent_is_weak as boolean)
                  : null,
              days_since_last_played: toFiniteNumber(selectedGoalie?.days_since_last_played),
              l10_starts: toFiniteNumber(selectedGoalie?.l10_starts),
              opponent_context_adjustment_pct: toFiniteNumber(
                opponentContext?.context_adjustment_pct
              )
            }
          : null
      };
    })
    .filter((row): row is NormalizedGoalieProjectionRow => Boolean(row));

  return {
    asOfDate: toStringOrNull(root.asOfDate),
    requestedDate: toStringOrNull(root.requestedDate),
    fallbackApplied: Boolean(root.fallbackApplied),
    serving: normalizeServingContract(root.serving),
    data
  };
};

export type NormalizedStartChartGameRow = {
  id: number;
  date: string | null;
  homeTeamId: number;
  awayTeamId: number;
  homeGoalies: Array<{
    player_id: number;
    name: string;
    start_probability: number | null;
    projected_gsaa_per_60: number | null;
    confirmed_status: boolean | null;
    percent_ownership: number | null;
  }>;
  awayGoalies: Array<{
    player_id: number;
    name: string;
    start_probability: number | null;
    projected_gsaa_per_60: number | null;
    confirmed_status: boolean | null;
    percent_ownership: number | null;
  }>;
  homeRating: TeamPowerSnapshotLike | null;
  awayRating: TeamPowerSnapshotLike | null;
};

export type NormalizedStartChartResponse = {
  dateUsed: string | null;
  requestedDate: string | null;
  fallbackApplied: boolean;
  serving: NormalizedServingContract | null;
  games: NormalizedStartChartGameRow[];
};

export const normalizeStartChartResponse = (
  payload: unknown
): NormalizedStartChartResponse => {
  const root = (payload ?? {}) as Record<string, unknown>;
  const games = toArray<Record<string, unknown>>(root.games)
    .map((row) => {
      const id = toFiniteNumber(row.id);
      const homeTeamId = toFiniteNumber(row.homeTeamId);
      const awayTeamId = toFiniteNumber(row.awayTeamId);
      if (id == null || homeTeamId == null || awayTeamId == null) return null;

      const normalizeGoalie = (goalie: Record<string, unknown>) => {
        const playerId = toFiniteNumber(goalie.player_id);
        const name = toStringOrNull(goalie.name);
        if (playerId == null || !name) return null;
        return {
          player_id: playerId,
          name,
          start_probability: toFiniteNumber(goalie.start_probability),
          projected_gsaa_per_60: toFiniteNumber(goalie.projected_gsaa_per_60),
          confirmed_status:
            typeof goalie.confirmed_status === "boolean"
              ? goalie.confirmed_status
              : null,
          percent_ownership: toFiniteNumber(goalie.percent_ownership)
        };
      };
      type NormalizedGoalie = NonNullable<ReturnType<typeof normalizeGoalie>>;

      const normalizeRating = (rating: unknown) => {
        const candidate = (rating ?? {}) as Record<string, unknown>;
        if (Object.keys(candidate).length === 0) return null;
        return {
          offRating: toFiniteNumber(candidate.offRating ?? candidate.off_rating),
          defRating: toFiniteNumber(candidate.defRating ?? candidate.def_rating),
          paceRating: toFiniteNumber(
            candidate.paceRating ?? candidate.pace_rating
          ),
          trend10: toFiniteNumber(candidate.trend10),
          ppTier: toFiniteNumber(candidate.ppTier ?? candidate.pp_tier),
          pkTier: toFiniteNumber(candidate.pkTier ?? candidate.pk_tier)
        };
      };

      const homeGoalies = toArray<Record<string, unknown>>(row.homeGoalies)
        .map(normalizeGoalie)
        .filter((goalie): goalie is NormalizedGoalie => Boolean(goalie));

      const awayGoalies = toArray<Record<string, unknown>>(row.awayGoalies)
        .map(normalizeGoalie)
        .filter((goalie): goalie is NormalizedGoalie => Boolean(goalie));

      return {
        id,
        date: toStringOrNull(row.date),
        homeTeamId,
        awayTeamId,
        homeGoalies,
        awayGoalies,
        homeRating: normalizeRating(row.homeRating),
        awayRating: normalizeRating(row.awayRating)
      };
    })
    .filter((row): row is NormalizedStartChartGameRow => Boolean(row));

  return {
    dateUsed: toStringOrNull(root.dateUsed),
    requestedDate: toStringOrNull(root.requestedDate),
    fallbackApplied: Boolean(root.fallbackApplied),
    serving: normalizeServingContract(root.serving),
    games
  };
};

export type NormalizedTeamMoversResponse = {
  generatedAt: string | null;
  teams: Array<{
    team: string;
    ctpi_0_to_100: number;
    sparkSeries: Array<{ date: string; value: number }>;
  }>;
};

export const normalizeTeamMoversResponse = (
  payload: unknown
): NormalizedTeamMoversResponse => {
  const base = normalizeCtpiResponse(payload);
  return {
    generatedAt: base.generatedAt,
    teams: base.teams.map((team) => ({
      team: team.team,
      ctpi_0_to_100: team.ctpi_0_to_100,
      sparkSeries: team.sparkSeries
    }))
  };
};

export type NormalizedSkaterMoversResponse = {
  generatedAt: string | null;
  rankings: Array<{ playerId: number; delta: number }>;
  playerMetadata: Record<string, { fullName: string; imageUrl: string | null }>;
};

export const normalizeSkaterMoversResponse = (
  payload: unknown
): NormalizedSkaterMoversResponse => {
  const root = (payload ?? {}) as Record<string, unknown>;
  const categories = (root.categories ?? {}) as Record<string, unknown>;
  const firstCategory = Object.values(categories)[0] as Record<string, unknown> | undefined;
  const rankings = toArray<Record<string, unknown>>(firstCategory?.rankings)
    .map((row) => {
      const playerId = toFiniteNumber(row.playerId);
      const delta = toFiniteNumber(row.delta);
      if (playerId == null || delta == null) return null;
      return { playerId, delta };
    })
    .filter((row): row is { playerId: number; delta: number } => Boolean(row));

  const rawMetadata = (root.playerMetadata ?? {}) as Record<string, Record<string, unknown>>;
  const playerMetadata = Object.entries(rawMetadata).reduce<
    Record<string, { fullName: string; imageUrl: string | null }>
  >((acc, [key, value]) => {
    const fullName = toStringOrNull(value?.fullName);
    if (!fullName) return acc;
    acc[key] = {
      fullName,
      imageUrl: toStringOrNull(value?.imageUrl)
    };
    return acc;
  }, {});

  return {
    generatedAt: toStringOrNull(root.generatedAt),
    rankings,
    playerMetadata
  };
};

export type NormalizedSkaterTrendRanking = {
  playerId: number;
  percentile: number;
  gp: number;
  rank: number;
  previousRank: number | null;
  delta: number;
  latestValue: number | null;
};

export type NormalizedSkaterTrendCategory = {
  rankings: NormalizedSkaterTrendRanking[];
  series: Record<string, Array<{ gp: number; percentile: number }>>;
};

export type NormalizedSkaterTrendResponse = {
  generatedAt: string | null;
  requestedDate: string | null;
  dateUsed: string | null;
  fallbackApplied: boolean;
  serving: NormalizedServingContract | null;
  categories: Record<string, NormalizedSkaterTrendCategory>;
  playerMetadata: Record<
    string,
    {
      id: number;
      fullName: string;
      position: string | null;
      teamAbbrev: string | null;
      imageUrl: string | null;
    }
  >;
};

export const normalizeSkaterTrendResponse = (
  payload: unknown
): NormalizedSkaterTrendResponse => {
  const root = (payload ?? {}) as Record<string, unknown>;
  const rawCategories = (root.categories ?? {}) as Record<string, unknown>;
  const categories = Object.entries(rawCategories).reduce<
    Record<string, NormalizedSkaterTrendCategory>
  >((acc, [key, value]) => {
    const category = (value ?? {}) as Record<string, unknown>;
    const series = Object.entries(
      (category.series ?? {}) as Record<string, unknown>
    ).reduce<NormalizedSkaterTrendCategory["series"]>((seriesAcc, [playerId, rawPoints]) => {
      seriesAcc[playerId] = toArray<Record<string, unknown>>(rawPoints)
        .map((point) => {
          const gp = toFiniteNumber(point.gp);
          const percentile = toFiniteNumber(point.percentile);
          if (gp == null || percentile == null) return null;
          return { gp, percentile };
        })
        .filter((point): point is { gp: number; percentile: number } => Boolean(point));
      return seriesAcc;
    }, {});
    const rankings = toArray<Record<string, unknown>>(category.rankings)
      .map((row) => {
        const playerId = toFiniteNumber(row.playerId);
        const percentile = toFiniteNumber(row.percentile);
        const gp = toFiniteNumber(row.gp);
        const rank = toFiniteNumber(row.rank);
        const delta = toFiniteNumber(row.delta);
        if (
          playerId == null ||
          percentile == null ||
          gp == null ||
          rank == null ||
          delta == null
        ) {
          return null;
        }

        return {
          playerId,
          percentile,
          gp,
          rank,
          previousRank: toFiniteNumber(row.previousRank),
          delta,
          latestValue: toFiniteNumber(row.latestValue)
        };
      })
      .filter((row): row is NormalizedSkaterTrendRanking => Boolean(row));

    acc[key] = { rankings, series };
    return acc;
  }, {});

  const rawMetadata = (root.playerMetadata ?? {}) as Record<
    string,
    Record<string, unknown>
  >;
  const playerMetadata = Object.entries(rawMetadata).reduce<
    NormalizedSkaterTrendResponse["playerMetadata"]
  >((acc, [key, value]) => {
    const id = toFiniteNumber(value.id);
    const fullName = toStringOrNull(value.fullName);
    if (id == null || !fullName) return acc;
    acc[key] = {
      id,
      fullName,
      position: toStringOrNull(value.position),
      teamAbbrev: toStringOrNull(value.teamAbbrev),
      imageUrl: toStringOrNull(value.imageUrl)
    };
    return acc;
  }, {});

  return {
    generatedAt: toStringOrNull(root.generatedAt),
    requestedDate: toStringOrNull(root.requestedDate),
    dateUsed: toStringOrNull(root.dateUsed),
    fallbackApplied: Boolean(root.fallbackApplied),
    serving: normalizeServingContract(root.serving),
    categories,
    playerMetadata
  };
};
