import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseLineHistoryQuery, readLineHistory } from "./lineHistory";

const now = new Date("2026-11-12T17:00:00Z");
const query = { mode: "publication", teamId: "54", startDate: "2026-11-04", endDate: "2026-11-10" };
const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");

function report(key = "report-1", overrides: Record<string, unknown> = {}) {
  return {
    report_key: key, team_id: 54, game_id: 2026020001, report_date: "2026-11-05",
    published_at: "2026-11-05T17:00:00Z", received_at: "2026-11-05T17:01:00Z",
    interpretation_version: "v1", created_at: "2026-11-05T17:02:00Z",
    payload: {
      key, teamId: 54, gameId: 2026020001, date: "2026-11-05",
      publishedAt: "2026-11-05T17:00:00Z", originalPublishedAt: "2026-11-05T17:00:00Z",
      receivedAt: "2026-11-05T17:01:00Z", interpretedAt: "2026-11-05T17:02:00Z",
      originalUrl: "https://twitter.com/Reporter/status/123", text: "Practice lines\nA — B",
      provenance: { attributionStatus: "resolved", originalTweetId: "123", private: "SECRET" },
      interpretation: {
        version: "v1", context: "practice", identityContext: { aliases: "SECRET" },
        units: [{ situation: "es_forward", number: 1, complete: false,
          evidence: [{ text: "SECRET" }], players: [{ playerId: 1, name: "Player A", alias: "SECRET" }] }],
      },
    }, ...overrides,
  };
}

function database(data: unknown[], error: unknown = null) {
  const builder = {
    select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(), lte: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(), is: vi.fn().mockReturnThis(), gt: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data, error }),
  };
  return { from: vi.fn(() => builder), builder };
}

function gameClaim(id = "claim-1") {
  return {
    claim_id: id, capture_id: "capture-1", team_id: 54, game_id: 2026020001,
    interpretation_version: "v1", interpreted_at: "2026-11-04T17:02:00Z",
    payload: {
      id, captureId: "capture-1", version: "v1", teamId: 54, gameId: 2026020001,
      text: "Tomorrow vs TOR", kind: "entry", context: "game", phase: "pregame",
      accepted: true, explicit: true, reviewReasons: [], identityStatus: "resolved_at_event",
      identityEvidence: ["verified roster"], publicationEvidence: ["provider_timestamp"],
      time: { originalPublishedAt: "2026-11-04T17:00:00Z", relayPublishedAt: null,
        ingestedAt: "2026-11-04T17:01:00Z", interpretedAt: "2026-11-04T17:02:00Z", effectiveAt: null, effectiveUntil: null },
      binding: { status: "bound", evidence: ["relative_date:tomorrow:2026-11-05", "team_participation:54"],
        resolverVersion: "v1", scheduleIdentity: "2026020001:2026-11-05:OK" },
      decisionEvidence: { producerVersion: "v1", decisionId: "decision-1", sourceReferences: ["SECRET"],
        binding: [{ start: 0, end: 8, text: "Tomorrow" }], phase: [{ start: 0, end: 8, text: "Tomorrow" }] },
      provenance: { attributionStatus: "resolved", originalTweetId: "123" },
      originalIdentity: "123", author: "Reporter", sourceUrl: "https://x.com/Reporter/status/123",
      unit: { situation: "es_forward", number: 1, complete: false, players: [{ playerId: 1, name: "Player A" }] },
    },
  };
}
function gameDatabase(claims: unknown[], games: unknown[] = [
  { id: 2026020001, date: "2026-11-05", startTime: null, homeTeamId: 54, awayTeamId: 10 },
]) {
  const game = database(games), claim = database(claims);
  return { game, claim, from: vi.fn((table: string) => {
    if (table === "games") return game.builder;
    if (table === "line_claim_revisions") return claim.builder;
    throw new Error(`Unexpected table: ${table}`);
  }) };
}

beforeEach(() => {
  vi.stubEnv("TWEET_PIPELINE_INTERPRETATION_ENABLED", "true");
  vi.stubEnv("TWEET_PIPELINE_PUBLISHING_ENABLED", "true");
});
afterEach(() => vi.unstubAllEnvs());

