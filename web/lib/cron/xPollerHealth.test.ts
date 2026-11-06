import { describe, expect, it } from "vitest";
import { assessPollerHealth, summariseReads, summariseRunCadence, type PollRunRow } from "./xPollerHealth";

const START = "2026-11-06T00:00:00.000Z";
const END = "2026-11-06T01:00:00.000Z";
const at = (minute: number) => new Date(Date.parse(START) + minute * 60_000).toISOString();
const run = (id: number, minute: number, source_key: string, ok: boolean): PollRunRow => ({ response_id: id, run_at: at(minute), source_key, ok, enqueue_error: null });

describe("summariseReads", () => {
  it("counts successes and the longest and current failure streaks, treating an absent entry as a failure", () => {
    const runs = [
      run(1, 2, "dfo", true), run(2, 4, "dfo", false), run(3, 6, "dfo", false), run(3, 6, "ccc", true),
      run(4, 8, "dfo", true), run(5, 10, "ccc", true), // run 5 has no dfo entry
    ];
    expect(summariseReads(runs, "dfo")).toEqual({ runs: 5, ok: 2, rate: 0.4, longestFailStreak: 2, currentFailStreak: 1, lastOkAt: at(8),
      mirrorReads: 0, unrecoveredGaps: 0 });
  });

  it("counts mirror reads and unrecovered gaps from poller v6", () => {
    const runs = [{ ...run(1, 2, "dfo", true), via: "mirror" }, { ...run(2, 4, "dfo", true), via: "public", gap_state: "unrecovered" },
      { ...run(3, 6, "dfo", false), via: "mirror" }];
    expect(summariseReads(runs, "dfo")).toMatchObject({ ok: 2, mirrorReads: 1, unrecoveredGaps: 1 });
  });
});

describe("summariseRunCadence", () => {
  it("matches started runs to captured results and measures gaps from the first captured run", () => {
    const runs = [run(1, 30, "a", true), run(1, 30, "b", true), run(2, 32, "a", true), run(3, 50, "a", true)];
    // Started at 30, 32, 34 (no result), 50 and 52 (no result); captured runs before 30 do not exist, which is not a gap.
    expect(summariseRunCadence(runs, START, END, [at(29.9), at(31.9), at(34), at(49.95), at(52)]))
      .toEqual({ started: 5, captured: 3, missed: 2, longestGapMinutes: 18, lastRunAt: at(50) });
    expect(summariseRunCadence(runs, START, END)).toMatchObject({ started: null, missed: null });
    expect(summariseRunCadence([], START, END, [])).toMatchObject({ captured: 0, missed: 0, longestGapMinutes: 60 });
  });
});

