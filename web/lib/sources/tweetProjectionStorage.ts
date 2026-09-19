import { createHash } from "node:crypto";
import type { ParsedLinesCccSource } from "./linesCccIngestion";
import { getPrimaryTextForSource, toLinesCccRow } from "./linesCccIngestion";
import { tweetPipelineFlags, type TweetInterpretation } from "./tweetInterpretation";
import { easternReportDate, explicitPracticeSession, publicProjectionReport, selectProjectedUnitSets, verifiedOriginalTweetUrl, type ProjectionReport, type ProjectedUnitSet } from "./projectedLineups";
import { fetchAllSupabasePages } from "lib/supabase/pagination";
import { classifyInjuryEvent } from "./tweetPlayerEvents";
import { capturePlayerForecastSourceRows, type ForecastLineSourceRow } from "lib/player-forecasts/sourceObservations";

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
    const interpretation: TweetInterpretation = { ...latest.interpretation, units: values.flatMap((set) => set.units), events: [], unresolved: [] };
    const base = toLinesCccRow({ source: { snapshotDate: latest.date, team: { id: latest.teamId, abbreviation: latest.teamAbbreviation } as any,
      gameId: latest.gameId, nhlFilterStatus: "accepted", classification: "lineup", rawText: latest.text, tweetPostedAt: latest.publishedAt,
      observedAt: reports.map((report) => report.receivedAt).sort().at(-1), metadata: { interpretation } }, rosterEntries: [] });
    return { ...base, capture_key: `projection:${key}:${createHash("sha256").update(reports.map((report) => report.key).sort().join(":")).digest("hex")}`,
      source_group: "tweet_projection", source_key: "validated_units", source_account: null, source_url: latest.originalUrl,
      metadata: { interpretation, situationReports: values.map((set) => ({ situation: set.situation, publishedAt: set.publishedAt, originals: set.reports.map((report) => report.originalUrl) })) },
    } as ForecastLineSourceRow;
  });
}

