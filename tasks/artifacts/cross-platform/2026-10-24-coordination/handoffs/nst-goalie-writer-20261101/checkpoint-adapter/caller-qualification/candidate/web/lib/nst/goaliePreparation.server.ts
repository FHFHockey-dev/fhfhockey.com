import { createHash } from "node:crypto";
import { buildGoalieCatchupManifest, completedGoalieDate, goalieDateMillis } from "./goalieCatchup";
import type { GoalieCheckpointClient } from "./goalieCatchup.server";

export const GOALIE_FINALITY_VERSION = "official-nhl-score-off-v1";
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const HASH = /^[a-f0-9]{64}$/;
const record = (value: unknown): Record<string, any> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : null;
const positiveId = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) > 0;

/** OFF is deliberately narrower than an ended/in-progress game. A date absent
 * from the source, a postponed game or a missing state is never a no-game day. */
export function validateGoalieFinalScore(payload: unknown, season: number, date: string) {
  goalieDateMillis(date);
  const score = record(payload);
  if (!score || score.currentDate !== date || !Array.isArray(score.games) || score.games.length > 32) {
    throw new Error("Official score date or complete slate is unavailable.");
  }
  const ids = new Set<number>();
  const games: number[] = [];
  for (const candidate of score.games) {
    const game = record(candidate);
    if (!game || !positiveId(game.id) || ids.has(game.id) || ![1, 2, 3].includes(game.gameType) ||
        !positiveId(game.season) || typeof game.gameDate !== "string" || game.gameDate !== date) {
      throw new Error("Official score identities are incomplete or duplicated.");
    }
    ids.add(game.id);
    if (game.gameType !== 2) continue;
    if (game.season !== season || game.gameState !== "OFF" ||
        String(game.id).length !== 10 || String(game.id).slice(0, 6) !== `${Math.floor(season / 10000)}02` ||
        !positiveId(game.homeTeam?.id) || !positiveId(game.awayTeam?.id) || game.homeTeam.id === game.awayTeam.id) {
      throw new Error("Regular-season game finality or identity is unverified.");
    }
    games.push(game.id);
  }
  return { date, gameIds: games.sort((a, b) => a - b), calendar: games.length ? "final" as const : "no_games" as const };
}

async function readOfficialScore(date: string, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(`https://api-web.nhle.com/v1/score/${date}`, {
    signal, redirect: "error", cache: "no-store", headers: { Accept: "application/json" },
  });
  if (!response.ok || !response.body) throw new Error("Official score response unavailable.");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 1_048_576) throw new Error("Official score response exceeds capture bound.");
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } finally { await reader.cancel(); }
}

async function bounded<T>(operation: (signal: AbortSignal) => PromiseLike<T>, deadlineAt: number, now: () => number) {
  const remaining = Math.min(5_000, deadlineAt - now());
  if (remaining <= 0) throw new Error("Preparation deadline exhausted.");
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([operation(controller.signal), new Promise<never>((_, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(new Error("Preparation source timed out.")); }, remaining);
    })]);
  } finally { clearTimeout(timer); }
}

async function checkpointRpc(client: GoalieCheckpointClient, name: string, args: Record<string, unknown>, deadlineAt: number, now: () => number) {
  const response = await bounded(signal => {
    const query = client.rpc(name, args) as ReturnType<GoalieCheckpointClient["rpc"]> &
      { abortSignal?: (value: AbortSignal) => ReturnType<GoalieCheckpointClient["rpc"]> };
    return query.abortSignal ? query.abortSignal(signal) : query;
  }, deadlineAt, now);
  if (response.error || !record(response.data)) throw new Error("Preparation checkpoint unavailable.");
  return record(response.data)!;
}

export type GoaliePreparationResult = {
  status: "disabled" | "not_due" | "existing" | "prepared" | "held" | "unavailable";
  scope: string | null;
  jobId: string | null;
  sourceRequests: number;
  requiresReview: boolean;
  reason: string | null;
};

/** At most14 sequential official score reads, each5s, one180s total budget.
 * Nothing fetches when disabled, held or an active cohort already exists.
 * Evidence + cohort + enqueue commit in one RPC; uncertain writes never retry. */
