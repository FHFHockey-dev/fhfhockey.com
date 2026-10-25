import { createHash } from "node:crypto";
import { YAHOO_FANTASY_API_BASE_URL } from "../integrations/yahoo/liveDraft";
import { yahooPlanningPlayers } from "../integrations/yahoo/rosterPlanning";
import { yahooFields, yahooValue } from "../integrations/yahoo/starterBoard";
import { forgeRosterRevision } from "../projections/issuedContext";
import { classifyCurrentRosterInjuryEvidence, type CurrentRosterInjuryEvidence } from "./currentRosterInjuryEvidence";
import { playerForecastSourcePayloadHash as hash } from "./sourceSnapshot";

/** v2 FORGE `universe` stage, offline half: the owned Yahoo roster plus the first two available-player pages
 * (sort=OR), bound to canonical identities by one read-only SQL. Name matches are diagnostics only, an
 * unresolved identity is listed and never guessed, and injury statuses only propose knownConflict values. */
export type YahooUniverseScope = { leagueKey: string; teamKey: string; seasonId: number };
export type YahooUniverseReceipt = { url: string; capturedAt: string; responseDate: string | null; bodySha256: string; rawBody: string };
export type YahooUniversePlayer = { playerId: number; nhlPlayerId: number; teamId: number; class: "skater" | "goalie";
  universe: "owned" | "candidate"; rosterRevision: string; yahooPlayerKey: string };
type Row = Record<string, any>;
type Entry = { key: string; universe: "owned" | "candidate"; row: Row; receipt: YahooUniverseReceipt };
type Unresolved = { yahooPlayerKey: string; universe: "owned" | "candidate"; reasons: string[] };

export const YAHOO_UNIVERSE_PAGE_STARTS = Object.freeze([0, 25]);
const PAGE_SIZE = 25, BODY_BYTES = 1024 * 1024, CLOCK_SKEW_MS = 120000, DAY_MS = 86400000;
const fail = (reason: string): never => { throw new Error(reason); };
const sha = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");
const text = (value: unknown) => typeof value === "string" || typeof value === "number" ? String(value) : null;
const nyDate = (instant: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York",
  year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(instant));
const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
const positive = (value: unknown) => Number.isSafeInteger(value) && Number(value) > 0;

export function yahooUniverseContext(scope: YahooUniverseScope) {
  const gameKey = /^(\d+)\.l\.\d+$/.exec(scope?.leagueKey ?? "")?.[1], season = String(scope?.seasonId ?? "");
  if (!gameKey || !/^\d+\.l\.\d+\.t\.\d+$/.test(scope.teamKey) || !scope.teamKey.startsWith(`${scope.leagueKey}.t.`)
    || !/^\d{8}$/.test(season) || Number(season.slice(0, 4)) + 1 !== Number(season.slice(4))) fail("invalid_yahoo_universe_scope");
  return { gameKey: gameKey!, contextKey: `yahoo:game:${gameKey}:season:${season.slice(0, 4)}` };
}

/** The exact provider URLs, as `fetchYahooBoardResource` builds them for standard JSON. */
export function yahooUniverseRequestUrls(scope: YahooUniverseScope, date: string) {
  yahooUniverseContext(scope);
  if (!validDate(date)) fail("invalid_date");
  return [`${YAHOO_FANTASY_API_BASE_URL}/team/${scope.teamKey}/roster;date=${date}?format=json`,
    ...YAHOO_UNIVERSE_PAGE_STARTS.map(start => `${YAHOO_FANTASY_API_BASE_URL}/league/${scope.leagueKey}/players;status=A;sort=OR;start=${start};count=${PAGE_SIZE}/ownership?format=json`)];
}

function players(payload: unknown) {
  try { return yahooPlanningPlayers(payload); } catch { return fail("yahoo_player_collection_incomplete"); }
}

