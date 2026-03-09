type PlayerUsageInput = {
  playerId: number;
  toiSeconds: number;
};

type UnitUsageRow = {
  playerId: number;
  PPTOI: number;
  percentageOfPP: number;
  pp_unit_usage_index: number;
  pp_unit_relative_toi: number;
  pp_vs_unit_avg: number;
};

export type PowerPlayCombinationMetricRow = UnitUsageRow & {
  gameId: number;
  unit: number;
  pp_share_of_team: number | null;
};

function round(value: number, precision = 6): number {
  return Number(value.toFixed(precision));
}

export function buildUnitUsageRows(
  players: PlayerUsageInput[],
  avgUnitToiSeconds: number
): UnitUsageRow[] {
  return players.map((player) => {
    const usageIndex =
      avgUnitToiSeconds > 0 ? player.toiSeconds / avgUnitToiSeconds : 0;
    const relativeToi = player.toiSeconds - avgUnitToiSeconds;
    const vsUnitAvg = usageIndex - 1;

    return {
      playerId: player.playerId,
      PPTOI: player.toiSeconds,
      percentageOfPP: round(usageIndex),
      pp_unit_usage_index: round(usageIndex),
      pp_unit_relative_toi: Math.round(relativeToi),
      pp_vs_unit_avg: round(vsUnitAvg)
    };
  });
}

export function buildPowerPlayCombinationRows(args: {
  gameId: number;
  unit: number;
  players: PlayerUsageInput[];
  avgUnitToiSeconds: number;
  teamPpToiSeconds: number | null;
}): PowerPlayCombinationMetricRow[] {
  const unitRows = buildUnitUsageRows(args.players, args.avgUnitToiSeconds);

  return unitRows.map((row) => ({
    gameId: args.gameId,
    unit: args.unit,
    ...row,
    pp_share_of_team:
      args.teamPpToiSeconds && args.teamPpToiSeconds > 0
        ? round(row.PPTOI / args.teamPpToiSeconds)
        : null
  }));
}
