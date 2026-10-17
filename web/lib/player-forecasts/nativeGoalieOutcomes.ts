import { createHash } from "node:crypto";
import { finalBoxscoreForGame, parseTimeOnIceSeconds, rawPlayerForOutput } from "./settlement";
import { playerForecastSourcePayloadHash } from "./sourceSnapshot";
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

/** Shared original summary authentication and exact selected appearance-volume match. */
function matchedNativeGoalieSummary(input: NativeGoalieOutcomeInput & { summary: NativeGoalieShutoutSummary }) {
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
    && row.gamesPlayed === 1 && [row.saves, row.goalsAgainst, row.shotsAgainst, row.timeOnIce].every(count)
    && row.saves === appearance.saves && row.goalsAgainst === appearance.goalsAgainst && row.shotsAgainst === appearance.shotsAgainst
    && row.saves + row.goalsAgainst === row.shotsAgainst && row.timeOnIce === source.appearanceSeconds
    && row.timeOnIce > 0 && row.timeOnIce <= 65 * 60;
  return { row, coherent, matches: matches.length, body, receipt };
}

/** Credited SO only. Missing/ambiguous per-game evidence never becomes a GA=0 inference. */
export function deriveNativeGoalieShutoutCredit(input: NativeGoalieOutcomeInput & { summary: NativeGoalieShutoutSummary }) {
  const { row, coherent: volumeMatches, matches, body, receipt } = matchedNativeGoalieSummary(input);
  const coherent = volumeMatches && [0, 1].includes(row.shutouts) && !(row.shutouts === 1 && row.goalsAgainst !== 0);
  return { shutoutCredit: coherent ? row.shutouts as 0 | 1 : null,
    reason: coherent ? null : matches > 1 ? "ambiguous_summary_row" : !row ? "missing_summary_row" : "incoherent_or_unsupported_summary_fields",
    fullPageRows: body.data.length, usedGameId: input.appearance.gameId,
    sourceReceipt: { id: `http:${receipt.bodySha256}`, url: receipt.url, fetchedAt: receipt.capturedAt, bodySha256: receipt.bodySha256 },
    conditioning: "positive_minute_historical_appearance", released: false, forecastIssued: false };
}

export type NativeGoalieWinSummary = NativeGoalieShutoutSummary;

/** Explicit official per-game win credit, including positive-minute relief/no-decision appearances. */
export function deriveNativeGoalieSummaryWinCredit(input: NativeGoalieOutcomeInput & { summary: NativeGoalieWinSummary }) {
  const { row, coherent: volumeMatches, body, receipt } = matchedNativeGoalieSummary(input);
  const cohortMatches = new Set(body.data.map((r: any) => r?.gameId)).size === body.data.length
    && body.data.every((r: any) => r && r.playerId === input.nhlPlayerId
      && (r.seasonId === undefined || r.seasonId === input.appearance.seasonId)
      && input.summary.scope.approvedGameIds.includes(r.gameId)
      && typeof r.gameDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.gameDate)
      && r.gameDate >= input.summary.scope.startDate && r.gameDate <= input.summary.scope.endDate);
  const explicitCredits = volumeMatches && [row.wins, row.losses, row.otLosses].every(value => value === 0 || value === 1)
    && row.wins + row.losses + row.otLosses <= 1;
  const observed = deriveNativeGoalieOutcomes(input);
  const box = (input.appearance.finalBoxscore as BaselineBoxscoreReceipt).rawRow.payload;
  const won = input.appearance.teamId === box.homeTeam.id
    ? box.homeTeam.score > box.awayTeam.score : box.awayTeam.score > box.homeTeam.score;
  const overtime = box.periodDescriptor.number > 3;
  const side = input.appearance.teamId === box.homeTeam.id ? "homeTeam" : "awayTeam";
  const otherDecisions = box.playerByGameStats[side].goalies
    .filter((goalie: any) => goalie.playerId !== input.nhlPlayerId).map((goalie: any) => goalie.decision);
  const conflicts = explicitCredits && (observed.winCredit !== null && observed.winCredit !== row.wins
    || row.wins === 1 && !won || row.losses === 1 && (won || overtime)
    || row.otLosses === 1 && (won || !overtime)
    || observed.officialDecision === "L" && row.losses !== 1
    || observed.officialDecision === "O" && row.otLosses !== 1
    || row.wins === 1 && otherDecisions.includes("W")
    || (row.losses === 1 || row.otLosses === 1) && otherDecisions.some((decision: unknown) => decision === "L" || decision === "O"));
  const winCredit = cohortMatches && explicitCredits && !conflicts ? row.wins as 0 | 1 : null;
  return { version: "native-goalie-summary-win-credit-v1" as const, winCredit,
    reason: !cohortMatches ? "summary_cohort_conflict" : !explicitCredits ? "missing_or_incoherent_summary_win_credit"
      : conflicts ? "conflicting_boxscore_summary_win_credit" : null,
    gameId: input.appearance.gameId, nhlPlayerId: input.nhlPlayerId,
    officialStarter: observed.officialStarter, officialDecision: observed.officialDecision,
    source: "official_per_game_summary_credited_wins" as const,
    sourceReceipt: { id: `http:${receipt.bodySha256}`, url: receipt.url, fetchedAt: receipt.capturedAt, bodySha256: receipt.bodySha256 },
    boxscoreReceipt: observed.sourceReceipt, conditioning: "positive_minute_historical_appearance" as const,
    released: false as const, forecastIssued: false as const };
}

