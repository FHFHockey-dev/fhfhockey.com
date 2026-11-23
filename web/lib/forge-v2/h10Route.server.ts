/**
 * Hosted FORGE Full-NHL H1–H10 shadow issuance (nightly plus material). Off unless FORGE_H10_SHADOW_ENABLED=true and an
 * approval evidence id is configured; it fails closed without one and never invents one.
 * - **Writes:** only `forge_v2_private`.
 * - **Reads:** bounded SELECTs on public tables (`H10_SQL`, and `H10_NEWS_SQL` for accepted news cards), plus
 *   `forge_v2_private` state.
 * - **External requests:** only the official NHL roster (`api-web.nhle.com/v1/roster/{club}/{season}`), when the API
 *   route passes `fetchRoster`: all clubs once per night before the freeze, and in material mode only the clubs a
 *   pending trade/recall report names (at most `maximumRecheckTeams` per call). Never NST.
 * - **Consumers:** nothing reads the output. The v2 read route stays disabled, the RSO adapter stays off, and qualification
 *   refuses non-public evidence.
 * - **Nightly:** the cutoff is pinned to 04:00 ET. The first invocation freezes the denominator and its schedule as an
 *   `affiliation` record. Later invocations resume the same queues under a time budget, until done.
 * - **Material:** membership changes since the nightly freeze (trade, recall, assignment, IR) and new roster events
 *   (injury, return, scratch) become v2 material events for the affected players only. Accepted news cards
 *   (FxTwitter, via the existing poller) are snapshotted; a trade or recall report only triggers an official recheck
 *   (`h10News.ts`), and availability/role reports become overlay revisions on the stored forecasts, never new ones.
 */
import { Instant, instant } from "./contracts";
import { buildDenominator, FrozenDenominator } from "./denominator";
import { contentHash } from "./hash.server";
import { PostgresHistoryStore, SqlConnection } from "./history.server";
import { buildH10Training, H10GameLog, H10_RECIPE } from "./h10Features";
import { H10RunInput, runH10Issuance } from "./h10Producer.server";
import { runH10GoalieIssuance } from "./h10GoalieProducer.server";
import { h10InputsFromRows, H10InputRows, H10_SQL, readH10Rows } from "./h10Reader.server";
import { easternDailyDeadline, easternDate, MaterialEvent } from "./refresh";
import { CONDITIONING, ScheduleGame, TARGET_VERSION } from "./contracts";
import { targetKey } from "./identity";
import { appearanceSnapshots, moveEvidence, OfficialMove, OverlayKey, planRecheck } from "./h10News";
import { FetchRoster, H10NewsReadOverflow, newsStep, officialStep, overlayStep, readAppearances, ReadNews, storedMoves } from "./h10NewsRoute.server";
import { resolveMembership } from "./denominator";

export interface H10RouteConfig {
  enabled: boolean; approvalEvidenceId: string; approvedAt: Instant; codeVersion: string; seasonId: number;
  /** Inferred log receipt: the first WGO skater ingest (UTC minute of day) after start + gameHours. */
  logIngestUtcMinute: number; gameHours: number; rosterMaxAgeHours: number; maximumTrainingExamples: number; budgetMs: number; logsWindowDays: number;
  /** Floor for the first night (no previous freeze); later nights must keep 90% of the previous night's players. */
  minimumPlayers: number;
  /** Clubs the frozen denominator must cover (32 in production). */
  expectedTeams: number;
  /** Official roster reads (FORGE_H10_OFFICIAL_ROSTERS, default on); the API route passes the fetcher only when on. */
  officialRosters?: boolean;
  newsLookbackHours?: number; maximumRecheckTeams?: number; reportExpiryHours?: number; movesWindowDays?: number; overlayLookbackDays?: number;
}
const NEWS_DEFAULTS = { newsLookbackHours: 72, maximumRecheckTeams: 4, reportExpiryHours: 72, movesWindowDays: 30, overlayLookbackDays: 14 } as const;
export function h10RouteConfig(env: Record<string, string | undefined>): H10RouteConfig | { error: string } {
  if (env.FORGE_H10_SHADOW_ENABLED !== "true") return { error: "disabled" };
  const approvalEvidenceId = env.FORGE_H10_SHADOW_APPROVAL_ID?.trim(), approvedAt = env.FORGE_H10_SHADOW_APPROVED_AT?.trim(), codeVersion = env.VERCEL_GIT_COMMIT_SHA?.trim();
  if (!approvalEvidenceId || !approvedAt || !Number.isFinite(Date.parse(approvedAt)) || !codeVersion) return { error: "approval_or_code_version_missing" };
  return { enabled: true, approvalEvidenceId, approvedAt: new Date(approvedAt).toISOString(), codeVersion, seasonId: Number(env.FORGE_H10_SEASON_ID ?? 20262027),
    logIngestUtcMinute: 7 * 60 + 30, gameHours: 3.5, rosterMaxAgeHours: 36, maximumTrainingExamples: 2000, budgetMs: 200_000, logsWindowDays: 60, minimumPlayers: 700, expectedTeams: 32,
    officialRosters: env.FORGE_H10_OFFICIAL_ROSTERS !== "false", ...NEWS_DEFAULTS };
}

