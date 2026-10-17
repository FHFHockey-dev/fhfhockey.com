import { getPrimaryTextForSource, type ParsedLinesCccSource } from "./linesCccIngestion";
import { crossCheckTweetSourceCoverage, tweetClaimAttribution, type TweetSourceCoverage } from "./tweetSourceDirectory";
import { easternReportDate } from "./projectedLineups";
import { extractTweetPlayerEvents } from "./tweetPlayerEvents";
import { TWEET_INTERPRETATION_VERSION, type TweetInterpretation } from "./tweetInterpretation";
import type { TweetClaimGame } from "./tweetClaimExtraction";
import type { TweetDatedIdentityEvidence } from "./tweetClaimEvidence";

/** Verified beat intervals narrow candidates; only independent dated roster/game evidence can qualify them. */
export async function applyTweetClaimSourceHints(db: any, sources: ParsedLinesCccSource[], directory: TweetSourceCoverage[],
  games: TweetClaimGame[], asOf: string) {
  const output: ParsedLinesCccSource[] = [], retainedGames = [...games];
  for (const source of sources) {
    if (source.team || !["accepted", "rejected_ambiguous"].includes(source.nhlFilterStatus)
      || source.nhlFilterStatus === "rejected_ambiguous" && source.nhlFilterReason !== "no_single_nhl_team_match"
      || source.detectedLeague && source.detectedLeague !== "NHL") { output.push(source); continue; }
    const attribution = tweetClaimAttribution(source), publishedAt = attribution.originalPublishedAt;
    const prior = crossCheckTweetSourceCoverage({ attribution, publishedAt, asOf, teamIds: [], league: "NHL", entries: directory });
    if (attribution.status !== "resolved" || !publishedAt || !Number.isFinite(Date.parse(publishedAt))
      || Date.parse(publishedAt) > Date.parse(asOf) || prior.status !== "consistent_prior" || prior.teamIds.length !== 1
      || !prior.leagues.includes("NHL")) { output.push(source); continue; }
    const text = getPrimaryTextForSource(source);
    if (!/\b(tonight|today|this (?:afternoon|evening))\b/i.test(text)) { output.push(source); continue; }
    const teamId = prior.teamIds[0]!, date = easternReportDate(publishedAt);
    const teams = await db.from("teams").select("id,name,abbreviation").in("id", [teamId]).limit(2);
    if (teams.error) throw teams.error;
    if (teams.data?.length !== 1) { output.push(source); continue; }
    // Incoming games contain only explicitly bound source IDs, not a complete schedule.
    const result = await db.from("games").select("id,date,startTime,homeTeamId,awayTeamId").eq("date", date)
      .or(`homeTeamId.eq.${teamId},awayTeamId.eq.${teamId}`).limit(3);
    if (result.error) throw result.error;
    const matches: TweetClaimGame[] = result.data ?? [];
    if (matches.length !== 1 || Date.parse(matches[0]!.startTime) <= Date.parse(publishedAt)) { output.push(source); continue; }
    const game = matches[0]!;
    const proof = await db.rpc("read_tweet_claim_dated_roster", { p_game: game.id, p_asof: publishedAt });
    if (proof.error) throw proof.error;
    const roster = (proof.data as TweetDatedIdentityEvidence[] ?? []).filter(row => row.teamId === teamId);
    const events = extractTweetPlayerEvents({ text, players: roster.map(row => ({ playerId: row.playerId, teamId,
      fullName: row.fullName, lastName: row.fullName.split(" ").at(-1)!, position: row.role === "goalie" ? "G" : "F" })),
      publishedAt, includeClaimAnchors: true, claimAware: true });
    if (!events.length) { output.push(source); continue; }
    const old = source.metadata?.interpretation as TweetInterpretation | undefined;
    // Existing structured-unit exceptions are not erased by resolving an event.
    const unresolved = (old?.unresolved ?? []).filter(span => span.reason === "invalid_extraction" || !events.some(event =>
      event.claimAnchor && event.claimAnchor.subjectSpan.start <= span.start && event.claimAnchor.subjectSpan.end >= span.end));
    const retainedEvents = (old?.events ?? []).filter(event => !events.some(next => next.playerId === event.playerId
      && next.evidence.start === event.evidence.start && next.evidence.end === event.evidence.end));
    const interpretation: TweetInterpretation = { ...old, version: old?.version ?? TWEET_INTERPRETATION_VERSION, units: old?.units ?? [],
      unresolved, context: "game", certainty: old?.certainty ?? "reported", events: [...events, ...retainedEvents] };
    output.push({ ...source, team: teams.data[0], gameId: game.id, detectedLeague: "NHL", nhlFilterStatus: "accepted", nhlFilterReason: null,
      metadata: { ...source.metadata, interpretation, tweetSourceDirectoryHint: { teamId, entryIds: [...prior.entryIds].sort(),
        status: "consistent_prior", bindingAuthority: false, originalFilterStatus: source.nhlFilterStatus,
        originalFilterReason: source.nhlFilterReason ?? null } } });
    const retainedIndex = retainedGames.findIndex(existing => existing.id === game.id);
    if (retainedIndex === -1) retainedGames.push(game);
    else retainedGames[retainedIndex] = game;
  }
  return { sources: output, games: retainedGames };
}