export type NativeGoalieStarterInput = {
  nhlPlayerId: number; teamId: number; cutoffAt: string;
  boxscore: Pick<BaselineBoxscoreReceipt, "rawRow" | "game" | "contentHash">;
};

/** Original explicit starter flag; zero-minute listed nonstarters are valid labels.
 * Missing players/flags are unknown, never a negative inferred from bench status. */
export function deriveNativeGoalieStarterLabel(input: NativeGoalieStarterInput) {
  const { rawRow: raw, game, contentHash } = input.boxscore;
  const cutoff = timestampMicros(input.cutoffAt), fetched = timestampMicros(raw?.fetched_at),
    start = timestampMicros(game?.startTime);
  const original = raw && game && finalBoxscoreForGame(raw, game);
  const sourceIdValid = id(raw?.id) || /^[a-f0-9]{64}$/.test(raw?.payload_hash) && raw?.id === `http:${raw.payload_hash}`;
  if (!id(input.nhlPlayerId) || !id(input.teamId) || !sourceIdValid || raw.endpoint !== "boxscore"
    || !original || !/^[a-f0-9]{64}$/.test(contentHash) || contentHash !== playerForecastSourcePayloadHash(raw.payload)
    || cutoff === null || fetched === null || start === null || fetched < start || fetched > cutoff
    || timestampMicros(raw.payload.startTimeUTC) !== start || raw.payload.gameDate !== game.date
    || raw.payload.gameType !== 2 || game.type !== 2) throw new Error("Invalid original goalie starter source identity, hash or clock.");
  const own = rawPlayerForOutput({ player_id: input.nhlPlayerId, team_id: input.teamId }, original);
  if (!own) throw new Error("Invalid or conflicting goalie starter player/team identities.");
  let reason: string | null = own.goalie ? null : "missing_explicit_goalie_row";
  for (const side of ["homeTeam", "awayTeam"] as const) {
    const goalies = raw.payload.playerByGameStats[side].goalies;
    if (goalies.length > 20 || goalies.some((row: any) => row.position !== "G" || typeof row.starter !== "boolean"
      || parseTimeOnIceSeconds(row.toi) === null)) reason = "missing_or_ambiguous_starter_flags";
    else if (goalies.filter((row: any) => row.starter === true).length !== 1) reason = "conflicting_starter_flags";
  }
  const officialStarter = reason ? null : own.goalie!.starter as boolean;
  return { version: "native-goalie-starter-label-v1" as const,
    gameId: Number(game.id), seasonId: Number(game.seasonId), teamId: input.teamId, nhlPlayerId: input.nhlPlayerId,
    officialStarter, reason, cutoffAt: input.cutoffAt,
    // Retain actual original transport/source clock; repackaging is not new availability.
    availableAt: raw.fetched_at as string,
    evidence: { id: `boxscore:${raw.id}`, hash: contentHash, availableAt: raw.fetched_at as string, capturedAt: raw.fetched_at as string },
    sourceReceipt: { rawRowId: raw.id, providerPayloadHash: raw.payload_hash as string, contentHash, fetchedAt: raw.fetched_at as string },
    forecastIssued: false as const, released: false as const,
    limitations: ["Official original starter flag only; false does not establish nonappearance or zero minutes.",
      "Historical starter labels are not a future probability, confirmation, or credited goalie-minimum progress."] };
}