/** Original-byte verification of the three receipts. Owned and candidate rows keep Yahoo's merged player fields. */
export function parseYahooUniverseCapture(receipts: YahooUniverseReceipt[], scope: YahooUniverseScope, date: string) {
  const urls = yahooUniverseRequestUrls(scope, date), { gameKey } = yahooUniverseContext(scope);
  if (!Array.isArray(receipts) || receipts.length !== urls.length
    || JSON.stringify(receipts.map(receipt => receipt?.url).sort()) !== JSON.stringify([...urls].sort())) fail("yahoo_capture_differs_from_plan");
  const byUrl = new Map(receipts.map(receipt => [receipt.url, receipt]));
  for (const receipt of receipts) {
    const captured = Date.parse(receipt.capturedAt), responded = Date.parse(receipt.responseDate ?? "");
    if (typeof receipt.rawBody !== "string" || !receipt.rawBody.length || Buffer.byteLength(receipt.rawBody) > BODY_BYTES
      || sha(receipt.rawBody) !== receipt.bodySha256) fail("invalid_original_receipt");
    if (!Number.isFinite(captured) || !Number.isFinite(responded) || Math.abs(captured - responded) > CLOCK_SKEW_MS) fail("yahoo_source_clock_unverified");
    if (nyDate(receipt.capturedAt) !== date) fail("yahoo_capture_not_on_run_date");
  }
  const roster = JSON.parse(byUrl.get(urls[0])!.rawBody), rosterFields = yahooFields(yahooValue(roster, "roster"));
  const owned = yahooValue(roster, "is_owned_by_current_login");
  if (text(yahooValue(roster, "team_key")) !== scope.teamKey || text(rosterFields.date) !== date
    || rosterFields.coverage_type !== "date" || !(owned === true || owned === 1 || owned === "1")) fail("yahoo_roster_scope_unverified");
  const entries: Entry[] = [], excluded: Unresolved[] = [], seen = new Set<string>();
  const add = (row: Row, universe: Entry["universe"], receipt: YahooUniverseReceipt) => {
    const key = row.player_key;
    if (!new RegExp(`^${gameKey}\\.p\\.\\d+$`).test(key)) fail("yahoo_player_key_out_of_scope");
    if (seen.has(key)) fail(universe === "owned" ? "yahoo_roster_duplicate" : "availability_pages_changed_or_owned");
    seen.add(key);
    entries.push({ key, universe, row, receipt });
  };
  for (const row of players(roster)) add(row, "owned", byUrl.get(urls[0])!);
  if (!entries.length) fail("yahoo_roster_empty");
  for (const url of urls.slice(1)) {
    const receipt = byUrl.get(url)!, page = JSON.parse(receipt.rawBody), rows = players(page);
    if (text(yahooValue(page, "league_key")) !== scope.leagueKey || rows.length > PAGE_SIZE) fail("yahoo_availability_scope_unverified");
    for (const row of rows) {
      // status=A covers free agents and waivers; any other ownership is a race or scope error, never a candidate.
      if (["freeagents", "waivers"].includes(yahooFields(row.ownership).ownership_type)) add(row, "candidate", receipt);
      else excluded.push({ yahooPlayerKey: String(row.player_key), universe: "candidate", reasons: ["ownership_not_available"] });
    }
  }
  const cutoffAt = receipts.map(receipt => new Date(receipt.capturedAt).toISOString()).sort().at(-1)!;
  return { entries, excluded, cutoffAt, keys: entries.map(entry => entry.key).sort(),
    sources: urls.map(url => { const { capturedAt, responseDate, bodySha256, rawBody } = byUrl.get(url)!;
      return { url, capturedAt, responseDate, bodySha256, bytes: Buffer.byteLength(rawBody) }; }) };
}

/** The one bounded read-only identity query (the 2026-10-16 query plus class, lifecycle and current club
 * membership, which the consumers' rosterRevision is computed from). Keys are validated before interpolation. */
