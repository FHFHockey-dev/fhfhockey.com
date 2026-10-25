// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { canonicalJson, instant, rehearseRecovery, recoverySql } from "./rehearse-exhausted-tweet-recovery";

function fixture() {
  const observedAt = "2026-10-14T00:40:35Z";
  const definitions: Array<{ id: string; tweet: string; source: string; team: 1 | 22; game: number; received: string }> = [
    { id: "46b36f2f-68b8-4333-9d63-1e5934f96d81", tweet: "2110076030937362799", source: "gamedaynewsnhl", team: 22, game: 2026020104, received: "2026-10-13T18:38:24Z" },
    { id: "243f805f-0f45-4559-af7f-5bcf21b773dd", tweet: "2110075994304282818", source: "gamedaygoalies", team: 22, game: 2026020104, received: "2026-10-13T18:37:45Z" },
    { id: "452fb725-93bb-438b-adbf-4ddb8cb98004", tweet: "2110098376381604210", source: "gamedaynewsnhl", team: 1, game: 2026020090, received: "2026-10-13T20:08:37Z" },
  ];
  const bodies = { 1: "Injury1", 22: "Goalie22 Injury22" };
  const published = { 1: "2026-10-13T20:00:00Z", 22: "2026-10-13T18:31:00Z" };
  const interpretation = (team: 1 | 22) => ({ version: "2026-10-10.2", context: "game", units: [] as Record<string, unknown>[], unresolved: [],
    events: team === 1 ? [{ kind: "injury", playerId: 11, playerName: "Injury1", availability: "out", evidence: { start: 0, end: 7, text: "Injury1" } }]
      : [{ kind: "goalie", playerId: 220, state: "projected", evidence: { start: 0, end: 8, text: "Goalie22" } },
        { kind: "injury", playerId: 221, playerName: "Injury22", availability: "out", evidence: { start: 9, end: 17, text: "Injury22" } }],
  });
  const events = definitions.map(row => ({ id: row.id, tweet_id: row.tweet, source_key: row.source,
    processing_status: "failed", received_at: row.received, text: bodies[row.team], raw_payload: { note: "retained" } }));
  const jobs = definitions.map(row => ({ job_key: `ingest:line_source_ifttt_events:${row.id}`, status: "failed", attempts: 8,
    failure_stage: "projection_storage", lease_expires_at: null }));
  const rawSnapshots = definitions.map(row => ({ tweet_id: row.tweet, source_key: row.source, team_id: row.team, game_id: row.game,
    capture_key: `raw:${row.tweet}`, snapshot_date: "2026-10-13", status: "observed", nhl_filter_status: "accepted",
    raw_text: bodies[row.team], unmatched_names: null, observed_at: row.received, tweet_posted_at: published[row.team],
    metadata: { interpretation: interpretation(row.team) } }));
  const reports = ([1, 22] as const).map(team => {
    const source = definitions.find(row => row.team === team && row.source === (team === 22 ? "gamedaygoalies" : "gamedaynewsnhl"))!;
    return { report_key: `report:${team}`, game_id: source.game, team_id: team, report_date: "2026-10-13", interpretation_version: "2026-10-10.2",
      payload: { key: `report:${team}`, text: bodies[team], publishedAt: published[team], receivedAt: source.received,
        originalUrl: null, provenance: { relayTweetId: source.tweet, attributionStatus: "pending" }, interpretation: interpretation(team) } };
  });
  const childSnapshots = reports.flatMap(report => report.payload.interpretation.events.map(event => ({
    capture_key: `${report.report_key}:${event.kind}`, source: "tweet_projection", game_id: report.game_id, team_id: report.team_id,
    status: "observed", nhl_filter_status: "accepted", raw_payload: { sources: [{ table: "line_source_snapshots",
      snapshot: rawSnapshots.find(row => row.tweet_id === report.payload.provenance.relayTweetId)! }] },
  })));
  const goalies = [{ id: "goalie", source_capture_key: "report:22:goalie", game_id: 2026020104, team_id: 22, player_id: 220,
    observation_status: "projected", accepted: true, parser_version: "2026-10-10.2", observed_at: published[22], available_at: definitions[1].received }];
  const lineups = ([1, 22] as const).map(team => ({ id: `injury:${team}`, source_capture_key: `report:${team}:injury`,
    game_id: team === 1 ? 2026020090 : 2026020104, team_id: team, classification: "injury", accepted: true, parser_version: "2026-10-10.2",
    observed_at: published[team], available_at: team === 1 ? definitions[2].received : definitions[1].received }));
  const assignments = lineups.map(row => ({ id: `assignment:${row.team_id}`, snapshot_id: row.id, player_id: row.team_id === 1 ? 11 : 221,
    raw_player_name: `Injury${row.team_id}`, unit_type: "injury", assignment_status: "ruled_out" }));
  const targets = ([1, 22] as const).flatMap(team => Array.from({ length: 10 }, (_, index) => {
    const date = new Date(Date.UTC(2026, 9, 13 + index)).toISOString().slice(0, 10);
    return { id: index ? team * 100 + index : team === 1 ? 2026020090 : 2026020104,
      team_id: team, ordinal: index + 1, seasonId: 20262027, date,
      startTime: index ? `${date}T22:00:00Z` : team === 1 ? "2026-10-13T22:00:00Z" : "2026-10-14T02:30:00Z",
      homeTeamId: team, awayTeamId: 30, type: 2 };
  }));
  const canonicalGames = targets.map(({ team_id: _team, ordinal: _ordinal, ...game }) => game);
  const scheduleRows = canonicalGames.flatMap(game => [game.homeTeamId, game.awayTeamId].map((team, index) => ({
    id: game.id * 2 + index, source_game_id: game.id, source_season_id: game.seasonId, season: "2026", game_type: 2,
    game_date: game.date, team_id: team, opponent_team_id: index ? game.homeTeamId : game.awayTeamId,
    team_abbreviation: index ? "MTL" : "TOR", opponent_abbreviation: index ? "TOR" : "MTL", home_away: index ? "away" : "home",
    start_time: game.startTime, game_status: "FUT", schedule_status: "OK", fetched_at: "2026-10-14T00:30:00Z",
  })));
  const queue = targets.map(row => ({ scope_key: `game:${row.id}:team:${row.team_id}`, game_id: row.id, team_id: row.team_id,
    status: "succeeded", source_high_watermark: "2026-10-13T21:00:00Z", processed_watermark: "2026-10-13T21:00:00Z", lease_expires_at: null }));
  return { observedAt, events, jobs, rawSnapshots, reports, childSnapshots, goalies, lineups, assignments, targets,
    queue, canonicalGames, canonicalGameCount: 20, scheduleRows, scheduleRowCount: 40, unresolved: [] };
}

