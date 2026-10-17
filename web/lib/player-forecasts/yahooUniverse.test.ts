import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { forgeRosterRevision } from "../projections/issuedContext";
import { buildYahooUniverse, diffYahooUniverse, parseYahooUniverseCapture, proposeYahooKnownConflicts, PROPOSED_YAHOO_KNOWN_CONFLICT_POLICY,
  PROPOSED_YAHOO_KNOWN_CONFLICT_POLICY_HASH, yahooUniverseIdentityQuery, yahooUniverseInjuryEvidence, yahooUniverseRequestUrls,
  resolveYahooUniverseIdentities } from "./yahooUniverse";
import { syntheticCapturedAt, syntheticDate, syntheticIdentityRow, syntheticPageBody, syntheticReceipt, syntheticReceipts, syntheticRosterBody,
  syntheticScope, unmappedIdentityRow, type SyntheticPlayer } from "./yahooUniverse.fixtures";
import { playerForecastSourcePayloadHash } from "./sourceSnapshot";

const scope = syntheticScope, date = syntheticDate;
const universe = (owned: SyntheticPlayer[], page0: SyntheticPlayer[], rows: any[], page1: SyntheticPlayer[] = []) =>
  buildYahooUniverse({ receipts: syntheticReceipts(owned, page0, page1), identityRows: rows, scope, date });