export function yahooUniverseIdentityQuery(keys: string[], scope: YahooUniverseScope) {
  const { gameKey, contextKey } = yahooUniverseContext(scope), season = scope.seasonId;
  if (!Array.isArray(keys) || !keys.length || keys.length > 100 || new Set(keys).size !== keys.length
    || keys.some(key => !new RegExp(`^${gameKey}\\.p\\.\\d+$`).test(key))) fail("invalid_identity_keys");
  const sorted = [...keys].sort(), scoped = `provider='yahoo' AND {t}.context_key='${contextKey}'
           AND {t}.season_id=${season} AND {t}.verification_status='verified'`;
  const sql = `BEGIN READ ONLY;
SET LOCAL statement_timeout = '8s';
SET LOCAL TimeZone = 'UTC';
WITH requested(external_player_id) AS (
  VALUES ${sorted.map(key => `('${key}')`).join(",\n    ")}
)
SELECT q.external_player_id AS requested_external_player_id,
       m.external_player_id, m.canonical_id, m.nhl_player_id,
       m.verification_status, m.canonical_verification_status,
       m.context_key, m.season_id, m.canonical_position, m.lifecycle_status, m.canonical_name,
       (SELECT count(*) FROM public.fhfh_player_external_identities r
         WHERE r.${scoped.replaceAll("{t}", "r")}
           AND r.external_player_id=q.external_player_id) AS reverse_owner_count,
       CASE WHEN m.canonical_id IS NOT NULL THEN
         (SELECT count(*) FROM public.fhfh_player_external_identities f
           WHERE f.${scoped.replaceAll("{t}", "f")}
             AND f.fhfh_player_id=m.canonical_id) END AS forward_mapping_count,
       CASE WHEN m.nhl_player_id IS NOT NULL THEN
         (SELECT count(*) FROM public.fhfh_player_identities c2
           WHERE c2.nhl_player_id=m.nhl_player_id AND c2.verification_status='verified'
             AND c2.merged_into_id IS NULL) END AS canonical_nhl_owner_count,
       CASE WHEN m.nhl_player_id IS NOT NULL THEN
         (SELECT coalesce(json_agg(json_build_object('teamId', s."teamId", 'createdAt', s.created_at) ORDER BY s.created_at, s."teamId"), '[]'::json)
           FROM (SELECT ro."teamId", ro.created_at FROM public.rosters ro
                  WHERE ro."playerId"=m.nhl_player_id AND ro."seasonId"=${season} AND ro.is_current
                  ORDER BY ro.created_at, ro."teamId" LIMIT 11) s) END AS current_roster_memberships
FROM requested q
LEFT JOIN LATERAL (
  SELECT e.external_player_id,e.fhfh_player_id AS canonical_id,c.nhl_player_id,
         e.verification_status,c.verification_status AS canonical_verification_status,
         e.context_key,e.season_id,c.canonical_position,c.lifecycle_status,c.canonical_name
  FROM public.fhfh_player_external_identities e
  JOIN public.fhfh_player_identities c ON c.id=e.fhfh_player_id
  WHERE e.${scoped.replaceAll("{t}", "e")}
    AND e.external_player_id=q.external_player_id
    AND c.verification_status='verified' AND c.merged_into_id IS NULL
  ORDER BY e.fhfh_player_id,c.nhl_player_id
  LIMIT 2
) m ON true
ORDER BY q.external_player_id,m.canonical_id,m.nhl_player_id
LIMIT ${2 * sorted.length + 1};
COMMIT;
`;
  return { version: "forge-daily-yahoo-identity-query-v1", keys: sorted, sql, sqlSha256: sha(sql) };
}

