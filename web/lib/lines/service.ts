import { fetchAllSupabasePages, fetchAllSupabaseFilterChunks } from "lib/supabase/pagination";
import { sanitizePublicNewsText } from "lib/newsFeed";
import { verifiedOriginalTweetUrl } from "lib/sources/projectedLineups";
import { activeLineClaims, eligibleClaim, reconcilePP } from "./reconcile";
import { chooseDefaultGame, observeLineGame, stateAtRead } from "./gameState";
import { fetchEntryHistory, fetchLineClaims, latestLineDecisions } from "./storage";
import { instant, lineSnapshotFlags, type EntryRevision, type GameLinesResponse, type LineClaim, type LineGame, type SelectedLineUnit } from "./types";

export async function fetchLineGames(supabase: any, args: { teamId?: number; gameId?: number }): Promise<LineGame[]> {
  const rows = await fetchAllSupabasePages<any>(({ from, to }) => {
    let query = supabase.from("games").select("id,date,startTime,homeTeamId,awayTeamId,home:teams!games_homeTeamId_fkey(abbreviation),away:teams!games_awayTeamId_fkey(abbreviation)");
    if (args.teamId) query = query.or(`homeTeamId.eq.${args.teamId},awayTeamId.eq.${args.teamId}`);
    else if (args.gameId) query = query.eq("id", args.gameId);
    return query.order("date", { ascending: false }).order("id").range(from, to);
  });
  return rows.map((row) => ({ id: row.id, date: row.date, homeTeamId: row.homeTeamId, awayTeamId: row.awayTeamId,
    homeAbbreviation: row.home?.abbreviation ?? String(row.homeTeamId), awayAbbreviation: row.away?.abbreviation ?? String(row.awayTeamId),
    scheduledStart: instant(row.startTime) == null ? null : row.startTime, phase: "unknown", actualStart: null, observedAt: null,
    stateSource: null, scheduleIdentity: `${row.id}:${row.startTime ?? row.date}:OK`, replacesGameId: null }));
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

function publicClaim(claim: LineClaim): LineClaim {
  const sanitize = sanitizePublicNewsText;
  return { ...claim, provenance: undefined, text: claim.text.split("\n").map(sanitize).join("\n"), sourceUrl: verifiedOriginalTweetUrl(claim.sourceUrl),
    unit: claim.unit ? { ...claim.unit, evidence: claim.unit.evidence.map((span) => ({ ...span, text: sanitize(span.text) })) } : null,
    relationship: claim.relationship ? { ...claim.relationship, evidence: { ...claim.relationship.evidence, text: sanitize(claim.relationship.evidence.text) } } : null };
}
function publicUnits(units: SelectedLineUnit[]) { return units.map((unit) => ({ ...unit, claims: unit.claims.map(publicClaim) })); }
function publicEntry(entry: EntryRevision): EntryRevision { return { ...entry, units: publicUnits(entry.units), evidenceClaims: entry.evidenceClaims?.map(publicClaim) }; }

export async function readGameLines(supabase: any, args: { teamId?: number; gameId?: number; now: string }): Promise<GameLinesResponse> {
  const controls = lineSnapshotFlags();
  const empty: GameLinesResponse = { enabled: controls.entryServing, mode: "snapshots", status: controls.entryServing ? "no_game" : "disabled", controls, game: null, games: [], teams: [] };
  if (!controls.entryServing) return empty;
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
  const teams = await Promise.all(teamIds.map(async (teamId) => {
    const scoped = claims.filter((claim) => claim.gameId === game.id && claim.teamId === teamId);
    const previous = await latestLineDecisions(supabase, game.id, teamId);
    const history = entries.filter((entry) => entry.teamId === teamId && entry.gameId !== game.id && entry.status !== "expected" && games.find((candidate) => candidate.id === entry.gameId)?.date! < game.date)
      .sort((a, b) => games.find((candidate) => candidate.id === b.gameId)!.date.localeCompare(games.find((candidate) => candidate.id === a.gameId)!.date) || b.revision - a.revision);
    const fallback = history[0];
    const active = activeLineClaims(scoped);
    const pp = reconcilePP({ game, teamId, games, claims, previous: previous.pp, now: args.now, carryForward: controls.carryForward });
    return { teamId, abbreviation: teamId === game.homeTeamId ? game.homeAbbreviation : game.awayAbbreviation,
      entry: previous.entry ? publicEntry(previous.entry) : null,
      entryRevisions: entries.filter((entry) => entry.gameId === game.id && entry.teamId === teamId).map(publicEntry),
      fallback: !previous.entry?.units.length && fallback ? { gameId: fallback.gameId, date: games.find((candidate) => candidate.id === fallback.gameId)!.date, entry: publicEntry(fallback) } : null,
      observations: controls.observations ? active.filter((claim) => ["iga", "entry_correction"].includes(claim.kind) || claim.kind === "pp" && claim.phase === "in_game").map(publicClaim) : [],
      history: controls.observations ? [...scoped, ...claims.filter((claim) => claim.teamId === teamId && claim.gameId == null)].map(publicClaim) : [],
      ppDefaults: pp.map((decision) => ({ ...decision, selection: decision.selection ? { ...decision.selection, claims: decision.selection.claims.map(publicClaim) } : null })),
      unresolved: [...claims.filter((claim) => claim.teamId === teamId && (claim.gameId === game.id || claim.gameId == null) && !eligibleClaim(claim)).map((claim) => ({ claimId: claim.id, reasons: claim.reviewReasons.length ? claim.reviewReasons : ["Evidence is not eligible for selection"] })),
        ...scoped.filter((claim) => claim.kind === "entry" && previous.entry?.cutoff && (instant(claim.time.interpretedAt) ?? Infinity) > instant(previous.entry.cutoff)!).map((claim) => ({ claimId: claim.id, reasons: ["Late entry evidence requires an explicit correction"] }))],
      conflicts: [...previous.entry?.conflicts ?? [], ...pp.flatMap((decision) => decision.conflict ? [decision.conflict] : [])],
    };
  }));
  return { enabled: true, mode: "snapshots", status: "ready", controls, game, games, teams };
}
