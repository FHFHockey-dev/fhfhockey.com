// Fictional contract probes only; numeric IDs are synthetic, never source lookups.
const evidence = () => ({ recentStarts: 10, recentShotsAgainst: 300, recentGoalsAllowed: 27,
  seasonStarts: 20, seasonShotsAgainst: 600, seasonGoalsAllowed: 54,
  baselineStarts: 40, baselineShotsAgainst: 1200, baselineGoalsAllowed: 108, residualStdDev: 1 });
const modelInput = () => ({ projectedShotsAgainst: 30, starterProbability: 1, projectedGoalsFor: 3, evidence: evidence(), leagueSavePct: 0.9 });
const sourceRow = (overrides = {}) => ({ shots_against: 30, goals_allowed: 3, saves: 27, ...overrides });
const evidenceResponses = rows => [
  ...[1, 2, 3].map(() => ({ table: 'forge_goalie_game', data: rows })),
  { table: 'wgo_goalie_stats', data: null },
];
const neutralStage = () => ({ shotsTrendPct: 0, goalsTrendPct: 0, opponentRestDays: null, defendingRestDays: null,
  opponentIsHome: false, baseShotsAgainst: 30,
  teamFiveOnFiveContextAdjustment: { contextPctAdjustment: 0, leagueSavePctAdjustment: 0 },
  nstOpponentDangerAdjustment: { contextPctAdjustment: 0 } });
const prior = (xgaPerGame = 2.95) => ({ xgaPerGame, xgfPerGame: 2.95, xga: 140 });
const nst = (xgaPer60 = 2.5) => ({ gamesPlayed: 15, xgaPer60, xga: xgaPer60 * 15 });
module.exports = { evidence, modelInput, sourceRow, evidenceResponses, neutralStage, prior, nst };