describe("Yahoo universe stage", () => {
  it("binds owned and candidate players to canonical identities, classes and consumer roster revisions", () => {
    const result = universe([{ key: "477.p.1" }, { key: "477.p.2", positionType: "G" }], [{ key: "477.p.3" }, { key: "477.p.4", ownership: "waivers" }], [
      syntheticIdentityRow("477.p.1", 101, 8470001), syntheticIdentityRow("477.p.2", 102, 8470002, { canonical_position: "G" }),
      syntheticIdentityRow("477.p.3", 103, 8470003, { current_roster_memberships: [{ teamId: 12, createdAt: "2026-10-02T00:00:00+00:00" },
        { teamId: 12, createdAt: "2026-09-01T00:00:00+00:00" }] }), syntheticIdentityRow("477.p.4", 104, 8470004)]);
    expect(yahooUniverseRequestUrls(scope, date)).toEqual([
      "https://fantasysports.yahooapis.com/fantasy/v2/team/477.l.900.t.3/roster;date=2026-10-20?format=json",
      "https://fantasysports.yahooapis.com/fantasy/v2/league/477.l.900/players;status=A;sort=OR;start=0;count=25/ownership?format=json",
      "https://fantasysports.yahooapis.com/fantasy/v2/league/477.l.900/players;status=A;sort=OR;start=25;count=25/ownership?format=json"]);
    expect(result.status).toBe("complete");
    expect(result.ownedComplete).toBe(true);
    expect(result.cutoffAt).toBe(syntheticCapturedAt);
    expect(result.players.map(({ rosterRevision: _revision, ...player }) => player)).toEqual([
      { playerId: 101, nhlPlayerId: 8470001, teamId: 10, class: "skater", universe: "owned", yahooPlayerKey: "477.p.1" },
      { playerId: 102, nhlPlayerId: 8470002, teamId: 10, class: "goalie", universe: "owned", yahooPlayerKey: "477.p.2" },
      { playerId: 103, nhlPlayerId: 8470003, teamId: 12, class: "skater", universe: "candidate", yahooPlayerKey: "477.p.3" },
      { playerId: 104, nhlPlayerId: 8470004, teamId: 10, class: "skater", universe: "candidate", yahooPlayerKey: "477.p.4" }]);
    expect(result.players[2].rosterRevision).toBe(forgeRosterRevision({ canonicalId: 103, nhlId: 8470003, seasonId: 20262027, teamId: 12,
      membershipCreatedAt: ["2026-09-01T00:00:00+00:00", "2026-10-02T00:00:00+00:00"] }));
    expect(result.injury.knownConflicts).toBeNull();
    expect(result).toMatchObject({ networkRequests: 0, databaseWrites: 0, counts: { owned: 2, ownedResolved: 2, candidates: 2, candidatesResolved: 2 } });
  });

  it("lists unmapped, ambiguous and membership-unresolved identities instead of guessing", () => {
    const keys = Array.from({ length: 9 }, (_, index) => `477.p.${index + 1}`);
    const result = universe(keys.slice(0, 4).map((key, index) => ({ key, positionType: index === 3 ? "G" : "P" })), keys.slice(4).map(key => ({ key })), [
      unmappedIdentityRow("477.p.1"),
      syntheticIdentityRow("477.p.2", 102, 8470002, { reverse_owner_count: 2 }),
      syntheticIdentityRow("477.p.3", 103, 8470003), syntheticIdentityRow("477.p.3", 113, 8470013),
      syntheticIdentityRow("477.p.4", 104, 8470004),
      syntheticIdentityRow("477.p.5", 105, 8470005, { current_roster_memberships: [{ teamId: 10, createdAt: "2026-10-01T00:00:00Z" }, { teamId: 11, createdAt: "2026-10-05T00:00:00Z" }] }),
      syntheticIdentityRow("477.p.6", 106, 8470006, { lifecycle_status: "minor_league" }),
      syntheticIdentityRow("477.p.7", 107, 8470007), syntheticIdentityRow("477.p.8", 107, 8470008),
      syntheticIdentityRow("477.p.9", 109, 8470009, { canonical_name: "Someone Else" })]);
    expect(result.status).toBe("partial");
    expect(result.ownedComplete).toBe(false);
    expect(result.unmapped).toEqual([{ yahooPlayerKey: "477.p.1", universe: "owned", reasons: ["no_verified_mapping"] }]);
    expect(result.ambiguous).toEqual([
      { yahooPlayerKey: "477.p.2", universe: "owned", reasons: ["reverse_owner_count_not_1"] },
      { yahooPlayerKey: "477.p.3", universe: "owned", reasons: ["multiple_verified_mappings"] },
      { yahooPlayerKey: "477.p.4", universe: "owned", reasons: ["provider_class_conflict"] },
      { yahooPlayerKey: "477.p.7", universe: "candidate", reasons: ["duplicate_playerId"] },
      { yahooPlayerKey: "477.p.8", universe: "candidate", reasons: ["duplicate_playerId"] }]);
    expect(result.membershipUnresolved).toEqual([
      { yahooPlayerKey: "477.p.5", universe: "candidate", reasons: ["no_unique_current_club"] },
      { yahooPlayerKey: "477.p.6", universe: "candidate", reasons: ["canonical_not_active_nhl"] }]);
    // A name mismatch is reported but never changes the binding.
    expect(result.players.map(player => player.playerId)).toEqual([109]);
    expect(result.nameMismatches).toEqual([{ yahooPlayerKey: "477.p.9", playerId: 109, providerName: "Synthetic 477.p.9", canonicalName: "Someone Else" }]);
  });

  it("fails closed on plan, scope, clock and identity-row mismatches", () => {
    const urls = yahooUniverseRequestUrls(scope, date), rows = [syntheticIdentityRow("477.p.1", 101, 8470001)];
    const good = syntheticReceipts([{ key: "477.p.1" }], []);
    const replace = (index: number, receipt: any) => good.map((value, i) => i === index ? receipt : value);
    expect(() => parseYahooUniverseCapture(good.slice(0, 2), scope, date)).toThrow("yahoo_capture_differs_from_plan");
    expect(() => parseYahooUniverseCapture(replace(0, { ...good[0], rawBody: `${good[0].rawBody} ` }), scope, date)).toThrow("invalid_original_receipt");
    expect(() => parseYahooUniverseCapture(replace(0, syntheticReceipt(urls[0], syntheticRosterBody([{ key: "477.p.1" }], { teamKey: "477.l.900.t.4" }))), scope, date)).toThrow("yahoo_roster_scope_unverified");
    expect(() => parseYahooUniverseCapture(replace(0, syntheticReceipt(urls[0], syntheticRosterBody([{ key: "477.p.1" }], { owned: 0 }))), scope, date)).toThrow("yahoo_roster_scope_unverified");
    expect(() => parseYahooUniverseCapture(replace(1, syntheticReceipt(urls[1], syntheticPageBody([], "477.l.901"))), scope, date)).toThrow("yahoo_availability_scope_unverified");
    expect(() => parseYahooUniverseCapture(replace(1, syntheticReceipt(urls[1], syntheticPageBody([{ key: "477.p.1" }]))), scope, date)).toThrow("availability_pages_changed_or_owned");
    expect(() => parseYahooUniverseCapture(replace(1, { ...good[1], responseDate: "2026-10-20T10:20:00.000Z" }), scope, date)).toThrow("yahoo_source_clock_unverified");
    expect(() => parseYahooUniverseCapture(replace(2, syntheticReceipt(urls[2], good[2].rawBody, "2026-10-20T03:30:00.000Z")), scope, date)).toThrow("yahoo_capture_not_on_run_date");
    const truncated = JSON.parse(good[0].rawBody); truncated.fantasy_content.team[1].roster[0].players.count = 2;
    expect(() => parseYahooUniverseCapture(replace(0, syntheticReceipt(urls[0], JSON.stringify(truncated))), scope, date)).toThrow("yahoo_player_collection_incomplete");
    const capture = parseYahooUniverseCapture(good, scope, date);
    expect(() => resolveYahooUniverseIdentities(capture, [], scope)).toThrow("identity_rows_differ_from_query");
    expect(() => resolveYahooUniverseIdentities(capture, [...rows, syntheticIdentityRow("477.p.2", 102, 8470002)], scope)).toThrow("identity_rows_differ_from_query");
    // Another manager's player on an availability page is excluded, not a candidate.
    const raced = universe([{ key: "477.p.1" }], [{ key: "477.p.2", ownership: "team" }], rows);
    expect(raced).toMatchObject({ status: "partial", excluded: [{ yahooPlayerKey: "477.p.2", reasons: ["ownership_not_available"] }] });
  });

  it("builds one bounded read-only identity query from validated keys", () => {
    const query = yahooUniverseIdentityQuery(["477.p.30", "477.p.4"], scope);
    expect(query.keys).toEqual(["477.p.30", "477.p.4"]);
    expect(query.sql).toMatch(/^BEGIN READ ONLY;\nSET LOCAL statement_timeout = '8s';\nSET LOCAL TimeZone = 'UTC';/);
    expect(query.sql).toContain("VALUES ('477.p.30'),\n    ('477.p.4')");
    expect(query.sql).toContain("e.provider='yahoo' AND e.context_key='yahoo:game:477:season:2026'");
    expect(query.sql).toContain("c.verification_status='verified' AND c.merged_into_id IS NULL");
    expect(query.sql).toContain("LIMIT 5;\nCOMMIT;");
    expect(query.sqlSha256).toBe(createHash("sha256").update(query.sql).digest("hex"));
    for (const keys of [["477.p.1'); DROP TABLE x; --"], ["453.p.1"], [], ["477.p.1", "477.p.1"]]) {
      expect(() => yahooUniverseIdentityQuery(keys, scope)).toThrow("invalid_identity_keys");
    }
  });

  it("proposes conflicts from status codes only after provenance passes, and never proposes false", () => {
    const owned: SyntheticPlayer[] = [{ key: "477.p.1", status: "IR", statusFull: "Injured Reserve", injuryNote: "Lower Body" },
      { key: "477.p.2", status: "O", statusFull: "Out", injuryNote: "Upper Body" }, { key: "477.p.3", status: "DTD", statusFull: "Day-to-Day", injuryNote: "Concussion" },
      { key: "477.p.4" }, { key: "477.p.5", status: "IR", statusFull: "Healthy scratch" }];
    const page0: SyntheticPlayer[] = [{ key: "477.p.6", status: "IR-LT", statusFull: "Injured Reserve", injuryNote: "Knee" }, { key: "477.p.7", status: "SUSP", statusFull: "Suspended" },
      { key: "477.p.8", status: "NA", statusFull: "Not Active" }, { key: "477.p.9", status: "XYZ" }];
    const rows = [...owned, ...page0].map((player, index) => syntheticIdentityRow(player.key, 101 + index, 8470001 + index));
    const result = universe(owned, page0, rows);
    expect(Object.fromEntries(result.injury.classifications.map(row => [row.playerId, [row.proposedKnownConflict, row.rule]]))).toEqual({
      101: [true, "status:IR"], 102: [true, "status:O"], 103: [null, "status:DTD"], 104: [null, "no_status_fields"], 105: [null, "conflicting_or_return_status"],
      106: [true, "status:IR-LT"], 107: [true, "status:SUSP"], 108: [null, "conflicting_or_return_status"], 109: [null, "unrecognized_status"] });
    // The classifier alone would support the DTD concussion note; the status code keeps it unknown.
    expect(result.injury.classifications[2].classifier).toMatchObject({ status: "injury_supported" });
    expect(result.injury.review).toEqual([109]);
    expect(Object.values(result.injury.proposedKnownConflicts)).not.toContain(false);
    expect(result.injury).toMatchObject({ knownConflicts: null, knownConflictsStatus: "withheld_pending_policy_approval",
      policyHash: PROPOSED_YAHOO_KNOWN_CONFLICT_POLICY_HASH, policyStatus: "proposed_pending_tj_approval" });
    expect(result.injury.evidence).toHaveLength(8);
    // Re-evaluated more than 24 h later, or with altered bytes, the same evidence proposes nothing.
    const later = proposeYahooKnownConflicts(result.injury.evidence, result.players, 20262027, "2026-10-21T11:00:00.000Z");
    expect(new Set(later.classifications.map(row => row.rule))).toEqual(new Set(["provenance:stale_or_invalid_source_clock", "no_status_fields"]));
    const tampered = structuredClone(result.injury.evidence);
    (tampered[1].payload as Record<string, unknown>).status = "IR";
    expect(proposeYahooKnownConflicts(tampered, result.players, 20262027, result.cutoffAt).classifications[1].rule).toBe("provenance:source_provenance_unverified");
  });

  it("pins the proposed policy object by hash", () => {
    expect(PROPOSED_YAHOO_KNOWN_CONFLICT_POLICY_HASH).toBe(playerForecastSourcePayloadHash(PROPOSED_YAHOO_KNOWN_CONFLICT_POLICY));
    expect(PROPOSED_YAHOO_KNOWN_CONFLICT_POLICY_HASH).toBe("9a50f265d169817dd24fef6b6f5154deafe47a4104cd6880d28549f7775e8a66");
  });

  it("diffs membership and fields against an earlier universe", () => {
    const player = { playerId: 1, nhlPlayerId: 11, teamId: 3, class: "skater" as const, universe: "owned" as const, rosterRevision: "a", yahooPlayerKey: "477.p.1" };
    expect(diffYahooUniverse([player], [{ playerId: 1, nhlPlayerId: 11, teamId: 3 }])).toEqual({ unchanged: true, added: [], removed: [], changed: [] });
    expect(diffYahooUniverse([player, { ...player, playerId: 2 }], [{ ...player, rosterRevision: "b", universe: "candidate" }, { playerId: 5 }]))
      .toEqual({ unchanged: false, added: [2], removed: [5], changed: [{ playerId: 1, fields: ["universe", "rosterRevision"] }] });
  });
});

