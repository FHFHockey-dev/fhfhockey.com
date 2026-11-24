import { fetchAllSupabasePages } from "lib/supabase/pagination";
import { sanitizePublicNewsText } from "lib/newsFeed";
import { easternReportDate, verifiedOriginalTweetUrl } from "lib/sources/projectedLineups";
import { tweetPublicationFromUrl } from "lib/sources/tweetPublicationTime";
import { isRelayAccount, RELAY_ONLY_WEIGHT, scrubRelayHandles } from "./authority";
import { activeLineClaims, captureIdentity, currentSourceReadings, eligibleClaim, reconcilePP } from "./reconcile";
import { readOfficialPowerPlay } from "./officialPowerPlay";
import { chooseDefaultGame, observeLineGame, stateAtRead, trustworthyState } from "./gameState";
import { fetchCarryMemberships, fetchEntryHistory, fetchLineClaims, latestLineDecisions } from "./storage";
import { instant, lineSnapshotFlags, type EntryRevision, type EntryView, type GameLinesResponse, type LineClaim, type LineGame, type SelectedLineUnit, type SourceFeedItem } from "./types";

/** Public GET bounds: games in this window, and a game-state refresh only when stored state is older than the interval. */
const READ_WINDOW = { backDays: 21, forwardDays: 14 };
const READ_OBSERVE_INTERVAL_MS = 5 * 60_000;
const day = (now: string, offsetDays: number) => new Date(Date.parse(now) + offsetDays * 86_400_000).toISOString().slice(0, 10);

/** `dateFrom` / `dateTo` (YYYY-MM-DD, inclusive) bound the read; `gameIds` reads exactly those games. */
export async function fetchLineGames(supabase: any, args: { teamId?: number; gameId?: number; gameIds?: number[]; dateFrom?: string; dateTo?: string }): Promise<LineGame[]> {
  if (args.gameIds && !args.gameIds.length) return [];
  const rows = await fetchAllSupabasePages<any>(({ from, to }) => {
    let query = supabase.from("games").select("id,date,startTime,homeTeamId,awayTeamId,home:teams!games_homeTeamId_fkey(abbreviation),away:teams!games_awayTeamId_fkey(abbreviation)");
    if (args.teamId) query = query.or(`homeTeamId.eq.${args.teamId},awayTeamId.eq.${args.teamId}`);
    else if (args.gameId) query = query.eq("id", args.gameId);
    else if (args.gameIds) query = query.in("id", args.gameIds);
    if (args.dateFrom) query = query.gte("date", args.dateFrom);
    if (args.dateTo) query = query.lte("date", args.dateTo);
    return query.order("date", { ascending: false }).order("id").range(from, to);
  });
  return rows.map((row) => ({ id: row.id, date: row.date, homeTeamId: row.homeTeamId, awayTeamId: row.awayTeamId,
    homeAbbreviation: row.home?.abbreviation ?? String(row.homeTeamId), awayAbbreviation: row.away?.abbreviation ?? String(row.awayTeamId),
    scheduledStart: instant(row.startTime) == null ? null : row.startTime, phase: "unknown", actualStart: null, observedAt: null,
    stateSource: null, scheduleIdentity: `${row.id}:${row.startTime ?? row.date}:OK`, replacesGameId: null }));
}

/**
 * The latest stored state of each game, as stored (not aged by stateAtRead): one indexed single-row read per game
 * (line_game_state_history). A schedule amendment (a different scheduled start) invalidates the stored state.
 */
export async function latestLineGameStates(supabase: any, games: LineGame[]): Promise<LineGame[]> {
  return Promise.all(games.map(async (game) => {
    const result = await supabase.from("line_game_state_observations").select("payload").eq("game_id", game.id).order("observed_at", { ascending: false }).limit(1);
    if (result.error) throw result.error;
    const state = result.data?.[0]?.payload as LineGame | undefined;
    return state && state.scheduledStart === game.scheduledStart ? { ...game, ...state } : game;
  }));
}

