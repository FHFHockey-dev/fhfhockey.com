import { sanitizePublicNewsText } from "lib/newsFeed";
import { easternReportDate, verifiedOriginalTweetUrl } from "./projectedLineups";
import { tweetPipelineFlags } from "./tweetInterpretation";
import { eligibleClaim } from "lib/lines/reconcile";
import type { LineClaim } from "lib/lines/types";

export type LineHistoryItem = {
  id: string;
  reportDate: string;
  gameId: number | null;
  gameDate: string | null;
  gameLink: "verified" | "unverified" | "unlinked";
  recordType: "legacy_report" | LineClaim["kind"];
  originalPublishedAt: string | null;
  storedPublishedAt: string | null;
  receivedAt: string | null;
  interpretedAt: string | null;
  sourceUrl: string | null;
  text: string;
  context: string;
  version: string;
  units: Array<{
    situation: string;
    number: number | null;
    players: Array<{ playerId: number; name: string }>;
    complete: boolean;
  }>;
};

export type LineHistoryPage = {
  enabled: boolean;
  items: LineHistoryItem[];
  nextCursor: string | null;
  coverage: "unknown";
  correctionHistory: "unverified";
  skippedRecords: number;
  scannedRecords: number;
};

export type LineHistoryMode = "game" | "publication" | "claimPublication";
type Cursor = {
  v: 1;
  mode: LineHistoryMode;
  teamId: number;
  startDate: string;
  endDate: string;
  asOf: string;
  sortDate: string;
  recordKey: string;
  stage?: "rows" | "next";
  gameId?: number | null;
};
export type LineHistoryQuery = {
  mode: LineHistoryMode;
  teamId: number;
  startDate: string;
  endDate: string;
  asOf: string;
  cursor: Cursor | null;
};

const PAGE_SIZE = 50;
// Stored report hashes/parser versions use these characters. Restrict cursor
// values before interpolation into PostgREST's logical-filter grammar.
const REPORT_KEY = /^[A-Za-z0-9:_-][A-Za-z0-9:._-]{0,511}$/;
const object = (value: unknown): value is Record<string, unknown> =>
  value != null && typeof value === "object" && !Array.isArray(value);
const positiveId = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value > 0;

function realDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** undefined means malformed; null means the stored clock is unknown. */
function timestamp(value: unknown): string | null | undefined {
  if (value == null) return null;
  if (typeof value !== "string" || !realDate(value.slice(0, 10)) ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return undefined;
  if (Number(value.slice(11, 13)) > 23 || Number(value.slice(14, 16)) > 59 || Number(value.slice(17, 19)) > 59) return undefined;
  const instant = Date.parse(value);
  return Number.isFinite(instant) ? new Date(instant).toISOString() : undefined;
}

export class LineHistoryValidationError extends Error {}

export function parseLineHistoryQuery(
  query: Record<string, unknown>,
  now = new Date(),
): LineHistoryQuery {
  const { teamId, startDate, endDate } = query;
  const mode = query.mode ?? "game";
  if (typeof teamId !== "string" || !/^[1-9]\d*$/.test(teamId) ||
    !positiveId(Number(teamId)) || !realDate(startDate) || !realDate(endDate) || startDate > endDate ||
    (mode !== "game" && mode !== "publication" && mode !== "claimPublication")) {
    throw new LineHistoryValidationError("A valid teamId and inclusive startDate/endDate are required");
  }
  let cursor: Cursor | null = null;
  if (query.cursor != null) {
    try {
      if (typeof query.cursor !== "string" || query.cursor.length > 2048 ||
        !/^[A-Za-z0-9_-]+$/.test(query.cursor)) throw new Error();
      const decoded: unknown = JSON.parse(Buffer.from(query.cursor, "base64url").toString("utf8"));
      if (!object(decoded) || Object.keys(decoded).length !== (mode === "claimPublication" ? 10 : 8) || decoded.v !== 1 || decoded.mode !== mode ||
        decoded.teamId !== Number(teamId) || decoded.startDate !== startDate || decoded.endDate !== endDate ||
        typeof decoded.asOf !== "string" || timestamp(decoded.asOf) !== decoded.asOf || Date.parse(decoded.asOf) > now.getTime() ||
        typeof decoded.sortDate !== "string" || typeof decoded.recordKey !== "string") throw new Error();
      if (mode === "claimPublication" && decoded.stage === "next") {
        if (!Number.isSafeInteger(decoded.gameId) || Number(decoded.gameId) < 0 || decoded.sortDate !== "" || decoded.recordKey !== "") throw new Error();
      } else {
        if (!REPORT_KEY.test(decoded.recordKey) ||
          (mode === "publication"
            ? !realDate(decoded.sortDate) || decoded.sortDate < startDate || decoded.sortDate > endDate
            : !timestamp(decoded.sortDate) || Date.parse(decoded.sortDate) > Date.parse(decoded.asOf)) ||
          (mode === "claimPublication" && (decoded.stage !== "rows" || decoded.gameId !== null && !positiveId(decoded.gameId)))) throw new Error();
      }
      cursor = decoded as Cursor;
    } catch {
      throw new LineHistoryValidationError("Invalid history cursor for this team and date range");
    }
  }
  return { mode, teamId: Number(teamId), startDate, endDate, asOf: cursor?.asOf ?? now.toISOString(), cursor };
}

function publicUnits(value: unknown): LineHistoryItem["units"] | null {
  if (!Array.isArray(value)) return null;
  const units: LineHistoryItem["units"] = [];
  for (const unit of value) {
    if (!object(unit) || !["es_forward", "es_defense", "pp", "pk", "goalie", "scratch", "injury"].includes(String(unit.situation)) ||
      (unit.number !== null && !positiveId(unit.number)) || typeof unit.complete !== "boolean" || !Array.isArray(unit.players)) return null;
    const players: LineHistoryItem["units"][number]["players"] = [];
    for (const player of unit.players) {
      if (!object(player) || !positiveId(player.playerId) || typeof player.name !== "string") return null;
      const name = sanitizePublicNewsText(player.name);
      if (!name || players.some((previous) => previous.playerId === player.playerId)) return null;
      players.push({ playerId: player.playerId, name });
    }
    units.push({ situation: String(unit.situation), number: unit.number as number | null, complete: unit.complete, players });
  }
  return units;
}

function attributedOriginalUrl(url: unknown, provenance: unknown): string | null {
  if (typeof url !== "string" || !object(provenance) || provenance.attributionStatus !== "resolved") return null;
  const candidate = verifiedOriginalTweetUrl(url);
  if (!candidate) return null;
  const handle = new URL(candidate).pathname.split("/")[1]!;
  return /^(?:i|null|undefined|unknown|none|n_?a|source_account)$/i.test(handle) ||
    provenance.originalTweetId !== candidate.match(/\/status\/(\d+)$/)?.[1] ? null : candidate;
}

function publicItem(value: unknown, scope: LineHistoryQuery): LineHistoryItem | null {
  if (!object(value) || !object(value.payload)) return null;
  const row = value;
  const payload = value.payload;
  if (typeof row.report_key !== "string" || !REPORT_KEY.test(row.report_key) || payload.key !== row.report_key ||
    row.team_id !== scope.teamId || payload.teamId !== row.team_id ||
    !realDate(row.report_date) || payload.date !== row.report_date || row.report_date < scope.startDate || row.report_date > scope.endDate ||
    (row.game_id !== null && !positiveId(row.game_id)) || payload.gameId !== row.game_id ||
    !object(payload.interpretation) || typeof row.interpretation_version !== "string" ||
    payload.interpretation.version !== row.interpretation_version || typeof payload.text !== "string") return null;
  const interpretation = payload.interpretation;
  if (!["camp", "practice", "game", "unknown"].includes(String(interpretation.context)) ||
    !Array.isArray(interpretation.units)) return null;

  const createdAt = timestamp(row.created_at);
  const original = timestamp(payload.originalPublishedAt);
  const stored = timestamp(row.published_at);
  const payloadPublished = timestamp(payload.publishedAt);
  const received = timestamp(row.received_at);
  const payloadReceived = timestamp(payload.receivedAt);
  const interpreted = timestamp(payload.interpretedAt);
  if (!createdAt || createdAt > scope.asOf || original === undefined || stored === undefined ||
    payloadPublished !== stored || received === undefined || payloadReceived !== received || interpreted === undefined) return null;
  if (original && easternReportDate(original) !== row.report_date) return null;
  if (payload.originalUrl != null && typeof payload.originalUrl !== "string") return null;

  const units = publicUnits(interpretation.units);
  if (!units) return null;
  return {
    id: row.report_key, reportDate: row.report_date, gameId: row.game_id as number | null,
    gameDate: null, gameLink: row.game_id == null ? "unlinked" : "unverified", recordType: "legacy_report",
    originalPublishedAt: original, storedPublishedAt: stored, receivedAt: received, interpretedAt: interpreted,
    sourceUrl: attributedOriginalUrl(payload.originalUrl, payload.provenance),
    text: payload.text.split("\n").map((line) => sanitizePublicNewsText(line)).join("\n"),
    context: String(interpretation.context), version: row.interpretation_version, units,
  };
}

type HistoryGame = { id: number; date: string; opponentId: number; scheduleIdentity: string };
const strings = (value: unknown): value is string[] =>
  Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === "string" && item.trim().length > 0);

