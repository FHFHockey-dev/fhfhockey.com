import { createHash } from "node:crypto";
import { finalBoxscoreForGame, parseTimeOnIceSeconds, rawPlayerForOutput } from "./settlement";
import { deriveNativeGoalieStarterLabel } from "./nativeGoalieOutcomes";
import { playerForecastSourcePayloadHash as hash } from "./sourceSnapshot";
import type { HttpReceipt } from "./nativeDailyPipeline";
import type { NativeMaterializationParent } from "./nativeInputMaterialization";
import type { DatedParticipationEligibility, ParticipationEvidence } from "./modeledSkaterParticipation";
import { rollingParticipationWindow, type RollingWindowGoalieStartInput } from "./rollingWindowParticipation";
import { timestampMicros } from "../projections/evidenceTime";

/** Rolling 14-day history frames from original receipts: weekly NHL schedules define each club's
 * regular-season opportunities; final boxscores supply game-instant listed eligibility and explicit
 * positive or zero TOI labels. A missing row or unread game stays unknown, never negative. */
export const ROLLING_HISTORY_FRAME_VERSION = "rolling-14d-history-frame-manifest-v1" as const;
export type RollingHistory = RollingWindowGoalieStartInput["history"];
/** Listing in an original final boxscore establishes eligibility for that game instant only. */
type ListedEligibility = DatedParticipationEligibility & { scope: "listed_game_instant_only"; gameId: number };
export type RollingFramePlayer = { playerId: number; nhlPlayerId: number; teamId: number; playerClass: "skater" | "goalie" };

const DAY = BigInt(86400000000);
const SCHEDULE_URL = /^https:\/\/api-web\.nhle\.com\/v1\/schedule\/(\d{4}-\d{2}-\d{2})$/;
const BOXSCORE_URL = /^https:\/\/api-web\.nhle\.com\/v1\/gamecenter\/(\d+)\/boxscore$/;
const fail = (reason: string): never => { throw new Error(reason); };
const micros = (value: string) => timestampMicros(value) ?? fail("invalid_clock");
const sha = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");
const receiptEvidence = (receipt: HttpReceipt) => ({ id: `http:${receipt.bodySha256}`, hash: receipt.bodySha256,
  availableAt: receipt.capturedAt, capturedAt: receipt.capturedAt });
const originalParent = (receipt: HttpReceipt): NativeMaterializationParent => ({ ...receiptEvidence(receipt),
  original: { url: receipt.url, rawBody: receipt.rawBody, bodySha256: receipt.bodySha256 } });
function verifiedBody(receipt: HttpReceipt, cutoffAt: string) {
  if (typeof receipt?.rawBody !== "string" || !receipt.rawBody.length || Buffer.byteLength(receipt.rawBody) > 1024 * 1024
    || sha(receipt.rawBody) !== receipt.bodySha256 || micros(receipt.capturedAt) > micros(cutoffAt)) fail("invalid_original_receipt");
  return JSON.parse(receipt.rawBody);
}

type FrameGame = { gameId: number; seasonId: number; scheduledAt: string; date: string; homeTeamId: number; awayTeamId: number;
  status: "final" | "not_final"; gameState: string };

/** Window games for the requested clubs from fresh weekly schedules covering all 14 window dates. */
function scheduleFrame(args: { cutoffAt: string; seasonId: number; clubIds: number[]; scheduleReceipts: HttpReceipt[] }) {
  const window = rollingParticipationWindow(args.cutoffAt), cutoff = micros(args.cutoffAt);
  const start = micros(window.startAt), end = micros(window.endAt), clubs = new Set(args.clubIds);
  if (!args.clubIds.length || args.clubIds.some(id => !Number.isSafeInteger(id) || id <= 0)
    || new Set(args.scheduleReceipts.map(receipt => receipt.url)).size !== args.scheduleReceipts.length) fail("invalid_history_frame_request");
  const dates = new Set<string>(), identities = new Map<number, string>(), games = new Map<number, FrameGame>();
  for (const receipt of args.scheduleReceipts) {
    if (!SCHEDULE_URL.test(receipt?.url ?? "")) fail("invalid_original_receipt");
    const body = verifiedBody(receipt, args.cutoffAt);
    // A frame is one schedule observation; a receipt older than a day cannot stand in for the fresh frame.
    if (cutoff - micros(receipt.capturedAt) > DAY) fail("stale_history_schedule_receipt");
    if (!Array.isArray(body?.gameWeek)) fail("schedule_shape");
    for (const day of body.gameWeek) {
      if (typeof day?.date !== "string" || !Array.isArray(day.games)) fail("schedule_shape");
      dates.add(day.date);
      for (const game of day.games) {
        if (game?.gameType !== 2) continue;
        const scheduledAt = new Date(Date.parse(game.startTimeUTC)).toISOString(), at = micros(scheduledAt);
        const identity = hash({ id: game.id, season: game.season, start: game.startTimeUTC, home: game.homeTeam?.id, away: game.awayTeam?.id,
          state: game.gameState, schedule: game.gameScheduleState });
        if (identities.has(game.id) && identities.get(game.id) !== identity) fail("schedule_source_conflict");
        identities.set(game.id, identity);
        if (at < start || at >= end || !clubs.has(game.homeTeam?.id) && !clubs.has(game.awayTeam?.id)) continue;
        if (!Number.isSafeInteger(game.id) || game.id <= 0 || game.season !== args.seasonId) fail("schedule_season_or_identity_conflict");
        games.set(game.id, { gameId: game.id, seasonId: game.season, scheduledAt, date: day.date,
          homeTeamId: game.homeTeam.id, awayTeamId: game.awayTeam.id, gameState: String(game.gameState ?? ""),
          status: ["OFF", "FINAL"].includes(game.gameState) ? "final" : "not_final" });
      }
    }
  }
  if (window.dates.some(date => !dates.has(date))) fail("history_window_not_fully_observed");
  return { window, games: [...games.values()].sort((a, b) => Number(micros(a.scheduledAt) - micros(b.scheduledAt)) || a.gameId - b.gameId) };
}