describe("historical report query boundaries", () => {
  it.each([
    { teamId: "0" }, { teamId: "54,team_id.gt.0" }, { teamId: ["54"] },
    { teamId: "9007199254740992" }, { startDate: "2026-02-30" },
    { startDate: "2026-11-11" }, { endDate: "2026-11-10T00:00:00Z" },
    { cursor: "bad" }, { cursor: ["bad"] },
  ])("rejects invalid input before any database filter is built: %j", (invalid) => {
    expect(() => parseLineHistoryQuery({ ...query, ...invalid }, now)).toThrow();
  });

  it("accepts real leap dates and ranges beyond one year without unbounded row reads", () => {
    expect(parseLineHistoryQuery({ ...query, startDate: "2024-02-29" }, now).startDate).toBe("2024-02-29");
  });

  it("rejects cross-scope, future-anchor and filter-injection cursors", async () => {
    const rows = Array.from({ length: 51 }, (_, index) => report(`report-${String(99 - index).padStart(3, "0")}`));
    const first = await readLineHistory(database(rows), parseLineHistoryQuery(query, now));
    const cursor = JSON.parse(Buffer.from(first.nextCursor!, "base64url").toString());
    for (const update of [
      { teamId: 22 }, { startDate: "2026-11-03" }, { endDate: "2026-11-11" },
      { asOf: "2027-01-01T00:00:00.000Z" }, { asOf: "2026-11-12" },
      { sortDate: "2026-11-11" }, { recordKey: "x),team_id.gt.0" }, { mode: "game" },
    ]) expect(() => parseLineHistoryQuery({ ...query, cursor: encode({ ...cursor, ...update }) }, now)).toThrow();
  });
});

