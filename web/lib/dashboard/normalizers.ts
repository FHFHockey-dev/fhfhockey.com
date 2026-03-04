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

export type NormalizedTeamRatingRow = {
  teamAbbr: string;
  date: string;
  offRating: number;
  defRating: number;
  paceRating: number;
  ppTier: 1 | 2 | 3;
  pkTier: 1 | 2 | 3;
  trend10: number;
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
        trend10: trend10 ?? 0
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
};

export type NormalizedSustainabilityResponse = {
  snapshot_date: string | null;
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
        luck_pressure: luckPressure
      };
    })
    .filter((row): row is NormalizedSustainabilityRow => Boolean(row));

  return {
    snapshot_date: toStringOrNull(root.snapshot_date),
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
  volatility_index: number | null;
  blowup_risk: number | null;
};

export type NormalizedGoalieResponse = {
  asOfDate: string | null;
  data: NormalizedGoalieProjectionRow[];
};

export const normalizeGoalieResponse = (payload: unknown): NormalizedGoalieResponse => {
  const root = (payload ?? {}) as Record<string, unknown>;
  const data = toArray<Record<string, unknown>>(root.data)
    .map((row) => {
      const goalieId = toFiniteNumber(row.goalie_id);
      const goalieName = toStringOrNull(row.goalie_name);
      if (goalieId == null || !goalieName) return null;
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
        volatility_index: toFiniteNumber(row.volatility_index),
        blowup_risk: toFiniteNumber(row.blowup_risk)
      };
    })
    .filter((row): row is NormalizedGoalieProjectionRow => Boolean(row));

  return {
    asOfDate: toStringOrNull(root.asOfDate),
    data
  };
};

export type NormalizedStartChartGameRow = {
  id: number;
  homeTeamId: number;
  awayTeamId: number;
  homeGoalies: Array<{ player_id: number; name: string; start_probability: number | null }>;
  awayGoalies: Array<{ player_id: number; name: string; start_probability: number | null }>;
};

export type NormalizedStartChartResponse = {
  dateUsed: string | null;
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
          start_probability: toFiniteNumber(goalie.start_probability)
        };
      };

      const homeGoalies = toArray<Record<string, unknown>>(row.homeGoalies)
        .map(normalizeGoalie)
        .filter(
          (goalie): goalie is { player_id: number; name: string; start_probability: number | null } =>
            Boolean(goalie)
        );

      const awayGoalies = toArray<Record<string, unknown>>(row.awayGoalies)
        .map(normalizeGoalie)
        .filter(
          (goalie): goalie is { player_id: number; name: string; start_probability: number | null } =>
            Boolean(goalie)
        );

      return {
        id,
        homeTeamId,
        awayTeamId,
        homeGoalies,
        awayGoalies
      };
    })
    .filter((row): row is NormalizedStartChartGameRow => Boolean(row));

  return {
    dateUsed: toStringOrNull(root.dateUsed),
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