/** Matchup choices for the older reports view. Read the stored schedule and phase only. */
export async function readReportGames(supabase: any, args: { teamId?: number; gameId?: number; now: string }) {
  const exact = args.gameId ? (await fetchLineGames(supabase, { gameId: args.gameId }))[0] : null;
  if (args.gameId && (!exact || args.teamId && ![exact.homeTeamId, exact.awayTeamId].includes(args.teamId))) return null;
  const teamIds = args.teamId ? [args.teamId] : exact ? [exact.homeTeamId, exact.awayTeamId] : [];
  const schedules = await Promise.all(teamIds.map(teamId => fetchLineGames(supabase, {
    teamId, dateFrom: day(args.now, -READ_WINDOW.backDays), dateTo: day(args.now, READ_WINDOW.forwardDays),
  })));
  const byId = new Map(schedules.flat().map(game => [game.id, game]));
  if (exact) byId.set(exact.id, exact);
  const games = [...byId.values()].sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
  let selected = exact ?? null;
  if (!selected) {
    const today = easternReportDate(args.now);
    const recent = games.filter(game => game.date <= today && game.date >= day(today, -1));
    // The reports view can operate on the schedule alone when the optional snapshot tables are absent.
    let states: LineGame[] = [];
    try { states = await latestLineGameStates(supabase, recent); }
    catch (error) {
      if (!["42P01", "PGRST205"].includes((error as { code?: string }).code ?? "")) throw error;
    }
    for (const state of states) byId.set(state.id, stateAtRead(state, args.now));
    const candidates = [...byId.values()];
    const primary = chooseDefaultGame(candidates, args.now);
    // A scheduled matchup today stays identifiable after its start when live status is unknown.
    selected = primary?.phase === "live" ? primary : candidates.find(game => game.date === today && game.phase !== "final" && game.phase !== "postponed") ?? primary;
  }
  return { selectedGameId: selected?.id ?? null, games: games.map(({ id, date, awayTeamId, homeTeamId, awayAbbreviation, homeAbbreviation }) =>
    ({ id, date, awayTeamId, homeTeamId, awayAbbreviation, homeAbbreviation })) };
}

function publicQuoteEvidence(claim: LineClaim): LineClaim {
  const original = claim.provenance?.originalTweetId;
  const relay = claim.provenance?.relayTweetId;
  // Older selected quotes sometimes put the original status clock in the relay field.
  if (relay && original && relay !== original && claim.time.relayPublishedAt && claim.reviewReasons.includes("quoted_publication_time_unresolved")) {
    const carrierClock = tweetPublicationFromUrl(`https://x.com/i/web/status/${relay}`);
    if (carrierClock && Math.floor(Date.parse(carrierClock) / 1000) !== Math.floor(Date.parse(claim.time.relayPublishedAt) / 1000)) {
      claim = { ...claim, time: { ...claim.time, relayPublishedAt: null } };
    }
  }
  // A trailing link on the carrier's own lineup does not establish its byline.
  if (!original || original === claim.provenance?.relayTweetId || !isRelayAccount(claim.relayAccount)
    || claim.sourceUrl || claim.time.originalPublishedAt || claim.publicationEvidence?.length) return claim;
  const link = claim.text.trimEnd().match(/\shttps:\/\/(?:x|twitter)\.com\/([\w]{1,15})\/status\/(\d+)\/?$/i);
  if (!link || link[2] !== original || link[1]!.toLowerCase() !== claim.originalAuthor?.toLowerCase()) return claim;
  return { ...claim, originalAuthor: null, author: null, originalIdentity: null, authorityTier: claim.authorityTier === "excluded" ? "excluded" : "unknown", authority: RELAY_ONLY_WEIGHT,
    certainty: claim.certainty === "confirmed" ? "reported" : claim.certainty, confirmationEvidence: [],
    provenance: { ...claim.provenance!, originalTweetId: null, attributionStatus: "pending" } };
}