export async function prepareGoalieCatchup(input: {
  client: GoalieCheckpointClient;
  deadlineAt: number;
  now?: () => number;
  scoreSource?: (date: string, signal: AbortSignal) => Promise<unknown>;
}): Promise<GoaliePreparationResult> {
  const now = input.now ?? Date.now;
  const deadlineAt = Math.min(input.deadlineAt, now() + 180_000);
  const result: GoaliePreparationResult = { status: "unavailable", scope: null, jobId: null,
    sourceRequests: 0, requiresReview: false, reason: null };
  let writeStarted = false;
  try {
    const context = await checkpointRpc(input.client, "nst_goalie_preparation_state_v1", {}, deadlineAt, now);
    if (context.version !== 1 || typeof context.enabled !== "boolean" || typeof context.reviewRequired !== "boolean") {
      throw new Error("Preparation state is incomplete.");
    }
    if (!context.enabled) return { ...result, status: "disabled", reason: "Automatic goalie preparation is disabled." };
    if (context.reviewRequired) return { ...result, status: "held", requiresReview: true, reason: "Existing goalie work requires reconciliation." };
    if (context.activeScope !== null) {
      if (!HASH.test(context.activeScope) || !UUID.test(context.jobId ?? "")) throw new Error("Active cohort receipt is invalid.");
      return { ...result, status: "existing", scope: context.activeScope, jobId: context.jobId };
    }
    if (context.startDate === null) return { ...result, status: "not_due", reason: "No unprepared completed dates are due." };
    const season = record(context.season);
    if (!season || !positiveId(season.id) || String(season.id).length !== 8 || context.sourceVersion !== GOALIE_FINALITY_VERSION) {
      throw new Error("Current season or source version is unavailable.");
    }
    const start = goalieDateMillis(context.startDate), end = goalieDateMillis(context.endDate);
    if (start < goalieDateMillis(season.startDate) || end > goalieDateMillis(season.regularSeasonEndDate) ||
        end > goalieDateMillis(completedGoalieDate(new Date(now()))) || end < start || end - start > 13 * 86_400_000) {
      throw new Error("Preparation aperture is invalid.");
    }
    const observations = [];
    const days = [];
    const source = input.scoreSource ?? readOfficialScore;
    for (let day = start; day <= end; day += 86_400_000) {
      const date = new Date(day).toISOString().slice(0, 10);
      result.sourceRequests++;
      const payload = await bounded(signal => source(date, signal), deadlineAt - 5_000, now);
      const final = validateGoalieFinalScore(payload, season.id, date);
      const payloadText = JSON.stringify(payload);
      if (Buffer.byteLength(payloadText, "utf8") > 1_048_576) throw new Error("Official score response exceeds the capture bound.");
      observations.push({ date, sourceUrl: `https://api-web.nhle.com/v1/score/${date}`, payloadText,
        fingerprint: createHash("sha256").update(payloadText).digest("hex"), observedAt: new Date(now()).toISOString() });
      days.push({ date, calendar: final.calendar, allCounts: final.calendar === "no_games" ? "complete" as const : "incomplete" as const });
    }
    const manifest = buildGoalieCatchupManifest({ season: String(season.id), sourceVersion: GOALIE_FINALITY_VERSION,
      seasonStartDate: season.startDate, regularSeasonEndDate: season.regularSeasonEndDate, startDate: context.startDate,
      // End is the DB-selected aperture; do not silently expand a shorter snapshot.
      now: new Date(now()), days, receipts: [], holds: [], readsComplete: true });
    if (manifest.endDate !== context.endDate) throw new Error("Prepared dates differ from the database aperture.");
    writeStarted = true;
    const receipt = await checkpointRpc(input.client, "nst_goalie_prepare_cohort_v1", {
      p_manifest: manifest, p_observations: observations,
    }, deadlineAt, now);
    if (receipt.status !== "ensured" || receipt.scope !== manifest.scope || receipt.plannedRequestCount !== manifest.plannedRequestCount ||
        (manifest.plannedRequestCount ? !UUID.test(receipt.jobId ?? "") : receipt.jobId !== null)) throw new Error("Preparation acknowledgement is inconsistent.");
    return { ...result, status: "prepared", scope: manifest.scope, jobId: receipt.jobId };
  } catch {
    return { ...result, status: writeStarted ? "held" : "unavailable", requiresReview: writeStarted,
      reason: writeStarted ? "Evidence/cohort acknowledgement is uncertain; reconcile before repeating preparation."
        : "Final-game or checkpoint evidence is unavailable; no cohort was written." };
  }
}
