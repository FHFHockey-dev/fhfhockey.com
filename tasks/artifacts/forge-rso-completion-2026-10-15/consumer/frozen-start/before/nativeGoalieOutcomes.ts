import { createHash } from "node:crypto";
import { timestampMicros } from "../projections/evidenceTime";
import { baselineGoalieComponents, verifyBaselineBoxscoreReceipt, type BaselineBoxscoreReceipt } from "./baselineSourceLineage";
import type { GoalieAppearanceInput } from "./goalieBaselineRates";

export type NativeGoalieOutcomeInput = {
  nhlPlayerId: number;
  cutoffAt: string;
  appearance: GoalieAppearanceInput;
};

const id = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) > 0;
const count = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0;
const invalid = (): never => { throw new Error("Native goalie outcomes require matching final boxscore and explicit starter/decision evidence."); };

/** Observed labels only. No start probability, rate fitting or inferred shutout credit. */
export function deriveNativeGoalieOutcomes(input: NativeGoalieOutcomeInput) {
  const { appearance, nhlPlayerId, cutoffAt } = input;
  verifyBaselineBoxscoreReceipt(appearance, nhlPlayerId, cutoffAt, "goalie");
  const receipt = appearance.finalBoxscore as BaselineBoxscoreReceipt;
  const raw = receipt.rawRow, game = receipt.game, body = raw.payload;
  const cutoff = timestampMicros(cutoffAt), fetched = timestampMicros(receipt.fetchedAt),
    start = timestampMicros(game.startTime), bodyStart = timestampMicros(body.startTimeUTC);
  const period = body.periodDescriptor;
  const sourceIdValid = id(raw.id) || /^[a-f0-9]{64}$/.test(raw.payload_hash)
    && raw.id === `http:${raw.payload_hash}`;
  if (!id(nhlPlayerId) || !sourceIdValid || raw.endpoint !== "boxscore"
    || cutoff === null || fetched === null || start === null || bodyStart === null
    || bodyStart !== start || fetched < start || fetched > cutoff || timestampMicros(appearance.availableAt) !== cutoff
    || !period || ![3, 4, 5].includes(period.number) || period.maxRegulationPeriods !== 3
    || period.periodType !== (period.number === 3 ? "REG" : period.number === 4 ? "OT" : "SO")
    || !count(body.homeTeam?.score) || !count(body.awayTeam?.score) || body.homeTeam.score === body.awayTeam.score
    || period.number > 3 && Math.abs(body.homeTeam.score - body.awayTeam.score) !== 1) invalid();
  const winner = body.homeTeam.score > body.awayTeam.score ? "homeTeam" : "awayTeam";
  let selected: { row: Record<string, any>; decision: "W" | "L" | "O" | null } | undefined;
  let winCredits = 0, lossCredits = 0;
  for (const side of ["homeTeam", "awayTeam"] as const) {
    const goalies = body.playerByGameStats[side].goalies;
    if (!Array.isArray(goalies) || !goalies.length || goalies.length > 20
      || goalies.filter(row => row.starter === true).length !== 1) invalid();
    for (const goalie of goalies) {
      if (!goalie || !id(goalie.playerId) || goalie.position !== "G" || typeof goalie.starter !== "boolean") invalid();
      const components = baselineGoalieComponents(goalie);
      const decision = goalie.decision == null || goalie.decision === "" ? null : goalie.decision;
      if (decision !== null && !["W", "L", "O"].includes(decision)) invalid();
      if (decision !== null && components.toiMinutes <= 0) invalid();
      if (decision === "W") {
        if (side !== winner || ++winCredits > 1) invalid();
      } else if (decision === "L" || decision === "O") {
        if (side === winner || ++lossCredits > 1 || (decision === "O") !== (period.number > 3)) invalid();
      }
      if (goalie.playerId === nhlPlayerId) selected = { row: goalie, decision };
    }
  }
  if (!selected) invalid();
  return { version: "native-goalie-outcomes-receipt-v1" as const,
    classification: "private_historical_observed_outcomes" as const,
    gameId: game.id as number, seasonId: game.seasonId as number, teamId: appearance.teamId, nhlPlayerId,
    conditioning: "positive_minute_historical_appearance" as const,
    officialStarter: selected!.row.starter as boolean, officialDecision: selected!.decision,
    winCredit: selected!.decision === null ? null : selected!.decision === "W" ? 1 : 0,
    shutoutCredit: null,
    missingOutcomeEvidence: ["SHUTOUTS_GOALIE", ...(selected!.decision === null ? ["WINS_GOALIE"] : [])],
    limitations: ["Explicit goalie decisions are observed win credits; relief wins are not start-conditioned observations.",
      "No credited shutout field is declared by this receipt; zero goals against and a team result cannot substitute.",
      "Historical labels do not establish a future start/appearance probability or authorize a rate-policy change."],
    cutoffAt, sourceReceipt: { rawRowId: raw.id, providerPayloadHash: receipt.payloadHash,
      contentHash: receipt.contentHash, fetchedAt: receipt.fetchedAt },
    forecastIssued: false as const, released: false as const, qualificationEligible: false as const };
}


export type NativeGoalieShutoutSummary = {
  scope: { nhlPlayerId: number; seasonId: number; startDate: string; endDate: string; approvedGameIds: number[] };
  receipts: Array<{ url: string; capturedAt: string; bodySha256: string; rawBody: string }>;
};