const RECORDS = "forge_v2_private.forge_v2_records";
interface Frozen { denominator: FrozenDenominator; schedule: ScheduleGame[]; logsHash: string; dropped: Record<string, number>; limitations: string[]; eventIds?: string[] }
async function frozen(db: SqlConnection, scope: string): Promise<Frozen | null> {
  const { rows } = await db.query<{ payload: string }>(`select payload from ${RECORDS} where kind = 'affiliation' and scope_key = $1 order by ordinal desc limit 1`, [scope]);
  return rows[0] ? JSON.parse(rows[0].payload) as Frozen : null;
}
const nightlyCutoff = (now: number) => new Date(instant(easternDailyDeadline(easternDate(new Date(now).toISOString()))) - 4 * 3600000).toISOString();

export interface H10RouteInput {
  mode: "nightly" | "material";
  now: number;
  db: SqlConnection;
  config: H10RouteConfig;
  readRows?: (db: SqlConnection, seasonId: number, logsFrom: string) => Promise<H10InputRows>;
  readRosterEvents?: (db: SqlConnection, since: Instant) => Promise<Array<{ event_id: string; player_id: string; event_type: string; created_at: Date | string }>>;
  /** Accepted news cards (FxTwitter via the existing poller). Absent: the news and overlay steps are skipped. */
  readNews?: ReadNews;
  /** Official NHL roster read. Absent: no outbound request, and membership comes from `rosters` and stored moves. */
  fetchRoster?: FetchRoster;
  /** Wall clock in ms (default: `now` advancing in real time); official observations are stamped with it. */
  clock?: () => number;
}

