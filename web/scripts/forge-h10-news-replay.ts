/**
 * G2c: the accepted news cards of read #3 (2026-11-16 .. 11-23, manifest-verified) replayed through the H1–H10 news
 * rules at every proposed material tick (:05 and :35 UTC, outside 08–12), against the real denominator and the real
 * 32-club official read. Pure and local: no database, no fetch, no production call.
 *
 * Limits of the replay, reported with the result: read #3 holds each card's latest state only (an earlier revision is
 * invisible, so first-seen times are upper bounds); FORGE membership is the end-of-week `rosters` state; the official
 * state at every recheck is the 11-23 19:51Z read.
 *
 *   npx tsx scripts/forge-h10-news-replay.ts <packet-dir> <out.json>
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildDenominator, resolveMembership } from "../lib/forge-v2/denominator";
import { h10InputsFromRows } from "../lib/forge-v2/h10Reader.server";
import { appearanceSnapshots, AvailabilityOverlay, credibleForAvailability, effectiveSnapshots, mergeSnapshots, moveEvidence, NewsCardRow, NewsSnapshot, OfficialMove, officialMoves,
  OverlayKey, parseOfficialRoster, planRecheck, resolveAvailability } from "../lib/forge-v2/h10News";
import { clubAbbrev } from "../lib/forge-v2/h10NewsRoute.server";
import { contentHash } from "../lib/forge-v2/hash.server";
import { realRows, ts, verified } from "./forge-h10-real-inputs";

const [packet, out] = process.argv.slice(2);
if (!packet || !out) throw new Error("usage: <packet-dir> <out.json>");
const ASOF = "2026-11-23T17:20:00.000Z", SEASON = 20262027;

/** RFC 4180 CSV (quoted fields with doubled quotes; the players column holds JSON). */
function parseCsv(text: string) {
  const rows: string[][] = []; let field = "", row: string[] = [], quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) { if (c === '"' && text[i + 1] === '"') { field += '"'; i++; } else if (c === '"') quoted = false; else field += c; continue; }
    if (c === '"') quoted = true; else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(field); rows.push(row); row = []; field = ""; }
    else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [head, ...body] = rows;
  return body.filter(r => r.length === head.length).map(r => Object.fromEntries(head.map((k, i) => [k, r[i] === "" ? null : r[i]])) as Record<string, string | null>);
}

