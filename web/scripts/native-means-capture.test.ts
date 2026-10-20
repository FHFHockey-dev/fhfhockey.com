// @vitest-environment node
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { collectNativeMeansOriginals, NATIVE_MEANS_CAPTURE_LIMITS, runNativeMeansCapture } from "./native-means-capture";
import { nativeMeansGameUrl, nativeMeansScheduleUrl } from "../lib/player-forecasts/nativeDailyMeansCapture";

const urls = [nativeMeansGameUrl(2026020001, "boxscore"), nativeMeansGameUrl(2026020001, "landing"), nativeMeansScheduleUrl("2026-09-29")];
const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
const dirs: string[] = [];
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });

describe("bounded native means collector", () => {
  it("is serial, spaced, allowlisted and records intent before each request", async () => {
    const order: string[] = [], wait = vi.fn(async () => { order.push("wait"); });
    const network = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      order.push(`fetch:${url}`);
      expect(init).toMatchObject({ redirect: "error", cache: "no-store" });
      return ok({ url });
    }) as unknown as typeof fetch;
    const result = await collectNativeMeansOriginals(urls, (action, fields) => order.push(`${action}:${fields.url}`), { network, wait });
    expect(result.failures).toEqual([]);
    expect(result.receipts.map(receipt => receipt.url)).toEqual(urls);
    expect(result.receipts[0].bodySha256).toBe(createHash("sha256").update(result.receipts[0].rawBody).digest("hex"));
    expect(order.slice(0, 4)).toEqual([`request_intent:${urls[0]}`, `fetch:${urls[0]}`, `response_completed:${urls[0]}`, "wait"]);
    expect(wait).toHaveBeenCalledTimes(2);
    expect(wait).toHaveBeenCalledWith(NATIVE_MEANS_CAPTURE_LIMITS.spacingMs);
  });

  it("refuses foreign, duplicate or over-budget URL sets before any request", async () => {
    const network = vi.fn() as unknown as typeof fetch;
    for (const bad of [["https://api-web.nhle.com/v1/roster/TOR/20262027"],
      [urls[0], urls[0]], ["https://example.com/v1/schedule/2026-09-29"]]) {
      await expect(collectNativeMeansOriginals(bad, () => undefined, { network })).rejects.toThrow("capture_scope_denied");
    }
    await expect(collectNativeMeansOriginals(urls, () => undefined, { network, limits: { requests: 2, totalBytes: 1024 } })).rejects.toThrow("capture_budget_exceeded");
    await expect(collectNativeMeansOriginals(urls, () => undefined, { network, limits: { requests: 401, totalBytes: 1024 } })).rejects.toThrow("capture_ceiling_exceeded");
    expect(network).not.toHaveBeenCalled();
  });

  it("stops at the first failed or oversized response without retrying", async () => {
    const events: string[] = [], wait = async () => undefined;
    const failing = vi.fn(async () => new Response("no", { status: 503 })) as unknown as typeof fetch;
    const failed = await collectNativeMeansOriginals(urls, action => events.push(action), { network: failing, wait });
    expect(failed).toMatchObject({ receipts: [], failures: [{ url: urls[0], reason: "http_status_503" }] });
    expect(failing).toHaveBeenCalledTimes(1);
    expect(events).toEqual(["request_intent", "response_completed", "request_failed"]);
    const huge = vi.fn(async () => new Response("x".repeat(NATIVE_MEANS_CAPTURE_LIMITS.bodyBytes + 1))) as unknown as typeof fetch;
    expect((await collectNativeMeansOriginals(urls, () => undefined, { network: huge, wait })).failures).toEqual([{ url: urls[0], reason: "body_byte_bound" }]);
    const total = vi.fn(async () => ok({ pad: "y".repeat(600) })) as unknown as typeof fetch;
    const capped = await collectNativeMeansOriginals(urls, () => undefined, { network: total, wait, limits: { requests: 10, totalBytes: 1000 } });
    expect(capped.receipts).toHaveLength(1);
    expect(capped.failures).toEqual([{ url: urls[1], reason: "total_byte_bound" }]);
  });
});

