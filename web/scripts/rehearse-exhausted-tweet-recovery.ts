import { createHash, randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { readForecastSchedule } from "../lib/player-forecasts/scopeReads";

type Row = Record<string, unknown>;
const targets = [
  { id: "46b36f2f-68b8-4333-9d63-1e5934f96d81", tweet: "2110076030937362799", source: "gamedaynewsnhl", team: 22, game: 2026020104 },
  { id: "243f805f-0f45-4559-af7f-5bcf21b773dd", tweet: "2110075994304282818", source: "gamedaygoalies", team: 22, game: 2026020104 },
  { id: "452fb725-93bb-438b-adbf-4ddb8cb98004", tweet: "2110098376381604210", source: "gamedaynewsnhl", team: 1, game: 2026020090 },
] as const;

function requireFact(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
function record(value: unknown): Row {
  requireFact(value !== null && typeof value === "object" && !Array.isArray(value), "Expected record");
  return value as Row;
}
function rows(value: unknown): Row[] {
  requireFact(Array.isArray(value), "Expected complete row array");
  return value.map(record);
}
function text(value: unknown): string {
  requireFact(typeof value === "string" && value.length > 0, "Expected nonempty string");
  return value;
}
function number(value: unknown): number {
  requireFact(typeof value === "number" && Number.isSafeInteger(value), "Expected integer");
  return value;
}
export function instant(value: unknown): bigint {
  const match = text(value).match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}(?::?\d{2})?)$/);
  requireFact(match, "Unknown or unsupported-precision clock");
  const base = `${match[1]}T${match[2]}`, milliseconds = Date.parse(`${base}Z`);
  requireFact(Number.isFinite(milliseconds) && new Date(milliseconds).toISOString().slice(0, 19) === base, "Unknown clock");
  const zone = match[4], hours = zone === "Z" ? 0 : Number(zone.slice(1, 3));
  const minutes = zone === "Z" || zone.length === 3 ? 0 : Number(zone.slice(3).replace(":", ""));
  requireFact(hours <= 14 && minutes < 60 && (hours !== 14 || minutes === 0), "Unknown timezone offset");
  const offset = (zone.startsWith("-") ? -1 : 1) * (hours * 60 + minutes);
  return BigInt(milliseconds - offset * 60_000) * BigInt(1000) + BigInt((match[3] ?? "").padEnd(6, "0"));
}
// Deployed sourceObservations.validDate emits millisecond ISO clocks for captures.
// Validate that exact derivation, rather than treating arbitrary microsecond clocks as equal.
function retainedCaptureInstant(value: unknown): bigint {
  const source = instant(value);
  requireFact(source >= BigInt(0), "Unsupported pre-epoch retained clock");
  return source / BigInt(1000) * BigInt(1000);
}
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") return `{${Object.entries(record(value)).sort(([a], [b]) => a.localeCompare(b))
    .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(",")}}`;
  requireFact(value === null || ["string", "boolean", "number"].includes(typeof value), "Non-JSON value");
  requireFact(typeof value !== "number" || Number.isFinite(value), "Non-JSON number");
  return JSON.stringify(value);
}
const hash = (value: unknown) => createHash("sha256").update(canonicalJson(value)).digest("hex");
function one(items: Row[], predicate: (item: Row) => boolean): Row {
  const matches = items.filter(predicate);
  requireFact(matches.length === 1, "Missing or conflicting receipt");
  return matches[0];
}
function unique(items: Row[], key: string) {
  requireFact(new Set(items.map(item => item[key])).size === items.length, `Duplicate ${key}`);
}

/** Uses a real typed client with an offline-only GET transport; never reads credentials. */
function offlineScheduleClient(games: Row[], schedule: Row[], calls: string[]) {
  return createClient("https://offline-recovery.invalid", "offline-fixture", {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (input, init) => {
      const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
      requireFact(url.hostname === "offline-recovery.invalid" && (init?.method ?? "GET") === "GET", "Non-offline/read-only request");
      const table = url.pathname.split("/").at(-1);
      requireFact(table === "games" || table === "roster_optimizer_team_games", "Unexpected schedule table");
      calls.push(table);
      let selected = [...(table === "games" ? games : schedule)];
      for (const [key, filter] of url.searchParams) {
        if (["select", "order", "offset", "limit"].includes(key)) continue;
        if (key === "or") {
          const match = filter.match(/^\(homeTeamId\.eq\.(1|22),awayTeamId\.eq\.\1\)$/);
          requireFact(match, "Unexpected team scope");
          const team = Number(match[1]); selected = selected.filter(row => row.homeTeamId === team || row.awayTeamId === team); continue;
        }
        const [operator, ...parts] = filter.split("."), value = parts.join(".");
        if (operator === "eq") selected = selected.filter(row => String(row[key]) === value);
        else if (operator === "gte") selected = selected.filter(row => text(row[key]) >= value);
        else if (operator === "lte") selected = selected.filter(row => text(row[key]) <= value);
        else if (operator === "in") {
          requireFact(key === "source_game_id" && /^\([0-9,]+\)$/.test(value), "Unexpected game filter");
          const ids = value.slice(1, -1).split(",").map(Number); selected = selected.filter(row => ids.includes(number(row[key])));
        } else throw new Error("Unexpected offline filter");
      }
      const order = text(url.searchParams.get("order")).split(",").map(part => part.split(".")[0]);
      selected.sort((a, b) => {
        for (const key of order) {
          const left = a[key], right = b[key];
          const delta = typeof left === "number" && typeof right === "number" ? left - right : text(left).localeCompare(text(right));
          if (delta) return delta;
        }
        return 0;
      });
      const offset = Number(url.searchParams.get("offset") ?? 0), limit = Number(url.searchParams.get("limit") ?? 500);
      requireFact(Number.isSafeInteger(offset) && offset >= 0 && Number.isSafeInteger(limit) && limit > 0, "Invalid offline page");
      const page = selected.slice(offset, offset + limit);
      return new Response(JSON.stringify(page), { status: 200, headers: {
        "Content-Type": "application/json", "Content-Range": `${offset}-${offset + page.length - 1}/${selected.length}`,
      } });
    } },
  });
}

export type RecoveryReadSet = {
  table: string; key: string; expected: Row[];
  selectors: Array<{ column: string; jsonKey?: string; values: Array<string | number> }>;
  projection?: string[];
};
export type RecoveryPlan = {
  mode: "resume_retained_evidence"; project: string; preparedAt: string; evidenceObservedAt: string;
  evidenceHash: string; planHash: string; owner: string; readSets: RecoveryReadSet[];
  events: Array<{ id: string; tweet: string; source: string; captureKey: string; reportKey: string; team: number; game: number }>;
  retainedVersion: string; capturesInserted: 0; queuesInsertedOrUpdated: 0;
  eventReceiptsUpdated: 3; jobsUpdated: 3; scheduleReadTables: string[];
  originalHorizons: Array<{ team: number; cutoff: string; games: Row[] }>;
};

/** Resume existing private evidence, never reparse it or rerun the live producer. */
export async function rehearseRecovery(input: unknown, preparedAt: string): Promise<RecoveryPlan> {
  const evidence = record(input), observedAt = text(evidence.observedAt);
  requireFact(instant(preparedAt) >= instant(observedAt), "Recovery clock predates evidence");
  const events = rows(evidence.events), jobs = rows(evidence.jobs), raw = rows(evidence.rawSnapshots);
  const reports = rows(evidence.reports), children = rows(evidence.childSnapshots), goalies = rows(evidence.goalies);
  const lineups = rows(evidence.lineups), assignments = rows(evidence.assignments), queue = rows(evidence.queue);
  const games = rows(evidence.canonicalGames), schedule = rows(evidence.scheduleRows), scopedTargets = rows(evidence.targets);
  requireFact(events.length === 3 && jobs.length === 3 && raw.length === 3 && reports.length === 2
    && children.length === 3 && goalies.length === 1 && lineups.length === 2 && assignments.length === 2
    && queue.length === 20 && scopedTargets.length === 20, "Unexpected recovery footprint");
  requireFact(games.length === number(evidence.canonicalGameCount) && games.length <= 200
    && schedule.length === number(evidence.scheduleRowCount) && schedule.length === 40, "Incomplete discovery evidence");
  requireFact(rows(evidence.unresolved).length === 0, "Unresolved review work requires a different plan");
  for (const [items, key] of [[events, "id"], [jobs, "job_key"], [raw, "capture_key"], [reports, "report_key"],
    [children, "capture_key"], [games, "id"], [schedule, "id"], [queue, "scope_key"]] as const) unique(items, key);
  const eventPlans: RecoveryPlan["events"] = [];
  for (const target of targets) {
    const event = one(events, row => row.id === target.id), job = one(jobs, row => row.job_key === `ingest:line_source_ifttt_events:${target.id}`);
    const snapshot = one(raw, row => row.tweet_id === target.tweet && row.source_key === target.source);
    requireFact(event.tweet_id === target.tweet && event.source_key === target.source && event.processing_status === "failed"
      && job.status === "failed" && job.attempts === 8 && job.failure_stage === "projection_storage" && job.lease_expires_at === null,
    "Event is not the reviewed exhausted job");
    requireFact(snapshot.team_id === target.team && snapshot.game_id === target.game && snapshot.snapshot_date === "2026-10-13"
      && snapshot.status === "observed" && snapshot.nhl_filter_status === "accepted" && snapshot.raw_text === event.text
      && instant(snapshot.observed_at) === instant(event.received_at)
      && instant(snapshot.tweet_posted_at) <= instant(snapshot.observed_at) && instant(snapshot.observed_at) <= instant(observedAt), "Raw source receipt mismatch");
    const interpretation = record(record(snapshot.metadata).interpretation);
    requireFact(interpretation.version === "2026-10-10.2" && interpretation.context === "game"
      && rows(interpretation.units).length === 0 && rows(interpretation.unresolved).length === 0
      && (interpretation.relationships === undefined || rows(interpretation.relationships).length === 0)
      && (snapshot.unmatched_names === null || rows(snapshot.unmatched_names).length === 0), "Unfinished parse/review work");
    const sourceText = snapshot.enriched_text ?? snapshot.raw_text;
    const report = one(reports, row => {
      const payload = record(row.payload);
      return row.game_id === target.game && row.team_id === target.team && payload.text === sourceText
        && instant(payload.publishedAt) === instant(snapshot.tweet_posted_at)
        && canonicalJson(payload.interpretation) === canonicalJson(interpretation);
    });
    const payload = record(report.payload), provenance = record(payload.provenance);
    requireFact(payload.key === report.report_key && report.report_date === "2026-10-13"
      && targets.some(item => item.tweet === provenance.relayTweetId)
      && instant(payload.receivedAt) <= instant(event.received_at), "Report lineage mismatch");
    eventPlans.push({ ...target, captureKey: text(snapshot.capture_key), reportKey: text(report.report_key) });
  }
  for (const report of reports) {
    const payload = record(report.payload), interpretation = record(payload.interpretation);
    requireFact(report.interpretation_version === "2026-10-10.2", "Unexpected retained version");
    const typedEvents = rows(interpretation.events);
    requireFact(typedEvents.length === (report.team_id === 22 ? 2 : 1)
      && typedEvents.filter(event => event.kind === "injury").length === 1
      && typedEvents.filter(event => event.kind === "goalie").length === (report.team_id === 22 ? 1 : 0), "Missing or duplicate typed events");
    for (const event of typedEvents) {
      requireFact(event.kind === "goalie" || event.kind === "injury", "Unplanned event kind");
      const span = record(event.evidence), start = number(span.start), end = number(span.end);
      requireFact(start >= 0 && end > start && end <= text(payload.text).length && text(payload.text).slice(start, end) === span.text, "Event span mismatch");
      const childKey = `${text(report.report_key)}:${event.kind}`;
      const child = one(children, row => row.capture_key === childKey);
      requireFact(child.source === "tweet_projection" && child.team_id === report.team_id && child.game_id === report.game_id
        && child.status === "observed" && child.nhl_filter_status === "accepted", "Derived source mismatch");
      const lineage = rows(record(child.raw_payload).sources);
      requireFact(lineage.length === 1 && lineage[0].table === "line_source_snapshots", "Unbounded retained lineage");
      const retained = record(lineage[0].snapshot);
      one(raw, row => row.capture_key === retained.capture_key && row.raw_text === retained.raw_text
        && instant(row.observed_at) === instant(retained.observed_at)
        && canonicalJson(record(row.metadata).interpretation) === canonicalJson(record(retained.metadata).interpretation));
      const capture = one(event.kind === "goalie" ? goalies : lineups, row => row.source_capture_key === childKey);
      requireFact(capture.accepted === true && capture.parser_version === "2026-10-10.2"
        && capture.team_id === report.team_id && capture.game_id === report.game_id
        && instant(capture.observed_at) === instant(payload.publishedAt)
        && instant(capture.available_at) === retainedCaptureInstant(payload.receivedAt), "Capture clock/identity mismatch");
      if (event.kind === "goalie") requireFact(capture.player_id === event.playerId && capture.observation_status === event.state, "Goalie identity/state mismatch");
      else {
        requireFact(capture.classification === "injury", "Unexpected retained capture classification");
        const assignment = one(assignments, row => row.snapshot_id === capture.id && row.player_id === event.playerId);
        requireFact(assignment.unit_type === "injury" && assignment.raw_player_name === event.playerName
          && assignment.assignment_status === "ruled_out" && event.availability === "out", "Injury assignment mismatch");
      }
    }
  }
  const scheduleCalls: string[] = [], db = offlineScheduleClient(games, schedule, scheduleCalls);
  const originalHorizons: RecoveryPlan["originalHorizons"] = [];
  for (const team of [1, 22]) {
    const teamTargets = scopedTargets.filter(row => row.team_id === team).sort((a, b) => number(a.ordinal) - number(b.ordinal));
    requireFact(teamTargets.length === 10 && teamTargets.every((row, index) => row.ordinal === index + 1), "Incomplete original horizon");
    const verified = await readForecastSchedule({ db, now: new Date(observedAt), teamId: team, throughDate: text(teamTargets[9].date) });
    requireFact(canonicalJson(verified.map(row => row.id).sort()) === canonicalJson(teamTargets.map(row => number(row.id)).sort()), "Changed required game scope");
    const injury = one(lineups, row => row.team_id === team), watermark = instant(injury.available_at);
    const original = games.filter(row => (row.homeTeamId === team || row.awayTeamId === team) && instant(row.startTime) > watermark)
      .sort((a, b) => instant(a.startTime) < instant(b.startTime) ? -1 : instant(a.startTime) > instant(b.startTime) ? 1 : number(a.id) - number(b.id)).slice(0, 10);
    requireFact(canonicalJson(original.map(row => row.id)) === canonicalJson(teamTargets.map(row => row.id)), "Original horizon membership mismatch");
    originalHorizons.push({ team, cutoff: text(injury.available_at), games: original.map(row => ({ id: row.id, date: row.date, startTime: row.startTime })) });
    for (const target of teamTargets) {
      const entry = one(queue, row => row.scope_key === `game:${number(target.id)}:team:${team}`);
      requireFact(entry.status === "succeeded" && entry.game_id === target.id && entry.team_id === team
        && entry.lease_expires_at === null && instant(entry.source_high_watermark) >= watermark
        && instant(entry.processed_watermark) >= watermark, "Queue coverage is incomplete; never silently requeue");
    }
  }
  const gameIds = new Set(scopedTargets.map(row => number(row.id)));
  const selector = (column: string, items: Row[]) => [{ column, values: items.map(row => text(String(row[column]))) }];
  const readSets: RecoveryReadSet[] = [
    { table: "line_source_ifttt_events", key: "id", expected: events, selectors: selector("id", events) },
    { table: "tweet_pipeline_jobs", key: "job_key", expected: jobs, selectors: selector("job_key", jobs) },
    { table: "line_source_snapshots", key: "capture_key", expected: [...raw, ...children], selectors: [
      ...selector("tweet_id", raw), ...selector("capture_key", children),
    ] },
    { table: "tweet_projection_reports", key: "report_key", expected: reports, selectors: selector("report_key", reports) },
    { table: "player_forecast_goalie_start_observations", key: "id", expected: goalies, selectors: selector("source_capture_key", goalies) },
    { table: "player_forecast_lineup_snapshots", key: "id", expected: lineups, selectors: selector("source_capture_key", lineups) },
    { table: "player_forecast_lineup_assignments", key: "id", expected: assignments, selectors: [{ column: "snapshot_id", values: lineups.map(row => text(row.id)) }] },
    { table: "player_forecast_inference_queue", key: "scope_key", expected: queue, selectors: selector("scope_key", queue) },
    { table: "games", key: "id", expected: games.filter(row => gameIds.has(number(row.id))),
      selectors: [{ column: "id", values: [...gameIds] }], projection: ["id", "seasonId", "date", "startTime", "homeTeamId", "awayTeamId", "type"] },
    { table: "roster_optimizer_team_games", key: "id", expected: schedule, selectors: [{ column: "source_game_id", values: [...gameIds] }] },
    { table: "lineup_unresolved_player_names", key: "id", expected: [], selectors: [
      { column: "tweet_id", values: targets.map(target => target.tweet) },
      { column: "metadata", jsonKey: "captureKey", values: [...raw, ...children].map(row => text(row.capture_key)) },
    ] },
  ];
  const base = { mode: "resume_retained_evidence" as const, project: "fyhftlxokyjtpndbkfse", preparedAt,
    evidenceObservedAt: observedAt, evidenceHash: hash(evidence), owner: randomUUID(), readSets, events: eventPlans,
    retainedVersion: "2026-10-10.2", capturesInserted: 0 as const, queuesInsertedOrUpdated: 0 as const,
    eventReceiptsUpdated: 3 as const, jobsUpdated: 3 as const, scheduleReadTables: scheduleCalls, originalHorizons };
  return { ...base, planHash: hash(base) };
}

/** Emits an atomic six-row executor; never connects to a database or sends requests. */
export function recoverySql(plan: RecoveryPlan): string {
  const { planHash, ...base } = plan;
  requireFact(hash(base) === planHash && plan.mode === "resume_retained_evidence", "Plan hash mismatch");
  requireFact(plan.project === "fyhftlxokyjtpndbkfse" && plan.events.length === 3 && plan.events.every(event => targets.some(target =>
    target.id === event.id && target.tweet === event.tweet && target.source === event.source && target.team === event.team && target.game === event.game))
    && new Set(plan.events.map(event => event.id)).size === 3 && plan.capturesInserted === 0 && plan.queuesInsertedOrUpdated === 0, "Unexpected mutation budget");
  const literal = (value: unknown) => `'${canonicalJson(value).replace(/'/g, "''")}'::jsonb`;
  const strings = (value: unknown) => `'${text(value).replace(/'/g, "''")}'`;
  const tables = ["line_source_ifttt_events", "tweet_pipeline_jobs", "line_source_snapshots", "tweet_projection_reports",
    "player_forecast_goalie_start_observations", "player_forecast_lineup_snapshots", "player_forecast_lineup_assignments",
    "player_forecast_inference_queue", "games", "roster_optimizer_team_games", "lineup_unresolved_player_names"];
  requireFact(plan.readSets.length === tables.length && plan.readSets.every((set, index) => set.table === tables[index]), "Unexpected read tables");
  const column = (name: string) => { requireFact(/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name), "Invalid SQL column"); return `"${name}"`; };
  const checks = plan.readSets.map(set => {
    const expected = [...set.expected].sort((a, b) => String(a[set.key]) < String(b[set.key]) ? -1 : String(a[set.key]) > String(b[set.key]) ? 1 : 0);
    const projection = set.projection ? `jsonb_build_object(${set.projection.flatMap(key => [strings(key), `r.${column(key)}`]).join(",")})` : "to_jsonb(r)";
    const predicate = set.selectors.map(selector => `${selector.jsonKey ? `(r.${column(selector.column)}->>${strings(selector.jsonKey)})` : `r.${column(selector.column)}::text`} IN (${selector.values.map(value => strings(String(value))).join(",")})`).join(" OR ");
    return `SELECT coalesce(jsonb_agg(${projection} ORDER BY r.${column(set.key)}::text COLLATE "C"),'[]'::jsonb) INTO actual
      FROM (SELECT r.* FROM public.${set.table} r WHERE ${predicate} FOR SHARE) r;
    IF actual IS DISTINCT FROM ${literal(expected)} THEN RAISE EXCEPTION 'Read-set drift: ${set.table}'; END IF;`;
  }).join("\n");
  const body = `DECLARE actual jsonb; affected integer; completed_at timestamptz := clock_timestamp();
BEGIN
  -- Short relation locks freeze receipt-table trigger DDL and review inserts until COMMIT.
  -- Privileged trigger-function/schema replacement must be excluded by the execution window.
  LOCK TABLE public.line_source_ifttt_events, public.tweet_pipeline_jobs IN SHARE ROW EXCLUSIVE MODE;
  LOCK TABLE public.lineup_unresolved_player_names IN SHARE MODE;
  IF EXISTS (SELECT 1 FROM pg_trigger t WHERE NOT t.tgisinternal
    AND t.tgrelid IN ('public.line_source_ifttt_events'::regclass,'public.tweet_pipeline_jobs'::regclass))
  THEN RAISE EXCEPTION 'Unexpected receipt-table trigger'; END IF;
  PERFORM 1 FROM public.line_source_ifttt_events WHERE id::text IN (${plan.events.map(row => strings(row.id)).join(",")}) ORDER BY id FOR UPDATE;
  PERFORM 1 FROM public.tweet_pipeline_jobs WHERE job_key IN (${plan.events.map(row => strings(`ingest:line_source_ifttt_events:${row.id}`)).join(",")}) ORDER BY job_key FOR UPDATE;
  ${checks}
  ${plan.originalHorizons.map(horizon => `SELECT coalesce(jsonb_agg(jsonb_build_object('id',g.id,'date',g.date,'startTime',g."startTime") ORDER BY g."startTime",g.id),'[]'::jsonb) INTO actual
    FROM (SELECT id,date,"startTime" FROM public.games WHERE type=2 AND "seasonId"=20262027
      AND "startTime">${strings(horizon.cutoff)}::timestamptz AND ${horizon.team} IN ("homeTeamId","awayTeamId")
      ORDER BY "startTime",id LIMIT 10) g;
  IF actual IS DISTINCT FROM ${literal(horizon.games)} THEN RAISE EXCEPTION 'Original horizon membership changed'; END IF;`).join("\n")}
  ${plan.events.map(event => `UPDATE public.line_source_ifttt_events
    SET processing_status='processed',updated_at=completed_at,
      raw_payload=raw_payload || jsonb_build_object('lineSourceProcessing',
        ${literal({ recoveryMode: plan.mode, planHash, retainedParserVersion: plan.retainedVersion, captureKey: event.captureKey,
          reportKey: event.reportKey, captureWrites: 0, queueWrites: 0, emailsSent: 0, relatedLineUnits: 0,
          excludedStages: ["producer_reparse", "new_forecast_generation", "unrelated_team_reconciliation", "email"],
          noOriginalAttributionOrHistoricalIssuanceClaim: true })} || jsonb_build_object('processedAt',completed_at))
    WHERE id=${strings(event.id)}::uuid AND processing_status='failed';
  GET DIAGNOSTICS affected=ROW_COUNT;
  IF affected<>1 THEN RAISE EXCEPTION 'Unexpected event write count'; END IF;
  UPDATE public.tweet_pipeline_jobs SET status='complete',attempts=attempts+1,owner=${strings(plan.owner)}::uuid,
    lease_expires_at=NULL,failure_stage=NULL,updated_at=completed_at,
    payload=coalesce(payload,'{}'::jsonb) || jsonb_build_object('boundedRecovery',
      ${literal({ planHash, mode: plan.mode, captureWrites: 0, queueWrites: 0 })} || jsonb_build_object('completedAt',completed_at))
    WHERE job_key=${strings(`ingest:line_source_ifttt_events:${event.id}`)} AND status='failed' AND attempts=8 AND lease_expires_at IS NULL;
  GET DIAGNOSTICS affected=ROW_COUNT;
  IF affected<>1 THEN RAISE EXCEPTION 'Unexpected job write count'; END IF;`).join("\n")}
END;`;
  let marker = "$bounded_recovery$";
  while (body.includes(marker)) marker = `$bounded_recovery_${createHash("sha256").update(marker + body).digest("hex").slice(0, 20)}$`;
  return `-- PROPOSAL ONLY. Requires independent review and explicit six-row production authorization.
-- Target project: ${plan.project}; approved plan SHA-256: ${planHash}.
-- Zero new captures, queues, forecasts, attribution claims, provider requests or emails.
BEGIN ISOLATION LEVEL SERIALIZABLE;
SET LOCAL statement_timeout='10s';
SET LOCAL lock_timeout='2s';
SET LOCAL TIME ZONE 'UTC';
SET LOCAL standard_conforming_strings=on;
DO ${marker}
${body}
${marker};
SELECT id,tweet_id,processing_status,updated_at FROM public.line_source_ifttt_events
  WHERE id::text IN (${plan.events.map(row => strings(row.id)).join(",")}) ORDER BY id;
SELECT job_key,status,attempts,lease_expires_at FROM public.tweet_pipeline_jobs
  WHERE job_key IN (${plan.events.map(row => strings(`ingest:line_source_ifttt_events:${row.id}`)).join(",")}) ORDER BY job_key;
COMMIT;
`;
}

if (require.main === module) {
  const [input, output, ...extra] = process.argv.slice(2);
  requireFact(input && output && !extra.length && ![input, output].some(arg => arg.startsWith("--")), "Usage: script evidence.json output-prefix (no execution mode)");
  void rehearseRecovery(JSON.parse(readFileSync(input, "utf8")), new Date().toISOString()).then(plan => {
    writeFileSync(`${output}.plan.json`, JSON.stringify(plan, null, 2) + "\n");
    writeFileSync(`${output}.proposed.sql`, recoverySql(plan));
    process.stdout.write(JSON.stringify({ planHash: plan.planHash, captures: 0, queues: 0, events: 3, jobs: 3, executed: false }) + "\n");
  }).catch(error => { process.stderr.write(String(error) + "\n"); process.exitCode = 1; });
}
