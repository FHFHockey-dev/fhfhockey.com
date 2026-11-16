/** BLSH daily request/context read v1: turns one blsh_request_context_v1(dateFrom, D) result
 * into the reader's RAW-{feed}.json files and CURRENT-REQUEST shape. A line-by-line port of
 * capture_reader.add_page + build_request (tasks/artifacts/blsh-request-reader-20261111,
 * capture_reader.py 841f2bb6...). Pure: no I/O, no credentials. The route or cron that calls the
 * function stays human-gated until the migration is reviewed, approved and applied
 * (REQUEST-CONTEXT.md). captureContext names this path, so export_context needs a v6 mode
 * before it will accept the result (PROFILE-SPEC.md). */
import { createHash } from "node:crypto";

export const REQUEST_CONTEXT_VERSION = "fhfh.blsh.request-context.v1";
export const REQUEST_CONTEXT_CAPTURE = "definer_function_request_context_v1";
const SEASON = 20262027, MAX_ROWS = 10000, MAX_LINKED = 8;
/** COLUMNS.json c14231f0... of the request reader, verbatim (the test compares the bytes' parse). */
export const REQUEST_CONTEXT_COLUMNS = {
  wgo: ["id", "player_id", "game_id", "season_id", "date", "player_name", "team_abbrev", "position_code", "games_played", "toi_per_game", "es_toi_per_game",
    "pp_toi_per_game", "goals", "assists", "pp_points", "shots", "hits", "blocked_shots", "total_primary_assists", "total_secondary_assists", "penalties_drawn",
    "penalties", "total_fow", "total_fol", "sat_for", "sat_against", "es_goals_for", "pp_goals_for", "sh_goals_for", "es_goals_against", "pp_goals_against",
    "sh_goals_against", "points"],
  individual: ["id", "player_id", "season", "date_scraped", "gp", "toi", "ixg", "goals", "shots"],
  onIce: ["id", "player_id", "season", "date_scraped", "gp", "toi", "xgf", "xga"],
  calendar: ["id", "seasonId", "date", "type"],
} as const;
type Feed = keyof typeof REQUEST_CONTEXT_COLUMNS;
const FEEDS: Feed[] = ["wgo", "individual", "onIce", "calendar"];
const TABLES: Record<Feed, string> = { wgo: "public.wgo_skater_stats", individual: "public.nst_gamelog_as_counts", onIce: "public.nst_gamelog_as_counts_oi", calendar: "public.games" };
const CONTEXT_KEYS = REQUEST_CONTEXT_COLUMNS.wgo.slice(0, 12);
type Row = Record<string, unknown>;

const need = (ok: unknown, code: string): void => { if (!ok) throw new Error(code); };
const positiveId = (value: unknown) => Number.isSafeInteger(value) && (value as number) > 0;
const day = (value: unknown) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
/** Python json.dumps(..., ensure_ascii=False, separators=(",", ":")) + "\n" for the JSON values used here. */
const encoded = (value: unknown) => Buffer.from(`${JSON.stringify(value)}\n`, "utf8");
const sha = (bytes: Buffer) => createHash("sha256").update(new Uint8Array(bytes)).digest("hex");
const zip = (keys: readonly string[], values: unknown[]) => Object.fromEntries(keys.map((key, index) => [key, values[index]]));
const deepEqual = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export interface RequestContextResult {
  version: string; seasonId: number; dateFrom: string; eventThroughDate: string; snapshotUTC: string; statementUTC: string; columnsSHA256: string;
  keySeal: { ids: number[]; rows: number }; rows: unknown[];
}