/** Exact bounded public query. The whole page is exposed; only approved bound appearances may be used. */
export function nativeGoalieSummaryUrl(scope: NativeGoalieShutoutSummary["scope"]) {
  const season = String(scope.seasonId);
  const realDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value))
    && new Date(value).toISOString().slice(0, 10) === value;
  if (!id(scope.nhlPlayerId) || !/^\d{8}$/.test(season) || Number(season.slice(0, 4)) + 1 !== Number(season.slice(4))
    || !realDate(scope.startDate) || !realDate(scope.endDate) || scope.startDate > scope.endDate
    || scope.startDate < `${season.slice(0, 4)}-07-01` || scope.endDate >= `${season.slice(4)}-07-01`
    || Date.parse(scope.endDate) - Date.parse(scope.startDate) >= 60 * 86400000
    || !Array.isArray(scope.approvedGameIds) || !scope.approvedGameIds.length || scope.approvedGameIds.length > 60
    || new Set(scope.approvedGameIds).size !== scope.approvedGameIds.length || !scope.approvedGameIds.every(id)) {
    throw new Error("Native SO summary requires the bounded declared player/season/date/game scope.");
  }
  const params = new URLSearchParams({ isAggregate: "false", isGame: "true", start: "0", limit: "50",
    factCayenneExp: "gamesPlayed>=1", cayenneExp: `playerId=${scope.nhlPlayerId} and seasonId=${scope.seasonId} and gameDate>="${scope.startDate}" and gameDate<="${scope.endDate}" and gameTypeId=2` });
  return `https://api.nhle.com/stats/rest/en/goalie/summary?${params.toString().replace(/\+/g, "%20")}`;
}

/** Credited SO only. Missing/ambiguous per-game evidence never becomes a GA=0 inference. */
export function deriveNativeGoalieShutoutCredit(input: NativeGoalieOutcomeInput & { summary: NativeGoalieShutoutSummary }) {
  const { appearance, nhlPlayerId, cutoffAt, summary } = input;
  verifyBaselineBoxscoreReceipt(appearance, nhlPlayerId, cutoffAt, "goalie");
  const expectedUrl = nativeGoalieSummaryUrl(summary.scope), original = summary.receipts;
  if (summary.scope.nhlPlayerId !== nhlPlayerId || summary.scope.seasonId !== appearance.seasonId
    || !summary.scope.approvedGameIds.includes(appearance.gameId) || appearance.gameDate < summary.scope.startDate
    || appearance.gameDate > summary.scope.endDate || !Array.isArray(original) || original.length !== 1) throw new Error("SO appearance is outside the approved summary cohort.");
  const receipt = original[0], fetched = timestampMicros(receipt.capturedAt), cutoff = timestampMicros(cutoffAt);
  const source = appearance.finalBoxscore as BaselineBoxscoreReceipt;
  if (receipt.url !== expectedUrl || typeof receipt.rawBody !== "string" || !receipt.rawBody.length
    || Buffer.byteLength(receipt.rawBody) > 1024 * 1024 || !/^[a-f0-9]{64}$/.test(receipt.bodySha256)
    || createHash("sha256").update(receipt.rawBody, "utf8").digest("hex") !== receipt.bodySha256
    || fetched === null || cutoff === null || fetched > cutoff || fetched < timestampMicros(source.game.startTime)!) {
    throw new Error("Invalid original SO summary receipt URL/hash/clock.");
  }
  const body = JSON.parse(receipt.rawBody);
  if (!body || !Array.isArray(body.data) || !Number.isSafeInteger(body.total) || body.total !== body.data.length
    || body.total < 0 || body.total >= 50) throw new Error("SO summary single-page completeness is unverified.");
  const matches = body.data.filter((row: any) => row?.gameId === appearance.gameId);
  const row = matches.length === 1 ? matches[0] : null;
  const coherent = row && row.playerId === nhlPlayerId && (row.seasonId === undefined || row.seasonId === appearance.seasonId) && row.gameDate === appearance.gameDate
    && row.gamesPlayed === 1 && [0, 1].includes(row.shutouts) && [row.saves, row.goalsAgainst, row.shotsAgainst, row.timeOnIce].every(count)
    && row.saves === appearance.saves && row.goalsAgainst === appearance.goalsAgainst && row.shotsAgainst === appearance.shotsAgainst
    && row.saves + row.goalsAgainst === row.shotsAgainst && row.timeOnIce === source.appearanceSeconds
    && row.timeOnIce > 0 && row.timeOnIce <= 65 * 60 && !(row.shutouts === 1 && row.goalsAgainst !== 0);
  return { shutoutCredit: coherent ? row.shutouts as 0 | 1 : null,
    reason: coherent ? null : matches.length > 1 ? "ambiguous_summary_row" : !row ? "missing_summary_row" : "incoherent_or_unsupported_summary_fields",
    fullPageRows: body.data.length, usedGameId: appearance.gameId,
    sourceReceipt: { id: `http:${receipt.bodySha256}`, url: receipt.url, fetchedAt: receipt.capturedAt, bodySha256: receipt.bodySha256 },
    conditioning: "positive_minute_historical_appearance", released: false, forecastIssued: false };
}
