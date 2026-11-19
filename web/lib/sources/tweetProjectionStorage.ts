import { createHash } from "node:crypto";
import type { ParsedLinesCccSource } from "./linesCccIngestion";
import { getPrimaryTextForSource, isDisputedRetainedProjectionSubject, toLinesCccRow } from "./linesCccIngestion";
import { tweetPipelineFlags, type TweetInterpretation } from "./tweetInterpretation";
import { easternReportDate, explicitPracticeSession, publicProjectionReport, selectProjectedUnitSets, verifiedOriginalTweetUrl, type ProjectionReport, type ProjectedUnitSet } from "./projectedLineups";
import { fetchAllSupabasePages } from "lib/supabase/pagination";
import { classifyInjuryEvent } from "./tweetPlayerEvents";
import { capturePlayerForecastSourceRows, type ForecastLineSourceRow } from "lib/player-forecasts/sourceObservations";
import { persistTweetClaimSources } from "./tweetClaimRegistry";
import { isRelayAccount } from "lib/lines/authority";
import { compareInterpretationVersions, isDatedInterpretationVersion } from "./interpretationVersion";

export function projectedSetsToForecastRows(sets: ProjectedUnitSet[]): ForecastLineSourceRow[] {
  const groups = new Map<string, ProjectedUnitSet[]>();
  for (const set of sets) {
    const report = set.reports[0]!;
    if (!report.gameId || set.group || report.interpretation.context !== "game") continue;
    const key = `${report.gameId}:${report.teamId}`;
    groups.set(key, [...(groups.get(key) ?? []), set]);
  }
  return [...groups.entries()].map(([key, values]) => {
    const reports = [...new Map(values.flatMap((set) => set.reports).map((report) => [report.key, report])).values()];
    reports.sort((a, b) => Date.parse(b.publishedAt!) - Date.parse(a.publishedAt!));
    const latest = reports[0]!;
    const interpretation: TweetInterpretation = { ...latest.interpretation, formation: values.find((set) => set.situation === "es")?.reports[0]?.interpretation.formation, units: values.flatMap((set) => set.units), events: [], unresolved: [] };
    const base = toLinesCccRow({ source: { snapshotDate: latest.date, team: { id: latest.teamId, abbreviation: latest.teamAbbreviation } as any,
      gameId: latest.gameId, nhlFilterStatus: "accepted", classification: "lineup", rawText: latest.text, tweetPostedAt: latest.publishedAt,
      observedAt: reports.map((report) => report.receivedAt).sort().at(-1), metadata: { interpretation } }, rosterEntries: [] });
    return { ...base, capture_key: `projection:${key}:${createHash("sha256").update(reports.map((report) => report.key).sort().join(":")).digest("hex")}`,
      source_group: "tweet_projection", source_key: "validated_units", source_account: null, source_url: latest.originalUrl,
      metadata: { interpretation, projectionReports: reports, situationReports: values.map((set) => ({ situation: set.situation, publishedAt: set.publishedAt, originals: set.reports.map((report) => report.originalUrl) })) },
    } as ForecastLineSourceRow;
  });
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).filter(([, item]) => item !== undefined)
    .sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(",")}}`;
  return JSON.stringify(value);
}

function projectionProvenanceJson(payload: any): string {
  // Raw source storage refreshes updated_at on retry; it is not an evidence version.
  return canonicalJson({ ...payload, sources: payload.sources.map(({ table, snapshot }: any) => {
    const { updated_at: _updatedAt, ...evidence } = snapshot;
    return { table, snapshot: evidence };
  }) });
}

function retainedOriginalIdentityMatches(snapshot: any, report: ProjectionReport): boolean {
  const usesQuote = snapshot.primary_text_source === "quoted_oembed";
  const originalUrl = usesQuote
    ? verifiedOriginalTweetUrl(snapshot.quoted_tweet_url ?? null, snapshot.quoted_author_handle)
    : verifiedOriginalTweetUrl(snapshot.source_url ?? null);
  if (originalUrl?.toLowerCase() !== report.originalUrl?.toLowerCase()) return false;
  const originalId = originalUrl?.match(/\/status\/(\d+)$/)?.[1] ?? null;
  if (report.provenance?.originalTweetId !== originalId
    || report.provenance?.attributionStatus !== (originalUrl ? "resolved" : "pending")) return false;
  const originalPublishedAt = usesQuote || originalUrl ? report.publishedAt : null;
  if (originalPublishedAt == null ? report.originalPublishedAt != null
    : report.originalPublishedAt == null || Date.parse(report.originalPublishedAt) !== Date.parse(originalPublishedAt)) return false;
  // Direct original reports identify the relay itself; quoted reports identify a separate source.
  if (!usesQuote && originalId && originalId !== snapshot.tweet_id) return false;
  if (usesQuote && originalUrl) {
    if (originalId === snapshot.tweet_id) return false;
    const author = snapshot.quoted_author_handle?.replace(/^@/, "");
    if (!author || !/^[A-Za-z0-9_]{1,15}$/.test(author)
      || author.toLowerCase() !== new URL(originalUrl).pathname.split("/")[1]!.toLowerCase()) return false;
    if (snapshot.quoted_tweet_id != null && snapshot.quoted_tweet_id !== originalId) return false;
  }
  // A known retained URL ID may not contradict the relay/quote IDs, even when attribution is pending.
  const urlTweetId = (value: string | null | undefined) => {
    if (!value) return null;
    try { const url = new URL(value); return /^(?:www\.)?(?:x|twitter)\.com$/i.test(url.hostname)
      ? url.pathname.match(/^\/[A-Za-z0-9_]+\/(?:web\/)?status\/(\d+)$/)?.[1] ?? null : null; } catch { return null; }
  };
  for (const value of [snapshot.source_url, snapshot.tweet_url]) {
    const id = urlTweetId(value);
    if (id && id !== snapshot.tweet_id) return false;
    const verified = !usesQuote && verifiedOriginalTweetUrl(value ?? null);
    if (verified && verified.toLowerCase() !== report.originalUrl?.toLowerCase()) return false;
  }
  const quotedId = urlTweetId(snapshot.quoted_tweet_url);
  return !usesQuote || snapshot.quoted_tweet_id == null || !quotedId || snapshot.quoted_tweet_id === quotedId;
}

type ProjectedEvent = { report: ProjectionReport; kind: "goalie" | "injury" };

function retainedEventRow({ report, kind }: ProjectedEvent, original: any): ForecastLineSourceRow {
  const events = report.interpretation.events!.filter((event) => event.kind === kind && (event.teamId == null || event.teamId === report.teamId));
  // Recreate the compatibility columns from the relay that won the immutable report.
  // A later relay of that original may have different wrapper text, labels, or matched names.
  const base = toLinesCccRow({ source: {
    snapshotDate: report.date, team: { id: report.teamId, abbreviation: report.teamAbbreviation, name: original.team_name } as any,
    gameId: report.gameId, tweetPostedAt: report.publishedAt, tweetPostedLabel: original.tweet_posted_label,
    observedAt: report.receivedAt, sourceLabel: original.source_label, classification: original.classification,
    detectedLeague: original.detected_league, nhlFilterStatus: original.nhl_filter_status, nhlFilterReason: original.nhl_filter_reason,
    rawText: original.raw_text, enrichedText: original.enriched_text,
    quotedRawText: original.quoted_raw_text, quotedEnrichedText: original.quoted_enriched_text,
    keywordHits: original.keyword_hits, matchedNames: original.matched_player_names,
    matchedPlayerIds: original.matched_player_ids, unmatchedNames: original.unmatched_names,
    goalies: [original.goalie_1_name, original.goalie_2_name], injuries: original.injured_player_names,
    scratches: original.scratches_player_names, metadata: { interpretation: report.interpretation },
  } });
  return { ...base, capture_key: `${report.key}:${kind}`, source_group: "tweet_projection", source_key: "validated_events",
    source_account: validatedEventReporter({ quotedAuthorHandle: original.quoted_author_handle }, report), source_url: report.originalUrl,
    observed_at: report.receivedAt, tweet_posted_at: report.publishedAt, classification: kind === "goalie" ? "goalie_start" : "injury",
    ...(kind === "goalie" ? {
      goalie_1_player_id: events[0]?.playerId ?? null, goalie_1_name: events[0]?.playerName ?? null,
      goalie_2_player_id: events[1]?.playerId ?? null, goalie_2_name: events[1]?.playerName ?? null,
    } : {}),
    metadata: { projectionReports: [report], interpretation: { ...report.interpretation, units: [], events } },
  };
}

/** Retain a versioned derivation, not a fabricated original tweet, before publishing children. */
async function persistProjectionSourceSnapshots(supabase: any, unitRows: ForecastLineSourceRow[], events: ProjectedEvent[]): Promise<ForecastLineSourceRow[]> {
  const reports = [...new Map([...unitRows.flatMap((row) => row.metadata?.projectionReports as ProjectionReport[]), ...events.map((event) => event.report)]
    .map((report) => [report.key, report])).values()];
  const tweetIds = [...new Set(reports.map((report) => report.provenance?.relayTweetId).filter((id): id is string => Boolean(id)))];
  if (reports.some((report) => !report.provenance?.relayTweetId)) throw new Error("Projection source lineage is missing its retained relay tweet.");
  const sources: Array<{ table: string; snapshot: any }> = [];
  for (const table of ["line_source_snapshots", "lines_ccc"]) {
    const retained = await fetchAllSupabasePages<any>(({ from, to }) => supabase.from(table).select("*")
      .in("tweet_id", tweetIds).order("capture_key", { ascending: true }).range(from, to));
    sources.push(...retained.map((snapshot) => ({ table, snapshot })));
  }
  const lineage = new Map(reports.map((report) => {
    const matches = sources.filter(({ snapshot }) => snapshot.tweet_id === report.provenance!.relayTweetId
      && snapshot.team_id === report.teamId && snapshot.game_id === report.gameId && snapshot.snapshot_date === report.date
      && snapshot.nhl_filter_status === "accepted" && snapshot.status === "observed"
      && (snapshot.primary_text_source === "quoted_oembed" ? snapshot.quoted_enriched_text ?? snapshot.quoted_raw_text ?? ""
        : snapshot.enriched_text ?? snapshot.raw_text ?? "") === report.text
      && Date.parse(snapshot.observed_at) === Date.parse(report.receivedAt)
      && Date.parse(snapshot.tweet_posted_at) === Date.parse(report.publishedAt!)
      && retainedOriginalIdentityMatches(snapshot, report)
      && canonicalJson(snapshot.metadata?.interpretation) === canonicalJson(report.interpretation));
    if (matches.length !== 1) throw new Error(`Projection source lineage is missing or ambiguous for report ${report.key}.`);
    return [report.key, matches[0]!] as const;
  }));
  const rows = [...unitRows, ...events.map((event) => retainedEventRow(event, lineage.get(event.report.key)!.snapshot))];
  const snapshots = rows.map((row) => {
    const contributing = row.metadata!.projectionReports as ProjectionReport[];
    const original = lineage.get(contributing[0]!.key)!.snapshot;
    const rawPayload = { derivation: "tweet-projection-v1", reports: contributing,
      sources: contributing.map((report) => lineage.get(report.key)) };
    return { ...row, source: "tweet_projection", source_account: "tweet_projection",
      team_name: original.team_name, team_abbreviation: original.team_abbreviation,
      // Tweet IDs and author fields belong to the retained originals in raw_payload.
      source_handle: null, author_name: null,
      tweet_id: null, tweet_url: null, quoted_tweet_id: null, quoted_tweet_url: null,
      quoted_author_handle: null, quoted_author_name: null, primary_text_source: null,
      raw_payload: rawPayload, metadata: { ...row.metadata, derived: true, sourceAccountKind: "internal_derivation",
        provenanceHash: createHash("sha256").update(projectionProvenanceJson(rawPayload)).digest("hex") },
    };
  });
  const write = await supabase.from("line_source_snapshots").upsert(snapshots, { onConflict: "capture_key", ignoreDuplicates: true });
  if (write.error) throw write.error;
  const readback = await supabase.from("line_source_snapshots").select("*").in("capture_key", snapshots.map((row) => row.capture_key));
  if (readback.error) throw readback.error;
  return snapshots.map((expected) => {
    const retained = readback.data?.filter((row: any) => row.capture_key === expected.capture_key);
    if (retained?.length !== 1) throw new Error(`Projection source readback missing for ${expected.capture_key}.`);
    const actual = retained[0];
    const conflicts = Object.entries(expected).some(([key, value]) => {
      if (key === "updated_at") return false;
      if (key === "raw_payload") return !Array.isArray(actual.raw_payload?.sources)
        || projectionProvenanceJson(actual.raw_payload) !== projectionProvenanceJson(value);
      if (["observed_at", "tweet_posted_at"].includes(key) && value != null) return Date.parse(actual[key]) !== Date.parse(String(value));
      return canonicalJson(actual[key]) !== canonicalJson(value);
    });
    if (conflicts) {
      throw new Error(`Projection source version conflict for ${expected.capture_key}.`);
    }
    // Catalog identity names the derivation; preserve the child's existing reporter attribution.
    const child = rows.find((row) => row.capture_key === expected.capture_key)!;
    const report = (child.metadata!.projectionReports as ProjectionReport[])[0]!;
    const original = lineage.get(report.key)!.snapshot;
    const usesQuote = child.source_key === "validated_events" && original.primary_text_source === "quoted_oembed";
    return { ...actual, source_account: child.source_account, primary_text_source: usesQuote ? "quoted_oembed" : null,
      quoted_tweet_url: usesQuote ? report.originalUrl : null,
      quoted_author_handle: usesQuote && report.originalUrl ? original.quoted_author_handle : null } as ForecastLineSourceRow;
  });
}

/** Only facts published before this report may inform injury history. */
export async function enrichTweetInjuryHistory(supabase: any, sources: ParsedLinesCccSource[]) {
  if (!tweetPipelineFlags().interpretation) return;
  for (const source of sources) {
    const interpretation = source.metadata?.interpretation as TweetInterpretation | undefined;
    if (!interpretation?.events?.length || !source.tweetPostedAt || source.nhlFilterStatus !== "accepted") continue;
    for (const event of interpretation.events.filter((event) => event.kind === "injury")) {
      const { data, error } = await supabase.from("tweet_player_events").select("availability,published_at")
        .eq("player_id", event.playerId).lt("published_at", source.tweetPostedAt)
        .in("availability", ["out", "available"])
        .or("payload->>availabilityScope.is.null,payload->>availabilityScope.neq.game").order("published_at", { ascending: false }).limit(2);
      if (error) throw error;
      const conflictingHistory = data?.length > 1 && data[0].published_at === data[1].published_at && data[0].availability !== data[1].availability;
      if (conflictingHistory && !event.reviewReason) event.reviewReason = "conflicting_history";
      let previous: "injured" | "healthy" | undefined = conflictingHistory ? undefined : data?.[0]?.availability === "out" ? "injured" : data?.[0]?.availability === "available" ? "healthy" : undefined;
      if (!previous && !conflictingHistory) {
        const history = await supabase.from("player_status_history").select("status_state,status_expires_at")
          .eq("player_id", event.playerId).lt("observed_at", source.tweetPostedAt).order("observed_at", { ascending: false }).limit(1);
        if (history.error) throw history.error;
        const status = history.data?.[0];
        if (status?.status_state === "injured" && (!status.status_expires_at || Date.parse(status.status_expires_at) > Date.parse(source.tweetPostedAt))) previous = "injured";
      }
      if (event.reviewReason !== "conflicting_claims") event.state = classifyInjuryEvent(event.evidence.text, previous);
    }
  }
}

export function projectionReportFromSource(source: ParsedLinesCccSource): ProjectionReport | null {
  const interpretation = source.metadata?.interpretation as TweetInterpretation | undefined;
  if (!interpretation || !source.team || source.nhlFilterStatus !== "accepted") return null;
  const text = getPrimaryTextForSource(source);
  const usesOriginal = source.primaryTextSource === "quoted_oembed";
  const originalUrl = usesOriginal
    ? verifiedOriginalTweetUrl(source.quotedTweetUrl ?? null, source.quotedAuthorHandle)
    : verifiedOriginalTweetUrl(source.sourceUrl ?? null);
  const publishedAt = source.tweetPostedAt && Number.isFinite(Date.parse(source.tweetPostedAt)) ? source.tweetPostedAt : null;
  const date = publishedAt ? easternReportDate(publishedAt) : source.snapshotDate;
  const originalId = originalUrl?.match(/\/status\/(\d+)/)?.[1];
  const gameId = interpretation.context === "game" && source.snapshotDate === date ? source.gameId ?? null : null;
  const identity: unknown[] = [originalId ?? null, source.team.id, date, text, interpretation];
  // Older workers must still generate their existing immutable keys on retry.
  if (isDatedInterpretationVersion(interpretation.version) && compareInterpretationVersions(interpretation.version, "2026-11-18.1") >= 0) identity.push(gameId);
  const fingerprint = createHash("sha256").update(JSON.stringify(identity)).digest("hex");
  return {
    key: `${fingerprint}:${source.team.id}:${interpretation.version}`,
    teamId: source.team.id, teamAbbreviation: source.team.abbreviation,
    gameId,
    session: explicitPracticeSession(text), date, publishedAt, originalPublishedAt: usesOriginal || originalUrl ? publishedAt : null,
    receivedAt: source.observedAt ?? publishedAt ?? `${source.snapshotDate}T12:00:00Z`,
    originalUrl, text, interpretation, interpretedAt: new Date().toISOString(),
    provenance: { relayTweetId: source.tweetId ?? null, originalTweetId: originalId ?? null, attributionStatus: originalUrl ? "resolved" : "pending" },
  };
}

/**
 * The reporter a validated goalie/injury row is credited to: the author of the report's verified original post
 * (lowercase handle). Pending attribution and relay accounts give null, which keeps the pipeline fallback. Quote posts
 * stay null here: the forecast capture credits the quoted author and keeps the relay as relaySourceAccount.
 */
export function validatedEventReporter(source: Pick<ParsedLinesCccSource, "quotedAuthorHandle">, report: Pick<ProjectionReport, "originalUrl">): string | null {
  if (source.quotedAuthorHandle) return null;
  const handle = verifiedOriginalTweetUrl(report.originalUrl)?.match(/^https:\/\/(?:x|twitter)\.com\/([A-Za-z0-9_]{1,15})\/status\/\d+/i)?.[1] ?? null;
  return handle && !isRelayAccount(handle) ? handle.toLowerCase() : null;
}

export async function persistTweetProjectionReports(supabase: any, sources: ParsedLinesCccSource[]) {
  if (process.env.TWEET_CLAIMS_MODE === "shadow") {
    await persistTweetClaimSources(supabase, sources);
    return;
  }
  if (!tweetPipelineFlags().publishing) return;
  const reports = sources.map(projectionReportFromSource).filter((report): report is ProjectionReport => report != null);
  if (!reports.length) return;
  const { error } = await supabase.from("tweet_projection_reports").upsert(reports.map((report) => ({
    report_key: report.key, team_id: report.teamId, game_id: report.gameId, report_date: report.date,
    published_at: report.publishedAt, received_at: report.receivedAt,
    interpretation_version: report.interpretation.version, payload: report,
  })), { onConflict: "report_key", ignoreDuplicates: true });
  if (error) throw error;
  // A historical reparse is never a live forecast update.
  const today = easternReportDate(new Date().toISOString());
  const gameIds = [...new Set(reports.filter((report) => report.date === today && report.gameId && report.interpretation.context === "game").map((report) => report.gameId!))];
  const stored = gameIds.length ? await fetchTweetProjectionReports(supabase, { date: today, internal: true }) : [];
  const factConflicts = new Set<string>();
  const current = currentProjectionReadings(stored, [], false, factConflicts);
  const historical = new Map(reports.filter(report => report.date !== today && report.gameId
    && report.interpretation.context === "game" && report.interpretation.events?.some(e => e.kind === "injury" || e.availabilityScope === "game"))
    .map(report => [`${report.date}:${report.teamId}:${report.gameId}`, report]));
  for (const report of historical.values()) {
    const peers = await fetchTweetProjectionReports(supabase, { date: report.date, teamId: report.teamId, gameId: report.gameId!, internal: true });
    currentProjectionReadings(peers, [], false, factConflicts);
  }
  // Both immutable reports are retained. Their disagreement is visible to the reviewer
  // and requires no retry; it must not produce another forecast or availability event.
  const events = reports.filter((report) => !factConflicts.has(report.key)).flatMap((report) => report.publishedAt ? (report.interpretation.events ?? [])
    // Lineup in/out participation is game-scoped, so the injury prior-status read above never sees it.
    .filter((event) => event.kind === "injury" || event.kind === "participation" && event.availabilityScope === "game").map((event) => ({
      event_key: `${report.key}:${event.playerId}:${event.evidence.start}${event.kind === "injury" ? "" : `:${event.kind}`}`, player_id: event.playerId,
      published_at: report.publishedAt, availability: event.availability, payload: event,
    })) : []);
  if (events.length) {
    const result = await supabase.from("tweet_player_events").upsert(events, { onConflict: "event_key", ignoreDuplicates: true });
    if (result.error) throw result.error;
  }
  for (const gameId of gameIds) {
    const rows = projectedSetsToForecastRows(selectProjectedUnitSets(current.filter(report => report.gameId === gameId)));
    const events = new Map<string, ProjectedEvent>();
    for (const source of sources.filter((source) => source.gameId === gameId && source.nhlFilterStatus === "accepted")) {
      const requested = projectionReportFromSource(source);
      if (!requested?.interpretation.events?.length || requested.interpretation.context !== "game") continue;
      const report = stored.find((report) => report.key === requested.key);
      if (!report) throw new Error(`Retained projection report missing for ${requested.key}.`);
      if (!current.includes(report)) continue;
      if (report.gameId !== requested.gameId || report.text !== requested.text || canonicalJson(report.interpretation) !== canonicalJson(requested.interpretation)
        || (report.provenance?.relayTweetId !== requested.provenance?.relayTweetId
        && (!report.provenance?.originalTweetId || report.originalUrl?.toLowerCase() !== requested.originalUrl?.toLowerCase()
          || Date.parse(report.publishedAt!) !== Date.parse(requested.publishedAt!)))) {
        throw new Error(`Projection source version conflict for ${report.key}.`);
      }
      for (const event of report.interpretation.events ?? []) {
        if ((event.kind === "injury" || event.kind === "goalie") && (event.teamId == null || event.teamId === report.teamId)) {
          events.set(`${report.key}:${event.kind}`, { report, kind: event.kind });
        }
      }
    }
    if (rows.length || events.size) {
      const retainedRows = await persistProjectionSourceSnapshots(supabase, rows, [...events.values()]);
      await capturePlayerForecastSourceRows({ supabase, rows: retainedRows });
    }
  }
}

function originalPostIdentity(url: string | null): string | null {
  return verifiedOriginalTweetUrl(url)?.match(/\/status\/(\d+)$/)?.[1] ?? null;
}

function publicDisplayIdentity(report: ProjectionReport): string {
  return originalPostIdentity(report.originalUrl) ?? `team:${report.teamId}:text:${report.text}`;
}

type GameEvent = NonNullable<TweetInterpretation["events"]>[number];

function incompatibleGameClaims(a: GameEvent[], b: GameEvent[]): boolean {
  const starting = (event: GameEvent) => event.kind === "goalie" && event.goalieRole !== "backup"
    && ["projected", "likely", "confirmed"].includes(event.state);
  const nonstarter = (event: GameEvent) => event.kind === "goalie" && (event.goalieRole === "backup" || event.state === "ruled_out");
  const starters = (events: GameEvent[]) => new Set(events.filter(starting).map(event => event.playerId));
  const left = starters(a), right = starters(b);
  if (left.size === 1 && right.size === 1 && !right.has([...left][0]!)) return true;
  return a.some(one => b.some(two => {
    if (one.playerId !== two.playerId || (one.effectiveDate && two.effectiveDate && one.effectiveDate !== two.effectiveDate)) return false;
    if (starting(one) && nonstarter(two) || nonstarter(one) && starting(two)) return true;
    return (one.kind === two.kind || one.availabilityScope === "game" && two.availabilityScope === "game")
      && ((one.availability === "out" && two.availability === "available") || (one.availability === "available" && two.availability === "out"));
  }));
}

type ProjectionVersion = { url: string | null; relay: string | null; version: string };

// Input is already ordered by receipt of the interpretation, newest first.
// Keep exact copies of the winning revision and binding for downstream lineage.
function currentProjectionReadings(reports: ProjectionReport[], otherVersions: ProjectionVersion[] = [], showDisputedSources = false, factConflicts = new Set<string>()) {
  const headers = reports.map(report => ({ url: report.originalUrl, relay: report.provenance?.relayTweetId ?? null, version: report.interpretation.version }));
  const originals = new Map<string, string>();
  for (const row of [...headers, ...otherVersions]) {
    const id = originalPostIdentity(row.url);
    if (id && row.relay) originals.set(row.relay, id);
  }
  const sourceId = (row: ProjectionVersion) => originalPostIdentity(row.url) ?? (row.relay ? originals.get(row.relay) ?? row.relay : null);
  const newest = new Map<string, string>();
  function remember(identity: string | null, version: string) {
    if (!identity || !isDatedInterpretationVersion(version)) return;
    const prior = newest.get(identity);
    if (!prior || compareInterpretationVersions(version, prior) > 0) newest.set(identity, version);
  }
  const identities = reports.map((report, i) => sourceId(headers[i]!) ?? publicDisplayIdentity(report));
  for (const [i, report] of reports.entries()) remember(identities[i]!, report.interpretation.version);
  for (const row of [...headers, ...otherVersions]) {
    remember(sourceId(row), row.version);
    // A corrected attribution can change the original post as well as the game.
    if (row.relay) remember(`carrier:${row.relay}`, row.version);
  }
  const bindings = new Map<string, number | null>();
  const disputed = new Set<string>();
  const winners = reports.filter((report, i) => {
    const original = identities[i]!;
    const version = newest.get(original);
    const carrierVersion = headers[i]!.relay ? newest.get(`carrier:${headers[i]!.relay}`) : undefined;
    if (version && version !== report.interpretation.version || carrierVersion && carrierVersion !== report.interpretation.version) return false;
    const side = `${report.teamId}:${original}`;
    if (bindings.has(side) && bindings.get(side) !== report.gameId) disputed.add(side);
    bindings.set(side, report.gameId);
    return true;
  });
  const claims = new Map<string, Array<{ report: ProjectionReport; events: GameEvent[] }>>();
  for (const report of winners) {
    const identity = originalPostIdentity(report.originalUrl) ?? report.provenance?.relayTweetId;
    if (!identity || !report.gameId || report.interpretation.context !== "game") continue;
    const events = report.interpretation.events?.filter(e => (e.teamId == null || e.teamId === report.teamId)
      && (!e.effectiveDate || e.effectiveDate === report.date)) ?? [];
    if (!events.length) continue;
    const scope = `${identity}:${report.teamId}:${report.gameId}:${report.interpretation.version}`;
    const peers = claims.get(scope) ?? [];
    for (const prior of peers) if (incompatibleGameClaims(prior.events, events)) {
      factConflicts.add(prior.report.key);
      factConflicts.add(report.key);
    }
    peers.push({report, events});
    claims.set(scope, peers);
  }
  if (!disputed.size && !factConflicts.size) return winners;
  return winners.flatMap(report => {
    const identity = sourceId({ url: report.originalUrl, relay: report.provenance?.relayTweetId ?? null, version: report.interpretation.version }) ?? publicDisplayIdentity(report);
    const disputedBinding = disputed.has(`${report.teamId}:${identity}`);
    if (!disputedBinding && !factConflicts.has(report.key)) return [report];
    if (!showDisputedSources) return [];
    return [{ ...report, gameId: disputedBinding ? null : report.gameId, ...(factConflicts.has(report.key) ? {reviewReason:"conflicting_claims" as const} : {}),
      interpretation: { ...report.interpretation, context: "unknown" as const,
      certainty: "reported" as const, units: [], excludedUnits: [], events: [], changes: [], relationships: [], unresolved: [] } }];
  });
}

export async function fetchTweetProjectionReports(supabase: any, args: { teamId?: number; gameId?: number; date: string; internal?: boolean }): Promise<ProjectionReport[]> {
  if (!tweetPipelineFlags().publishing) return [];
  const rows = await fetchAllSupabasePages<{ payload: ProjectionReport }>(({ from, to }) => {
    let query = supabase.from("tweet_projection_reports").select("payload").eq("report_date", args.date);
    // A newer interpretation can withdraw a game or move the subject to another team.
    // The exact-key archive used by the publisher keeps its original SQL scope.
    if (args.teamId) query = query.eq("team_id", args.teamId);
    if (args.internal && args.gameId) query = query.eq("game_id", args.gameId);
    return query.order("report_key", { ascending: true }).range(from, to);
  });
  const reports = rows.map(({ payload }) => payload).sort((a, b) => Date.parse(b.interpretedAt ?? b.receivedAt) - Date.parse(a.interpretedAt ?? a.receivedAt)
    || a.key.localeCompare(b.key));
  // Publication must read the requested exact key and its own retained lineage.
  if (args.internal) return reports;
  // Look up version/lineage only for other teams. Their full interpretations stay in storage.
  const otherVersions = args.teamId && reports.some(report => report.originalUrl || report.provenance?.relayTweetId)
    ? await fetchAllSupabasePages<ProjectionVersion>(({ from, to }) =>
        supabase.from("tweet_projection_reports").select("url:payload->>originalUrl,relay:payload->provenance->>relayTweetId,version:interpretation_version")
          .eq("report_date", args.date).neq("team_id", args.teamId).order("report_key").range(from, to))
    : [];
  const unique = new Map<string, ProjectionReport>();
  for (const report of currentProjectionReadings(reports, otherVersions, true)) {
    if (args.gameId && args.gameId !== report.gameId) continue;
    if (isDisputedRetainedProjectionSubject(report)) continue;
    const side = report.reviewReason === "conflicting_claims" ? report.key : `${report.teamId}:${publicDisplayIdentity(report)}`;
    if (!unique.has(side)) unique.set(side, report);
  }
  return [...unique.values()].slice(0, 1000).map(publicProjectionReport);
}