function matchingSpans(value: unknown, text: string): boolean {
  return Array.isArray(value) && value.length > 0 && value.every((span) => object(span) &&
    typeof span.start === "number" && Number.isInteger(span.start) && span.start >= 0 &&
    typeof span.end === "number" && Number.isInteger(span.end) && span.end > span.start && span.end <= text.length &&
    typeof span.text === "string" && text.slice(span.start, span.end) === span.text);
}

function publicGameClaim(value: unknown, scope: LineHistoryQuery, games: Map<number, HistoryGame>): LineHistoryItem | null {
  if (!object(value) || !object(value.payload)) return null;
  const claim = value.payload;
  const game = positiveId(value.game_id) ? games.get(value.game_id) : undefined;
  if (!game || value.team_id !== scope.teamId || claim.teamId !== value.team_id || claim.gameId !== value.game_id ||
    typeof value.claim_id !== "string" || !REPORT_KEY.test(value.claim_id) || claim.id !== value.claim_id ||
    typeof value.capture_id !== "string" || claim.captureId !== value.capture_id ||
    typeof value.interpretation_version !== "string" || claim.version !== value.interpretation_version ||
    typeof claim.text !== "string" || !["entry", "iga", "pp", "entry_correction", "retraction"].includes(String(claim.kind)) ||
    !object(claim.time) || !object(claim.binding) || !object(claim.decisionEvidence) || !object(claim.provenance) ||
    claim.accepted !== true || claim.explicit !== true || !Array.isArray(claim.reviewReasons) || claim.reviewReasons.length !== 0 ||
    claim.identityStatus !== "resolved_at_event" || !strings(claim.identityEvidence) ||
    !strings(claim.publicationEvidence) || !strings(claim.binding.evidence) || claim.binding.status !== "bound" ||
    claim.binding.scheduleIdentity !== game.scheduleIdentity || typeof claim.binding.resolverVersion !== "string" ||
    !["pregame", "in_game"].includes(String(claim.phase))) return null;

  const decision = claim.decisionEvidence;
  const bindingReasons = claim.binding.evidence.filter((entry) => /^(?:explicit_game:|opponent_date:|relative_date:)/.test(entry));
  if (typeof decision.producerVersion !== "string" || !decision.producerVersion.trim() ||
    typeof decision.decisionId !== "string" || !decision.decisionId.trim() || !strings(decision.sourceReferences) ||
    !matchingSpans(decision.binding, claim.text) || !matchingSpans(decision.phase, claim.text) ||
    !claim.binding.evidence.includes(`team_participation:${scope.teamId}`) ||
    !bindingReasons.length || !bindingReasons.every((entry) => entry === `explicit_game:${game.id}` ||
      entry === `opponent_date:${game.opponentId}:${game.date}` ||
      /^(?:relative_date):(today|tonight|tomorrow|yesterday):/.test(entry) && entry.endsWith(`:${game.date}`))) return null;

  const original = timestamp(claim.time.originalPublishedAt);
  const received = timestamp(claim.time.ingestedAt);
  const interpreted = timestamp(claim.time.interpretedAt);
  const rowInterpreted = timestamp(value.interpreted_at);
  const relay = timestamp(claim.time.relayPublishedAt);
  if (!original || !received || !interpreted || interpreted !== rowInterpreted || relay === undefined ||
    original > scope.asOf || received > scope.asOf || interpreted > scope.asOf || relay != null && relay > scope.asOf ||
    timestamp(claim.time.effectiveAt) === undefined || timestamp(claim.time.effectiveUntil) === undefined ||
    !eligibleClaim(claim as unknown as LineClaim)) return null;

  if (typeof claim.sourceUrl !== "string" || typeof claim.author !== "string") return null;
  const sourceUrl = attributedOriginalUrl(claim.sourceUrl, claim.provenance);
  const sourceId = sourceUrl?.match(/\/status\/(\d+)$/)?.[1];
  const originalIdentity = typeof claim.originalIdentity === "string" ? claim.originalIdentity : null;
  if (!sourceUrl || claim.provenance.attributionStatus !== "resolved" || claim.provenance.originalTweetId !== sourceId ||
    claim.author.replace(/^@/, "").toLowerCase() !== new URL(sourceUrl).pathname.split("/")[1]!.toLowerCase() ||
    (originalIdentity !== sourceId && verifiedOriginalTweetUrl(originalIdentity)?.toLowerCase() !== sourceUrl.toLowerCase())) return null;
  const units = publicUnits(claim.unit == null ? [] : [claim.unit]);
  const context = claim.context ?? claim.specificity;
  if (!units || !["game", "warmup", "projected"].includes(String(context))) return null;
  return {
    id: value.claim_id, recordType: claim.kind as LineClaim["kind"], reportDate: easternReportDate(original),
    gameId: game.id, gameDate: game.date, gameLink: "verified", originalPublishedAt: original,
    storedPublishedAt: relay, receivedAt: received, interpretedAt: interpreted, sourceUrl,
    text: claim.text.split("\n").map((line) => sanitizePublicNewsText(line)).join("\n"),
    context: String(context), version: value.interpretation_version, units,
  };
}

