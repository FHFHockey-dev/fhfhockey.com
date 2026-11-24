/**
 * FxTwitter/News evidence for the FORGE H1–H10 material path. A read-only consumer of the accepted News/Lines cards
 * (`news_feed_items` with `news_feed_item_players`), which the existing poller and review pipeline produce; this file
 * owns no poller and edits nothing in `lib/sources/**`.
 *
 * Rules (TJ, D1, 2026-11-23):
 *  - Membership. A credible trade, recall or roster-move report never moves a player. It names the clubs to recheck
 *    against the official NHL roster; only an official observation (`officialMoves`) changes membership. The report
 *    stays pending until then. A move the official roster already shows needs no report.
 *  - Availability and role are an overlay on the stored if-playing forecast, never a new forecast. Out, scratch and
 *    questionable reports bind to games; an explicit return ("RETURNING", "RETURNING TO LINEUP", "FULLY HEALTHY")
 *    lifts an out overlay, so the same stored vintage is served again. "PROJECTED RETURN", practice notes and lines
 *    alone never lift one.
 *  - Provenance. Each card revision is snapshotted on first sight with the original post, its source, the post time
 *    and FORGE's first-seen time. An identical redelivery is the same snapshot. A changed card is a new revision that
 *    supersedes its predecessor. Reports are ordered by post time, so a late-arriving older report never overwrites a
 *    newer one, and same-time contradictions are recorded as conflicts that change nothing.
 */
import { Instant, instant } from "./contracts";
import { MembershipEvidence } from "./denominator";
import { contentHash } from "./hash.server";
import { authorityTier } from "../lines/authority";
import type { AuthorityTier } from "../lines/types";

export interface NewsCardRow {
  id: string; card_status: string; category: string; subcategory: string | null; source_account: string | null; source_tweet_id: string | null;
  original_tweet_id: string | null; tweet_url: string | null; team_id: number | null; headline: string; observed_at: Date | string | null;
  published_at: Date | string | null; updated_at: Date | string; players: Array<{ player_id: number | null; team_id: number | null; role: string }>;
}

export type NewsSignal = "membership_report" | "out" | "scratch" | "questionable" | "confirmed_return" | "projected_return" | "goalie_confirmed_start"
  | "goalie_expected_start" | "lineup_report" | "not_applicable";

const norm = (value: string | null | undefined) => (value ?? "").trim().toUpperCase().replace(/\s+/g, " ");
/** The card's category and subcategory decide its effect; the subcategory separates a confirmed return from a projected one. */
export function classifyNewsCard(category: string, subcategory: string | null): NewsSignal {
  const c = norm(category), s = norm(subcategory);
  if (c === "TRADE" || c === "SIGNING" || c === "WAIVER" || c === "ROSTER MOVE" || c === "RETIREMENT") return "membership_report";
  if (c === "TRANSACTION") return s === "" || s === "ROSTER MOVE" || s === "ROSTER STATUS" || s === "COMPLETED TRADE" || s === "OFFICIAL SIGNING" ? "membership_report" : "not_applicable";
  if (c === "INJURY") return s === "OUT" || s === "SURGERY / REHAB" ? "out" : "questionable";
  if (c === "REPORTED INJURY") return "questionable";
  if (c === "SCRATCHES") return s === "CONFIRMED SCRATCH" ? "scratch" : "not_applicable";
  if (c === "RETURN" || c === "RETURNING") return s === "RETURNING" || s === "RETURNING TO LINEUP" || s === "FULLY HEALTHY" ? "confirmed_return" : "projected_return";
  if (c === "GOALIE START") return s === "CONFIRMED STARTER" ? "goalie_confirmed_start" : "goalie_expected_start";
  if (c === "LINE COMBINATION" || c === "LINE CHANGE" || c === "LINEUP" || c === "PRACTICE LINES") return "lineup_report";
  return "not_applicable";
}

export interface NewsSnapshot {
  id: string; cardId: string; revision: string; supersedes: string | null; cardStatus: string; category: string; subcategory: string | null; signal: NewsSignal;
  postId: string | null; postUrl: string | null; account: string | null; tier: AuthorityTier; headline: string; cardTeamId: number | null;
  players: Array<{ playerId: number; teamId: number | null; role: string }>; unresolvedPlayers: number;
  /** The original post's time (`observed_at`), the ordering clock. `published_at` is re-stamped by the feed and never used. */
  postedAt: Instant | null;
  /** When FORGE first read this revision. */
  firstSeenAt: Instant;
}

