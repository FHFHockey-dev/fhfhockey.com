import type { NextApiRequest, NextApiResponse } from "next";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dailyPublicationWindow } from "lib/rankings/dailyPublicationPolicy";

const m = vi.hoisted(() => ({
  clients: vi.fn(), claim: vi.fn(), record: vi.fn(), latest: vi.fn(),
  read: vi.fn(), prepare: vi.fn(), publish: vi.fn(),
}));
vi.mock("lib/rankings/dailyPublicationClient", () => ({ createDailyPublicationClients: m.clients }));
vi.mock("lib/rankings/publicationDispatchLedger", () => ({
  claimRankingDispatch: m.claim, recordRankingDispatch: m.record, latestRankingPublicationCutoff: m.latest,
}));
vi.mock("lib/rankings/publicationReadiness", () => ({ readRankingPublicationReadiness: m.read }));
vi.mock("lib/rankings/dailyRankingPair", () => ({ prepareDailyRankingPair: m.prepare, publishDailyRankingPair: m.publish }));
import handler from "../../../../pages/api/internal/rankings-daily-publication";

const cutoff = "2026-11-17";
const releaseSha = "a".repeat(40);
const readiness = { status: "ready", cutoffDate: cutoff, readyAt: "2026-11-18T11:00:00Z",
  sourceDigest: "qualified revision", expectedPlayerIds: [1, 2] };
const work = {}, terminal = {};

async function invoke(options: { token?: string; method?: string; query?: Record<string, string> } = {}) {
  const res = { setHeader: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn() };
  await handler({ headers: { authorization: options.token ?? "Bearer fixture-secret" },
    method: options.method ?? "GET", query: options.query ?? {} } as NextApiRequest, res as unknown as NextApiResponse);
  return { code: res.status.mock.calls[0][0], body: res.json.mock.calls[0][0] };
}