/** Publication browsing retains unresolved interpretations without qualifying their game link. */
function publicPublicationClaim(value: unknown, scope: LineHistoryQuery, gameId: number | null): LineHistoryItem | null {
  if (!object(value) || !object(value.payload)) return null;
  const claim = value.payload;
  if (value.team_id !== scope.teamId || claim.teamId !== value.team_id || value.game_id !== gameId || claim.gameId !== gameId ||
    typeof value.claim_id !== "string" || !REPORT_KEY.test(value.claim_id) || claim.id !== value.claim_id ||
    typeof value.capture_id !== "string" || claim.captureId !== value.capture_id ||
    typeof value.interpretation_version !== "string" || claim.version !== value.interpretation_version ||
    typeof claim.text !== "string" || !object(claim.time) ||
    !["entry", "iga", "pp", "entry_correction", "retraction"].includes(String(claim.kind))) return null;
  const original = timestamp(claim.time.originalPublishedAt);
  const received = timestamp(claim.time.ingestedAt);
  const interpreted = timestamp(claim.time.interpretedAt);
  const relay = timestamp(claim.time.relayPublishedAt);
  if (!original || !interpreted || interpreted !== timestamp(value.interpreted_at) || received === undefined || relay === undefined ||
    original > scope.asOf || interpreted > scope.asOf || received != null && received > scope.asOf || relay != null && relay > scope.asOf) return null;
  const units = publicUnits(claim.unit == null ? [] : [claim.unit]);
  const context = claim.context ?? claim.specificity ?? "unknown";
  if (!units || !["game", "warmup", "practice", "projected", "camp", "unknown"].includes(String(context))) return null;
  return {
    id: value.claim_id, recordType: claim.kind as LineClaim["kind"], reportDate: easternReportDate(original),
    gameId, gameDate: null, gameLink: gameId == null ? "unlinked" : "unverified",
    originalPublishedAt: original, storedPublishedAt: relay, receivedAt: received, interpretedAt: interpreted,
    sourceUrl: attributedOriginalUrl(claim.sourceUrl, claim.provenance),
    text: claim.text.split("\n").map((line) => sanitizePublicNewsText(line)).join("\n"),
    context: String(context), version: value.interpretation_version, units,
  };
}