/** Relay accounts never reach the site surface: every public string field is scrubbed of them. */
export function publicClaim(claim: LineClaim): LineClaim {
  claim = publicQuoteEvidence(claim);
  const sanitize = (value: string) => sanitizePublicNewsText(scrubRelayHandles(value));
  const candidate = verifiedOriginalTweetUrl(claim.sourceUrl);
  const handle = candidate ? new URL(candidate).pathname.split("/")[1]! : null;
  const id = candidate?.match(/\/status\/(\d+)$/)?.[1];
  const identity = verifiedOriginalTweetUrl(claim.originalIdentity);
  const consistent = candidate && handle && !/^(?:i|null|undefined|unknown|none|n_?a|source_account)$/i.test(handle) && !isRelayAccount(handle)
    && claim.author?.replace(/^@/, "").toLowerCase() === handle.toLowerCase()
    && (!claim.provenance || claim.provenance.attributionStatus === "resolved" && claim.provenance.originalTweetId === id)
    && (claim.originalIdentity === id || identity?.toLowerCase() === candidate.toLowerCase());
  const originalUrl = consistent ? candidate : null;
  return { ...claim, provenance: undefined, text: scrubRelayHandles(claim.text).split("\n").map(sanitize).join("\n"), sourceUrl: originalUrl,
    relayAccount: null, reviewReasons: claim.reviewReasons.map(scrubRelayHandles), originalAuthor: isRelayAccount(claim.originalAuthor) ? null : claim.originalAuthor,
    decisionEvidence: claim.decisionEvidence ? { ...claim.decisionEvidence, sourceReferences: claim.decisionEvidence.sourceReferences.map(scrubRelayHandles),
      binding: claim.decisionEvidence.binding.map((span) => ({ ...span, text: sanitize(span.text) })), phase: claim.decisionEvidence.phase.map((span) => ({ ...span, text: sanitize(span.text) })) } : undefined,
    publicationEvidence: claim.publicationEvidence?.map(scrubRelayHandles),
    contextEvidence: claim.contextEvidence?.map((span) => ({ ...span, text: sanitize(span.text) })),
    author: originalUrl ? new URL(originalUrl).pathname.split("/")[1]! : "Original source pending",
    originalIdentity: originalUrl,
    unit: claim.unit ? { ...claim.unit, number: claim.unit.situation === "pp" && !claim.unit.explicitNumber ? null : claim.unit.number,
      evidence: claim.unit.evidence.map((span) => ({ ...span, text: sanitize(span.text) })) } : null,
    relationship: claim.relationship ? { ...claim.relationship, evidence: { ...claim.relationship.evidence, text: sanitize(claim.relationship.evidence.text) } } : null };
}
const FEED_WINDOW_MS = 2 * 86400000;
const excludedAuthor = (claim: LineClaim) => claim.authorityTier === "excluded" || claim.reviewReasons.includes("author_excluded");

/** Raw captures for one team and game, one item per original post with its relays collapsed under it. */
export function buildSourceFeed(claims: LineClaim[], game: LineGame, now: string): SourceFeedItem[] {
  const start = (instant(game.scheduledStart) ?? instant(`${game.date}T12:00:00Z`)!) - FEED_WINDOW_MS, end = instant(now) ?? -Infinity;
  const readings = claims.map(publicQuoteEvidence);
  const identity = captureIdentity(readings);
  const visible = readings.filter(claim => !excludedAuthor(claim) && (instant(claim.time.ingestedAt) ?? Infinity) <= end);
  const inScope = (claim: LineClaim) => claim.gameId === game.id || claim.gameId == null && (instant(claim.time.ingestedAt) ?? -Infinity) >= start;
  const currentIds = new Set(currentSourceReadings(visible, identity).filter(inScope).map(claim => claim.id));
  const groups = new Map<string, LineClaim[]>();
  for (const claim of visible.filter(inScope)) groups.set(identity(claim), [...groups.get(identity(claim)) ?? [], claim]);
  return [...groups.entries()].filter(([, group]) => group.some(claim => currentIds.has(claim.id))).map(([id, group]) => {
    const ordered = [...group].sort((a, b) => Number(currentIds.has(b.id)) - Number(currentIds.has(a.id))
      || Number(b.provenance?.attributionStatus === "resolved") - Number(a.provenance?.attributionStatus === "resolved")
      || (instant(b.time.interpretedAt) ?? 0) - (instant(a.time.interpretedAt) ?? 0) || a.id.localeCompare(b.id));
    const current = ordered.filter(claim => currentIds.has(claim.id));
    const representative = current[0]!, shown = publicClaim(representative);
    const bound = current.find((claim) => claim.binding.status === "bound") ?? representative;
    const relays = new Map<string, SourceFeedItem["relays"][number]>();
    for (const claim of ordered) if (claim.relayAccount) {
      const key = `${claim.relayAccount}:${claim.provenance?.relayTweetId ?? ""}`;
      if (!relays.has(key)) relays.set(key, { account: null, relayTweetId: claim.provenance?.relayTweetId ?? null, relayPublishedAt: claim.time.relayPublishedAt, ingestedAt: claim.time.ingestedAt });
    }
    return { id, originalIdentity: shown.originalIdentity, originalAuthor: ordered.find((claim) => claim.originalAuthor && !isRelayAccount(claim.originalAuthor))?.originalAuthor
        ?? (shown.sourceUrl && !isRelayAccount(shown.author) ? shown.author : null),
      authorityTier: representative.authorityTier ?? "unknown", relays: [...relays.values()], text: shown.text,
      publishedAt: ordered.find(claim => instant(claim.time.originalPublishedAt) != null)?.time.originalPublishedAt ?? null,
      ingestedAt: ordered.map((claim) => claim.time.ingestedAt).sort()[0]!,
      binding: { status: bound.binding.status, gameId: bound.gameId, evidence: bound.binding.evidence },
      context: representative.context ?? null, claimIds: group.map((claim) => claim.id).sort(), sourceUrl: shown.sourceUrl };
  }).sort((a, b) => (instant(b.publishedAt ?? b.ingestedAt) ?? 0) - (instant(a.publishedAt ?? a.ingestedAt) ?? 0) || a.id.localeCompare(b.id));
}