const iso = (value: Date | string | null) => value === null ? null : new Date(value).toISOString();
/** One card revision as first seen. The revision hashes the card's meaning, not its feed timestamps. */
export function snapshotCard(row: NewsCardRow, seenAt: Instant): Omit<NewsSnapshot, "supersedes"> {
  const players = row.players.filter(p => p.player_id !== null).map(p => ({ playerId: p.player_id!, teamId: p.team_id, role: p.role }))
    .sort((a, b) => a.playerId - b.playerId || a.role.localeCompare(b.role));
  const meaning = { cardId: row.id, status: row.card_status, category: norm(row.category), subcategory: norm(row.subcategory) || null, account: row.source_account,
    postId: row.original_tweet_id ?? row.source_tweet_id, postUrl: row.tweet_url, team: row.team_id, players, headline: row.headline, postedAt: iso(row.observed_at),
    unresolved: row.players.filter(p => p.player_id === null).length };
  const revision = contentHash(meaning).slice(0, 16);
  return { id: `forge-h10-news:${row.id}:${revision}`, cardId: row.id, revision, cardStatus: row.card_status, category: meaning.category,
    subcategory: meaning.subcategory, signal: classifyNewsCard(row.category, row.subcategory), postId: meaning.postId, postUrl: row.tweet_url, account: row.source_account,
    tier: authorityTier(row.source_account), headline: row.headline, cardTeamId: row.team_id, players, unresolvedPlayers: meaning.unresolved, postedAt: meaning.postedAt, firstSeenAt: seenAt };
}

/** Adds freshly read cards to the stored snapshots. A known revision keeps its stored first-seen time (redelivery
 * dedupe); a new revision of a known card supersedes that card's latest revision (a correction). */
export function mergeSnapshots(stored: readonly NewsSnapshot[], rows: readonly NewsCardRow[], seenAt: Instant) {
  const known = new Map(stored.map(s => [s.id, s])), latest = new Map<string, NewsSnapshot>();
  for (const s of stored) { const prior = latest.get(s.cardId); if (!prior || newer(s, prior)) latest.set(s.cardId, s); }
  const added: NewsSnapshot[] = [];
  let duplicates = 0;
  for (const row of [...rows].sort((a, b) => a.id.localeCompare(b.id))) {
    const fresh = snapshotCard(row, seenAt);
    if (known.has(fresh.id)) { duplicates += 1; continue; }
    const snapshot: NewsSnapshot = { ...fresh, supersedes: latest.get(row.id)?.id ?? null };
    known.set(snapshot.id, snapshot); latest.set(row.id, snapshot); added.push(snapshot);
  }
  return { all: [...known.values()], added, duplicates };
}
const newer = (a: NewsSnapshot, b: NewsSnapshot) => instant(a.firstSeenAt) > instant(b.firstSeenAt) || a.firstSeenAt === b.firstSeenAt && a.revision > b.revision;

/** Each card's latest revision seen by `asOf`; a card withdrawn from publication (or never published) has no effect. */
export function effectiveSnapshots(snapshots: readonly NewsSnapshot[], asOf: Instant): NewsSnapshot[] {
  const latest = new Map<string, NewsSnapshot>();
  for (const s of snapshots.filter(s => instant(s.firstSeenAt) <= instant(asOf))) { const prior = latest.get(s.cardId); if (!prior || newer(s, prior)) latest.set(s.cardId, s); }
  return [...latest.values()].filter(s => s.cardStatus === "published" && s.postedAt !== null && instant(s.postedAt) <= instant(asOf))
    .sort((a, b) => instant(a.postedAt!) - instant(b.postedAt!) || instant(a.firstSeenAt) - instant(b.firstSeenAt) || a.id.localeCompare(b.id));
}

/** Game-specific availability and role need a named author: a club account or a reviewed beat reporter. */
export const credibleForAvailability = (s: NewsSnapshot) => s.tier === "team" || s.tier === "beat";
/** A membership report only triggers an official recheck, so any accepted card that is not excluded may ask for one. */
export const credibleForRecheck = (s: NewsSnapshot) => s.tier !== "excluded";

// ---------------------------------------------------------------- membership: recheck planning and official moves

export interface OfficialRoster { teamId: number; abbrev: string; fetchedAt: Instant; sha256: string; players: Array<{ id: number; position: "F" | "D" | "G" }> }
/** An official membership change. `toTeamId` null is a departure: on a complete read of every club, a FORGE member
 * no official roster lists (a send-down, waiver or release, or a list the endpoint omits). */
