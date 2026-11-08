import { fetchAllSupabasePages, fetchAllSupabaseFilterChunks } from "lib/supabase/pagination";
import { sanitizePublicNewsText } from "lib/newsFeed";
import { verifiedOriginalTweetUrl } from "lib/sources/projectedLineups";
import { isRelayAccount, scrubRelayHandles } from "./authority";
import { activeLineClaims, captureIdentity, eligibleClaim, reconcileEntry, reconcilePP } from "./reconcile";
import { chooseDefaultGame, observeLineGame, stateAtRead, trustworthyState } from "./gameState";
import { fetchCarryMemberships, fetchEntryHistory, fetchLineClaims, latestLineDecisions } from "./storage";
import { instant, lineSnapshotFlags, type EntryRevision, type EntryView, type GameLinesResponse, type LineClaim, type LineGame, type SelectedLineUnit, type SourceFeedItem } from "./types";

/** `dateFrom` / `dateTo` (YYYY-MM-DD, inclusive) bound the processor's read; readers omit them. */
export async function fetchLineGames(supabase: any, args: { teamId?: number; gameId?: number; dateFrom?: string; dateTo?: string }): Promise<LineGame[]> {
  const rows = await fetchAllSupabasePages<any>(({ from, to }) => {
    let query = supabase.from("games").select("id,date,startTime,homeTeamId,awayTeamId,home:teams!games_homeTeamId_fkey(abbreviation),away:teams!games_awayTeamId_fkey(abbreviation)");
    if (args.teamId) query = query.or(`homeTeamId.eq.${args.teamId},awayTeamId.eq.${args.teamId}`);
    else if (args.gameId) query = query.eq("id", args.gameId);
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
 * (line_game_state_history). A schedule amendment invalidates the stored state, as in hydrateLineGameStates.
 */
export async function latestLineGameStates(supabase: any, games: LineGame[]): Promise<LineGame[]> {
  return Promise.all(games.map(async (game) => {
    const result = await supabase.from("line_game_state_observations").select("payload").eq("game_id", game.id).order("observed_at", { ascending: false }).limit(1);
    if (result.error) throw result.error;
    const state = result.data?.[0]?.payload as LineGame | undefined;
    return state && state.scheduledStart === game.scheduledStart ? { ...game, ...state } : game;
  }));
}

export async function hydrateLineGameStates(supabase: any, games: LineGame[], now: string): Promise<LineGame[]> {
  if (!games.length) return [];
  const rows = await fetchAllSupabaseFilterChunks<{ payload: LineGame }, number>(games.map((game) => game.id), (ids, { from, to }) => supabase.from("line_game_state_observations").select("payload")
    .in("game_id", ids).order("observed_at", { ascending: false }).order("state_id").range(from, to));
  const latest = new Map<number, LineGame>();
  for (const row of rows) if (!latest.has(row.payload.id)) latest.set(row.payload.id, row.payload);
  return games.map((game) => {
    const state = latest.get(game.id);
    // Database schedule amendments invalidate the earlier state/binding identity.
    return state && state.scheduledStart === game.scheduledStart ? stateAtRead({ ...game, ...state }, now) : game;
  });
}

/** Relay accounts never reach the site surface: every public string field is scrubbed of them. */
export function publicClaim(claim: LineClaim): LineClaim {
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
    unit: claim.unit ? { ...claim.unit, evidence: claim.unit.evidence.map((span) => ({ ...span, text: sanitize(span.text) })) } : null,
    relationship: claim.relationship ? { ...claim.relationship, evidence: { ...claim.relationship.evidence, text: sanitize(claim.relationship.evidence.text) } } : null };
}
const FEED_WINDOW_MS = 2 * 86400000;
const excludedAuthor = (claim: LineClaim) => claim.authorityTier === "excluded" || claim.reviewReasons.includes("author_excluded");

/** Raw captures for one team and game, one item per original post with its relays collapsed under it. */
export function buildSourceFeed(claims: LineClaim[], game: LineGame, now: string): SourceFeedItem[] {
  const start = (instant(game.scheduledStart) ?? instant(`${game.date}T12:00:00Z`)!) - FEED_WINDOW_MS, end = instant(now) ?? -Infinity;
  const scoped = claims.filter((claim) => !excludedAuthor(claim) && (instant(claim.time.ingestedAt) ?? Infinity) <= end
    && (claim.gameId === game.id || claim.gameId == null && (instant(claim.time.ingestedAt) ?? -Infinity) >= start));
  const identity = captureIdentity(claims);
  const groups = new Map<string, LineClaim[]>();
  for (const claim of scoped) groups.set(identity(claim), [...groups.get(identity(claim)) ?? [], claim]);
  return [...groups.entries()].map(([id, group]) => {
    const ordered = [...group].sort((a, b) => Number(b.provenance?.attributionStatus === "resolved") - Number(a.provenance?.attributionStatus === "resolved")
      || (instant(b.time.interpretedAt) ?? 0) - (instant(a.time.interpretedAt) ?? 0) || a.id.localeCompare(b.id));
    const representative = ordered[0]!, shown = publicClaim(representative);
    const bound = ordered.find((claim) => claim.binding.status === "bound") ?? representative;
    const relays = new Map<string, SourceFeedItem["relays"][number]>();
    for (const claim of ordered) if (claim.relayAccount) {
      const key = `${claim.relayAccount}:${claim.provenance?.relayTweetId ?? ""}`;
      if (!relays.has(key)) relays.set(key, { account: null, relayTweetId: claim.provenance?.relayTweetId ?? null, relayPublishedAt: claim.time.relayPublishedAt, ingestedAt: claim.time.ingestedAt });
    }
    return { id, originalIdentity: shown.originalIdentity, originalAuthor: ordered.find((claim) => claim.originalAuthor && !isRelayAccount(claim.originalAuthor))?.originalAuthor
        ?? (shown.sourceUrl && !isRelayAccount(shown.author) ? shown.author : null),
      authorityTier: representative.authorityTier ?? "unknown", relays: [...relays.values()], text: shown.text,
      publishedAt: representative.time.originalPublishedAt ?? representative.time.relayPublishedAt,
      ingestedAt: ordered.map((claim) => claim.time.ingestedAt).sort()[0]!,
      binding: { status: bound.binding.status, gameId: bound.gameId, evidence: bound.binding.evidence },
      context: representative.context ?? null, claimIds: group.map((claim) => claim.id).sort(), sourceUrl: shown.sourceUrl };
  }).sort((a, b) => (instant(b.publishedAt ?? b.ingestedAt) ?? 0) - (instant(a.publishedAt ?? a.ingestedAt) ?? 0) || a.id.localeCompare(b.id));
}

function publicUnits(units: SelectedLineUnit[]) { return units.map((unit) => ({ ...unit, claims: unit.claims.map(publicClaim) })); }
function publicEntry(entry: EntryRevision): EntryRevision { return { ...entry, units: publicUnits(entry.units), evidenceClaims: entry.evidenceClaims?.map(publicClaim) }; }

export async function readGameLines(supabase: any, args: { teamId?: number; gameId?: number; now: string }): Promise<GameLinesResponse> {
  const controls = lineSnapshotFlags();
  const empty: GameLinesResponse = { enabled: controls.entryServing, mode: "snapshots", status: controls.entryServing ? "no_game" : "disabled", controls, game: null, games: [], teams: [],
    entryView: { mode: "expected", frozenAt: null, basis: null } };
  if (!controls.entryServing || !args.teamId && !args.gameId) return empty;
  let games = await hydrateLineGameStates(supabase, await fetchLineGames(supabase, args), args.now);
  if (args.gameId && !games.some((game) => game.id === args.gameId)) return empty;
  // Read current state for the explicit game and near-term schedule candidates. Never writes on GET.
  const today = args.now.slice(0, 10);
  const candidates = args.gameId ? games.filter((game) => game.id === args.gameId)
    : games.filter((game) => game.date >= new Date(instant(args.now)! - 86400000).toISOString().slice(0, 10) && game.date <= today)
      .concat([...games].filter((game) => game.date > today).sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id).slice(0, 1));
  const observations = await Promise.all(candidates.map((game) => observeLineGame(game, args.now)));
  const states = new Map(observations.map((game) => [game.id, game]));
  games = games.map((game) => states.get(game.id) ?? game);
  const game = args.gameId ? games.find((game) => game.id === args.gameId)! : chooseDefaultGame(games, args.now);
  if (!game) return { ...empty, games };
  const teamIds = args.teamId ? [args.teamId] : [game.awayTeamId, game.homeTeamId];
  if (!teamIds.every((teamId) => [game.homeTeamId, game.awayTeamId].includes(teamId))) return empty;
  const [claims, entries] = await Promise.all([fetchLineClaims(supabase, teamIds, args.now), fetchEntryHistory(supabase, teamIds)]);
  // Carry-forward needs the origin games even when reading the two-team game route.
  const neededGames = [...new Set(claims.flatMap((claim) => claim.gameId != null && !games.some((candidate) => candidate.id === claim.gameId) ? [claim.gameId] : []))];
  for (const id of neededGames) games.push(...await hydrateLineGameStates(supabase, await fetchLineGames(supabase, { gameId: id }), args.now));
  // PP staleness counts the team's games; the game route loaded only this game.
  if (args.gameId && controls.carryForward) for (const teamId of teamIds) {
    for (const candidate of await fetchLineGames(supabase, { teamId })) if (!games.some((known) => known.id === candidate.id)) games.push(candidate);
  }
  const memberships = controls.carryForward ? await fetchCarryMemberships(supabase, claims) : [];
  // Read-time freeze: once the NHL state reads live, compute the entering lineup in memory. No writes on GET.
  const canFreeze = trustworthyState(game, args.now) && (game.phase === "live" || game.phase === "final" && instant(game.actualStart) != null);
  const teams = await Promise.all(teamIds.map(async (teamId) => {
    const scoped = claims.filter((claim) => claim.gameId === game.id && claim.teamId === teamId);
    const previous = await latestLineDecisions(supabase, game.id, teamId);
    const storedFrozen = !!previous.entry && previous.entry.status !== "expected";
    const entry = !storedFrozen && canFreeze ? reconcileEntry({ game, teamId, claims, previous: previous.entry, now: args.now }) : previous.entry;
    const entryBasis: EntryView["basis"] = storedFrozen ? "stored" : entry && entry !== previous.entry ? "read_time" : null;
    const history = entries.filter((entry) => entry.teamId === teamId && entry.gameId !== game.id && entry.status !== "expected" && games.find((candidate) => candidate.id === entry.gameId)?.date! < game.date)
      .sort((a, b) => games.find((candidate) => candidate.id === b.gameId)!.date.localeCompare(games.find((candidate) => candidate.id === a.gameId)!.date) || b.revision - a.revision);
    const fallback = history[0];
    const active = activeLineClaims(scoped);
    const pp = reconcilePP({ game, teamId, games, claims, previous: previous.pp, now: args.now, carryForward: controls.carryForward, memberships });
    return { entryBasis, teamId, abbreviation: teamId === game.homeTeamId ? game.homeAbbreviation : game.awayAbbreviation,
      entry: entry ? publicEntry(entry) : null,
      entryRevisions: entries.filter((entry) => entry.gameId === game.id && entry.teamId === teamId).map(publicEntry),
      fallback: !entry?.units.length && fallback ? { gameId: fallback.gameId, date: games.find((candidate) => candidate.id === fallback.gameId)!.date, entry: publicEntry(fallback) } : null,
      // Practice and projected reports are never in-game adjustments.
      observations: controls.observations ? active.filter((claim) => claim.context !== "practice" && claim.context !== "projected" && !excludedAuthor(claim)
        && (["iga", "entry_correction"].includes(claim.kind) || claim.kind === "pp" && claim.phase === "in_game")).map(publicClaim) : [],
      history: controls.observations ? [...scoped, ...claims.filter((claim) => claim.teamId === teamId && claim.gameId == null)].map(publicClaim) : [],
      ppDefaults: pp.map((decision) => ({ ...decision, selection: decision.selection ? { ...decision.selection, claims: decision.selection.claims.map(publicClaim) } : null })),
      unresolved: [...claims.filter((claim) => claim.teamId === teamId && (claim.gameId === game.id || claim.gameId == null) && !eligibleClaim(claim)).map((claim) => ({ claimId: claim.id, reasons: claim.reviewReasons.length ? claim.reviewReasons.map(scrubRelayHandles) : ["Evidence is not eligible for selection"] })),
        ...scoped.filter((claim) => claim.kind === "entry" && entry?.cutoff && (instant(claim.time.interpretedAt) ?? Infinity) > instant(entry.cutoff)!).map((claim) => ({ claimId: claim.id, reasons: ["Late entry evidence requires an explicit correction"] }))],
      conflicts: [...entry?.conflicts ?? [], ...pp.flatMap((decision) => decision.conflict ? [decision.conflict] : [])],
      feed: controls.observations ? buildSourceFeed(claims.filter((claim) => claim.teamId === teamId), game, args.now) : [],
    };
  }));
  const frozen = teams.filter((team) => team.entry && team.entry.status !== "expected");
  const entryView: EntryView = frozen.length ? { mode: "entering", frozenAt: frozen.map((team) => team.entry!.cutoff).filter(Boolean).sort()[0] ?? null,
    basis: frozen.every((team) => team.entryBasis === "stored") ? "stored" : "read_time" } : { mode: "expected", frozenAt: null, basis: null };
  return { enabled: true, mode: "snapshots", status: "ready", controls, game, games, teams: teams.map(({ entryBasis: _basis, ...team }) => team), entryView };
}