function main() {
  const news = verified(join(packet!, "read-results-news-20261123"));
  const cards: NewsCardRow[] = parseCsv(news("n1.csv")).map(r => ({ id: r.id!, card_status: r.card_status!, category: r.category!, subcategory: r.subcategory, source_account: r.source_account,
    source_tweet_id: r.source_tweet_id, original_tweet_id: r.original_tweet_id, tweet_url: r.tweet_url, team_id: r.team_id === null ? null : Number(r.team_id), headline: r.headline!,
    observed_at: ts(r.observed_at), published_at: ts(r.published_at), updated_at: ts(r.updated_at)!, players: JSON.parse(r.players ?? "[]") }));
  // The real denominator and the real official state (as the nightly route builds them).
  const rows = realRows(packet!), inputs = h10InputsFromRows(rows, { asOf: ASOF, seasonId: SEASON, logIngestUtcMinute: 450, gameHours: 3.5, rosterMaxAgeHours: 36 });
  const sweepDir = join(packet!, "nhl-public-rosters-20261123"), sweep = verified(sweepDir);
  const sweepAt = new Date(readFileSync(join(sweepDir, "fetched_at.txt"), "utf8").trim().split("\n")[1]).toISOString();
  const clubs = [...new Set(inputs.schedule.flatMap(g => [g.homeTeamId, g.awayTeamId]))].sort((a, b) => a - b);
  const officialBody = new Map(clubs.map(teamId => [teamId, JSON.parse(sweep(`roster_${clubAbbrev(teamId)}_20262027.json`))]));
  const rostersOnly = new Map(resolveMembership(inputs.evidence, sweepAt).members.map(m => [m.affiliation.playerId, m.affiliation.teamId as number]));
  const nightly = officialMoves(clubs.map(t => parseOfficialRoster(officialBody.get(t), t, clubAbbrev(t)!, sweepAt)), rostersOnly, [], true);
  const denominator = buildDenominator({ evidence: [...inputs.evidence, ...nightly.map(moveEvidence)], schedule: inputs.schedule, asOf: sweepAt, seasonId: SEASON, scheduleComplete: true, evidenceClass: "prospective_shadow" });
  const keys: OverlayKey[] = denominator.keys.map(k => ({ playerId: k.playerId, gameId: k.gameId, teamId: k.teamId, scheduledStartAt: k.scheduledStartAt ?? null, playerClass: k.playerClass === "goalie" ? "goalie" : "skater" }));
  const members = new Set(keys.map(k => k.playerId));
  // Official appearances (real skater and goalie lines), for players any card reports out. ESTIMATES, not live
  // acceptance: q3 has no time-on-ice column, so a skater line counts as participation (a goalie line needs a start or
  // shots against); first observation is the first material tick at or after the inferred WGO receipt.
  const reportedOut = new Set(cards.filter(c => /^(INJURY|SCRATCHES)$/i.test(c.category)).flatMap(c => c.players.map(p => p.player_id)).filter((id): id is number => id !== null));
  const tickAfter = (iso: string) => { const t = Date.parse(iso); for (let x = Math.ceil((t - 5 * 60000) / 1800000) * 1800000 + 5 * 60000; ; x += 1800000) { const h = new Date(x).getUTCHours(); if (h < 8 || h > 12) return new Date(x).toISOString(); } };
  const appearances = appearanceSnapshots([...inputs.logs.map(l => ({ l, played: true })), ...inputs.goalieLogs.map(l => ({ l, played: l.started || (l.values.SHOTS_AGAINST ?? 0) > 0 }))]
    .filter(({ l, played }) => played && reportedOut.has(l.playerId))
    .map(({ l }) => ({ playerId: l.playerId, gameId: l.gameId, gameStartAt: l.gameStartAt, timeOnIceSeconds: 1, firstObservedAt: tickAfter(l.source.firstReceivedAt) })));

  // Material ticks across the read window.
  const ticks: string[] = [];
  for (let t = Date.UTC(2026, 10, 16, 18, 5); t <= Date.UTC(2026, 10, 23, 21, 5); t += 30 * 60000) {
    const hour = new Date(t).getUTCHours();
    if (hour < 8 || hour > 12) ticks.push(new Date(t).toISOString());
  }
  let stored: NewsSnapshot[] = [], moves: OfficialMove[] = [];
  const current = new Map(rostersOnly);
  let maxRead = 0, rechecks = 0, gets = 0, maxGetsPerTick = 0, overlayRevisions = 0;
  const getsByDay = new Map<string, number>(), previous = new Map<string, string>();
  for (const tick of ticks) {
    const since = Date.parse(tick) - 72 * 3600000;
    const read = cards.filter(c => Date.parse(c.updated_at as string) > since && Date.parse(c.updated_at as string) <= Date.parse(tick));
    maxRead = Math.max(maxRead, read.length);
    stored = mergeSnapshots(stored, read, tick).all;
    const plan = planRecheck(stored, current, moves, tick, { maximumTeams: 4, expiryHours: 72, windowMs: 30 * 60000 });
    if (plan.teams.length) {
      rechecks += 1; gets += plan.teams.length; maxGetsPerTick = Math.max(maxGetsPerTick, plan.teams.length);
      getsByDay.set(tick.slice(0, 10), (getsByDay.get(tick.slice(0, 10)) ?? 0) + plan.teams.length);
      const fresh = officialMoves(plan.teams.map(t => parseOfficialRoster(officialBody.get(t), t, clubAbbrev(t)!, tick)), current, moves);
      for (const m of fresh.filter(m => !moves.some(x => x.id === m.id))) { moves = [...moves, m]; if (m.toTeamId !== null) current.set(m.playerId, m.toTeamId); }
    }
    // Overlay revisions the route would write at this tick (state changes per key).
    for (const o of resolveAvailability(keys, [...stored, ...appearances], tick)) {
      const id = `${o.playerId}:${o.gameId}`, hash = contentHash(o);
      if (previous.get(id) !== hash) { overlayRevisions += 1; previous.set(id, hash); }
    }
  }
  const end = ticks[ticks.length - 1];
  const effective = effectiveSnapshots(stored, end);
  const count = <T>(items: T[], key: (item: T) => string) => Object.fromEntries([...items.reduce((m, i) => m.set(key(i), (m.get(key(i)) ?? 0) + 1), new Map<string, number>())].sort());
  const overlays: AvailabilityOverlay[] = resolveAvailability(keys, [...stored, ...appearances], end);
  const withoutAppearances = resolveAvailability(keys, stored, end);
  const plan = planRecheck(stored, current, moves, end, { maximumTeams: 4, expiryHours: 72, windowMs: 30 * 60000 });
  const availabilitySignals = new Set(["out", "scratch", "questionable", "confirmed_return", "projected_return", "goalie_confirmed_start", "goalie_expected_start", "lineup_report"]);
  const report = {
    version: "forge-h10-news-replay-v1", read: { cards: cards.length, published: cards.filter(c => c.card_status === "published").length, firstUpdate: cards.map(c => c.updated_at as string).sort()[0],
      lastUpdate: cards.map(c => c.updated_at as string).sort().pop(), maxCardsReadInOneCall: maxRead, routeCap: 5000, pageSize: 500 },
    limits: ["latest card state only: earlier revisions invisible, first-seen times are upper bounds", "membership is the end-of-week rosters state", "official state at every recheck is the 11-23 19:51Z read"],
    estimates: {
      appearanceFirstObservedAt: "ESTIMATE, not live acceptance: the first material tick at or after the inferred WGO receipt (07:30 UTC after start + 3.5 h). The hosted route stamps the time it first reads the line.",
      participation: "ESTIMATE: read #3's skater lines carry no time on ice, so a line counts as participation; a goalie line needs a start or shots against. The hosted read requires time on ice > 0.",
    },
    snapshots: { total: stored.length, bySignal: count(stored, s => s.signal), byTier: count(stored, s => s.tier),
      noSourceAccount: { cards: cards.filter(c => !c.source_account).length, bySignal: count(stored.filter(s => !s.account), s => s.signal) },
      availabilityReports: { total: stored.filter(s => availabilitySignals.has(s.signal)).length, credible: stored.filter(s => availabilitySignals.has(s.signal) && credibleForAvailability(s)).length,
        notCredibleBySignal: count(stored.filter(s => availabilitySignals.has(s.signal) && !credibleForAvailability(s)), s => `${s.signal}:${s.tier}`) },
      namingPlayersOutsideDenominator: stored.filter(s => s.players.length && s.players.every(p => !members.has(p.playerId))).length },
    membership: { reports: stored.filter(s => s.signal === "membership_report").length, ticks: ticks.length, ticksWithRecheck: rechecks, officialGets: gets, maxGetsPerTick,
      getsByDay: Object.fromEntries([...getsByDay].sort()), confirmedMoves: moves.map(m => ({ playerId: m.playerId, from: m.fromTeamId, to: m.toTeamId, firstObservedAt: m.firstObservedAt })),
      atEnd: { pending: plan.pending.length, confirmed: plan.confirmed.length, reflected: plan.reflected.length, expired: plan.expired.length } },
    overlays: { atEnd: { keys: overlays.length, players: new Set(overlays.map(o => o.playerId)).size, byAvailability: count(overlays, o => o.availability),
      byRole: count(overlays.filter(o => o.role), o => o.role!), withConflicts: overlays.filter(o => o.conflicts.length).length, annotated: overlays.filter(o => o.annotations.length).length },
      liftedByOfficialAppearance: { players: new Set(overlays.filter(o => o.evidence.some(e => e.startsWith("forge-h10-appearance:"))).map(o => o.playerId)).size,
        outKeysWithoutAppearanceRule: withoutAppearances.filter(o => o.availability === "out").length },
      revisionsOverWeek: overlayRevisions, perDay: Math.round(overlayRevisions / 7.1) },
    effectiveCards: effective.length,
  };
  writeFileSync(out!, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(report, null, 1)}\n`);
}
main();