describe("assessPollerHealth", () => {
  const accounts = [
    { sourceKey: "dfofantasy", handle: "DFOFantasy", hasQueue: true },
    { sourceKey: "nhl_rosters", handle: "NHL_Rosters", hasQueue: true },
    { sourceKey: "fhfhockey", handle: "FHFHockey", hasQueue: false },
  ];
  const providers = [
    { source_key: "dfofantasy", provider: "ifttt", switched_at: null },
    { source_key: "nhl_rosters", provider: "fxtwitter", switched_at: at(30) },
    { source_key: "fhfhockey", provider: "ifttt", switched_at: null },
  ];
  const everyRunOk = Array.from({ length: 30 }, (_, index) => accounts.map((account) => run(index + 1, index * 2 + 1, account.sourceKey, true))).flat();
  const sighting = (source_key: string, tweet_id: string, minute: number, extra = {}) =>
    ({ source_key, tweet_id, post_kind: "post", full_text: `Post ${tweet_id}`, original_author_handle: null, first_seen_at: at(minute), ...extra });
  const event = (id: string, source_key: string, tweet_id: string, minute: number, text = `Post ${tweet_id}`) =>
    ({ id, source_key, tweet_id, text, received_at: at(minute) });

  it("measures IFTTT coverage before the switch and enqueue parity after it", () => {
    const health = assessPollerHealth({
      accounts, windowStart: START, windowEnd: END, providers, runs: everyRunOk, alerts: [],
      shadow: [sighting("dfofantasy", "1", 5), sighting("nhl_rosters", "10", 10), sighting("nhl_rosters", "11", 35), sighting("nhl_rosters", "12", 40)],
      ifttt: [event("a", "dfofantasy", "1", 6), event("b", "dfofantasy", "2", 7), event("c", "nhl_rosters", "10", 11)],
      queueRows: [{ source_key: "nhl_rosters", tweet_id: "11", source: "fxtwitter" }],
    });
    const dfo = health.accounts.find((account) => account.sourceKey === "dfofantasy")!;
    expect(dfo.coverage).toMatchObject({ iftttRows: 2, matched: 1, rate: 0.5, missed: 1, samples: [{ tweetId: "2", text: "Post 2" }] });
    expect(dfo.status).toBe("warning"); // one miss: critical needs a low rate and more than one miss
    expect(dfo.enqueue).toBeNull();
    const rosters = health.accounts.find((account) => account.sourceKey === "nhl_rosters")!;
    expect(rosters.provider).toBe("fxtwitter");
    expect(rosters.coverage).toMatchObject({ iftttRows: 1, matched: 1, rate: 1 });
    expect(rosters.enqueue).toMatchObject({ sightings: 2, queuedOnce: 1, missing: 1, viaIfttt: 0, iftttAfterSwitch: 0, samples: [{ tweetId: "12" }] });
    expect(rosters.status).toBe("critical");
    const fhfh = health.accounts.find((account) => account.sourceKey === "fhfhockey")!;
    expect(fhfh.coverage.rate).toBeNull();
    expect(fhfh.status).toBe("healthy");
    expect(health.runs).toMatchObject({ captured: 30, started: null, missed: null });
    expect(health.status).toBe("critical");
  });

  it("counts coverage from the account's first shadow sighting and leaves out posts still in flight", () => {
    const health = assessPollerHealth({
      accounts: [accounts[0]!], windowStart: START, windowEnd: END, providers, runs: everyRunOk, alerts: [], queueRows: [],
      shadowStartedAt: { dfofantasy: at(20) },
      shadow: [sighting("dfofantasy", "3", 25)],
      ifttt: [event("early", "dfofantasy", "1", 5), event("late", "dfofantasy", "3", 26), event("in-flight", "dfofantasy", "4", 55)],
    });
    expect(health.accounts[0]!.coverage).toMatchObject({ from: at(20), iftttRows: 1, matched: 1, rate: 1 });
    expect(health.accounts[0]!.status).toBe("healthy");
  });

  it("warns when IFTTT's newest post is more than 20 minutes ahead of the shadow's newest sighting", () => {
    const base = { accounts: [accounts[0]!, accounts[1]!], windowStart: START, windowEnd: END, providers, runs: everyRunOk, alerts: [], queueRows: [] };
    const stale = assessPollerHealth({ ...base,
      shadow: [sighting("dfofantasy", "1", 10), sighting("nhl_rosters", "9", 5)],
      ifttt: [event("a", "dfofantasy", "1", 11), event("b", "dfofantasy", "2", 45)] });
    const dfo = stale.accounts[0]!;
    expect(dfo.staleness).toEqual({ iftttNewestAt: at(45), shadowNewestAt: at(10), lagMinutes: 35, stale: true });
    expect(dfo.status).toBe("warning");
    // Switched accounts have no IFTTT to compare with: last-sighting age only.
    expect(stale.accounts[1]).toMatchObject({ staleness: null, lastSightingAgeMinutes: 55 });
    const fresh = assessPollerHealth({ ...base, shadow: [sighting("dfofantasy", "2", 44)], ifttt: [event("b", "dfofantasy", "2", 45)] });
    expect(fresh.accounts[0]!.staleness).toMatchObject({ lagMinutes: 1, stale: false });
    // A post IFTTT received 5 minutes ago may still be in flight: compared from the newest settled post only.
    const inFlight = assessPollerHealth({ ...base, shadow: [sighting("dfofantasy", "1", 10)], ifttt: [event("a", "dfofantasy", "1", 11), event("c", "dfofantasy", "3", 55)] });
    expect(inFlight.accounts[0]!.staleness).toMatchObject({ iftttNewestAt: at(11), stale: false });
  });

  it("flags IFTTT rows after the switch and a repost queued by both providers", () => {
    const health = assessPollerHealth({
      accounts: [accounts[1]!], windowStart: START, windowEnd: END, providers, runs: everyRunOk, alerts: [],
      shadow: [sighting("nhl_rosters", "20", 32, { post_kind: "repost", original_author_handle: "NHLFlyers", full_text: "Flyers recall a forward from Lehigh Valley today" })],
      ifttt: [event("r", "nhl_rosters", "777", 33, "RT @NHLFlyers: Flyers recall a forward from Lehigh Valley today")],
      queueRows: [{ source_key: "nhl_rosters", tweet_id: "20", source: "fxtwitter" }],
    });
    expect(health.accounts[0]!.enqueue).toMatchObject({ sightings: 1, queuedOnce: 0, missing: 0, doubleQueued: 1, iftttAfterSwitch: 1 });
    expect(health.accounts[0]!.status).toBe("warning");
  });

  it("reports open watchdog incidents and degrades without run history or the switch table", () => {
    const health = assessPollerHealth({
      accounts: [accounts[0]!], windowStart: START, windowEnd: END, providers: null, runs: null, shadow: [], ifttt: [], queueRows: [],
      alerts: [
        { alert_key: "poller_stalled", active: true, first_seen_at: at(50), detail: { note: "No poller result" } },
        { alert_key: "account_down:dfofantasy", active: true, first_seen_at: at(40), detail: {} },
        { alert_key: "fxtwitter_down", active: false, first_seen_at: at(1), detail: {} },
      ],
    });
    expect(health.incidents).toEqual([{ key: "poller_stalled", since: at(50), note: "No poller result" }]);
    expect(health.accounts[0]!.incidents.map((incident) => incident.key)).toEqual(["account_down:dfofantasy"]);
    expect(health.accounts[0]!.reads).toBeNull();
    expect(health.runs).toBeNull();
    expect(health.warnings.join(" ")).toMatch(/x_timeline_poll_runs/);
    expect(health.warnings.join(" ")).toMatch(/tweet_intake_providers/);
    expect(health.status).toBe("critical");
  });

  it("warns on a long gap between captured runs and on started runs that left no result", () => {
    const health = assessPollerHealth({
      accounts: [accounts[0]!], windowStart: START, windowEnd: END, providers, alerts: [], shadow: [], ifttt: [], queueRows: [],
      runs: [run(1, 1, "dfofantasy", true), run(2, 59, "dfofantasy", true)], startedRunTimes: [at(1), at(20), at(40), at(59)],
    });
    expect(health.runs).toMatchObject({ longestGapMinutes: 58, started: 4, captured: 2, missed: 2 });
    expect(health.status).toBe("warning");
    expect(health.warnings).toEqual([expect.stringMatching(/58 minutes/), "2 of 4 poller runs left no result (auth failure, timeout or empty body)."]);
  });
});