function publicUnits(units: SelectedLineUnit[]) { return units.map((unit) => ({ ...unit, claims: unit.claims.map(publicClaim) })); }
function publicEntry(entry: EntryRevision): EntryRevision { return { ...entry, units: publicUnits(entry.units), evidenceClaims: entry.evidenceClaims?.map(publicClaim) }; }

// A later game binding can qualify the same captured five without changing parser version.
function sameReportedPP(a: LineClaim, b: LineClaim): boolean {
  const unit = a.unit, other = b.unit;
  return !!unit && !!other && a.kind === "pp" && b.kind === "pp" && !!a.captureId && a.captureId === b.captureId
    && a.teamId === b.teamId && a.phase === b.phase && unit.complete && other.complete
    && unit.explicitNumber && other.explicitNumber && unit.number === other.number && unit.group === other.group
    && unit.players.length === 5 && other.players.length === 5
    && unit.players.every((player, i) => player.playerId === other.players[i]!.playerId);
}

export async function readGameLines(supabase: any, args: { teamId?: number; gameId?: number; now: string }): Promise<GameLinesResponse> {
  const controls = lineSnapshotFlags();
  const empty: GameLinesResponse = { enabled: controls.entryServing, mode: "snapshots", status: controls.entryServing ? "no_game" : "disabled", controls, game: null, games: [], teams: [],
    entryView: { mode: "expected", frozenAt: null, basis: null } };
  if (!controls.entryServing || !args.teamId && !args.gameId) return empty;
  // Bounded for game-night traffic: a date window of games, the latest stored state of the default-game candidates only,
  // and a game-state refresh only when that stored state is older than the processor's observe interval. Never writes on GET.
  const window = { from: day(args.now, -READ_WINDOW.backDays), to: day(args.now, READ_WINDOW.forwardDays) };
  let games = await fetchLineGames(supabase, args.gameId ? { gameId: args.gameId } : { teamId: args.teamId, dateFrom: window.from, dateTo: window.to });
  if (args.gameId && !games.some((game) => game.id === args.gameId)) return empty;
  const today = args.now.slice(0, 10);
  const candidates = args.gameId ? games.filter((game) => game.id === args.gameId)
    : games.filter((game) => game.date >= new Date(instant(args.now)! - 86400000).toISOString().slice(0, 10) && game.date <= today)
      .concat([...games].filter((game) => game.date > today).sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id).slice(0, 1));
  const stored = await latestLineGameStates(supabase, candidates);
  const fresh = (game: LineGame) => trustworthyState(game, args.now) && Date.parse(args.now) - (instant(game.observedAt) ?? -Infinity) < READ_OBSERVE_INTERVAL_MS;
  const observations = await Promise.all(stored.map((game) => fresh(game) ? game : observeLineGame(game, args.now)));
  const states = new Map(observations.map((game) => [game.id, stateAtRead(game, args.now)]));
  games = games.map((game) => states.get(game.id) ?? game);
  const game = args.gameId ? games.find((game) => game.id === args.gameId)! : chooseDefaultGame(games, args.now);
  if (!game) return { ...empty, games };
  const teamIds = args.teamId ? [args.teamId] : [game.awayTeamId, game.homeTeamId];
  if (!teamIds.every((teamId) => [game.homeTeamId, game.awayTeamId].includes(teamId))) return empty;
  // Exact-game selection still needs nearby games for the picker and PP staleness counts.
  if (args.gameId) for (const teamId of teamIds) {
    for (const candidate of await fetchLineGames(supabase, { teamId, dateFrom: window.from, dateTo: window.to })) if (!games.some((known) => known.id === candidate.id)) games.push(candidate);
  }
  const started = game.phase === "live" || game.phase === "final";
  const [claims, entries, official] = await Promise.all([fetchLineClaims(supabase, teamIds, args.now, `${window.from}T00:00:00Z`),
    fetchEntryHistory(supabase, teamIds, games.map((candidate) => candidate.id)),
    controls.observations && started ? readOfficialPowerPlay(game) : undefined]);
  // Carry-forward origin games a windowed claim names but the window missed: one batched read.
  const neededGames = [...new Set(claims.flatMap((claim) => claim.gameId != null && !games.some((candidate) => candidate.id === claim.gameId) ? [claim.gameId] : []))];
  games.push(...await fetchLineGames(supabase, { gameIds: neededGames }));
  const memberships = controls.carryForward ? await fetchCarryMemberships(supabase, claims) : [];
  const teams = await Promise.all(teamIds.map(async (teamId) => {
    const scoped = claims.filter((claim) => claim.gameId === game.id && claim.teamId === teamId);
    const previous = await latestLineDecisions(supabase, game.id, teamId);
    const entry = previous.entry;
    const history = entries.filter((entry) => entry.teamId === teamId && entry.gameId !== game.id && entry.status !== "expected" && games.find((candidate) => candidate.id === entry.gameId)?.date! < game.date)
      .sort((a, b) => games.find((candidate) => candidate.id === b.gameId)!.date.localeCompare(games.find((candidate) => candidate.id === a.gameId)!.date) || b.revision - a.revision);
    const fallback = history[0];
    const activeTeamClaims = activeLineClaims(claims.filter(claim => claim.teamId === teamId));
    const active = activeTeamClaims.filter(claim => claim.gameId === game.id);
    const pp = reconcilePP({ game, teamId, games, claims, previous: previous.pp, now: args.now, carryForward: controls.carryForward, memberships });
    const shownBindings = pp.flatMap(decision => decision.selection?.claims ?? []).filter(selected =>
      eligibleClaim(selected) && !activeTeamClaims.some(other => other.gameId != null && other.gameId !== selected.gameId && sameReportedPP(selected, other)));
    const unresolved = claims.filter(claim => claim.teamId === teamId && (claim.gameId === game.id || claim.gameId == null) && !eligibleClaim(claim))
      .filter(claim => !(claim.gameId == null && claim.binding.status === "unresolved" && claim.reviewReasons.length > 0
        && claim.reviewReasons.every(reason => reason === "no_game_binding_evidence" || reason === "binding_decision_unverified")
        && shownBindings.some(selected => sameReportedPP(claim, selected)
          && (instant(selected.time.interpretedAt) ?? -Infinity) > (instant(claim.time.interpretedAt) ?? Infinity))));
    return { teamId, abbreviation: teamId === game.homeTeamId ? game.homeAbbreviation : game.awayAbbreviation,
      entry: entry ? publicEntry(entry) : null,
      entryRevisions: entries.filter((entry) => entry.gameId === game.id && entry.teamId === teamId).map(publicEntry),
      fallback: !entry?.units.length && fallback ? { gameId: fallback.gameId, date: games.find((candidate) => candidate.id === fallback.gameId)!.date, entry: publicEntry(fallback) } : null,
      officialPowerPlay: official ? official.filter(event => event.teamId === teamId) : official,
      // Practice and projected reports are never in-game adjustments.
      observations: controls.observations ? active.filter((claim) => claim.context !== "practice" && claim.context !== "projected" && !excludedAuthor(claim)
        && (["iga", "entry_correction"].includes(claim.kind) || claim.kind === "pp" && claim.phase === "in_game")).map(publicClaim) : [],
      history: controls.observations ? [...scoped, ...claims.filter((claim) => claim.teamId === teamId && claim.gameId == null)].map(publicClaim) : [],
      ppDefaults: pp.map((decision) => ({ ...decision, selection: decision.selection ? { ...decision.selection, claims: decision.selection.claims.map(publicClaim) } : null })),
      unresolved: [...unresolved.map((claim) => ({ claimId: claim.id, reasons: claim.reviewReasons.length ? claim.reviewReasons.map(scrubRelayHandles) : ["Evidence is not eligible for selection"] })),
        ...scoped.filter((claim) => claim.kind === "entry" && entry?.cutoff && (instant(claim.time.interpretedAt) ?? Infinity) > instant(entry.cutoff)!).map((claim) => ({ claimId: claim.id, reasons: ["Late entry evidence requires an explicit correction"] }))],
      conflicts: [...entry?.conflicts ?? [], ...pp.flatMap((decision) => decision.conflict ? [decision.conflict] : [])],
      feed: controls.observations ? buildSourceFeed(claims.filter((claim) => claim.teamId === teamId), game, args.now) : [],
    };
  }));
  const frozen = teams.filter((team) => team.entry && team.entry.status !== "expected");
  const entryView: EntryView = frozen.length ? { mode: "entering", frozenAt: frozen.map((team) => team.entry!.cutoff).filter(Boolean).sort()[0] ?? null,
    basis: "stored" } : { mode: started ? "unrecorded" : "expected", frozenAt: null, basis: null };
  return { enabled: true, mode: "snapshots", status: "ready", controls, game, games, teams, entryView };
}