const encodeCursor = (cursor: Cursor) => Buffer.from(JSON.stringify(cursor)).toString("base64url");

/** Walk one exact existing-index prefix at a time; no JSON publication-date scan. */
async function readClaimPublication(database: { from: (table: string) => any }, scope: LineHistoryQuery, page: LineHistoryPage) {
  let gameId = scope.cursor?.gameId ?? null;
  if (scope.cursor?.stage === "next") {
    const discovery = await database.from("line_claim_revisions").select("game_id")
      .eq("team_id", scope.teamId).gt("game_id", gameId).lte("interpreted_at", scope.asOf)
      .order("game_id", { ascending: true }).limit(1);
    if (discovery.error || !Array.isArray(discovery.data)) throw new Error("Historical claim scope unavailable");
    if (!discovery.data.length) return page;
    const nextId = discovery.data[0]?.game_id;
    if (!positiveId(nextId) || nextId <= Number(gameId)) throw new Error("Historical claim scope is malformed");
    gameId = nextId;
  }
  let query = database.from("line_claim_revisions")
    .select("claim_id,capture_id,team_id,game_id,interpretation_version,interpreted_at,payload")
    .eq("team_id", scope.teamId).lte("interpreted_at", scope.asOf);
  query = gameId == null ? query.is("game_id", null) : query.eq("game_id", gameId);
  if (scope.cursor?.stage === "rows") {
    query = query.gte("interpreted_at", scope.cursor.sortDate)
      .or(`interpreted_at.gt.${scope.cursor.sortDate},and(interpreted_at.eq.${scope.cursor.sortDate},claim_id.gt.${scope.cursor.recordKey})`);
  }
  const { data, error } = await query.order("interpreted_at", { ascending: true })
    .order("claim_id", { ascending: true }).limit(PAGE_SIZE + 1);
  if (error || !Array.isArray(data)) throw new Error("Historical claims unavailable");
  const scanned = data.slice(0, PAGE_SIZE);
  page.scannedRecords = scanned.length;
  for (const row of scanned) {
    const item = publicPublicationClaim(row, scope, gameId);
    if (!item) page.skippedRecords += 1;
    else if (item.reportDate >= scope.startDate && item.reportDate <= scope.endDate) page.items.push(item);
  }
  const base = { v: 1 as const, mode: scope.mode, teamId: scope.teamId,
    startDate: scope.startDate, endDate: scope.endDate, asOf: scope.asOf };
  if (data.length > PAGE_SIZE) {
    const last = scanned[PAGE_SIZE - 1];
    if (!object(last) || !timestamp(last.interpreted_at) || typeof last.claim_id !== "string" || !REPORT_KEY.test(last.claim_id)) {
      throw new Error("Historical claim pagination boundary is malformed");
    }
    page.nextCursor = encodeCursor({ ...base, stage: "rows", gameId, sortDate: last.interpreted_at as string, recordKey: last.claim_id });
  } else {
    // An explicit next stage prevents an empty NULL bucket from being read again.
    page.nextCursor = encodeCursor({ ...base, stage: "next", gameId: gameId ?? 0, sortDate: "", recordKey: "" });
  }
  return page;
}