async function inputs(input: H10RouteInput, asOf: Instant, withLogs = true, moves: readonly OfficialMove[] = []) {
  // A change probe reads no game logs: the window starts after every game.
  const logsFrom = withLogs ? new Date(instant(asOf) - input.config.logsWindowDays * 86400000).toISOString().slice(0, 10) : "9999-12-31";
  const rows = await (input.readRows ?? readH10Rows)(input.db, input.config.seasonId, logsFrom);
  const built = h10InputsFromRows(rows, { asOf, seasonId: input.config.seasonId, logIngestUtcMinute: input.config.logIngestUtcMinute, gameHours: input.config.gameHours, rosterMaxAgeHours: input.config.rosterMaxAgeHours });
  // Official moves outrank the lagging `rosters` snapshot; a later disagreeing snapshot is reported as a conflict.
  return { ...built, evidence: [...built.evidence, ...moves.map(moveEvidence)], limitations: [...built.limitations] as string[] };
}
async function freeze(db: SqlConnection, scope: string, asOf: Instant, built: Awaited<ReturnType<typeof inputs>>, eventIds?: string[]): Promise<Frozen> {
  const denominator = buildDenominator({ evidence: built.evidence, schedule: built.schedule, asOf, seasonId: built.schedule[0]?.seasonId ?? 0, scheduleComplete: true, evidenceClass: "prospective_shadow" });
  const games = new Set(denominator.keys.map(key => key.gameId));
  const value: Frozen = { denominator, schedule: built.schedule.filter(game => games.has(game.gameId)), logsHash: contentHash([built.logs, built.goalieLogs]), dropped: built.dropped, limitations: built.limitations, ...(eventIds ? { eventIds } : {}) };
  await new PostgresHistoryStore(db).appendRecord(`${scope}:${denominator.denominatorSha256}`, "affiliation", scope, value);
  return value;
}
function issue(input: H10RouteInput, value: Frozen, logs: H10GameLog[], trigger: "daily" | { material: MaterialEvent[] }, previousKeys: string[],
  evidence?: H10RunInput["evidence"]) {
  return runH10Issuance({ db: input.db, store: new PostgresHistoryStore(input.db), artifacts: { put: async () => { throw new Error("h10_shadow_writes_no_artifacts"); } },
    denominator: value.denominator, schedule: value.schedule, logs, clock: () => new Date().toISOString(), trigger, stopAfterMs: input.now + input.config.budgetMs, previousKeys, evidence,
    config: { evidenceClass: "prospective_shadow", approvalEvidenceId: input.config.approvalEvidenceId, approvedAt: input.config.approvedAt, codeVersion: input.config.codeVersion, maximumTrainingExamples: input.config.maximumTrainingExamples } });
}
/** Goalie if-starts issuance; tables from migration 20261123200000. Until it is applied, every goalie key is one named gap. */
async function goaliePhase(input: H10RouteInput, value: Frozen, built: Awaited<ReturnType<typeof inputs>>, trigger: "daily" | { material: MaterialEvent[] }, evidence?: H10RunInput["evidence"]) {
  const migrated = (await input.db.query<{ ok: boolean }>("select to_regclass('forge_v2_private.forge_v2_goalie_vintages') is not null as ok")).rows[0]?.ok;
  const goalieKeys = value.denominator.keys.filter(key => key.playerClass === "goalie");
  if (!migrated) return { complete: true, published: 0, reused: 0, gaps: goalieKeys.map(key => ({ playerId: key.playerId, gameId: key.gameId, reason: "goalie_tables_not_migrated" })) };
  return runH10GoalieIssuance({ db: input.db, denominator: value.denominator, schedule: value.schedule, skaterLogs: built.logs, goalieLogs: built.goalieLogs, clock: () => new Date().toISOString(),
    trigger, stopAfterMs: input.now + input.config.budgetMs, evidence,
    config: { evidenceClass: "prospective_shadow", approvalEvidenceId: input.config.approvalEvidenceId, codeVersion: input.config.codeVersion, maximumTrainingExamples: input.config.maximumTrainingExamples } });
}
const summary = (report: Awaited<ReturnType<typeof runH10Issuance>>) => ({ denominatorSha256: report.denominatorSha256, asOf: report.asOf, trigger: report.trigger, scopes: report.scopes, goalieKeys: report.goalieKeys,
  gaps: report.gaps.reduce((map, gap) => ({ ...map, [gap.reason]: (map[gap.reason] ?? 0) + 1 }), {} as Record<string, number>), jobs: report.jobs, queues: report.queues, training: report.training, complete: report.complete });

/** Refuse to freeze a short or broken read: it would close every open episode and cache "complete" for the night. */
export function h10DenominatorGuard(denominator: FrozenDenominator, previous: FrozenDenominator | null, minimumPlayers: number, expectedTeams = 32, seasonEndsSoon = false): string | null {
  const teams = new Set(denominator.keys.map(key => key.teamId)).size;
  if (teams !== expectedTeams) return `teams_${teams}_not_${expectedTeams}`;
  // Near the end of the regular season every club has fewer than ten games left: a verified, exhausted schedule.
  if (denominator.counts.shortfallPlayers > 0 && !seasonEndsSoon) return `shortfall_players_${denominator.counts.shortfallPlayers}`;
  const floor = previous ? Math.floor(previous.counts.players * 0.9) : minimumPlayers;
  if (denominator.counts.players < floor) return `players_${denominator.counts.players}_below_${floor}`;
  return null;
}
const keysOf = (denominator: FrozenDenominator | null | undefined) => (denominator?.keys ?? [])
  .map(key => targetKey({ playerId: key.playerId, gameId: key.gameId, seasonId: key.seasonId, targetVersion: TARGET_VERSION, conditioning: CONDITIONING }));
