import { Affiliation, CONDITIONING, Horizon, HorizonEpisode, Instant, LockEpoch, Opportunity, ScheduleGame, TARGET_VERSION, assertId, assertSource, instant } from "./contracts";
import { canonicalJson, targetKey } from "./identity";

/** Input is the independently captured roster/IR/reserve feed, never boxscores. */
export function resolveAffiliations(history: readonly Affiliation[], asOf: Instant) {
  const cutoff = instant(asOf);
  const groups = new Map<number, Affiliation[]>();
  const unresolved: Array<{ playerId: number; reason: string }> = [];
  for (const row of history) {
    assertId(row.playerId);
    if (instant(row.source.firstReceivedAt) > cutoff || instant(row.effectiveAt) > cutoff) continue;
    const rows = groups.get(row.playerId) ?? [];
    rows.push(row); groups.set(row.playerId, rows);
  }
  const eligible: Affiliation[] = [];
  for (const [playerId, rows] of groups) {
    rows.sort((a, b) => instant(b.effectiveAt) - instant(a.effectiveAt) || instant(b.source.firstReceivedAt) - instant(a.source.firstReceivedAt));
    const row = rows[0];
    const ties = rows.filter(other => other.effectiveAt === row.effectiveAt && other.source.firstReceivedAt === row.source.firstReceivedAt);
    if (new Set(ties.map(canonicalJson)).size > 1) { unresolved.push({ playerId, reason: "conflicting_affiliation" }); continue; }
    try { assertSource(row.source, asOf); if (row.teamId !== null) assertId(row.teamId); }
    catch { unresolved.push({ playerId, reason: "unverified_affiliation" }); continue; }
    if (row.position === "G" || row.status === "assigned") continue;
    if (row.teamId === null || row.position === "unknown" || row.status === "unresolved") { unresolved.push({ playerId, reason: "unresolved_affiliation" }); continue; }
    eligible.push(structuredClone(row));
  }
  return { eligible: eligible.sort((a, b) => a.playerId - b.playerId), unresolved };
}

export interface OpportunityPopulation {
  opportunities: Opportunity[];
  unresolved: Array<{ playerId: number; reason: string }>;
  shortfalls: Array<{ playerId: number; count: number; reason: string }>;
  excludedGames: Array<{ gameId: number; reason: string; replacementGameId: number | null }>;
}

/** Supply all accepted schedule pages through season end; incomplete feeds stay explicit. */
export function buildOpportunities(input: { affiliations: readonly Affiliation[]; schedule: readonly ScheduleGame[]; asOf: Instant; seasonId: number; scheduleComplete: boolean }): OpportunityPopulation {
  const { eligible, unresolved } = resolveAffiliations(input.affiliations, input.asOf);
  const cutoff = instant(input.asOf);
  const versions = new Map<number, ScheduleGame[]>();
  for (const game of input.schedule) {
    assertId(game.gameId);
    if (game.seasonId !== input.seasonId || instant(game.source.firstReceivedAt) > cutoff) continue;
    const rows = versions.get(game.gameId) ?? []; rows.push(game); versions.set(game.gameId, rows);
  }
  const games: ScheduleGame[] = [];
  const excludedGames: OpportunityPopulation["excludedGames"] = [];
  for (const rows of versions.values()) {
    rows.sort((a, b) => instant(b.source.firstReceivedAt) - instant(a.source.firstReceivedAt));
    const game = rows[0];
    let reason: string | null = null;
    const tied = rows.filter(row => row.source.firstReceivedAt === game.source.firstReceivedAt);
    if (new Set(tied.map(canonicalJson)).size > 1) reason = "conflicting_schedule";
    try { assertSource(game.source, input.asOf); assertId(game.homeTeamId); assertId(game.awayTeamId); }
    catch { reason = "unverified_schedule"; }
    if (!reason) {
      if (game.replacementGameId !== null) reason = "replaced_game";
      else if (game.gameType !== "regular") reason = "unsupported_game_type";
      else if (["cancelled", "in_progress", "suspended", "final"].includes(game.status)) reason = game.status;
      else if (game.actualStartAt !== null && instant(game.actualStartAt) <= cutoff) reason = "play_begun";
      else if (game.scheduledStartAt === null) reason = "unknown_start";
      else if (instant(game.scheduledStartAt) <= cutoff) reason = "past_scheduled_lock";
    }
    if (reason) excludedGames.push({ gameId: game.gameId, reason, replacementGameId: game.replacementGameId });
    else games.push(game);
  }
  games.sort((a, b) => instant(a.scheduledStartAt!) - instant(b.scheduledStartAt!) || a.gameId - b.gameId);
  const opportunities: Opportunity[] = [], shortfalls: OpportunityPopulation["shortfalls"] = [];
  for (const player of eligible) {
    const next = games.filter(game => game.homeTeamId === player.teamId || game.awayTeamId === player.teamId).slice(0, 10);
    if (next.length < 10) shortfalls.push({ playerId: player.playerId, count: next.length, reason: input.scheduleComplete ? "verified_schedule_exhausted" : "schedule_capture_incomplete" });
    next.forEach((game, index) => {
      const target = { playerId: player.playerId, gameId: game.gameId, seasonId: game.seasonId, targetVersion: TARGET_VERSION, conditioning: CONDITIONING };
      const home = game.homeTeamId === player.teamId;
      opportunities.push({ ...target, id: `opportunity:${targetKey(target)}:${input.asOf}`, teamId: player.teamId!, opponentId: home ? game.awayTeamId : game.homeTeamId, home, horizon: (index + 1) as Horizon, observedAt: input.asOf, scheduleRevision: game.revision, affiliationRevision: player.revision, scheduledStartAt: game.scheduledStartAt!, sourceGameDate: game.sourceGameDate });
    });
  }
  return { opportunities, unresolved, shortfalls, excludedGames };
}