/** Only facts published before this report may inform injury history. */
export async function enrichTweetInjuryHistory(supabase: any, sources: ParsedLinesCccSource[]) {
  if (!tweetPipelineFlags().interpretation) return;
  for (const source of sources) {
    const interpretation = source.metadata?.interpretation as TweetInterpretation | undefined;
    if (!interpretation?.events?.length || !source.tweetPostedAt || source.nhlFilterStatus !== "accepted") continue;
    for (const event of interpretation.events.filter((event) => event.kind === "injury")) {
      const { data, error } = await supabase.from("tweet_player_events").select("availability")
        .eq("player_id", event.playerId).lt("published_at", source.tweetPostedAt)
        .in("availability", ["out", "available"]).order("published_at", { ascending: false }).limit(1);
      if (error) throw error;
      let previous: "injured" | "healthy" | undefined = data?.[0]?.availability === "out" ? "injured" : data?.[0]?.availability === "available" ? "healthy" : undefined;
      if (!previous) {
        const history = await supabase.from("player_status_history").select("status_state,status_expires_at")
          .eq("player_id", event.playerId).lt("observed_at", source.tweetPostedAt).order("observed_at", { ascending: false }).limit(1);
        if (history.error) throw history.error;
        const status = history.data?.[0];
        if (status?.status_state === "injured" && (!status.status_expires_at || Date.parse(status.status_expires_at) > Date.parse(source.tweetPostedAt))) previous = "injured";
      }
      event.state = classifyInjuryEvent(event.evidence.text, previous);
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
  const fingerprint = createHash("sha256").update(JSON.stringify([originalId ?? null, source.team.id, date, text, interpretation])).digest("hex");
  return {
    key: `${fingerprint}:${source.team.id}:${interpretation.version}`,
    teamId: source.team.id, teamAbbreviation: source.team.abbreviation,
    gameId: interpretation.context === "game" && source.snapshotDate === date ? source.gameId ?? null : null,
    session: explicitPracticeSession(text), date, publishedAt, originalPublishedAt: usesOriginal || originalUrl ? publishedAt : null,
    receivedAt: source.observedAt ?? publishedAt ?? `${source.snapshotDate}T12:00:00Z`,
    originalUrl, text, interpretation, interpretedAt: new Date().toISOString(),
    provenance: { relayTweetId: source.tweetId ?? null, originalTweetId: originalId ?? null, attributionStatus: originalUrl ? "resolved" : "pending" },
  };
}

export async function persistTweetProjectionReports(supabase: any, sources: ParsedLinesCccSource[]) {
  if (!tweetPipelineFlags().publishing) return;
  const reports = sources.map(projectionReportFromSource).filter((report): report is ProjectionReport => report != null);
  if (!reports.length) return;
  const { error } = await supabase.from("tweet_projection_reports").upsert(reports.map((report) => ({
    report_key: report.key, team_id: report.teamId, game_id: report.gameId, report_date: report.date,
    published_at: report.publishedAt, received_at: report.receivedAt,
    interpretation_version: report.interpretation.version, payload: report,
  })), { onConflict: "report_key", ignoreDuplicates: true });
  if (error) throw error;
  const events = reports.flatMap((report) => report.publishedAt ? (report.interpretation.events ?? [])
    .filter((event) => event.kind === "injury").map((event) => ({
      event_key: `${report.key}:${event.playerId}:${event.evidence.start}`, player_id: event.playerId,
      published_at: report.publishedAt, availability: event.availability, payload: event,
    })) : []);
  if (events.length) {
    const result = await supabase.from("tweet_player_events").upsert(events, { onConflict: "event_key", ignoreDuplicates: true });
    if (result.error) throw result.error;
  }
  // A historical reparse is never a live forecast update.
  const today = easternReportDate(new Date().toISOString());
  const gameIds = [...new Set(reports.filter((report) => report.date === today && report.gameId && report.interpretation.context === "game").map((report) => report.gameId!))];
  for (const gameId of gameIds) {
    const stored = await fetchTweetProjectionReports(supabase, { gameId, date: today, internal: true });
    const rows = projectedSetsToForecastRows(selectProjectedUnitSets(stored));
    const eventRows = sources.filter((source) => source.gameId === gameId && source.nhlFilterStatus === "accepted").flatMap((source) => {
      const interpretation = source.metadata?.interpretation as TweetInterpretation | undefined;
      if (!interpretation?.events?.length || interpretation.context !== "game") return [];
      return (["goalie", "injury"] as const).flatMap((kind) => {
        const typedEvents = interpretation.events!.filter((event) => event.kind === kind);
        if (!typedEvents.length) return [];
        const base = toLinesCccRow({ source, rosterEntries: [] });
        const report = projectionReportFromSource(source)!;
        return [{ ...base, capture_key: `${report.key}:${kind}`, source_group: "tweet_projection", source_key: "validated_events", source_account: null,
          source_url: report.originalUrl, classification: kind === "goalie" ? "goalie_start" : "injury",
          goalie_1_player_id: typedEvents[0]?.playerId ?? null, goalie_1_name: typedEvents[0]?.playerName ?? null,
          goalie_2_player_id: typedEvents[1]?.playerId ?? null, goalie_2_name: typedEvents[1]?.playerName ?? null,
          metadata: { interpretation: { ...interpretation, units: [], events: typedEvents } },
        } as ForecastLineSourceRow];
      });
    });
    if (rows.length || eventRows.length) await capturePlayerForecastSourceRows({ supabase, rows: [...rows, ...eventRows] });
  }
}

export async function fetchTweetProjectionReports(supabase: any, args: { teamId?: number; gameId?: number; date: string; internal?: boolean }): Promise<ProjectionReport[]> {
  if (!tweetPipelineFlags().publishing) return [];
  const rows = await fetchAllSupabasePages<{ payload: ProjectionReport }>(({ from, to }) => {
    let query = supabase.from("tweet_projection_reports").select("payload").eq("report_date", args.date);
    if (args.teamId) query = query.eq("team_id", args.teamId);
    if (args.gameId) query = query.eq("game_id", args.gameId);
    return query.order("report_key", { ascending: true }).range(from, to);
  }, { limit: 1000 });
  const unique = new Map<string, ProjectionReport>();
  for (const { payload: report } of rows.sort((a, b) => Date.parse(b.payload.interpretedAt ?? b.payload.receivedAt) - Date.parse(a.payload.interpretedAt ?? a.payload.receivedAt))) {
    const identity = `${report.teamId}:${report.originalUrl ?? report.text}`;
    if (!unique.has(identity)) unique.set(identity, report);
  }
  return args.internal ? [...unique.values()] : [...unique.values()].map(publicProjectionReport);
}
