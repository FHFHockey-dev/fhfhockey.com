export type CoverageAuditRow = {
  playerId: number;
  playedDates: string[];
  bandDates: string[];
};

export type CoverageAuditSummary = {
  playerId: number;
  playedGameCount: number;
  bandDateCount: number;
  missingDateCount: number;
  extraDateCount: number;
  coveragePct: number;
  missingDates: string[];
  extraDates: string[];
};

export function summarizeCoverageAuditRow(
  row: CoverageAuditRow
): CoverageAuditSummary {
  const playedSet = new Set(row.playedDates);
  const bandSet = new Set(row.bandDates);
  const missingDates = row.playedDates.filter((date) => !bandSet.has(date));
  const extraDates = row.bandDates.filter((date) => !playedSet.has(date));
  const playedGameCount = playedSet.size;
  const bandDateCount = bandSet.size;
  const coveredCount = playedGameCount - missingDates.length;
  const coveragePct =
    playedGameCount > 0 ? Number(((coveredCount / playedGameCount) * 100).toFixed(2)) : 100;

  return {
    playerId: row.playerId,
    playedGameCount,
    bandDateCount,
    missingDateCount: missingDates.length,
    extraDateCount: extraDates.length,
    coveragePct,
    missingDates,
    extraDates
  };
}

export function summarizeCoverageAudit(rows: CoverageAuditRow[]) {
  const playerSummaries = rows.map(summarizeCoverageAuditRow);
  const playersWithGaps = playerSummaries.filter((row) => row.missingDateCount > 0);
  const totalPlayedDates = playerSummaries.reduce((sum, row) => sum + row.playedGameCount, 0);
  const totalMissingDates = playerSummaries.reduce((sum, row) => sum + row.missingDateCount, 0);
  const overallCoveragePct =
    totalPlayedDates > 0
      ? Number((((totalPlayedDates - totalMissingDates) / totalPlayedDates) * 100).toFixed(2))
      : 100;

  return {
    playersAudited: playerSummaries.length,
    playersWithGaps: playersWithGaps.length,
    totalPlayedDates,
    totalMissingDates,
    overallCoveragePct,
    playerSummaries
  };
}