export interface OfficialMove { id: string; playerId: number; fromTeamId: number | null; toTeamId: number | null; position: "F" | "D" | "G" | "unknown"; firstObservedAt: Instant; rosterSha256: string; abbrev: string; after: string | null }

/** Recheck schedule for a pending report, by age since FORGE first saw it: first sight, then 1, 3, 6, 12, 24 and 48 h.
 * A report is due in a call when one of these marks fell inside the last `windowMs` (the material cadence), so a
 * pending report costs at most seven rechecks, not one per call. */
export const RECHECK_MARKS_HOURS = [0, 1, 3, 6, 12, 24, 48] as const;
export function recheckDue(firstSeenAt: Instant, asOf: Instant, windowMs: number) {
  const age = instant(asOf) - instant(firstSeenAt);
  return RECHECK_MARKS_HOURS.some(h => h * 3600000 <= age && age < h * 3600000 + windowMs);
}

/** Membership reports and the clubs to recheck now: the player's FORGE club, the card's club and the player's named
 * club, at most `maximumTeams` per call (oldest due report first).
 * - confirmed: an official move for one of its players was first observed no earlier than a day before the post;
 * - reflected: FORGE already has every named player on the club the card names (the official refresh got there first);
 * - expired: still unconfirmed `expiryHours` after the post;
 * - pending: otherwise; `due` lists those whose recheck mark falls in this call. */
export function planRecheck(snapshots: readonly NewsSnapshot[], current: ReadonlyMap<number, number>, moves: readonly OfficialMove[], asOf: Instant,
  options: { maximumTeams: number; expiryHours: number; windowMs?: number }) {
  const pending: Array<{ snapshotId: string; playerIds: number[]; postedAt: Instant; due: boolean }> = [], confirmed: Array<{ snapshotId: string; moveIds: string[] }> = [];
  const reflected: string[] = [], expired: string[] = [];
  for (const s of effectiveSnapshots(snapshots, asOf).filter(s => s.signal === "membership_report" && credibleForRecheck(s) && s.players.length)) {
    const matched = moves.filter(m => s.players.some(p => p.playerId === m.playerId) && instant(m.firstObservedAt) >= instant(s.postedAt!) - 86400000);
    if (matched.length) { confirmed.push({ snapshotId: s.id, moveIds: matched.map(m => m.id) }); continue; }
    if (s.players.every(p => p.teamId !== null && current.get(p.playerId) === p.teamId)) { reflected.push(s.id); continue; }
    if (instant(asOf) - instant(s.postedAt!) > options.expiryHours * 3600000) { expired.push(s.id); continue; }
    pending.push({ snapshotId: s.id, playerIds: s.players.map(p => p.playerId), postedAt: s.postedAt!, due: options.windowMs === undefined || recheckDue(s.firstSeenAt, asOf, options.windowMs) });
  }
  const teams: number[] = [];
  for (const report of pending.filter(r => r.due)) {
    const s = snapshots.find(x => x.id === report.snapshotId)!;
    for (const team of [...s.players.flatMap(p => [current.get(p.playerId) ?? null, p.teamId]), s.cardTeamId]) {
      if (team !== null && team !== undefined && !teams.includes(team) && teams.length < options.maximumTeams) teams.push(team);
    }
  }
  return { pending, confirmed, reflected, expired, teams };
}

/** Official moves: a player the official roster lists on a club other than his current FORGE club (or a player FORGE
 * does not list at all, a call-up). The move id has no clock in it, so a later observation of the same move reuses
 * the stored first-observed time. Absence is read as a departure only when `complete` (every club read): a partial
 * recheck never removes anyone. */