/** Exactly one verified mapping with reverse, forward and NHL-owner counts all 1; anything else is listed. */
export function resolveYahooUniverseIdentities(capture: ReturnType<typeof parseYahooUniverseCapture>, rows: Row[], scope: YahooUniverseScope) {
  const { contextKey } = yahooUniverseContext(scope), keys = new Set(capture.keys);
  if (!Array.isArray(rows) || rows.length > 2 * keys.size + 1 || rows.some(row => !keys.has(row?.requested_external_player_id))
    || [...keys].some(key => !rows.some(row => row.requested_external_player_id === key))) fail("identity_rows_differ_from_query");
  const players: YahooUniversePlayer[] = [], unmapped: Unresolved[] = [], ambiguous: Unresolved[] = [], membershipUnresolved: Unresolved[] = [];
  const diagnostics: Array<{ yahooPlayerKey: string; playerId: number; providerName: string | null; canonicalName: string | null }> = [];
  for (const entry of capture.entries) {
    const matches = rows.filter(row => row.requested_external_player_id === entry.key && row.canonical_id != null);
    const unresolved = { yahooPlayerKey: entry.key, universe: entry.universe };
    if (!matches.length) { unmapped.push({ ...unresolved, reasons: ["no_verified_mapping"] }); continue; }
    const [row] = matches, reasons: string[] = [];
    if (matches.length > 1) reasons.push("multiple_verified_mappings");
    if (row.external_player_id !== entry.key || row.verification_status !== "verified" || row.canonical_verification_status !== "verified"
      || row.context_key !== contextKey || Number(row.season_id) !== scope.seasonId) reasons.push("mapping_scope_unverified");
    for (const count of ["reverse_owner_count", "forward_mapping_count", "canonical_nhl_owner_count"]) if (Number(row[count]) !== 1) reasons.push(`${count}_not_1`);
    if (!positive(row.canonical_id) || !positive(row.nhl_player_id)) reasons.push("canonical_identity_incomplete");
    // Consumers classify canonical G as goalie and everything else as skater; Yahoo's position type must agree.
    const playerClass = row.canonical_position === "G" ? "goalie" as const : "skater" as const;
    if (entry.row.position_type !== (playerClass === "goalie" ? "G" : "P")) reasons.push("provider_class_conflict");
    if (reasons.length) { ambiguous.push({ ...unresolved, reasons }); continue; }
    const memberships = Array.isArray(row.current_roster_memberships) ? row.current_roster_memberships : null;
    const teams = new Set((memberships ?? []).map((membership: Row) => membership?.teamId));
    if (row.lifecycle_status !== "active_nhl") reasons.push("canonical_not_active_nhl");
    if (!memberships || memberships.length > 10 || memberships.some((membership: Row) => !positive(membership?.teamId)
      || typeof membership.createdAt !== "string" || !Number.isFinite(Date.parse(membership.createdAt)))) reasons.push("roster_membership_unverified");
    else if (teams.size !== 1) reasons.push("no_unique_current_club");
    if (reasons.length) { membershipUnresolved.push({ ...unresolved, reasons }); continue; }
    const teamId = Number([...teams][0]);
    players.push({ playerId: row.canonical_id, nhlPlayerId: row.nhl_player_id, teamId, class: playerClass, universe: entry.universe,
      rosterRevision: forgeRosterRevision({ canonicalId: row.canonical_id, nhlId: row.nhl_player_id, seasonId: scope.seasonId, teamId,
        membershipCreatedAt: memberships!.map((membership: Row) => membership.createdAt) }), yahooPlayerKey: entry.key });
    const normal = (value: unknown) => typeof value === "string" ? value.normalize("NFKD").replace(/[^a-z]/gi, "").toLowerCase() : null;
    const providerName = text(yahooFields(entry.row.name).full);
    if (normal(providerName) !== normal(row.canonical_name)) diagnostics.push({ yahooPlayerKey: entry.key, playerId: row.canonical_id,
      providerName, canonicalName: text(row.canonical_name) });
  }
  // A canonical or NHL identity reached from two provider keys is ambiguous for both.
  for (const field of ["playerId", "nhlPlayerId"] as const) {
    const repeated = new Set(players.filter((player, index) => players.findIndex(other => other[field] === player[field]) !== index).map(player => player[field]));
    for (const player of players.filter(player => repeated.has(player[field]))) {
      ambiguous.push({ yahooPlayerKey: player.yahooPlayerKey, universe: player.universe, reasons: [`duplicate_${field}`] });
    }
    players.splice(0, players.length, ...players.filter(player => !repeated.has(player[field])));
  }
  return { players, unmapped, ambiguous, membershipUnresolved, nameMismatches: diagnostics };
}