describe("gated daily Rankings route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("CRON_SECRET", "fixture-secret");
    vi.stubEnv("RANKINGS_DAILY_PUBLICATION", cutoff);
    vi.stubEnv("RANKINGS_DAILY_PUBLICATION_RELEASE", releaseSha);
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", releaseSha);
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-18T13:46:05Z"));
    m.clients.mockReturnValue({ work, terminal, requestCount: () => 7 });
    m.claim.mockResolvedValue({ outcome: "claimed", id: "attempt", priorCutoff: "2026-11-14" });
    m.read.mockResolvedValue(readiness);
    m.prepare.mockResolvedValue({ expectedRankingRows: 136 });
    m.publish.mockResolvedValue({ rankings: { dbWrittenRows: 136, windows: [] }, composites: { dbWrittenRows: 2 } });
    m.latest.mockResolvedValue(cutoff);
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });

  it("rejects unauthorized calls, method and date overrides before database access", async () => {
    expect((await invoke({ token: "Bearer wrong" })).code).toBe(401);
    expect((await invoke({ method: "POST" })).code).toBe(405);
    expect((await invoke({ query: { date: "2026-11-12" } })).code).toBe(400);
    expect(m.clients).not.toHaveBeenCalled();
  });
  it.each([["off", "disabled"], ["2026-11-16", "unapproved_date"], ["", "disabled"]])(
    "skips %s without touching a database", async (setting, status) => {
      vi.stubEnv("RANKINGS_DAILY_PUBLICATION", setting);
      expect((await invoke()).body.status).toBe(status);
      expect(m.clients).not.toHaveBeenCalled();
    });
  it("bounds the UTC slot, prior Eastern day, canary and application deadline", () => {
    const at = (t: string) => dailyPublicationWindow("daily", new Date(t));
    expect(at("2026-11-18T13:45:59Z").status).toBe("early");
    expect(at("2026-11-18T13:47:00Z").status).toBe("late");
    expect(at("2027-04-15T13:46:00Z")).toEqual({ status: "open", target: "2027-04-14",
      deadline: Date.parse("2027-04-15T13:48:55Z") });
    expect(at("2027-07-02T13:46:00Z").status).toBe("out_of_season");
    expect(at("2026-11-18T13:46:59Z")).toEqual({ status: "open", target: cutoff,
      deadline: Date.parse("2026-11-18T13:49:54Z") });
    expect(at("2026-11-19T02:00:00Z")).toMatchObject({ status: "late", target: cutoff });
    expect(() => dailyPublicationWindow("2026-02-30", new Date())).toThrow();
  });
  it.each(["", "a", "b".repeat(40)])("refuses an absent, malformed or different deployment SHA", async sha => {
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", sha);
    expect((await invoke()).body.reason).toBe("unapproved_release");
    expect(m.clients).not.toHaveBeenCalled();
  });
  it("requires an explicit release pin and never claims a late run past the hard stop", async () => {
    vi.stubEnv("RANKINGS_DAILY_PUBLICATION_RELEASE", "");
    expect((await invoke()).body.reason).toBe("unapproved_release");
    vi.setSystemTime(new Date("2026-11-18T13:50:00Z"));
    expect((await invoke()).body.reason).toBe("late_dispatch");
    expect(m.clients).not.toHaveBeenCalled();
  });
  it("checks the pinned source again after preparing both outputs, then verifies durable admission", async () => {
    expect((await invoke()).body).toMatchObject({ status: "complete", date: cutoff });
    expect(m.claim).toHaveBeenCalledWith(work, { date: cutoff, season: 20262027 });
    expect(m.read.mock.calls).toEqual(Array(2).fill([{ client: work, season: 20262027,
      cutoffDate: cutoff, lastServedDate: "2026-11-14" }]));
    expect(m.record.mock.calls.map(c => [c[1].stage, c[1].status])).toEqual([
      ["building", "running"], ["publishing", "running"], ["readback", "complete"],
    ]);
    expect(m.record).toHaveBeenLastCalledWith(terminal, expect.objectContaining({
      evidence: expect.objectContaining({ sourceDigest: "qualified revision", cohortCount: 2, durableCutoff: cutoff, releaseSha }),
    }));
  });
  it.each(["busy", "duplicate", "protected"])("exits on a %s durable claim", async outcome => {
    m.claim.mockResolvedValue({ outcome, id: null, priorCutoff: cutoff });
    expect((await invoke()).body.status).toBe(outcome);
    expect(m.read).not.toHaveBeenCalled();
  });
  it("records late, unready, missing baseline and superseded dates without trying either writer", async () => {
    m.read.mockResolvedValue({ status: "blocked", reason: "rolling_incomplete" });
    expect((await invoke()).body.reason).toBe("rolling_incomplete");
    m.read.mockResolvedValueOnce({ status: "no_slate", cutoffDate: cutoff });
    expect((await invoke()).body.reason).toBe("no_slate");
    m.claim.mockResolvedValueOnce({ outcome: "claimed", id: "id", priorCutoff: null });
    expect((await invoke()).body.reason).toBe("missing_previous_marked_pair");
    m.claim.mockResolvedValueOnce({ outcome: "claimed", id: "id", priorCutoff: cutoff });
    expect((await invoke()).body.reason).toBe("already_served");
    vi.setSystemTime(new Date("2026-11-18T13:48:00Z"));
    expect((await invoke()).body.reason).toBe("late_dispatch");
    expect(m.read).toHaveBeenCalledTimes(2);
    expect(m.prepare).not.toHaveBeenCalled();
    expect(m.publish).not.toHaveBeenCalled();
  });
  it("refuses admission if inputs change while building", async () => {
    m.read.mockResolvedValueOnce(readiness).mockResolvedValueOnce({ ...readiness, sourceDigest: "revision two" });
    expect((await invoke()).body).toMatchObject({ status: "blocked", reason: "source_revision_changed" });
    expect(m.publish).not.toHaveBeenCalled();
  });
  it("reports a database readiness failure separately from a source skip", async () => {
    m.read.mockResolvedValue({ status: "blocked", reason: "readiness_read_failed", details: [] });
    expect(await invoke()).toMatchObject({ code: 503, body: { status: "failed", reason: "readiness_read_failed" } });
    expect(m.publish).not.toHaveBeenCalled();
  });
  it("retains custody for uncertain writes and failed durable readback", async () => {
    m.publish.mockRejectedValueOnce(new Error("lost write response"));
    expect(await invoke()).toMatchObject({ code: 503, body: { status: "ambiguous" } });
    m.latest.mockResolvedValueOnce("2026-11-14");
    expect(await invoke()).toMatchObject({ code: 503, body: { status: "ambiguous" } });
    expect(m.record).toHaveBeenLastCalledWith(terminal, expect.objectContaining({ status: "ambiguous", stage: "readback" }));
  });
  it("returns a failure when the terminal receipt cannot be confirmed", async () => {
    m.record.mockImplementation((_client, receipt) => {
      if (receipt.status === "complete") throw Error("unconfirmed terminal RPC");
    });
    expect((await invoke()).code).toBe(503);
    expect(m.publish).toHaveBeenCalledOnce();
  });
});