export function officialMoves(rosters: readonly OfficialRoster[], current: ReadonlyMap<number, number>, stored: readonly OfficialMove[], complete = false): OfficialMove[] {
  const lastMove = new Map<number, OfficialMove>();
  for (const m of [...stored].sort((a, b) => instant(a.firstObservedAt) - instant(b.firstObservedAt) || a.id.localeCompare(b.id))) lastMove.set(m.playerId, m);
  const seen = new Map<number, Array<{ roster: OfficialRoster; position: "F" | "D" | "G" }>>();
  for (const roster of rosters) for (const p of roster.players) seen.set(p.id, [...seen.get(p.id) ?? [], { roster, position: p.position }]);
  const out: OfficialMove[] = [];
  for (const [playerId, listings] of [...seen].sort((a, b) => a[0] - b[0])) {
    if (new Set(listings.map(l => l.roster.teamId)).size !== 1) continue; // listed by two clubs at once: wait for a clean read
    const { roster, position } = listings.sort((a, b) => instant(a.roster.fetchedAt) - instant(b.roster.fetchedAt))[0];
    const from = current.get(playerId) ?? null;
    if (from === roster.teamId) continue;
    const prior = lastMove.get(playerId) ?? null;
    if (prior && prior.toTeamId === roster.teamId) { out.push(prior); continue; }
    out.push({ id: `forge-h10-official-move:${playerId}:${from ?? "none"}->${roster.teamId}:after:${prior?.id ?? "none"}`, playerId, fromTeamId: from, toTeamId: roster.teamId,
      position, firstObservedAt: roster.fetchedAt, rosterSha256: roster.sha256, abbrev: roster.abbrev, after: prior?.id ?? null });
  }
  if (complete && rosters.length) {
    const readAt = rosters.map(r => r.fetchedAt).sort().pop()!, readHash = contentHash(rosters.map(r => r.sha256).sort());
    for (const [playerId, from] of [...current].sort((a, b) => a[0] - b[0])) {
      if (seen.has(playerId)) continue;
      const prior = lastMove.get(playerId) ?? null;
      if (prior && prior.toTeamId === null && prior.fromTeamId === from) { out.push(prior); continue; }
      out.push({ id: `forge-h10-official-move:${playerId}:${from}->none:after:${prior?.id ?? "none"}`, playerId, fromTeamId: from, toTeamId: null, position: "unknown",
        firstObservedAt: readAt, rosterSha256: readHash, abbrev: "ALL", after: prior?.id ?? null });
    }
  }
  return out;
}

/** An official move as membership evidence. It is dated by its first official observation and outranks the club
 * snapshot in `rosters`; a later lagging snapshot is reported as a conflict, not obeyed. A departure is recorded as an
 * assignment off the club, so the player leaves the issued set and is listed out of scope. */
export function moveEvidence(move: OfficialMove): MembershipEvidence {
  const payload = { playerId: move.playerId, from: move.fromTeamId, to: move.toTeamId, rosterSha256: move.rosterSha256 };
  const departed = move.toTeamId === null;
  return { playerId: move.playerId, teamId: departed ? move.fromTeamId : move.toTeamId, position: move.position, status: departed ? "assigned" : "roster", effectiveAt: move.firstObservedAt,
    revision: move.id, kind: "official_transaction", transactionType: departed ? "assignment" : move.fromTeamId === null ? "recall" : "trade", supersedesRevision: null,
    source: { id: `api-web.nhle.com/v1/roster/${move.abbrev}:${move.rosterSha256.slice(0, 16)}`, revision: move.rosterSha256.slice(0, 16), sha256: contentHash(payload),
      source: "api-web.nhle.com", use: "approved", observedAt: move.firstObservedAt, publishedAt: null, firstReceivedAt: move.firstObservedAt } };
}

/** The official roster JSON (`/v1/roster/{club}/{season}`) reduced to ids and position groups, hashed as received. */
export function parseOfficialRoster(body: unknown, teamId: number, abbrev: string, fetchedAt: Instant): OfficialRoster {
  const groups = body as { forwards?: Array<{ id: number }>; defensemen?: Array<{ id: number }>; goalies?: Array<{ id: number }> };
  if (!groups || !Array.isArray(groups.forwards) || !Array.isArray(groups.defensemen) || !Array.isArray(groups.goalies)) throw new Error(`official_roster_malformed:${abbrev}`);
  const players = [...groups.forwards.map(p => ({ id: p.id, position: "F" as const })), ...groups.defensemen.map(p => ({ id: p.id, position: "D" as const })),
    ...groups.goalies.map(p => ({ id: p.id, position: "G" as const }))].filter(p => Number.isSafeInteger(p.id) && p.id > 0).sort((a, b) => a.id - b.id);
  if (!players.length) throw new Error(`official_roster_empty:${abbrev}`);
  return { teamId, abbrev, fetchedAt, sha256: contentHash(players), players };
}

// ---------------------------------------------------------------- availability and role overlay

/** An official game appearance: the player's box-score line for a started game, with his time on ice (seconds) and
 * the time FORGE first observed the line. */
