export type YahooMappingRow = Record<string, unknown> & {
  nhl_player_id?: unknown;
  yahoo_player_id?: unknown;
};

export type YahooPlayerDetailRow = Record<string, unknown> & {
  player_id?: unknown;
  player_key?: unknown;
  display_position?: unknown;
  eligible_positions?: unknown;
  editorial_team_abbreviation?: unknown;
};

export type YahooProjectionIdentityHint = {
  playerType: "skater" | "goalie";
  positions: Iterable<string>;
  teams: Iterable<string>;
};

export type YahooMappingDiagnostics = {
  projectedNhlIds: number;
  mappingRows: number;
  mappedNhlIds: number;
  unmappedNhlIds: number;
  duplicateNhlIds: number;
  conflictingYahooIdNhlIds: number;
  selectedNhlIds: number;
  currentGameMissingNhlIds: number;
  unresolvedNhlIds: number;
  unmappedNhlIdSamples: number[];
  currentGameMissingNhlIdSamples: number[];
  unresolvedNhlIdSamples: number[];
};

const FORWARD_POSITIONS = new Set(["C", "LW", "RW", "F", "FWD"]);

function normalizedTokens(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap(normalizedTokens);
  }
  if (value == null) return [];

  return String(value)
    .toUpperCase()
    .split(/[,/|\s]+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function normalizeTeam(value: unknown): string | null {
  const team = String(value ?? "")
    .trim()
    .toUpperCase();
  return team || null;
}

function normalizeYahooPlayerId(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const tail = raw.includes(".") ? raw.split(".").pop()?.trim() : raw;
  return tail || null;
}

function positionsOverlap(expected: Set<string>, actual: Set<string>) {
  for (const position of expected) {
    if (actual.has(position)) return true;
  }

  const expectedForward = Array.from(expected).some((position) =>
    FORWARD_POSITIONS.has(position),
  );
  const actualForward = Array.from(actual).some((position) =>
    FORWARD_POSITIONS.has(position),
  );
  return expectedForward && actualForward;
}

function detailPositions(detail: YahooPlayerDetailRow) {
  return new Set([
    ...normalizedTokens(detail.eligible_positions),
    ...normalizedTokens(detail.display_position),
  ]);
}

function candidateScore(
  detail: YahooPlayerDetailRow,
  hint: YahooProjectionIdentityHint,
): number | null {
  const actualPositions = detailPositions(detail);
  const actualIsGoalie = actualPositions.has("G");
  if (hint.playerType === "goalie" ? !actualIsGoalie : actualIsGoalie) {
    return null;
  }

  let score = 100;
  const expectedPositions = new Set(
    Array.from(hint.positions).flatMap(normalizedTokens),
  );
  if (expectedPositions.size > 0 && actualPositions.size > 0) {
    if (!positionsOverlap(expectedPositions, actualPositions)) return null;
    score += 20;
  }

  const expectedTeams = new Set(
    Array.from(hint.teams)
      .map(normalizeTeam)
      .filter((team): team is string => team != null),
  );
  const actualTeam = normalizeTeam(detail.editorial_team_abbreviation);
  if (actualTeam && expectedTeams.has(actualTeam)) score += 5;

  return score;
}

export function resolveYahooMappings(
  mappingRows: YahooMappingRow[],
  currentGameDetailsByYahooId: ReadonlyMap<string, YahooPlayerDetailRow>,
  identityHintsByNhlId: ReadonlyMap<number, YahooProjectionIdentityHint>,
): {
  mappingsByNhlId: Map<number, YahooMappingRow>;
  diagnostics: YahooMappingDiagnostics;
} {
  const rowsByNhlId = new Map<number, YahooMappingRow[]>();
  for (const row of mappingRows) {
    const nhlPlayerId = Number(row.nhl_player_id);
    if (!Number.isFinite(nhlPlayerId)) continue;
    const rows = rowsByNhlId.get(nhlPlayerId) ?? [];
    rows.push(row);
    rowsByNhlId.set(nhlPlayerId, rows);
  }

  const mappingsByNhlId = new Map<number, YahooMappingRow>();
  let duplicateNhlIds = 0;
  let conflictingYahooIdNhlIds = 0;
  let currentGameMissingNhlIds = 0;
  const unmappedNhlIdSet = new Set(
    Array.from(identityHintsByNhlId.keys()).filter(
      (nhlPlayerId) => !rowsByNhlId.has(nhlPlayerId)
    )
  );
  const currentGameMissingNhlIdSet = new Set<number>();
  const unresolvedNhlIdSet = new Set(unmappedNhlIdSet);
  const unmappedNhlIds = Math.max(
    0,
    identityHintsByNhlId.size - rowsByNhlId.size,
  );
  let unresolvedNhlIds = unmappedNhlIds;

  for (const [nhlPlayerId, rows] of rowsByNhlId) {
    if (rows.length > 1) duplicateNhlIds += 1;

    const rowsByYahooId = new Map<string, YahooMappingRow>();
    for (const row of rows) {
      const yahooPlayerId = normalizeYahooPlayerId(row.yahoo_player_id);
      if (yahooPlayerId && !rowsByYahooId.has(yahooPlayerId)) {
        rowsByYahooId.set(yahooPlayerId, row);
      }
    }
    if (rowsByYahooId.size > 1) conflictingYahooIdNhlIds += 1;

    const hint = identityHintsByNhlId.get(nhlPlayerId);
    if (!hint) {
      unresolvedNhlIds += 1;
      unresolvedNhlIdSet.add(nhlPlayerId);
      continue;
    }

    const scored: Array<{ row: YahooMappingRow; score: number }> = [];
    let hasCurrentGameDetail = false;
    for (const [yahooPlayerId, row] of rowsByYahooId) {
      const detail = currentGameDetailsByYahooId.get(yahooPlayerId);
      if (!detail) continue;
      hasCurrentGameDetail = true;
      const score = candidateScore(detail, hint);
      if (score != null) scored.push({ row, score });
    }

    if (!hasCurrentGameDetail) {
      currentGameMissingNhlIds += 1;
      unresolvedNhlIds += 1;
      currentGameMissingNhlIdSet.add(nhlPlayerId);
      unresolvedNhlIdSet.add(nhlPlayerId);
      continue;
    }

    scored.sort((left, right) => right.score - left.score);
    if (
      scored.length === 0 ||
      (scored.length > 1 && scored[0].score === scored[1].score)
    ) {
      unresolvedNhlIds += 1;
      unresolvedNhlIdSet.add(nhlPlayerId);
      continue;
    }

    mappingsByNhlId.set(nhlPlayerId, scored[0].row);
  }

  return {
    mappingsByNhlId,
    diagnostics: {
      projectedNhlIds: identityHintsByNhlId.size,
      mappingRows: mappingRows.length,
      mappedNhlIds: rowsByNhlId.size,
      unmappedNhlIds,
      duplicateNhlIds,
      conflictingYahooIdNhlIds,
      selectedNhlIds: mappingsByNhlId.size,
      currentGameMissingNhlIds,
      unresolvedNhlIds,
      unmappedNhlIdSamples: Array.from(unmappedNhlIdSet).sort((a, b) => a - b).slice(0, 25),
      currentGameMissingNhlIdSamples: Array.from(currentGameMissingNhlIdSet)
        .sort((a, b) => a - b)
        .slice(0, 25),
      unresolvedNhlIdSamples: Array.from(unresolvedNhlIdSet)
        .sort((a, b) => a - b)
        .slice(0, 25)
    },
  };
}