export function reconcileOpportunities(previous: readonly Opportunity[], current: readonly Opportunity[]) {
  const old = new Map(previous.map(row => [targetKey(row), row]));
  const next = new Map(current.map(row => [targetKey(row), row]));
  if (old.size !== previous.length || next.size !== current.length) throw new Error("Duplicate player/game opportunity");
  return {
    closed: previous.filter(row => !next.has(targetKey(row)) || next.get(targetKey(row))!.teamId !== row.teamId),
    opened: current.filter(row => !old.has(targetKey(row)) || old.get(targetKey(row))!.teamId !== row.teamId),
    teamChanges: current.filter(row => old.has(targetKey(row)) && old.get(targetKey(row))!.teamId !== row.teamId).map(row => ({ targetKey: targetKey(row), fromTeamId: old.get(targetKey(row))!.teamId, toTeamId: row.teamId, at: row.observedAt })),
  };
}

/** Returns a new ledger; closing an episode never changes its entry or prior ordinal. */
export function observeHorizonEpisodes(history: readonly HorizonEpisode[], current: readonly Opportunity[], observedAt: Instant): HorizonEpisode[] {
  const at = instant(observedAt);
  const ledger = structuredClone([...history]);
  if (ledger.some(row => instant(row.enteredAt) > at || (row.exitedAt !== null && instant(row.exitedAt) > at))) throw new Error("Observation must be chronological");
  const scopes = new Map(current.map(row => [targetKey(row), row]));
  if (scopes.size !== current.length || current.some(row => row.observedAt !== observedAt)) throw new Error("Invalid contemporaneous opportunities");
  const activeKeys = new Set<string>();
  for (const row of ledger.filter(episode => episode.exitedAt === null)) {
    const key = targetKey(row);
    if (activeKeys.has(key)) throw new Error("Multiple active horizon episodes");
    activeKeys.add(key);
    const now = scopes.get(key);
    if (!now || now.horizon !== row.horizon) row.exitedAt = observedAt;
  }
  for (const row of current) {
    const key = targetKey(row);
    if (ledger.some(episode => targetKey(episode) === key && episode.exitedAt === null)) continue;
    const episode = 1 + Math.max(0, ...ledger.filter(item => targetKey(item) === key && item.horizon === row.horizon).map(item => item.episode));
    ledger.push({ playerId: row.playerId, gameId: row.gameId, seasonId: row.seasonId, targetVersion: row.targetVersion, conditioning: row.conditioning, id: `episode:${key}:H${row.horizon}:${episode}`, horizon: row.horizon, episode, enteredAt: observedAt, exitedAt: null, scheduleRevision: row.scheduleRevision, affiliationRevision: row.affiliationRevision });
  }
  return ledger;
}

export interface LockTransition { epoch: LockEpoch | null; issuanceOpen: boolean; reason: string }

/** Call with the authoritative accepted schedule observation, not wall-clock guesses. */
export function advanceLock(previous: LockEpoch | null, game: ScheduleGame, acceptedAt: Instant): LockTransition {
  assertSource(game.source, acceptedAt);
  const at = instant(acceptedAt);
  if (previous && (previous.gameId !== game.gameId || instant(previous.adoptedAt) > at)) throw new Error("Invalid lock lineage");
  const make = (lockAt: Instant, reopened: boolean): LockEpoch => ({ id: `lock:${game.gameId}:${game.revision}:${acceptedAt}`, gameId: game.gameId, adoptedAt: acceptedAt, lockAt, scheduleRevision: game.revision, predecessorId: previous?.id ?? null, reopened, actualStartAt: game.actualStartAt ?? previous?.actualStartAt ?? null, timingStatus: game.actualStartAt !== null || previous?.actualStartAt != null ? "confirmed" : "provisional", playBegun: begun });
  const begun = previous?.playBegun === true || game.actualStartAt !== null || previous?.actualStartAt != null || ["in_progress", "suspended", "final"].includes(game.status);
  if (begun) {
    const epoch = !previous ? make(game.scheduledStartAt ?? game.actualStartAt ?? acceptedAt, false) : !previous.playBegun || (game.actualStartAt !== null && previous.actualStartAt !== game.actualStartAt) ? make(previous.lockAt, false) : previous;
    return { epoch, issuanceOpen: false, reason: "play_begun" };
  }
  if (game.replacementGameId !== null || game.status === "cancelled") return { epoch: previous, issuanceOpen: false, reason: game.replacementGameId !== null ? "replaced_game" : "cancelled" };
  if (game.scheduledStartAt === null) return { epoch: previous, issuanceOpen: false, reason: "unknown_start" };
  const start = instant(game.scheduledStartAt);
  if (!previous) {
    if (start <= at) return { epoch: null, issuanceOpen: false, reason: "initial_lock_already_passed" };
    return { epoch: make(game.scheduledStartAt, false), issuanceOpen: true, reason: "initial_lock" };
  }
  if (start === instant(previous.lockAt)) return { epoch: previous, issuanceOpen: at < start, reason: at < start ? "unchanged" : "locked" };
  if (at < instant(previous.lockAt)) return { epoch: make(game.scheduledStartAt, false), issuanceOpen: at < start, reason: "prelock_reschedule" };
  if (game.noPlayConfirmed && start > at) return { epoch: make(game.scheduledStartAt, true), issuanceOpen: true, reason: "affirmative_no_play_reopening" };
  return { epoch: previous, issuanceOpen: false, reason: "late_notice_cannot_extend_lock" };
}