export interface OfficialAppearance { playerId: number; gameId: number; gameStartAt: Instant; timeOnIceSeconds: number; firstObservedAt: Instant }
export const APPEARANCE_CATEGORY = "OFFICIAL APPEARANCE";
export const PARTICIPATION_ASSUMED = "participation_assumed_not_confirmed";
/** The official-appearance rule (TJ, approved 2026-11-23): a verified appearance lifts an older OUT report without a
 * return post.
 * - Actual participation only: time on ice above zero. Dressing, a lineup listing, or a goalie who sat as backup has
 *   none and lifts nothing.
 * - It must follow the OUT report and never overrides a newer credible OUT report: it is ordered by the game it was
 *   played in (an OUT posted after that game, e.g. an in-game injury, stays in force).
 * - It lifts the hold for later games from the time FORGE first observed the line, not from the game.
 * - Earlier editions and overlay revisions stay as they were; lifted games carry `participation_assumed_not_confirmed`
 *   (later participation is assumed, not confirmed).
 * (Read #3: 5 of 35 players reported out played again within the week with no return post.) */
export function appearanceSnapshots(appearances: readonly OfficialAppearance[]): NewsSnapshot[] {
  return appearances.filter(a => Number.isFinite(a.timeOnIceSeconds) && a.timeOnIceSeconds > 0).map(a => ({
    id: `forge-h10-appearance:${a.playerId}:${a.gameId}`, cardId: `official-appearance:${a.playerId}:${a.gameId}`, revision: "official",
    supersedes: null, cardStatus: "published", category: APPEARANCE_CATEGORY, subcategory: null, signal: "confirmed_return" as const, postId: null, postUrl: null,
    account: null, tier: "team" as const, headline: "official game appearance", cardTeamId: null, players: [{ playerId: a.playerId, teamId: null, role: "subject" }],
    unresolvedPlayers: 0, postedAt: a.gameStartAt, firstSeenAt: a.firstObservedAt }));
}

export interface OverlayKey { playerId: number; gameId: number; teamId: number; scheduledStartAt: Instant | null; playerClass: "skater" | "goalie" }
export interface AvailabilityOverlay {
  playerId: number; gameId: number;
  availability: "available" | "out" | "questionable";
  role: "confirmed_starter" | "expected_starter" | "not_confirmed_starter" | null;
  annotations: string[];
  /** Snapshot ids that decided this state (the report that set the availability, the role, each annotation);
   * conflicts lists same-time contradictions that were not applied. A report that changes nothing is not listed. */
  evidence: string[]; conflicts: string[];
}
interface Cell extends AvailabilityOverlay { availabilityBy: string | null; roleBy: string | null; annotationBy: string[] }

const LIFTS = new Set<NewsSignal>(["confirmed_return"]), REMOVES = new Set<NewsSignal>(["out", "scratch"]);
const GAME_SPECIFIC_HOURS = 48;

/** The overlay for every key some credible report touches, as of `asOf`. Keys with no report are absent (available,
 * no role). Same-time reports that disagree (a removal and a return) are recorded as conflicts and applied neither way. */