/** Requests for the window: the two weekly schedules covering its 14 dates. */
export function rollingHistoryScheduleUrls(cutoffAt: string): string[] {
  const { dates } = rollingParticipationWindow(cutoffAt);
  return [dates[0], dates[7]].map(date => `https://api-web.nhle.com/v1/schedule/${date}`);
}

/** Boxscores to capture after the schedules: final window games of the requested clubs only. */
export function rollingHistoryBoxscoreUrls(args: { cutoffAt: string; seasonId: number; clubIds: number[]; scheduleReceipts: HttpReceipt[] }): string[] {
  return scheduleFrame(args).games.filter(game => game.status === "final")
    .map(game => `https://api-web.nhle.com/v1/gamecenter/${game.gameId}/boxscore`);
}

/** Per-player rolling histories with the frame's manifest evidence and every materialization parent the
 * evidence references. Labels come only from original final boxscores; no eligibility is inferred. */
export function buildRollingParticipationHistories(args: { cutoffAt: string; seasonId: number; players: RollingFramePlayer[];
  scheduleReceipts: HttpReceipt[]; boxscoreReceipts: HttpReceipt[] }) {
  const clubIds = [...new Set(args.players.map(player => player.teamId))].sort((a, b) => a - b);
  if (new Set(args.players.map(player => player.playerId)).size !== args.players.length
    || args.players.some(player => ![player.playerId, player.nhlPlayerId, player.teamId].every(id => Number.isSafeInteger(id) && id > 0)
      || !["skater", "goalie"].includes(player.playerClass))) fail("invalid_history_frame_players");
  const { window, games } = scheduleFrame({ ...args, clubIds });
  const byId = new Map(games.map(game => [game.gameId, game]));
  const boxscores = new Map<number, { receipt: HttpReceipt; raw: any; metadata: any; evidence: ParticipationEvidence }>();
  for (const receipt of args.boxscoreReceipts) {
    const gameId = Number(BOXSCORE_URL.exec(receipt?.url ?? "")?.[1] ?? fail("invalid_original_receipt"));
    const game = byId.get(gameId);
    if (!game || game.status !== "final" || boxscores.has(gameId)) fail("unexpected_boxscore_receipt");
    const payload = verifiedBody(receipt, args.cutoffAt);
    if (Number(payload?.id) !== gameId) fail("boxscore_identity_mismatch");
    const raw = { id: `http:${receipt.bodySha256}`, endpoint: "boxscore", game_id: gameId, season_id: game!.seasonId,
      payload_hash: receipt.bodySha256, fetched_at: receipt.capturedAt, payload };
    const metadata = { id: gameId, date: game!.date, seasonId: game!.seasonId, type: 2, startTime: game!.scheduledAt,
      homeTeamId: game!.homeTeamId, awayTeamId: game!.awayTeamId };
    boxscores.set(gameId, { receipt, raw, metadata,
      evidence: { id: `boxscore:${raw.id}`, hash: hash(payload), availableAt: receipt.capturedAt, capturedAt: receipt.capturedAt } });
  }
  const schedules = args.scheduleReceipts.slice().sort((a, b) => a.url.localeCompare(b.url));
  const observedThrough = schedules.map(receipt => receipt.capturedAt).sort((a, b) => Number(micros(a) - micros(b))).at(-1)!;
  const payload = { version: ROLLING_HISTORY_FRAME_VERSION, windowStartAt: window.startAt, windowEndAt: window.endAt,
    timeZone: window.timeZone, windowDates: window.dates, observedThrough,
    parents: schedules.map(receipt => ({ url: receipt.url, bodySha256: receipt.bodySha256, capturedAt: receipt.capturedAt })),
    clubIds, gameIds: games.map(game => game.gameId).sort((a, b) => a - b),
    notFinalGameIds: games.filter(game => game.status === "not_final").map(game => game.gameId).sort((a, b) => a - b),
    unreadGameIds: games.filter(game => game.status === "final" && !boxscores.has(game.gameId)).map(game => game.gameId).sort((a, b) => a - b),
    historicalEligibilityInferred: false };
  const manifestHash = hash(payload);
  // The manifest is as fresh as its latest schedule observation, never backdated before a parent.
  const evidence: ParticipationEvidence = { id: `manifest:${manifestHash}`, hash: manifestHash, availableAt: observedThrough, capturedAt: observedThrough };
  const parents: NativeMaterializationParent[] = [...schedules.map(originalParent),
    ...[...boxscores.values()].flatMap(({ receipt, raw, evidence: content }) => [originalParent(receipt),
      { ...content, derived: { payload: raw.payload, parentHashes: [receipt.bodySha256] } }]),
    { ...evidence, derived: { payload, parentHashes: schedules.map(receipt => receipt.bodySha256) } }];

  const histories = new Map<number, RollingHistory>(), coverage: Array<{ playerId: number; teamId: number; playerClass: string;
    games: number; positive: number; zero: number; unknown: number; reasons: string[] }> = [];
  for (const player of args.players) {
    const rows = games.filter(game => game.homeTeamId === player.teamId || game.awayTeamId === player.teamId).map(game => {
      const base = { gameId: game.gameId, teamId: player.teamId, scheduledAt: game.scheduledAt, date: game.date,
        occurred: null as boolean | null, eligibility: null as ListedEligibility | null,
        positiveMinutes: null as boolean | null, resolution: null as "positive_toi" | "explicit_zero_toi" | null,
        outcomeEvidence: null as ParticipationEvidence | null, officialStarter: null as boolean | null,
        starterEvidence: null as ParticipationEvidence | null, reasons: [] as string[] };
      if (game.status === "not_final") { base.reasons.push(`game_not_final_in_schedule:${game.gameState || "unknown"}`); return base; }
      const source = boxscores.get(game.gameId);
      if (!source) { base.reasons.push("missing_original_boxscore"); return base; }
      const final = finalBoxscoreForGame(source.raw, source.metadata);
      if (!final) { base.reasons.push("boxscore_not_final"); return base; }
      base.occurred = true;
      const own = rawPlayerForOutput({ player_id: player.nhlPlayerId, team_id: player.teamId }, final) ?? fail("boxscore_player_identity_conflict");
      const row = player.playerClass === "goalie" ? own.goalie : own.skater;
      if (!row) { base.reasons.push("not_listed_for_current_club_game_eligibility_unknown"); return base; }
      const seconds = parseTimeOnIceSeconds(row.toi);
      if (seconds === null) { base.reasons.push("explicit_player_row_minutes_unknown"); return base; }
      base.eligibility = { playerId: player.playerId, nhlPlayerId: player.nhlPlayerId, teamId: player.teamId, eligible: true,
        effectiveFrom: game.scheduledAt, effectiveUntil: new Date(Date.parse(game.scheduledAt) + 1).toISOString(), evidence: source.evidence,
        scope: "listed_game_instant_only", gameId: game.gameId };
      base.positiveMinutes = seconds > 0; base.resolution = seconds > 0 ? "positive_toi" : "explicit_zero_toi";
      base.outcomeEvidence = source.evidence;
      if (player.playerClass === "goalie") {
        const starter = deriveNativeGoalieStarterLabel({ nhlPlayerId: player.nhlPlayerId, teamId: player.teamId, cutoffAt: args.cutoffAt,
          boxscore: { rawRow: source.raw, game: source.metadata, contentHash: source.evidence.hash } });
        base.officialStarter = starter.officialStarter; base.starterEvidence = starter.officialStarter === null ? null : starter.evidence;
        if (starter.reason) base.reasons.push(starter.reason);
      }
      return base;
    });
    histories.set(player.playerId, { complete: true, windowStartAt: window.startAt, windowEndAt: window.endAt, scheduleEvidence: evidence, games: rows });
    coverage.push({ playerId: player.playerId, teamId: player.teamId, playerClass: player.playerClass, games: rows.length,
      positive: rows.filter(row => row.positiveMinutes === true).length, zero: rows.filter(row => row.positiveMinutes === false).length,
      unknown: rows.filter(row => row.eligibility === null || row.positiveMinutes === null).length,
      reasons: [...new Set(rows.flatMap(row => row.reasons))].sort() });
  }
  return { window, evidence, manifest: payload, parents, histories, coverage };
}