const evidenceSource = (name: string, id: string, received: Instant, payload: Record<string, unknown>) => {
  const full = { features: {} as Record<string, never>, ...payload }, sha256 = contentHash(full);
  return { source: { id, revision: sha256, sha256, source: name, use: "approved" as const, observedAt: received, publishedAt: null, firstReceivedAt: received }, payload: full };
};

const floorSecond = (ms: number) => new Date(Math.floor(ms / 1000) * 1000).toISOString();
const currentClubs = (evidence: Awaited<ReturnType<typeof inputs>>["evidence"], asOf: Instant) =>
  new Map(resolveMembership(evidence, asOf).members.map(member => [member.affiliation.playerId, member.affiliation.teamId as number]));
const overlayKeys = (denominator: FrozenDenominator): OverlayKey[] => denominator.keys.map(key => ({ playerId: key.playerId, gameId: key.gameId, teamId: key.teamId,
  scheduledStartAt: key.scheduledStartAt ?? null, playerClass: key.playerClass === "goalie" ? "goalie" as const : "skater" as const }));

export async function handleH10Shadow(input: H10RouteInput): Promise<{ status: number; body: Record<string, unknown> }> {
  const startedAt = Date.now(), clock = input.clock ?? (() => input.now + (Date.now() - startedAt));
  const news = { ...NEWS_DEFAULTS, ...Object.fromEntries(Object.entries(input.config).filter(([key, value]) => key in NEWS_DEFAULTS && value !== undefined)) } as typeof NEWS_DEFAULTS;
  const fetchRoster = input.config.officialRosters === false ? undefined : input.fetchRoster;
  const todayCutoff = nightlyCutoff(input.now);
  const nightlyAsOf = input.now >= instant(todayCutoff) ? todayCutoff : nightlyCutoff(input.now - 86400000);
  const date = easternDate(nightlyAsOf), previousDate = easternDate(new Date(instant(nightlyAsOf) - 6 * 3600000).toISOString());
  const nightlyScope = `forge-h10-nightly:${date}`;
  if (input.mode === "nightly") {
    if (input.now < instant(todayCutoff)) return { status: 200, body: { success: true, status: "skipped", reason: "before_nightly_cutoff", cutoff: todayCutoff } };
    const done = await input.db.query<{ payload: string }>(`select payload from ${RECORDS} where kind = 'affiliation' and scope_key = $1 limit 1`, [`forge-h10-nightly-complete:${date}`]);
    if (done.rows[0]) return { status: 200, body: { success: true, status: "complete", cached: true, ...JSON.parse(done.rows[0].payload) } };
    const yesterday = await frozen(input.db, `forge-h10-nightly:${previousDate}`), yesterdayMaterial = await frozen(input.db, `forge-h10-material:${previousDate}`);
    let value = await frozen(input.db, nightlyScope);
    // The cutoff is the freeze time: everything read then was received by then (source clocks are last-observed stamps).
    // With official rosters on, the first call reads every club first and freezes after the last response.
    let official: Awaited<ReturnType<typeof officialStep>> | null = null;
    const stored: OfficialMove[] = value ? [] : await storedMoves(input.db, news.movesWindowDays, input.now);
    let asOf = value?.denominator.asOf ?? new Date(Math.floor(input.now / 60000) * 60000).toISOString();
    let current = await inputs(input, asOf, true, stored);
    const future = current.schedule.filter(game => game.scheduledStartAt && instant(game.scheduledStartAt) > instant(asOf)).map(game => instant(game.scheduledStartAt!));
    if (!value && !future.length) return { status: 200, body: { success: true, status: "skipped", reason: "no_future_regular_season_games", asOf } };
    const seasonEndsSoon = future.length > 0 && Math.max(...future) - instant(asOf) < 30 * 86400000;
    if (!value) {
      // The cheap refusals run before any official request or write: a short lines read, then a short roster read
      // (rosters plus stored moves). Nothing is written, and a later call can still issue tonight.
      const lines = buildH10Training(current.logs, input.config.seasonId, asOf, input.config.maximumTrainingExamples).available;
      if (lines < H10_RECIPE.minimumSupport) return { status: 409, body: { success: false, status: "failed", reason: "training_below_minimum_support", trainingExamples: lines } };
      const guard = (built: typeof current, at: Instant) => {
        const candidate = buildDenominator({ evidence: built.evidence, schedule: built.schedule, asOf: at, seasonId: input.config.seasonId, scheduleComplete: true, evidenceClass: "prospective_shadow" });
        const refused = h10DenominatorGuard(candidate, yesterday?.denominator ?? null, input.config.minimumPlayers, input.config.expectedTeams, seasonEndsSoon);
        return refused ? { status: 409, body: { success: false, status: "failed", reason: `denominator_guard:${refused}`, counts: candidate.counts } } : null;
      };
      const early = guard(current, asOf);
      if (early) return early;
      if (fetchRoster) {
        // Every club's official roster, then the freeze: the cutoff is after the last response.
        official = await officialStep(input.db, [...new Set(current.schedule.flatMap(game => [game.homeTeamId, game.awayTeamId]))], input.config.seasonId, fetchRoster,
          () => floorSecond(clock()), currentClubs(current.evidence, asOf), stored, { everyClub: true });
        asOf = floorSecond(clock());
        current = await inputs(input, asOf, true, official.moves);
        current.limitations = [...current.limitations.filter(l => l !== "no_official_transactions_feed"), "official_roster_observation_not_a_transactions_feed",
          ...(official.complete ? [] : ["official_roster_read_partial_no_departures"]), ...official.failures.map(f => `official_roster_unavailable:${f.teamId}:${f.reason}`)];
        const late = guard(current, asOf);
        if (late) return late;
      }
      // Keep two months of partitions ahead (migration 20261123210000); absent on an unpartitioned schema.
      if ((await input.db.query<{ ok: boolean }>("select to_regprocedure('forge_v2_private.forge_v2_ensure_month_partitions(date)') is not null as ok")).rows[0]?.ok) {
        await input.db.query("select forge_v2_private.forge_v2_ensure_month_partitions((date_trunc('month', clock_timestamp()) + interval '2 months')::date)");
      }
      value = await freeze(input.db, nightlyScope, asOf, current);
    }
    if (contentHash([current.logs, current.goalieLogs]) !== value.logsHash) return { status: 409, body: { success: false, status: "failed", reason: "logs_changed_after_freeze", denominatorSha256: value.denominator.denominatorSha256 } };
    const report = await issue(input, value, current.logs, "daily", [...keysOf(yesterday?.denominator), ...keysOf(yesterdayMaterial?.denominator)]);
    if (report.refused) return { status: 409, body: { success: false, status: "failed", reason: report.refused, training: report.training } };
    const goalies = report.complete ? await goaliePhase(input, value, current, "daily") : null;
    const complete = report.complete && goalies?.complete === true;
    if (complete) await new PostgresHistoryStore(input.db).appendRecord(`forge-h10-nightly-complete:${date}:${report.denominatorSha256}`, "affiliation",
      `forge-h10-nightly-complete:${date}`, { denominatorSha256: report.denominatorSha256, asOf: report.asOf, jobs: report.jobs, goalies: goalies ? { published: goalies.published, reused: goalies.reused, gaps: goalies.gaps.length } : null });
    return { status: 200, body: { success: true, status: complete ? "complete" : "continued", ...summary(report), goalies,
      ...(official ? { official: { clubs: official.rosters.length, complete: official.complete, failures: official.failures, newMoves: official.newMoves.map(m => ({ playerId: m.playerId, from: m.fromTeamId, to: m.toTeamId })) } } : {}) } };
  }
  // Material: changes since the latest nightly freeze (today's after 04:00 ET, otherwise the previous night's).
  const nightly = await frozen(input.db, nightlyScope);
  if (!nightly) return { status: 409, body: { success: false, status: "failed", reason: "nightly_not_frozen", nightly: date } };
  const materialScope = `forge-h10-material:${date}`, previous = await frozen(input.db, materialScope);
  // 1. Accepted news cards: snapshot new revisions (redeliveries are no-ops).
  const seenAt = floorSecond(clock());
  // Too many cards for one read: the news step is refused and reported as a gap; membership still runs.
  let refusedNews: { status: "refused"; reason: string; since: Instant; through: { updatedAt: Instant; id: string }; read: number } | null = null;
  const cards = input.readNews ? await newsStep(input.db, input.readNews, seenAt, news.newsLookbackHours).catch(error => {
    if (!(error instanceof H10NewsReadOverflow)) throw error;
    refusedNews = { status: "refused", reason: error.message, since: error.since, through: error.through, read: error.read };
    return null;
  }) : null;
  // 2. A pending trade/recall report triggers a bounded official recheck of the clubs it names. Only the official
  //    roster can move a player; a report the official roster does not confirm stays pending.
  let moves = await storedMoves(input.db, news.movesWindowDays, input.now);
  const probeBefore = await inputs(input, seenAt, false, moves);
  const plan = cards ? planRecheck(cards.snapshots, currentClubs(probeBefore.evidence, seenAt), moves, seenAt,
    { maximumTeams: news.maximumRecheckTeams, expiryHours: news.reportExpiryHours, windowMs: 30 * 60000 }) : null;
  const recheck = plan?.teams.length && fetchRoster
    ? await officialStep(input.db, plan.teams, input.config.seasonId, fetchRoster, () => floorSecond(clock()), currentClubs(probeBefore.evidence, seenAt), moves) : null;
  if (recheck) moves = recheck.moves;
  const reports = plan && recheck ? planRecheck(cards!.snapshots, currentClubs(probeBefore.evidence, seenAt), moves, floorSecond(clock()),
    { maximumTeams: news.maximumRecheckTeams, expiryHours: news.reportExpiryHours, windowMs: 30 * 60000 }) : plan;
  const newsBody = refusedNews ? { news: refusedNews } : cards ? { news: { read: cards.read, added: cards.added, duplicates: cards.duplicates, pendingReports: reports?.pending.length ?? 0,
    confirmedReports: reports?.confirmed.length ?? 0, reflectedReports: reports?.reflected.length ?? 0, expiredReports: reports?.expired.length ?? 0,
    recheck: recheck ? { clubs: recheck.rosters.map(r => r.teamId), failures: recheck.failures, newMoves: recheck.newMoves.map(m => ({ playerId: m.playerId, from: m.fromTeamId, to: m.toTeamId })) } : null } } : {};
  // 4. Availability and role: overlay revisions on the stored forecasts of the latest frozen keys.
  // An official appearance after an out report lifts it (h10News.appearanceSnapshots); only out players are read.
  const overlay = async (denominator: FrozenDenominator) => {
    if (!cards) return {};
    const at = floorSecond(clock()), appearances = await readAppearances(input.db, cards.snapshots, at, input.config);
    const step = await overlayStep(input.db, overlayKeys(denominator), [...cards.snapshots, ...appearanceSnapshots(appearances)], at, news.overlayLookbackDays);
    return { overlay: { written: step.written, unchanged: step.unchanged, appearances: appearances.length } };
  };
  // 3. Membership: the diff between the nightly freeze and now (rosters plus official moves).
  const asOfNow = floorSecond(clock());
  const current = await inputs(input, asOfNow, false, moves);
  const probe = buildDenominator({ evidence: current.evidence, schedule: current.schedule, asOf: asOfNow, seasonId: input.config.seasonId, scheduleComplete: true, evidenceClass: "prospective_shadow" });
  const membership = (d: FrozenDenominator) => new Map(d.keys.map(key => [key.playerId, `${key.teamId}:${key.membershipStatus}`]));
  const before = membership(nightly.denominator), after = membership(probe);
  const moved = [...new Set([...before.keys(), ...after.keys()])].filter(id => before.get(id) !== after.get(id)).sort((a, b) => a - b);
  const rosterEvents = (await (input.readRosterEvents ?? (async (db, since) => (await db.query(H10_SQL.rosterEvents, [since])).rows as never))(input.db, nightly.denominator.asOf!))
    .filter(e => after.has(Number(e.player_id)));
  if (!moved.length && !rosterEvents.length) return { status: 200, body: { success: true, status: "no_change", nightlyDenominatorSha256: nightly.denominator.denominatorSha256,
    ...newsBody, ...await overlay(previous?.denominator ?? nightly.denominator) } };
  // One event per player and evidence row, so later changes never re-issue earlier players. An official move's
  // evidence is dated by its first observation, so a report and a roster diff for one move issue it once.
  const evidence = new Map<number, ReturnType<typeof evidenceSource>[]>(), events: MaterialEvent[] = [];
  for (const playerId of moved) {
    const row = current.evidence.filter(e => e.playerId === playerId).sort((a, b) => instant(b.effectiveAt) - instant(a.effectiveAt))[0];
    const received = row?.source.firstReceivedAt ?? nightly.denominator.asOf!;
    const item = evidenceSource(row?.kind === "official_transaction" ? "api-web.nhle.com" : "public.rosters", `h10-roster-move:${playerId}:${received}`, received,
      { playerId, from: before.get(playerId) ?? null, to: after.get(playerId) ?? null, ...(row?.kind === "official_transaction" ? { officialMove: row.revision } : {}) });
    // The report that prompted the recheck travels with the move as provenance (post, source, first-seen time).
    const prompted = (reports?.confirmed ?? []).map(c => cards!.snapshots.find(s => s.id === c.snapshotId)!).filter(s => s.players.some(p => p.playerId === playerId))
      .map(s => evidenceSource("public.news_feed_items", s.id, s.firstSeenAt, { cardId: s.cardId, revision: s.revision, postId: s.postId, postUrl: s.postUrl, account: s.account, postedAt: s.postedAt }));
    evidence.set(playerId, [...(evidence.get(playerId) ?? []), item, ...prompted]);
    events.push({ id: `forge-h10:affiliation:${item.source.sha256.slice(0, 16)}`, kind: "affiliation", receivedAt: received, acceptedAt: received, payloadHash: item.source.sha256, affected: { playerIds: [playerId] } });
  }
  for (const e of rosterEvents) {
    const playerId = Number(e.player_id), received = new Date(e.created_at).toISOString();
    const item = evidenceSource("public.forge_roster_events", `h10-roster-event:${e.event_id}`, received, { playerId, eventId: e.event_id, eventType: e.event_type });
    evidence.set(playerId, [...(evidence.get(playerId) ?? []), item]);
    events.push({ id: `forge-h10:availability:${e.event_id}`, kind: "availability", receivedAt: received, acceptedAt: received, payloadHash: item.source.sha256, affected: { playerIds: [playerId] } });
  }
  // The material cutoff is when a new change was first detected; while no new change appears, every call reuses it.
  const seen = new Set(previous?.eventIds ?? []), fresh = events.some(event => !seen.has(event.id));
  const asOf = fresh ? new Date(Math.max(instant(asOfNow), instant(nightly.denominator.asOf!) + 1000, previous ? instant(previous.denominator.asOf!) + 1000 : 0)).toISOString() : previous!.denominator.asOf!;
  if (instant(asOf) > clock()) return { status: 200, body: { success: true, status: "continued", reason: "material_cutoff_after_now", asOf, ...newsBody } };
  for (const event of events) event.acceptedAt = asOf;
  let value = fresh ? null : previous;
  if (!value) {
    const built = await inputs(input, asOf, true, moves);
    const candidate = buildDenominator({ evidence: built.evidence, schedule: built.schedule, asOf, seasonId: input.config.seasonId, scheduleComplete: true, evidenceClass: "prospective_shadow" });
    const refused = h10DenominatorGuard(candidate, nightly.denominator, input.config.minimumPlayers, input.config.expectedTeams);
    if (refused) return { status: 409, body: { success: false, status: "failed", reason: `denominator_guard:${refused}`, counts: candidate.counts } };
    value = await freeze(input.db, materialScope, asOf, built, events.map(event => event.id));
  }
  const built = await inputs(input, asOf, true, moves);
  const report = await issue(input, value, built.logs, { material: events }, [...keysOf(nightly.denominator), ...keysOf(previous?.denominator)], evidence);
  const goalies = report.complete ? await goaliePhase(input, value, built, { material: events }, evidence) : null;
  const complete = report.complete && goalies?.complete === true;
  return { status: 200, body: { success: true, status: complete ? "complete" : "continued", moved: moved.length, availability: rosterEvents.length, ...summary(report), goalies,
    ...newsBody, ...(complete ? await overlay(value.denominator) : {}) } };
}