/** Proposed only; TJ approves this exact object (by hash) before any knownConflict is applied. */
export const PROPOSED_YAHOO_KNOWN_CONFLICT_POLICY = Object.freeze({
  version: "yahoo-status-known-conflict-policy-v1",
  status: "proposed_pending_tj_approval",
  source: "original Yahoo player payload (roster or available page) at most 24 h before the cutoff",
  gate: "classifyCurrentRosterInjuryEvidence provenance (identity, season, clock, content hash, original payload, player_key binding)",
  conflictStatuses: Object.freeze(["IR", "IR-LT", "IR-NR", "O", "SUSP"]),
  unknownStatuses: Object.freeze(["DTD", "GTD", "NA"]),
  conflictingOrReturnStatus: "unknown",
  unrecognizedStatus: "unknown_and_reported",
  absentStatus: "unknown",
  emitsFalse: false,
  rosterSlotPlacement: "ignored",
});
export const PROPOSED_YAHOO_KNOWN_CONFLICT_POLICY_HASH = hash(PROPOSED_YAHOO_KNOWN_CONFLICT_POLICY);
const PROVENANCE_REASONS = new Set(["identity_or_season_mismatch", "stale_or_invalid_source_clock", "source_provenance_unverified",
  "merged_yahoo_field_freshness_unknown", "yahoo_identity_binding_unverified", "unsupported_provider"]);
const statusFields = ["status", "status_full", "injury_note"] as const;

/** Original-payload evidence for resolved players that carry any Yahoo status field (the 2026-10-16 shape). */
export function yahooUniverseInjuryEvidence(capture: ReturnType<typeof parseYahooUniverseCapture>, players: YahooUniversePlayer[], seasonId: number) {
  const entries = new Map(capture.entries.map(entry => [entry.key, entry]));
  return players.flatMap((player): CurrentRosterInjuryEvidence[] => {
    const entry = entries.get(player.yahooPlayerKey);
    if (!entry || !statusFields.some(field => typeof entry.row[field] === "string" && entry.row[field].trim())) return [];
    const observedAt = new Date(Date.parse(entry.receipt.responseDate!)).toISOString();
    return [{ provider: "yahoo", sourceKind: "original_provider_payload", playerId: player.playerId, nhlPlayerId: player.nhlPlayerId, seasonId,
      sourceId: `yahoo-original:${entry.receipt.bodySha256}:${entry.key}`, observedAt, capturedAt: entry.receipt.capturedAt,
      expiresAt: new Date(Date.parse(observedAt) + DAY_MS).toISOString(), contentHash: hash(entry.row), payload: entry.row }];
  });
}

/** Re-runnable at any later cutoff (for example the inputs stage). Proposes `true` or `null`, never `false`. */
export function proposeYahooKnownConflicts(evidence: CurrentRosterInjuryEvidence[], players: YahooUniversePlayer[], seasonId: number, cutoffAt: string) {
  const policy = PROPOSED_YAHOO_KNOWN_CONFLICT_POLICY, proposedKnownConflicts: Record<number, true | null> = {};
  const classifications = players.map(player => {
    const rows = evidence.filter(row => row.playerId === player.playerId), row = rows.length === 1 ? rows[0] : null;
    const payload = row?.provider === "yahoo" ? row.payload : null, status = text(payload?.status)?.trim().toUpperCase() || null;
    const classifier = row ? classifyCurrentRosterInjuryEvidence(row, player, seasonId, cutoffAt) : null;
    const [proposed, rule]: [true | null, string] = rows.length > 1 ? [null, "multiple_evidence_rows"] : !classifier ? [null, "no_status_fields"]
      : PROVENANCE_REASONS.has(classifier.reason) ? [null, `provenance:${classifier.reason}`]
        : classifier.reason === "conflicting_or_return_status" ? [null, "conflicting_or_return_status"]
          : status && policy.conflictStatuses.includes(status) ? [true, `status:${status}`]
            : status && policy.unknownStatuses.includes(status) ? [null, `status:${status}`]
              : [null, status ? "unrecognized_status" : "status_code_absent"];
    proposedKnownConflicts[player.playerId] = proposed;
    return { playerId: player.playerId, yahooPlayerKey: player.yahooPlayerKey, universe: player.universe,
      fields: payload ? Object.fromEntries(statusFields.map(field => [field, text(payload[field])])) : null,
      classifier, proposedKnownConflict: proposed, rule };
  });
  return { policyVersion: policy.version, policyHash: PROPOSED_YAHOO_KNOWN_CONFLICT_POLICY_HASH, policyStatus: policy.status, cutoffAt,
    classifications, proposedKnownConflicts, review: classifications.filter(row => row.rule === "unrecognized_status").map(row => row.playerId) };
}