describe("bounded retained-ledger recovery", () => {
  it("verifies the three exact receipts with no new captures, queues, global network calls or source-clock changes", async () => {
    const input = fixture(), before = canonicalJson(input), network = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Forbidden network"));
    try {
      const plan = await rehearseRecovery(input, "2026-10-14T01:00:00Z");
      expect(plan).toMatchObject({ capturesInserted: 0, queuesInsertedOrUpdated: 0, eventReceiptsUpdated: 3, jobsUpdated: 3,
        retainedVersion: "2026-10-10.2" });
      expect(new Set(plan.scheduleReadTables)).toEqual(new Set(["games", "roster_optimizer_team_games"]));
      expect(canonicalJson(input)).toBe(before); expect(network).not.toHaveBeenCalled();
      const sql = recoverySql(plan);
      expect(sql.match(/UPDATE public.line_source_ifttt_events/g)).toHaveLength(3);
      expect(sql.match(/UPDATE public.tweet_pipeline_jobs/g)).toHaveLength(3);
      expect(sql).not.toMatch(/INSERT INTO|DELETE FROM|enqueue_player_forecast_job|capture_starter_board|\/api\//i);
      expect(sql).toContain("attempts=attempts+1"); expect(sql).toContain("Original horizon membership changed");
      expect(sql).toContain("FOR SHARE"); expect(sql).toContain("Unexpected receipt-table trigger");
      expect(sql).toContain("LOCK TABLE public.lineup_unresolved_player_names IN SHARE MODE");
      expect(sql).toContain("Read-set drift: lineup_unresolved_player_names");
      expect(sql).toContain('(r."metadata"->>\'captureKey\') IN');
      expect(plan.readSets.at(-1)?.selectors[0].values).toEqual(input.events.map(row => row.tweet_id));
      expect(sql).toContain("jsonb_build_object('id',r.\"id\",'seasonId',r.\"seasonId\"");
      expect(sql).toContain("END;\n$bounded_recovery$;");
    } finally { network.mockRestore(); }
  });
  const rejectCases: Array<[string, (value: ReturnType<typeof fixture>) => void]> = [
    ["foreign event", value => { value.events[0].id = "foreign"; }],
    ["active lease", value => { Object.assign(value.jobs[0], { lease_expires_at: "2026-10-14T02:00:00Z" }); }],
    ["changed attempts", value => { value.jobs[0].attempts = 9; }],
    ["failed queue", value => { value.queue[0].status = "failed"; }],
    ["insufficient queue watermark", value => { value.queue[0].source_high_watermark = "2026-10-13T17:00:00Z"; }],
    ["unknown processed watermark", value => { Object.assign(value.queue[0], { processed_watermark: null }); }],
    ["unprocessed source watermark", value => { value.queue[0].processed_watermark = "2026-10-13T17:00:00Z"; }],
    ["missing capture", value => { value.goalies = []; }],
    ["wrong goalie identity", value => { value.goalies[0].player_id++; }],
    ["future publication", value => { value.goalies[0].observed_at = "2026-10-14T02:00:00Z"; }],
    ["changed injury assignment", value => { value.assignments[0].assignment_status = "observed"; }],
    ["unresolved review", value => { Object.assign(value, { unresolved: [{ id: "pending" }] }); }],
    ["unrelated line units", value => { value.rawSnapshots[0].metadata.interpretation.units.push({ situation: "es_forward" }); }],
    ["new parser version", value => { value.rawSnapshots[0].metadata.interpretation.version = "2026-10-13.1"; }],
    ["changed original horizon", value => { value.targets[0].ordinal = 2; }],
    ["incomplete discovery", value => { value.canonicalGameCount++; }],
    ["future cache receipt", value => { value.scheduleRows[0].fetched_at = "2026-10-14T02:00:00Z"; }],
    ["required time conflict", value => { value.scheduleRows[0].start_time = "2026-10-13T23:00:00Z"; }],
  ];
  it.each(rejectCases)("fails closed without emitting SQL: %s", async (_name, mutate) => {
    const input = fixture(); mutate(input);
    await expect(rehearseRecovery(input, "2026-10-14T01:00:00Z")).rejects.toThrow();
  });
  it("does not treat malformed event spans as valid retained evidence", async () => {
    const input = fixture(); input.reports[0].payload.interpretation.events[0].evidence.end++;
    input.rawSnapshots[2].metadata.interpretation = structuredClone(input.reports[0].payload.interpretation);
    input.childSnapshots.find(row => row.team_id === 1)!.raw_payload.sources[0].snapshot.metadata.interpretation = structuredClone(input.reports[0].payload.interpretation);
    await expect(rehearseRecovery(input, "2026-10-14T01:00:00Z")).rejects.toThrow("span");
  });
  it("escapes untrusted JSON and chooses a delimiter absent from the SQL body", async () => {
    const input = fixture(); input.events[0].raw_payload.note = "' $bounded_recovery$ ; DROP TABLE example; --";
    const sql = recoverySql(await rehearseRecovery(input, "2026-10-14T01:00:00Z"));
    expect(sql).toContain("'' $bounded_recovery$"); expect(sql).toMatch(/DO \$bounded_recovery_[a-f0-9]{20}\$/);
    expect(sql.match(/UPDATE public./g)).toHaveLength(6);
  });
  it("rejects a changed plan rather than generating a wider executor", async () => {
    const plan = await rehearseRecovery(fixture(), "2026-10-14T01:00:00Z"); plan.events[0].id = "foreign";
    expect(() => recoverySql(plan)).toThrow("hash");
  });
  it("rejects the reviewer's one-microsecond capture mismatch", async () => {
    const input = fixture(); input.goalies[0].available_at = "2026-10-13T18:37:45.000001+00:00";
    await expect(rehearseRecovery(input, "2026-10-14T01:00:00Z")).rejects.toThrow("Capture clock");
  });
  it("requires processed coverage through the exact microsecond and accepts exact equality", async () => {
    const input = fixture(), entry = input.queue.find(row => row.team_id === 22)!;
    entry.processed_watermark = "2026-10-13T18:37:44.999999Z";
    await expect(rehearseRecovery(input, "2026-10-14T01:00:00Z")).rejects.toThrow("Queue coverage");
    entry.processed_watermark = "2026-10-13T18:37:45.000000+00:00";
    await expect(rehearseRecovery(input, "2026-10-14T01:00:00Z")).resolves.toMatchObject({ jobsUpdated: 3 });
    entry.source_high_watermark = "2026-10-13T18:37:44.999999Z";
    await expect(rehearseRecovery(input, "2026-10-14T01:00:00Z")).rejects.toThrow("Queue coverage");
  });
  it("accepts only the deployed producer's exact millisecond derivation while preserving full source clocks", async () => {
    const input = fixture(); input.reports[1].payload.receivedAt = "2026-10-13T18:37:45.000418Z";
    input.events[1].received_at = input.rawSnapshots[1].observed_at = input.reports[1].payload.receivedAt;
    const plan = await rehearseRecovery(input, "2026-10-14T01:00:00Z");
    expect(plan.readSets.find(set => set.table === "tweet_projection_reports")?.expected[1]).toEqual(input.reports[1]);
    input.goalies[0].available_at = "2026-10-13T18:37:45.000001Z";
    await expect(rehearseRecovery(input, "2026-10-14T01:00:00Z")).rejects.toThrow("Capture clock");
  });
  it("normalizes timezone offsets without discarding precision and rejects unsupported or invalid clocks", () => {
    expect(instant("2026-10-13T18:37:45.971001Z")).toBe(instant("2026-10-13T14:37:45.971001-04:00"));
    expect(instant("2026-10-13T18:37:45.971001Z") - instant("2026-10-13T18:37:45.971Z")).toBe(BigInt(1));
    for (const clock of ["2026-02-30T18:37:45Z", "2026-10-13T18:37:45.9710001Z", "2026-10-13T18:37:45", "2026-10-13T18:37:45+15:00"]) {
      expect(() => instant(clock)).toThrow();
    }
  });
});