/** Bounded private-table reads; never observes live games or calls providers. */
export async function readLineHistory(
  database: { from: (table: string) => any },
  scope: LineHistoryQuery,
): Promise<LineHistoryPage> {
  const page: LineHistoryPage = {
    enabled: tweetPipelineFlags().publishing, items: [], nextCursor: null,
    coverage: "unknown", correctionHistory: "unverified", skippedRecords: 0, scannedRecords: 0,
  };
  if (!page.enabled) return page;
  if (scope.mode === "claimPublication") return readClaimPublication(database, scope, page);
  const games = new Map<number, HistoryGame>();
  if (scope.mode === "game") {
    const result = await database.from("games").select("id,date,startTime,homeTeamId,awayTeamId")
      .or(`homeTeamId.eq.${scope.teamId},awayTeamId.eq.${scope.teamId}`)
      .gte("date", scope.startDate).lte("date", scope.endDate)
      .order("date", { ascending: false }).order("id", { ascending: false }).limit(201);
    if (result.error || !Array.isArray(result.data)) throw new Error("Historical game scope unavailable");
    if (result.data.length > 200) throw new LineHistoryValidationError("This range contains too many games; choose a narrower date range");
    for (const row of result.data) {
      if (!object(row) || !positiveId(row.id) || !realDate(row.date) || row.date < scope.startDate || row.date > scope.endDate ||
        !positiveId(row.homeTeamId) || !positiveId(row.awayTeamId) || row.homeTeamId === row.awayTeamId ||
        ![row.homeTeamId, row.awayTeamId].includes(scope.teamId) || (row.startTime != null && !timestamp(row.startTime))) {
        throw new Error("Historical game scope is malformed");
      }
      games.set(row.id, { id: row.id, date: row.date,
        opponentId: row.homeTeamId === scope.teamId ? row.awayTeamId : row.homeTeamId,
        scheduleIdentity: `${row.id}:${row.startTime ?? row.date}:OK` });
    }
    if (!games.size) return page;
  }
  const gameMode = scope.mode === "game";
  const dateColumn = gameMode ? "interpreted_at" : "report_date";
  const keyColumn = gameMode ? "claim_id" : "report_key";
  let query = gameMode
    ? database.from("line_claim_revisions")
      .select("claim_id,capture_id,team_id,game_id,interpretation_version,interpreted_at,payload")
      .eq("team_id", scope.teamId).in("game_id", [...games.keys()]).lte("interpreted_at", scope.asOf)
    : database.from("tweet_projection_reports")
      .select("report_key,team_id,game_id,report_date,published_at,received_at,interpretation_version,created_at,payload")
      .eq("team_id", scope.teamId).gte("report_date", scope.startDate).lte("report_date", scope.endDate)
      .lte("created_at", scope.asOf);
  if (scope.cursor) {
    query = query.or(`${dateColumn}.lt.${scope.cursor.sortDate},and(${dateColumn}.eq.${scope.cursor.sortDate},${keyColumn}.lt.${scope.cursor.recordKey})`);
  }
  const { data, error } = await query.order(dateColumn, { ascending: false })
    .order(keyColumn, { ascending: false }).limit(PAGE_SIZE + 1);
  if (error || !Array.isArray(data)) throw new Error("Line history store unavailable");
  const scanned = data.slice(0, PAGE_SIZE);
  page.scannedRecords = scanned.length;
  for (const row of scanned) {
    const item = gameMode ? publicGameClaim(row, scope, games) : publicItem(row, scope);
    if (item) page.items.push(item);
    else page.skippedRecords += 1;
  }
  if (data.length > PAGE_SIZE) {
    const last = scanned[PAGE_SIZE - 1];
    if (!object(last) || typeof last[dateColumn] !== "string" ||
      (gameMode ? !timestamp(last[dateColumn]) : !realDate(last[dateColumn])) ||
      typeof last[keyColumn] !== "string" || !REPORT_KEY.test(last[keyColumn] as string)) {
      throw new Error("Line history pagination boundary is malformed");
    }
    page.nextCursor = encodeCursor({
      v: 1, mode: scope.mode, teamId: scope.teamId, startDate: scope.startDate, endDate: scope.endDate,
      asOf: scope.asOf, sortDate: last[dateColumn] as string, recordKey: last[keyColumn] as string,
    } satisfies Cursor);
  }
  return page;
}