describe("historical report reader", () => {
  it("browses retained practice/rejected interpretations by original publication without qualifying games", async () => {
    const practice = gameClaim();
    practice.game_id = null as unknown as number;
    practice.payload.gameId = null as unknown as number;
    practice.payload.context = "practice";
    practice.payload.accepted = false;
    practice.payload.explicit = false;
    practice.payload.reviewReasons = ["identity incomplete"] as never[];
    practice.payload.time.originalPublishedAt = "2026-11-05T04:30:00+00:00"; // Nov 4 Eastern.
    const db = database([practice]);
    const result = await readLineHistory(db, parseLineHistoryQuery({ ...query, mode: "claimPublication", endDate: "2026-11-04" }, now));
    expect(result.items[0]).toMatchObject({ context: "practice", reportDate: "2026-11-04", gameLink: "unlinked", gameDate: null });
    expect(result).toMatchObject({ scannedRecords: 1, skippedRecords: 0 });
    expect(db.builder.is).toHaveBeenCalledWith("game_id", null);
    expect(db.builder.order.mock.calls).toEqual([["interpreted_at", { ascending: true }], ["claim_id", { ascending: true }]]);
  });

  it("advances an empty NULL bucket to one exact bound-game prefix and then terminates", async () => {
    const scope = parseLineHistoryQuery({ ...query, mode: "claimPublication" }, now);
    const first = await readLineHistory(database([]), scope);
    expect(first).toMatchObject({ items: [], scannedRecords: 0, skippedRecords: 0 });
    expect(first.nextCursor).toBeTruthy();
    const discovery = database([{ game_id: 2026020001 }]);
    const candidates = database([gameClaim()]);
    const db = { from: vi.fn().mockReturnValueOnce(discovery.builder).mockReturnValueOnce(candidates.builder) };
    const second = await readLineHistory(db, parseLineHistoryQuery({ ...query, mode: "claimPublication", cursor: first.nextCursor }, now));
    expect(discovery.builder.gt).toHaveBeenCalledWith("game_id", 0);
    expect(discovery.builder.limit).toHaveBeenCalledWith(1);
    expect(candidates.builder.eq).toHaveBeenCalledWith("game_id", 2026020001);
    expect(candidates.builder.is).not.toHaveBeenCalled();
    expect(second.items[0]).toMatchObject({ gameLink: "unverified", gameDate: null });
    const end = database([]);
    const third = await readLineHistory(end, parseLineHistoryQuery({ ...query, mode: "claimPublication", cursor: second.nextCursor }, now));
    expect(end.builder.gt).toHaveBeenCalledWith("game_id", 2026020001);
    expect(end.from).toHaveBeenCalledTimes(1);
    expect(third.nextCursor).toBeNull();
  });

  it.each([null, 2026020001])("keeps zero-match progress and resumes tied times in game prefix %s without counting filtered rows as invalid", async (gameId) => {
    const rows = Array.from({ length: 51 }, (_, index) => {
      const row = gameClaim(`claim-${String(index).padStart(3, "0")}`);
      row.game_id = gameId as unknown as number; row.payload.gameId = gameId as unknown as number;
      return row;
    });
    const selected = { ...query, startDate: "2026-11-05", mode: "claimPublication" };
    const initialCursor = gameId == null ? null : encode({
      v: 1, mode: "claimPublication", teamId: 54, startDate: selected.startDate, endDate: selected.endDate,
      asOf: now.toISOString(), stage: "next", gameId: 0, sortDate: "", recordKey: "",
    });
    const discovery = database([{ game_id: gameId }]);
    const candidates = database(rows);
    const firstDatabase = gameId == null ? candidates : {
      from: vi.fn().mockReturnValueOnce(discovery.builder).mockReturnValueOnce(candidates.builder),
    };
    const first = await readLineHistory(firstDatabase, parseLineHistoryQuery({ ...selected, cursor: initialCursor }, now));
    expect(first).toMatchObject({ items: [], scannedRecords: 50, skippedRecords: 0 });
    const db = database([rows[50]]);
    const next = parseLineHistoryQuery({ ...selected, cursor: first.nextCursor }, now);
    await readLineHistory(db, next);
    if (gameId != null) expect(db.builder.eq).toHaveBeenCalledWith("game_id", gameId);
    expect(db.builder.gte).toHaveBeenCalledWith("interpreted_at", "2026-11-04T17:02:00Z");
    expect(db.builder.or).toHaveBeenCalledWith("interpreted_at.gt.2026-11-04T17:02:00Z,and(interpreted_at.eq.2026-11-04T17:02:00Z,claim_id.gt.claim-049)");
  });

  it("does not leak outside-team, future-asOf or unknown-publication claims", async () => {
    const rows = [gameClaim("wrong-team"), gameClaim("future"), gameClaim("unknown")];
    for (const row of rows) { row.game_id = null as unknown as number; row.payload.gameId = null as unknown as number; }
    rows[0].team_id = 22; rows[0].payload.teamId = 22;
    rows[1].payload.time.originalPublishedAt = "2027-01-01T00:00:00Z";
    rows[2].payload.time.originalPublishedAt = null as unknown as string;
    const result = await readLineHistory(database(rows), parseLineHistoryQuery({ ...query, mode: "claimPublication" }, now));
    expect(result).toMatchObject({ items: [], scannedRecords: 3, skippedRecords: 3 });
  });

  it("defaults to game-date filtering and admits only independently evidenced claim links", async () => {
    const { mode: _mode, ...gameQuery } = query;
    const scope = parseLineHistoryQuery({ ...gameQuery, startDate: "2026-11-05", endDate: "2026-11-05" }, now);
    expect(scope.mode).toBe("game");
    const db = gameDatabase([gameClaim()]);
    const result = await readLineHistory(db, scope);
    expect(db.from.mock.calls.map(([table]) => table)).toEqual(["games", "line_claim_revisions"]);
    expect(db.game.builder.or).toHaveBeenCalledWith("homeTeamId.eq.54,awayTeamId.eq.54");
    expect(db.game.builder.limit).toHaveBeenCalledWith(201);
    expect(db.claim.builder.in).toHaveBeenCalledWith("game_id", [2026020001]);
    expect(db.claim.builder.lte).toHaveBeenCalledWith("interpreted_at", now.toISOString());
    expect(db.claim.builder.limit).toHaveBeenCalledWith(51);
    expect(result.items[0]).toMatchObject({
      id: "claim-1", recordType: "entry", gameLink: "verified", gameDate: "2026-11-05",
      reportDate: "2026-11-04", originalPublishedAt: "2026-11-04T17:00:00.000Z",
    });
    expect(JSON.stringify(result)).not.toMatch(/SECRET|decisionEvidence|publicationEvidence|identityEvidence|provenance/);
  });

  it("skips game IDs without semantic, publication, schedule or identity evidence", async () => {
    const missingBinding = gameClaim("no-binding"); missingBinding.payload.decisionEvidence.binding = [];
    const staleSchedule = gameClaim("stale-schedule"); staleSchedule.payload.binding.scheduleIdentity = "old";
    const unattributed = gameClaim("unattributed"); unattributed.payload.provenance.attributionStatus = "pending";
    const missingIdentity = gameClaim("missing-identity"); missingIdentity.payload.identityEvidence = [];
    const badSpans = gameClaim("bad-spans"); badSpans.payload.decisionEvidence.binding[0].text = "Invented";
    const badOriginal = gameClaim("bad-original"); badOriginal.payload.provenance.originalTweetId = "999";
    const wrongGame = gameClaim("wrong-game"); wrongGame.payload.binding.evidence[0] = "explicit_game:999";
    const result = await readLineHistory(gameDatabase([
      missingBinding, staleSchedule, unattributed, missingIdentity, badSpans, badOriginal, wrongGame,
    ]), parseLineHistoryQuery({ ...query, mode: "game" }, now));
    expect(result.items).toEqual([]);
    expect(result.skippedRecords).toBe(7);
    expect(result.coverage).toBe("unknown");
  });

  it("keeps practice reports out of the game-linked stream even with audited binding", async () => {
    const practice = gameClaim(); practice.payload.context = "practice";
    const result = await readLineHistory(gameDatabase([practice]), parseLineHistoryQuery({ ...query, mode: "game" }, now));
    expect(result.items).toEqual([]);
    expect(result.skippedRecords).toBe(1);
  });

  it("keeps claim versions/corrections and paginates interpretations without selecting active units", async () => {
    const rows = Array.from({ length: 51 }, (_, index) => gameClaim(`claim-${String(99 - index).padStart(3, "0")}`));
    for (const row of rows) {
      row.interpreted_at = "2026-11-04T17:02:00.123456+00:00";
      row.payload.time.interpretedAt = row.interpreted_at;
    }
    rows[0].payload.kind = "entry_correction";
    rows[1].payload.kind = "retraction";
    rows[1].payload.unit = null as unknown as typeof rows[1]["payload"]["unit"];
    const first = await readLineHistory(gameDatabase(rows), parseLineHistoryQuery({ ...query, mode: "game" }, now));
    expect(first.items).toHaveLength(50);
    expect(first.items.slice(0, 2).map((item) => item.recordType)).toEqual(["entry_correction", "retraction"]);
    const next = parseLineHistoryQuery({ ...query, mode: "game", cursor: first.nextCursor }, now);
    const db = gameDatabase([rows[50]]);
    await readLineHistory(db, next);
    expect(db.claim.builder.or).toHaveBeenCalledWith("interpreted_at.lt.2026-11-04T17:02:00.123456+00:00,and(interpreted_at.eq.2026-11-04T17:02:00.123456+00:00,claim_id.lt.claim-050)");
    expect(() => parseLineHistoryQuery({ ...query, cursor: first.nextCursor }, now)).toThrow();
  });

  it("never silently truncates a broad game scope or queries claims for an empty one", async () => {
    const large = gameDatabase([], Array.from({ length: 201 }, () => ({})));
    await expect(readLineHistory(large, parseLineHistoryQuery({ ...query, mode: "game" }, now))).rejects.toThrow("narrower date range");
    expect(large.from).toHaveBeenCalledTimes(1);
    const empty = gameDatabase([], []);
    expect((await readLineHistory(empty, parseLineHistoryQuery({ ...query, mode: "game" }, now))).items).toEqual([]);
    expect(empty.from).toHaveBeenCalledTimes(1);
  });

  it("reads only scoped report rows and returns a narrow sanitized DTO without collapsing versions", async () => {
    const first = report();
    first.payload.text = "via @GameDayLines\nPractice lines";
    const second = report("report-2"); // Same original URL; both versions survive.
    const db = database([first, second]);
    const result = await readLineHistory(db, parseLineHistoryQuery(query, now));
    expect(db.from).toHaveBeenCalledExactlyOnceWith("tweet_projection_reports");
    expect(db.builder.eq).toHaveBeenCalledWith("team_id", 54);
    expect(db.builder.gte).toHaveBeenCalledWith("report_date", "2026-11-04");
    expect(db.builder.lte.mock.calls).toEqual([
      ["report_date", "2026-11-10"], ["created_at", now.toISOString()],
    ]);
    expect(db.builder.limit).toHaveBeenCalledWith(51);
    expect(db.builder.order.mock.calls).toEqual([
      ["report_date", { ascending: false }], ["report_key", { ascending: false }],
    ]);
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toEqual({
      id: "report-1", reportDate: "2026-11-05", gameId: 2026020001,
      gameDate: null, gameLink: "unverified", recordType: "legacy_report",
      originalPublishedAt: "2026-11-05T17:00:00.000Z", storedPublishedAt: "2026-11-05T17:00:00.000Z",
      receivedAt: "2026-11-05T17:01:00.000Z", interpretedAt: "2026-11-05T17:02:00.000Z",
      sourceUrl: "https://x.com/Reporter/status/123", text: "\nPractice lines", context: "practice", version: "v1",
      units: [{ situation: "es_forward", number: 1, complete: false, players: [{ playerId: 1, name: "Player A" }] }],
    });
    expect(JSON.stringify(result)).not.toMatch(/SECRET|GameDayLines|identityContext|evidence|provenance/);
    expect(result).toMatchObject({ coverage: "unknown", correctionHistory: "unverified", skippedRecords: 0 });
  });

  it("anchors keyset pages to the original scope/snapshot and advances past skipped payloads", async () => {
    const rows = Array.from({ length: 51 }, (_, index) => report(`report-${String(99 - index).padStart(3, "0")}`));
    rows[49].payload.teamId = 22;
    const first = await readLineHistory(database(rows), parseLineHistoryQuery(query, now));
    expect(first.items).toHaveLength(49);
    expect(first.skippedRecords).toBe(1);
    const next = parseLineHistoryQuery({ ...query, cursor: first.nextCursor }, new Date("2026-11-13T17:00:00Z"));
    const db = database([rows[50]]);
    const second = await readLineHistory(db, next);
    expect(db.builder.or).toHaveBeenCalledWith("report_date.lt.2026-11-05,and(report_date.eq.2026-11-05,report_key.lt.report-050)");
    expect(db.builder.lte).toHaveBeenCalledWith("created_at", now.toISOString());
    expect(second.items[0].id).toBe("report-049");
    expect(second.nextCursor).toBeNull();
  });

  it("keeps unknown original clocks separate and withholds relay/unsafe source links", async () => {
    const rows = [report("one"), report("two"), report("three")];
    rows[0].payload.originalPublishedAt = null as unknown as string;
    rows[0].payload.originalUrl = "https://x.com/GameDayLines/status/123";
    rows[1].payload.originalUrl = "javascript:alert(1)";
    rows[2].payload.originalUrl = "https://evil.test/Reporter/status/123";
    const result = await readLineHistory(database(rows), parseLineHistoryQuery(query, now));
    expect(result.items[0]).toMatchObject({ originalPublishedAt: null, storedPublishedAt: "2026-11-05T17:00:00.000Z" });
    expect(result.items.map((item) => item.sourceUrl)).toEqual([null, null, null]);
  });

  it("withholds contradictory, pending, missing and anonymous original attribution", async () => {
    const mismatch = report("mismatch"); mismatch.payload.provenance.originalTweetId = "999";
    const pending = report("pending"); pending.payload.provenance.attributionStatus = "pending";
    const missing = report("missing"); delete (missing.payload as Record<string, unknown>).provenance;
    const anonymous = report("anonymous"); anonymous.payload.originalUrl = "https://x.com/unknown/status/123";
    const result = await readLineHistory(database([mismatch, pending, missing, anonymous]), parseLineHistoryQuery(query, now));
    expect(result.items.map((item) => item.sourceUrl)).toEqual([null, null, null, null]);
  });

  it("uses Eastern publication dates across DST rather than UTC calendar dates", async () => {
    const row = report();
    row.payload.originalPublishedAt = "2026-11-06T04:30:00Z"; // Nov 5, 23:30 Eastern.
    const result = await readLineHistory(database([row]), parseLineHistoryQuery(query, now));
    expect(result.items).toHaveLength(1);
    row.payload.originalPublishedAt = "2026-11-05T04:30:00Z"; // Nov 4, 23:30 Eastern: indexed date mismatch.
    const mismatch = await readLineHistory(database([row]), parseLineHistoryQuery(query, now));
    expect(mismatch.items).toEqual([]);
    expect(mismatch.skippedRecords).toBe(1);
  });

  it("skips malformed identities, clocks and nested units without partial private payloads", async () => {
    const rows: unknown[] = [null, { payload: null }, report("bad-game", { game_id: -1 }), report("future", { created_at: "2027-01-01T00:00:00Z" })];
    const badKey = report("bad-key"); badKey.payload.key = "other";
    const badTime = report("bad-time"); badTime.payload.originalPublishedAt = "2026-02-30T17:00:00Z";
    const badUnits = report("bad-units"); badUnits.payload.interpretation.units[0].players[0].playerId = Infinity;
    rows.push(badKey, badTime, badUnits, report("valid"));
    const result = await readLineHistory(database(rows), parseLineHistoryQuery(query, now));
    expect(result.items.map((item) => item.id)).toEqual(["valid"]);
    expect(result.skippedRecords).toBe(7);
  });

  it("makes no query while publishing is disabled and never converts store errors to empty success", async () => {
    const db = database([]);
    vi.stubEnv("TWEET_PIPELINE_PUBLISHING_ENABLED", "false");
    expect(await readLineHistory(db, parseLineHistoryQuery(query, now))).toMatchObject({ enabled: false, items: [] });
    expect(db.from).not.toHaveBeenCalled();
    vi.stubEnv("TWEET_PIPELINE_PUBLISHING_ENABLED", "true");
    await expect(readLineHistory(database([], { message: "private failure" }), parseLineHistoryQuery(query, now))).rejects.toThrow("unavailable");
  });
});