// Retained 2026-10-16 originals (private, outside the repo). Skipped on a clean clone.
const PRIVATE = join(process.env.FHFH_PRIVATE_DIR ?? join(homedir(), "Documents", "FHFH-private"), "forge-rso-completion-20261016-v1");
describe.skipIf(!existsSync(join(PRIVATE, "yahoo-original-sources-v1", "2-yahoo.json")))("Yahoo universe stage on the retained 2026-10-16 originals", () => {
  const read = (path: string) => readFileSync(join(PRIVATE, path), "utf8"), json = (path: string) => JSON.parse(read(path));
  // Loaded inside the tests: a skipped suite's body still runs during collection.
  let loaded: ReturnType<typeof load> | undefined;
  const fixture = () => loaded ??= load();
  function load() {
    const allocation = json("yahoo-original-sources-v1/allocation.json"), clocks = json("fresh-yahoo-reconciliation-v1/reconciliation.json").sourceClocks;
    const fixtureScope = { leagueKey: allocation.yahooLeagueKey, teamKey: allocation.yahooTeamKey, seasonId: allocation.targetSeasonId };
    const receipts = yahooUniverseRequestUrls(fixtureScope, allocation.rosterDate).map((url, index) => {
      const rawBody = read(`yahoo-original-sources-v1/${index + 2}-yahoo.json`), clock = clocks[index + 1];
      expect(createHash("sha256").update(rawBody, "utf8").digest("hex")).toBe(clock.sha256);
      return { url, capturedAt: clock.capturedAt, responseDate: new Date(clock.responseDate).toISOString(), bodySha256: clock.sha256, rawBody };
    });
    const plan = json("daily-acquisition-contract-20261016-v1/plan.json").universe.players as any[];
    const byCanonical = new Map(plan.map(player => [player.playerId, player]));
    // The 2026-10-16 read predates the class and membership columns; they are supplied from the plan's universe.
    const identityRows = (json("yahoo-mapping-rows-v1.json") as any[]).map(row => ({ ...row, lifecycle_status: "active_nhl", canonical_name: null,
      canonical_position: byCanonical.get(row.canonical_id)?.class === "goalie" ? "G" : "C",
      current_roster_memberships: [{ teamId: byCanonical.get(row.canonical_id)?.teamId, createdAt: "2026-10-01T00:00:00+00:00" }] }));
    return { allocation, fixtureScope, receipts, plan,
      result: buildYahooUniverse({ receipts, identityRows, scope: fixtureScope, date: allocation.rosterDate }) };
  }

  it("reproduces the 19 owned and 50 candidate players and the original identity query keys", () => {
    const { allocation, fixtureScope, receipts, plan, result } = fixture(), query = read("yahoo-mapping-read-proposal-v1/query.sql");
    const originalKeys = [...query.matchAll(/\('(\d+\.p\.\d+)'\)/g)].map(match => match[1]);
    expect(yahooUniverseIdentityQuery(parseYahooUniverseCapture(receipts, fixtureScope, allocation.rosterDate).keys, fixtureScope).keys).toEqual(originalKeys);
    expect(result).toMatchObject({ status: "complete", ownedComplete: true, counts: { owned: 19, ownedResolved: 19, candidates: 50, candidatesResolved: 50 } });
    expect(result.players.map(player => [player.playerId, player.nhlPlayerId, player.teamId, player.class, player.universe]).sort())
      .toEqual(plan.map(player => [player.playerId, player.nhlPlayerId, player.teamId, player.class, player.universe]).sort());
  });

  it("rebuilds the 2026-10-16 Fiala evidence byte-for-byte and proposes conflicts only from explicit statuses", () => {
    const { allocation, fixtureScope, receipts, result } = fixture(), retained = json("fresh-yahoo-reconciliation-v1/current-roster-injury-evidence.json")[0];
    const fiala = result.injury.evidence.find(row => row.playerId === retained.playerId)!;
    expect(fiala).toEqual(retained);
    expect(result.injury.classifications.find(row => row.playerId === retained.playerId))
      .toMatchObject({ classifier: { status: "injury_supported" }, proposedKnownConflict: true, rule: "status:IR" });
    const proposed = result.injury.classifications.filter(row => row.proposedKnownConflict === true);
    expect(proposed).toHaveLength(12);
    expect(proposed.every(row => PROPOSED_YAHOO_KNOWN_CONFLICT_POLICY.conflictStatuses.includes(String(row.fields?.status)))).toBe(true);
    expect(result.injury.classifications.filter(row => row.rule === "status:DTD")).toHaveLength(2);
    expect(result.injury.classifications.filter(row => row.rule === "no_status_fields")).toHaveLength(55);
    expect(Object.values(result.injury.proposedKnownConflicts)).not.toContain(false);
    expect(yahooUniverseInjuryEvidence(parseYahooUniverseCapture(receipts, fixtureScope, allocation.rosterDate), result.players, 20262027)).toHaveLength(14);
  });
});