/** Membership and field changes against an earlier universe (`players`, or a plan's `universe.players`). */
export function diffYahooUniverse(current: YahooUniversePlayer[], previous: Array<Partial<YahooUniversePlayer>>) {
  const before = new Map(previous.map(player => [player.playerId, player])), after = new Map(current.map(player => [player.playerId, player]));
  const changed = current.flatMap(player => {
    const old = before.get(player.playerId);
    const fields = old ? (["nhlPlayerId", "teamId", "class", "universe", "rosterRevision"] as const)
      .filter(field => old[field] !== undefined && old[field] !== player[field]) : [];
    return fields.length ? [{ playerId: player.playerId, fields }] : [];
  });
  const added = current.filter(player => !before.has(player.playerId)).map(player => player.playerId);
  const removed = previous.filter(player => !after.has(player.playerId!)).map(player => player.playerId!);
  return { unchanged: !added.length && !removed.length && !changed.length, added, removed, changed };
}

export function buildYahooUniverse(args: { receipts: YahooUniverseReceipt[]; identityRows: Row[]; scope: YahooUniverseScope; date: string;
  previous?: Array<Partial<YahooUniversePlayer>> }) {
  const capture = parseYahooUniverseCapture(args.receipts, args.scope, args.date);
  const query = yahooUniverseIdentityQuery(capture.keys, args.scope);
  const resolved = resolveYahooUniverseIdentities(capture, args.identityRows, args.scope);
  const evidence = yahooUniverseInjuryEvidence(capture, resolved.players, args.scope.seasonId);
  const injury = proposeYahooKnownConflicts(evidence, resolved.players, args.scope.seasonId, capture.cutoffAt);
  const count = (universe: string, list: Array<{ universe: string }>) => list.filter(row => row.universe === universe).length;
  const unresolved = [...resolved.unmapped, ...resolved.ambiguous, ...resolved.membershipUnresolved];
  const counts = { owned: count("owned", capture.entries), ownedResolved: count("owned", resolved.players),
    candidates: count("candidate", capture.entries), candidatesResolved: count("candidate", resolved.players),
    candidatesExcluded: capture.excluded.length, unmapped: resolved.unmapped.length, ambiguous: resolved.ambiguous.length,
    membershipUnresolved: resolved.membershipUnresolved.length };
  return { version: "forge-daily-yahoo-universe-v1", date: args.date, seasonId: args.scope.seasonId, leagueKey: args.scope.leagueKey,
    teamKey: args.scope.teamKey, cutoffAt: capture.cutoffAt, sources: capture.sources, identityQuerySha256: query.sqlSha256,
    status: unresolved.length || capture.excluded.length ? "partial" as const : "complete" as const,
    ownedComplete: counts.owned === counts.ownedResolved, counts, players: resolved.players, unmapped: resolved.unmapped,
    ambiguous: resolved.ambiguous, membershipUnresolved: resolved.membershipUnresolved, excluded: capture.excluded,
    nameMismatches: resolved.nameMismatches, change: args.previous ? diffYahooUniverse(resolved.players, args.previous) : null,
    // Evidence and a proposal only: knownConflicts stay withheld until TJ approves the policy hash.
    injury: { ...injury, evidence, knownConflicts: null, knownConflictsStatus: "withheld_pending_policy_approval" as const },
    limitations: ["Two available-player pages are a partial candidate pool; unseen players remain unknown.",
      "Absent Yahoo status fields do not establish health or eligibility.",
      "Club and rosterRevision come from FHFH current roster membership; the official NHL club roster capture still decides listing."],
    networkRequests: 0, databaseWrites: 0 };
}