export function buildRequestFromContextV1(result: RequestContextResult, options: { capturedAtUTC: string }) {
  need(result && result.version === REQUEST_CONTEXT_VERSION && result.seasonId === SEASON, "context_version_or_season");
  need(result.columnsSHA256 === "c14231f0e62595eed0cb37175360cab33e4731e48a520f22f4bf494e0c127750", "column_contract_changed");
  const eventThrough = result.eventThroughDate;
  need(day(result.dateFrom) && day(eventThrough) && result.dateFrom <= eventThrough, "context_date_scope");
  need(!Number.isNaN(Date.parse(result.snapshotUTC)) && Date.parse(result.snapshotUTC) <= Date.parse(options.capturedAtUTC), "capture_before_snapshot");
  const ids = result.keySeal?.ids;
  need(Array.isArray(ids) && ids.length <= MAX_ROWS && ids.every(positiveId), "cohort_bound_or_id");
  need(deepEqual(ids, [...new Set(ids)].sort((a, b) => a - b)) && result.keySeal.rows === ids.length, "key_seal_shape");
  need(Array.isArray(result.rows) && result.rows.length === ids.length, "missing_or_added_sealed_key");
  const source: Record<Feed, Map<number, Row>> = { wgo: new Map(), individual: new Map(), onIce: new Map(), calendar: new Map() };
  const observed: number[] = [];
  for (const group of result.rows) {
    need(Array.isArray(group) && group.length === 4, "row_group_shape");
    const [wgoValues, ...linked] = group as unknown[][];
    need(Array.isArray(wgoValues) && wgoValues.length === REQUEST_CONTEXT_COLUMNS.wgo.length, "wgo_row_shape");
    const target = zip(REQUEST_CONTEXT_COLUMNS.wgo, wgoValues);
    observed.push(target.id as number);
    need(target.season_id === SEASON && day(target.date) && (target.date as string) >= result.dateFrom && (target.date as string) <= eventThrough, "wgo_out_of_scope");
    FEEDS.forEach((feed, index) => {
      const values = index === 0 ? [wgoValues] : linked[index - 1];
      need(Array.isArray(values) && values.length <= MAX_LINKED, "linked_row_bound");
      const withinGroup = new Set<number>();
      for (const value of values as unknown[]) {
        need(Array.isArray(value) && value.length === REQUEST_CONTEXT_COLUMNS[feed].length, "source_row_shape");
        const item = zip(REQUEST_CONTEXT_COLUMNS[feed], value as unknown[]), id = item.id as number;
        need(positiveId(id) && !withinGroup.has(id), "invalid_or_duplicate_linked_id");
        withinGroup.add(id);
        if (feed === "individual" || feed === "onIce") need(item.season === SEASON && item.player_id === target.player_id && item.date_scraped === target.date, "process_join_scope");
        else if (feed === "calendar") need(item.seasonId === SEASON && item.id === target.game_id, "calendar_join_scope");
        const prior = source[feed].get(id);
        if (prior) need(deepEqual(prior, item), "same_id_different_values");
        source[feed].set(id, item);
      }
    });
  }
  need(deepEqual(observed, ids), "sealed_key_order_or_identity");
  const captured = options.capturedAtUTC;
  const rawFiles: Record<string, Buffer> = {};
  const request: Record<string, unknown> = { seasonId: SEASON, eventThroughDate: eventThrough, asOfUTC: captured,
    freshnessPolicy: { id: "blsh-capture-reader-v1-event7days-capture24hours", maxEventAgeDays: 7, maxCaptureAgeHours: 24 } };
  for (const feed of FEEDS) {
    const values = [...source[feed].values()].sort((a, b) => (a.id as number) - (b.id as number));
    const raw = { source: TABLES[feed], columns: REQUEST_CONTEXT_COLUMNS[feed], records: values, capturedAtUTC: captured, snapshotUTC: result.snapshotUTC };
    const rawBytes = encoded(raw);
    rawFiles[`RAW-${feed}.json`] = rawBytes;
    const capture = { source: TABLES[feed], sha256: sha(rawBytes), retrievedAtUTC: captured, sourceAvailableThroughUTC: null, revisionId: null };
    const rows = feed === "wgo"
      ? values.map(row => ({ ...Object.fromEntries(CONTEXT_KEYS.map(key => [key, row[key]])), counts: Object.fromEntries(REQUEST_CONTEXT_COLUMNS.wgo.filter(key => !CONTEXT_KEYS.includes(key)).map(key => [key, row[key]])) }))
      : values;
    request[feed] = feed === "individual" || feed === "onIce" ? { capture, rows, strengthScope: "unknown", dateMeaning: "unknown", toiUnit: "unknown" } : { capture, rows };
  }
  request.captureContext = REQUEST_CONTEXT_CAPTURE;
  return { rawFiles, request, rows: Object.fromEntries(FEEDS.map(feed => [feed, source[feed].size])) };
}