describe("native means CLI", () => {
  it("plans offline by default and never touches the network", async () => {
    const dir = mkdtempSync(join(tmpdir(), "native-means-")); dirs.push(dir);
    const write = (name: string, value: unknown) => { const path = join(dir, name), body = JSON.stringify(value); writeFileSync(path, body);
      return [path, createHash("sha256").update(body).digest("hex")]; };
    const [universe, universeSha] = write("universe.json", [{ playerId: 1, nhlPlayerId: 101, teamId: 1, rosterRevision: "r1", playerClass: "skater" }]);
    const [cache, cacheSha] = write("cache.json", { receipts: [] });
    const network = vi.fn() as unknown as typeof fetch, out = join(dir, "out");
    const args = ["capture", "--universe", universe, "--universe-sha256", universeSha, "--cache", cache, "--cache-sha256", cacheSha,
      "--season", "20262027", "--as-of", "2026-10-12T11:00:00.000Z", "--anchor", "2026-09-29", "--out", out];
    const result = await runNativeMeansCapture(args, () => new Date("2026-10-12T11:00:00.000Z"), network);
    expect(result).toMatchObject({ stage: "capture", status: "plan_only", planStatus: "requests_pending", requests: 2, networkRequests: 0, withinDefaultBound: true });
    expect(JSON.parse(readFileSync(join(out, "plan.json"), "utf8")).plan.requests.map((value: any) => value.url))
      .toEqual([nativeMeansScheduleUrl("2026-10-06"), nativeMeansScheduleUrl("2026-09-29")]);
    expect(existsSync(join(out, "ledger.jsonl"))).toBe(false);
    expect(network).not.toHaveBeenCalled();
    await expect(runNativeMeansCapture([...args.slice(0, -1), join(dir, "raised"), "--max-requests", "200"], undefined, network))
      .rejects.toThrow("raised_bound_requires_approval_ref");
  });

  it("reads the forge-daily universe document and records the plan status with the assembled means (A-15, A-17)", async () => {
    const dir = mkdtempSync(join(tmpdir(), "native-means-")); dirs.push(dir);
    const write = (name: string, value: unknown) => { const path = join(dir, name), body = JSON.stringify(value); writeFileSync(path, body);
      return [path, createHash("sha256").update(body).digest("hex")]; };
    const document = { version: "forge-daily-yahoo-universe-v1", date: "2026-10-12", seasonId: 20262027, status: "complete", ownedComplete: true, counts: { owned: 1 },
      unmapped: [], ambiguous: [], membershipUnresolved: [], excluded: [], change: null, injury: { evidence: [] },
      players: [{ playerId: 1, nhlPlayerId: 101, teamId: 1, class: "skater", universe: "owned", rosterRevision: "r1", yahooPlayerKey: "477.p.1" }] };
    const [universe, universeSha] = write("universe.json", document), [cache, cacheSha] = write("cache.json", { receipts: [] }), out = join(dir, "plan");
    const result = await runNativeMeansCapture(["plan", "--universe", universe, "--universe-sha256", universeSha, "--cache", cache, "--cache-sha256", cacheSha,
      "--season", "20262027", "--as-of", "2026-10-12T11:00:00.000Z", "--anchor", "2026-09-29", "--out", out], () => new Date("2026-10-12T11:00:00.000Z"));
    expect(result).toMatchObject({ status: "plan_only", planStatus: "requests_pending", requests: 2 });
    const planBody = readFileSync(join(out, "plan.json"), "utf8"), planSha = createHash("sha256").update(planBody).digest("hex");
    await runNativeMeansCapture(["assemble", "--universe", universe, "--universe-sha256", universeSha, "--cache", cache, "--cache-sha256", cacheSha,
      "--plan", join(out, "plan.json"), "--plan-sha256", planSha, "--cutoff", "2026-10-12T11:00:00.000Z", "--out", join(dir, "means")], () => new Date("2026-10-12T11:00:00.000Z"));
    expect(JSON.parse(readFileSync(join(dir, "means", "means.json"), "utf8")).plan).toMatchObject({ status: "requests_pending", pendingRequests: 2 });
    const [owned, ownedSha] = write("incomplete.json", { ...document, ownedComplete: false });
    await expect(runNativeMeansCapture(["plan", "--universe", owned, "--universe-sha256", ownedSha, "--cache", cache, "--cache-sha256", cacheSha,
      "--season", "20262027", "--as-of", "2026-10-12T11:00:00.000Z", "--anchor", "2026-09-29", "--out", join(dir, "owned")])).rejects.toThrow("universe_owned_incomplete");
  });
});
