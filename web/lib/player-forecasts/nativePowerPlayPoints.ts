import { timestampMicros } from "../projections/evidenceTime";
import { verifyBaselineBoxscoreReceipt, type BaselineBoxscoreReceipt } from "./baselineSourceLineage";
import type { BaselineAppearanceInput } from "./baselineRates";
import { playerForecastSourcePayloadHash } from "./sourceSnapshot";

export type NativePowerPlayPointsInput = {
  nhlPlayerId: number;
  cutoffAt: string;
  appearance: BaselineAppearanceInput;
  landing: { rawRow: Record<string, any>; contentHash: string };
};

const id = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) > 0;
const receiptId = (raw: Record<string, any>) => id(raw.id) || typeof raw.id === "string"
  && /^[a-f0-9]{64}$/.test(raw.payload_hash) && raw.id === `http:${raw.payload_hash}`;
const count = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0;
const record = (value: unknown): value is Record<string, any> => !!value && typeof value === "object" && !Array.isArray(value);
const invalid = (): never => { throw new Error("Private PPP requires complete, matching original landing and boxscore receipts."); };

/** Historical observed counts only. Never guesses strength from manpower,
 * fills missing summaries with zero, or modifies a captured baseline bundle. */
export function deriveNativePowerPlayPoints(input: NativePowerPlayPointsInput) {
  const { appearance, landing, nhlPlayerId, cutoffAt } = input;
  verifyBaselineBoxscoreReceipt(appearance, nhlPlayerId, cutoffAt, "skater");
  const boxscore = appearance.finalBoxscore as BaselineBoxscoreReceipt;
  const game = boxscore.game, raw = landing.rawRow, body = raw?.payload;
  const cutoff = timestampMicros(cutoffAt), fetched = timestampMicros(raw?.fetched_at);
  const gameStart = timestampMicros(game.startTime), landingStart = timestampMicros(body?.startTimeUTC),
    boxscoreFetched = timestampMicros(boxscore.fetchedAt);
  if (!id(nhlPlayerId) || !record(raw) || !receiptId(raw) || !receiptId(boxscore.rawRow) || raw.endpoint !== "landing"
    || raw.game_id !== game.id || raw.season_id !== game.seasonId || !record(body)
    || body.id !== game.id || body.season !== game.seasonId || body.gameDate !== game.date
    || body.gameType !== 2 || !["FINAL", "OFF"].includes(body.gameState)
    || cutoff === null || fetched === null || gameStart === null || landingStart === null || boxscoreFetched === null
    || fetched < gameStart || fetched > cutoff || boxscoreFetched < gameStart || boxscoreFetched > cutoff
    || !/^[a-f0-9]{64}$/.test(raw.payload_hash) || landing.contentHash !== playerForecastSourcePayloadHash(body)
    || landingStart !== gameStart
    || body.homeTeam?.id !== game.homeTeamId || body.awayTeam?.id !== game.awayTeamId
    || !count(body.homeTeam?.score) || !count(body.awayTeam?.score)) invalid();

  const players = new Map<number, { home: boolean; skater: boolean; row: Record<string, any>;
    goals: number; assists: number; ppGoals: number }>();
  for (const side of ["homeTeam", "awayTeam"] as const) {
    const stats = boxscore.rawRow.payload.playerByGameStats[side];
    if (!record(stats) || !Array.isArray(stats.forwards) || !Array.isArray(stats.defense)
      || !Array.isArray(stats.goalies) || !stats.goalies.length || stats.forwards.length + stats.defense.length === 0) invalid();
    for (const [population, rows] of [["skater", [...stats.forwards, ...stats.defense]], ["goalie", stats.goalies]] as const) {
      for (const player of rows) {
        if (!record(player) || !id(player.playerId) || players.has(player.playerId)
          || population === "skater" && ![player.goals, player.assists, player.powerPlayGoals].every(count)) invalid();
        players.set(player.playerId, { home: side === "homeTeam", skater: population === "skater",
          row: player, goals: 0, assists: 0, ppGoals: 0 });
      }
    }
  }
  if (!players.get(nhlPlayerId)?.skater
    || players.get(nhlPlayerId)!.home !== (appearance.teamId === game.homeTeamId)) invalid();
  const finalPeriod = body.periodDescriptor, periods = body.summary?.scoring;
  if (!record(finalPeriod) || !id(finalPeriod.number) || finalPeriod.number < 3 || finalPeriod.number > 5
    || finalPeriod.periodType !== (finalPeriod.number === 5 ? "SO" : finalPeriod.number === 4 ? "OT" : "REG")
    || !Array.isArray(periods) || periods.length !== finalPeriod.number) invalid();
  const periodIds = new Set<number>(), eventIds = new Set<number>();
  const teamGoals = { home: 0, away: 0 };
  const credits: Array<{ eventId: number; period: number; role: "goal" | "assist" }> = [];
  let powerPlayGoals = 0, powerPlayAssists = 0;
  for (const period of periods) {
    const descriptor = period?.periodDescriptor;
    if (!record(descriptor) || !id(descriptor.number) || descriptor.number > finalPeriod.number
      || periodIds.has(descriptor.number) || descriptor.maxRegulationPeriods !== 3
      || descriptor.periodType !== (descriptor.number === 5 ? "SO" : descriptor.number === 4 ? "OT" : "REG")
      || !Array.isArray(period.goals) || period.goals.length > 50) invalid();
    periodIds.add(descriptor.number);
    for (const goal of period.goals) {
      if (!record(goal) || !id(goal.eventId) || eventIds.has(goal.eventId)) invalid();
      eventIds.add(goal.eventId);
      if (descriptor.periodType === "SO") continue; // Displayed shootout winner is not an official goal/assist credit.
      const scorer = players.get(goal.playerId);
      if (!scorer || typeof goal.isHome !== "boolean" || scorer.home !== goal.isHome
        || !["ev", "pp", "sh"].includes(goal.strength) || !Array.isArray(goal.assists) || goal.assists.length > 2) invalid();
      const assistIds = goal.assists.map((assist: any) => assist?.playerId);
      if (new Set(assistIds).size !== assistIds.length || assistIds.includes(goal.playerId)
        || assistIds.some((playerId: unknown) => !id(playerId) || !players.has(playerId) || players.get(playerId)!.home !== scorer!.home)) invalid();
      scorer!.goals++;
      teamGoals[scorer!.home ? "home" : "away"]++;
      for (const playerId of assistIds) players.get(playerId)!.assists++;
      if (goal.strength === "pp") {
        scorer!.ppGoals++;
        if (goal.playerId === nhlPlayerId) {
          powerPlayGoals++;
          credits.push({ eventId: goal.eventId, period: descriptor.number, role: "goal" });
        }
        if (assistIds.includes(nhlPlayerId)) {
          powerPlayAssists++;
          credits.push({ eventId: goal.eventId, period: descriptor.number, role: "assist" });
        }
      }
    }
  }
  const homeScore = body.homeTeam.score, awayScore = body.awayTeam.score;
  const shootout = finalPeriod.periodType === "SO";
  if (shootout && Math.abs(homeScore - awayScore) !== 1
    || teamGoals.home !== homeScore - (shootout && homeScore > awayScore ? 1 : 0)
    || teamGoals.away !== awayScore - (shootout && awayScore > homeScore ? 1 : 0)) invalid();
  for (const player of players.values()) {
    if (player.skater && (player.goals !== player.row.goals || player.assists !== player.row.assists
      || player.ppGoals !== player.row.powerPlayGoals)) invalid();
  }
  return { version: "native-power-play-points-count-v1" as const,
    classification: "private_historical_observed_counts" as const, targetKey: "PP_POINTS" as const,
    gameId: game.id as number, seasonId: game.seasonId as number, teamId: appearance.teamId, nhlPlayerId,
    unit: "count" as const, conditioning: "positive_minute_historical_appearance" as const,
    powerPlayGoals, powerPlayAssists, powerPlayPoints: powerPlayGoals + powerPlayAssists, credits,
    cutoffAt, sourceReceipts: {
      landing: { rawRowId: raw.id, providerPayloadHash: raw.payload_hash, contentHash: landing.contentHash, fetchedAt: raw.fetched_at },
      boxscore: { rawRowId: boxscore.rawRow.id, providerPayloadHash: boxscore.payloadHash,
        contentHash: boxscore.contentHash, fetchedAt: boxscore.fetchedAt },
    },
    forecastIssued: false as const, released: false as const, qualificationEligible: false as const };
}