export function resolveAvailability(keys: readonly OverlayKey[], snapshots: readonly NewsSnapshot[], asOf: Instant): AvailabilityOverlay[] {
  const byPlayer = new Map<number, OverlayKey[]>();
  for (const k of keys) byPlayer.set(k.playerId, [...byPlayer.get(k.playerId) ?? [], k]);
  for (const list of byPlayer.values()) list.sort((a, b) => instant(a.scheduledStartAt ?? "9999-12-31T00:00:00Z") - instant(b.scheduledStartAt ?? "9999-12-31T00:00:00Z") || a.gameId - b.gameId);
  const overlays = new Map<string, Cell>();
  const cell = (k: OverlayKey) => {
    const id = `${k.playerId}:${k.gameId}`;
    if (!overlays.has(id)) overlays.set(id, { playerId: k.playerId, gameId: k.gameId, availability: "available", role: null, annotations: [], evidence: [], conflicts: [], availabilityBy: null, roleBy: null, annotationBy: [] });
    return overlays.get(id)!;
  };
  const setAvailability = (c: Cell, value: Cell["availability"], by: string) => {
    if (c.availability === value) return false;
    c.availability = value; c.availabilityBy = by;
    // A hold that applies again ends the assumption an appearance made.
    if (value !== "available") { const i = c.annotations.indexOf(PARTICIPATION_ASSUMED); if (i >= 0) { c.annotations.splice(i, 1); c.annotationBy.splice(i, 1); } }
    return true;
  };
  const setRole = (c: Cell, value: Cell["role"], by: string) => { if (c.role !== value) { c.role = value; c.roleBy = by; } };
  const effective = effectiveSnapshots(snapshots, asOf).filter(s => credibleForAvailability(s) && s.signal !== "membership_report" && s.signal !== "not_applicable");
  const nextGame = (list: OverlayKey[], after: Instant) => list.find(k => k.scheduledStartAt && instant(k.scheduledStartAt) > instant(after)
    && instant(k.scheduledStartAt) - instant(after) <= GAME_SPECIFIC_HOURS * 3600000);
  const later = (list: OverlayKey[], after: Instant) => list.filter(k => k.scheduledStartAt && instant(k.scheduledStartAt) > instant(after));
  for (const [playerId, list] of byPlayer) {
    const mine = effective.filter(s => s.players.some(p => p.playerId === playerId));
    const groups = new Map<string, NewsSnapshot[]>();
    for (const s of mine) groups.set(s.postedAt!, [...groups.get(s.postedAt!) ?? [], s]);
    for (const [postedAt, group] of [...groups].sort((a, b) => instant(a[0]) - instant(b[0]))) {
      const signals = new Set(group.map(s => s.signal));
      if ([...signals].some(x => LIFTS.has(x)) && [...signals].some(x => REMOVES.has(x))) {
        for (const k of later(list, postedAt)) cell(k).conflicts.push(...group.map(s => s.id));
        continue;
      }
      for (const s of group) {
        if (s.signal === "out") for (const k of later(list, postedAt)) setAvailability(cell(k), "out", s.id);
        else if (s.signal === "confirmed_return" && s.category === APPEARANCE_CATEGORY) {
          // Ordered by the game played; effective for games after FORGE first observed the line.
          const from = instant(s.firstSeenAt) > instant(postedAt) ? s.firstSeenAt : postedAt;
          for (const k of later(list, from)) {
            const c = cell(k);
            if (setAvailability(c, "available", s.id) && !c.annotations.includes(PARTICIPATION_ASSUMED)) { c.annotations.push(PARTICIPATION_ASSUMED); c.annotationBy.push(s.id); }
          }
        } else if (s.signal === "confirmed_return") for (const k of later(list, postedAt)) setAvailability(cell(k), "available", s.id);
        else {
          const game = nextGame(list, postedAt);
          if (!game) continue; // no game inside the window: a stale game-specific report changes nothing
          const c = cell(game);
          if (s.signal === "scratch") setAvailability(c, "out", s.id);
          else if (s.signal === "questionable") { if (c.availability === "available") setAvailability(c, "questionable", s.id); }
          else if (s.signal === "goalie_confirmed_start" || s.signal === "goalie_expected_start") {
            setRole(c, s.signal === "goalie_confirmed_start" ? "confirmed_starter" : c.role === "confirmed_starter" ? c.role : "expected_starter", s.id);
            // A confirmed starter makes his club's other goalies not-confirmed for that game.
            if (s.signal === "goalie_confirmed_start") for (const other of keys.filter(k => k.gameId === game.gameId && k.teamId === game.teamId && k.playerClass === "goalie" && k.playerId !== playerId)) {
              const o = cell(other); if (o.role !== "confirmed_starter") setRole(o, "not_confirmed_starter", s.id);
            }
          } else if (!c.annotations.includes(s.signal)) { c.annotations.push(s.signal); c.annotationBy.push(s.id); }
        }
      }
    }
  }
  return [...overlays.values()].filter(o => o.availabilityBy || o.roleBy || o.annotations.length || o.conflicts.length)
    .map(({ availabilityBy, roleBy, annotationBy, ...o }) => ({ ...o, annotations: [...o.annotations].sort(),
      evidence: [...new Set([availabilityBy, roleBy, ...annotationBy].filter((id): id is string => id !== null))].sort(), conflicts: [...new Set(o.conflicts)].sort() }))
    .sort((a, b) => a.playerId - b.playerId || a.gameId - b.gameId);
}

/** What a reader is served for one key: the stored if-playing vintage, withheld while the player is out. Returning
 * to "available" serves the same vintage again; nothing is re-issued. */
export function servedForecast(vintage: { id: string; outputHash: string }, overlay: AvailabilityOverlay | null) {
  const availability = overlay?.availability ?? "available";
  return { vintageId: vintage.id, outputHash: vintage.outputHash, availability, role: overlay?.role ?? null, served: availability === "out" ? "withheld_player_out" as const : "if_playing" as const };
}
