import { describe, expect, it, vi } from "vitest";
import { formatReportTime, readReportSource, reportRowIdentity, REPORT_PAGE_SIZE } from "./reportSource";

const fixture = Array.from({ length: 6184 }, (_, id) => ({
  id,
  time: "2026-10-02T01:06:10.162024Z",
  status: id < 32 || (id >= 1000 && id < 1051) ? "failure" : "success",
}));
const page = (rows: typeof fixture, count: number | null = rows.length) =>
  async (from: number, to: number) => ({ data: rows.slice(from, to + 1), count, error: null });

describe("bounded cron report source", () => {
  it("reproduces 32 sampled failures versus all 83 in 6184 tied-timestamp rows", async () => {
    expect(fixture.slice(0, 1000).filter((row) => row.status === "failure")).toHaveLength(32);
    const result = await readReportSource(page(fixture), (row) => String(row.id));
    expect(result.complete).toBe(true);
    expect(result.rows).toHaveLength(6184);
    expect(result.rows.filter((row) => row.status === "failure")).toHaveLength(83);
    expect(result.pages).toBe(13);
  });

  it.each([0, 500, 1000, 1001])("handles %i rows and full/empty boundary pages", async (count) => {
    const result = await readReportSource(page(fixture.slice(0, count)), (row) => String(row.id));
    expect(result.complete).toBe(true);
    expect(result.rows).toHaveLength(count);
  });

  it("does not assume a short server-capped page is the end", async () => {
    const result = await readReportSource(async (from, to) => ({
      ...await page(fixture.slice(0, 1001))(from, Math.min(to, from + 99)),
    }));
    expect(result.complete).toBe(true);
    expect(result.rows).toHaveLength(1001);
  });

  it("preserves identical audit observations and canonical identities", async () => {
    const rows = [fixture[0], fixture[0], fixture[0]];
    const result = await readReportSource(page(rows), undefined, 2);
    expect(result.complete).toBe(true);
    expect(result.rows).toHaveLength(3);
    expect(reportRowIdentity({ b: 1, a: { y: 3, x: 2 } })).toBe(reportRowIdentity({ a: { x: 2, y: 3 }, b: 1 }));
  });

  it("deduplicates stable run IDs and fails closed on overlapping pages", async () => {
    const result = await readReportSource(async (from, to) => page(fixture.slice(0, 501))(Math.max(0, from - 1), to - (from > 0 ? 1 : 0)), (row) => String(row.id));
    expect(result.complete).toBe(false);
    expect(new Set(result.rows.map((row) => row.id)).size).toBe(result.rows.length);
    expect(result.error).toContain("Repeated source identity");
  });

  it("marks concurrent arrivals incomplete and retains both pages", async () => {
    const result = await readReportSource(async (from, to) => page(fixture.slice(0, from === 0 ? 1000 : 1001))(from, to));
    expect(result.complete).toBe(false);
    expect(result.rows).toHaveLength(1000);
    expect(result.error).toContain("Source count changed");
  });

  it("retries only a failed page and preserves the earlier page on permanent timeout", async () => {
    const fetch = vi.fn(async (from: number, to: number) => from === 0 ? page(fixture.slice(0, 1000))(from, to)
      : { data: null, count: null, error: { message: "statement timeout" } });
    const result = await readReportSource(fetch);
    expect(fetch.mock.calls.map(([from]) => from)).toEqual([0, 500, 500]);
    expect(result.rows).toHaveLength(500);
    expect(result.complete).toBe(false);
    expect(result.error).toBe("statement timeout");
  });

  it("recovers from a transient failed page without duplicating observations", async () => {
    let attempts = 0;
    const result = await readReportSource(async (from, to) => {
      if (from === 500 && attempts++ === 0) throw new Error("temporary failure");
      return page(fixture.slice(0, 1000))(from, to);
    });
    expect(result.complete).toBe(true);
    expect(result.rows).toHaveLength(1000);
  });

  it("preserves observations when count is unavailable and rejects premature empty pages", async () => {
    const unknown = await readReportSource(page(fixture.slice(0, 10), null));
    expect(unknown.rows).toHaveLength(10);
    expect(unknown.complete).toBe(false);
    const empty = await readReportSource(async () => ({ data: [], count: 1, error: null }));
    expect(empty.error).toContain("before its exact count");
  });

  it("bounds page and elapsed-time budgets", async () => {
    const bounded = await readReportSource(page(fixture), undefined, 500, 1);
    expect(bounded.rows).toHaveLength(500);
    expect(bounded.complete).toBe(false);
    const fetch = vi.fn(page(fixture));
    const deadline = await readReportSource(fetch, undefined, 500, 40, 0);
    expect(fetch).not.toHaveBeenCalled();
    expect(deadline.error).toContain("deadline");
  });

  it("presents UTC alongside the correct Eastern daylight/standard time", () => {
    expect(formatReportTime("2026-10-02T21:15:00.000Z")).toMatch(/2026-10-02T21:15:00.000Z.*5:15:00 PM EDT/);
    expect(formatReportTime("2026-11-02T21:15:00.000Z")).toContain("4:15:00 PM EST");
  });
  it("detects in-place updates with stable membership without claiming snapshot consistency", async () => {
    const current = [{ runid: 1, status: "running" }, { runid: 2, status: "succeeded" }];
    const result = await readReportSource(async (from, to) => {
      if (from > 0) current[0].status = "failed";
      return { data: current.slice(from, to + 1).map((row) => ({ ...row })), count: 2, error: null };
    }, (row) => String(row.runid), 1);
    expect(result.enumerationComplete).toBe(true);
    expect(result.complete).toBe(false);
    expect(result.snapshotConsistent).toBe(false);
    expect(result.error).toContain("changed during verification");
  });

  it("qualifies an unchanged two-pass enumeration as observations rather than a snapshot", async () => {
    const result = await readReportSource(page(fixture.slice(0, 2)), (row) => String(row.id), 1);
    expect(result.complete).toBe(true);
    expect(result.pages).toBe(2);
    expect(result.verificationPages).toBe(2);
    expect(result.snapshotConsistent).toBe(false);
    expect(result.consistency).toContain("do not establish a transactional snapshot");
  });

  it("keeps a final page arriving after the source deadline incomplete", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    try {
      const result = await readReportSource(async (from) => {
        vi.setSystemTime(from === 0 ? 14_000 : 19_000);
        return { data: [{ id: from }], count: 2, error: null };
      }, (row) => String(row.id), 1, 40, 15_000);
      expect(result.complete).toBe(false);
      expect(result.rows).toHaveLength(2);
      expect(result.error).toContain("deadline");
      expect(vi.getTimerCount()).toBe(0);
    } finally { vi.useRealTimers(); }
  });

  it("cancels a hung final page at the remaining deadline even if fetch ignores cancellation", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    try {
      const signals: AbortSignal[] = [];
      const fetch = vi.fn((from: number, _to: number, signal: AbortSignal) => {
        signals.push(signal);
        if (from === 0) {
          vi.setSystemTime(14_000);
          return Promise.resolve({ data: [{ id: 0 }], count: 2, error: null });
        }
        return new Promise<{ data: { id: number }[]; count: number; error: null }>(() => {});
      });
      const pending = readReportSource(fetch, (row) => String(row.id), 1, 40, 15_000);
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(1_000);
      const result = await pending;
      expect(fetch.mock.calls.map(([from]) => from)).toEqual([0, 1]);
      expect(signals[1].aborted).toBe(true);
      expect(result.rows).toHaveLength(1);
      expect(result.complete).toBe(false);
      expect(result.error).toContain("deadline");
      expect(vi.getTimerCount()).toBe(0);
    } finally { vi.useRealTimers(); }
  });

  it("does not begin another retry after the source deadline expires", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    try {
      const fetch = vi.fn(async () => {
        vi.setSystemTime(15_001);
        throw new Error("request failed after deadline");
      });
      const result = await readReportSource(fetch, undefined, 500, 40, 15_000);
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(result.complete).toBe(false);
      expect(result.error).toContain("deadline");
    } finally { vi.useRealTimers(); }
  });

  it("finishes the delivered 6247-row verification in 14 requests rather than timing out after 20", async () => {
    vi.useFakeTimers(); vi.setSystemTime(0);
    const rows = Array.from({ length: 6247 }, (_, id) => ({ id, status: id < 212 ? "failure" : "success" }));
    const fetch = vi.fn(async (from: number, to: number) => {
      vi.setSystemTime(Date.now() + 750);
      return { data: rows.slice(from, to + 1), count: rows.length, error: null };
    });
    try {
      const old = await readReportSource(fetch, (row) => String(row.id));
      expect(old).toMatchObject({ complete: false, enumerationComplete: true, pages: 13, verificationPages: 7 });
      expect(old.rows).toHaveLength(6247);
      vi.setSystemTime(0); fetch.mockClear();
      const improved = await readReportSource(fetch, (row) => String(row.id), REPORT_PAGE_SIZE);
      expect(improved).toMatchObject({ complete: true, pages: 7, verificationPages: 7 });
      expect(fetch).toHaveBeenCalledTimes(14);
      expect(improved.rows.filter((row) => row.status === "failure")).toHaveLength(212);
    } finally { vi.useRealTimers(); }
  });

  it("allows slower complete reads beyond 15 seconds under the shared 180-second budget", async () => {
    vi.useFakeTimers(); vi.setSystemTime(0);
    const fetch = vi.fn(async (from: number, to: number) => {
      vi.setSystemTime(Date.now() + 4_000);
      return page(fixture)(from, to);
    });
    try {
      const result = await readReportSource(fetch, (row) => String(row.id), REPORT_PAGE_SIZE, 40, 180_000,
        { deadlineAt: 180_000, requestTimeoutMs: 15_000 });
      expect(result).toMatchObject({ complete: true, pages: 7, verificationPages: 7 });
      expect(Date.now()).toBe(56_000);
      expect(result.rows.filter((row) => row.status === "failure")).toHaveLength(83);
      expect(vi.getTimerCount()).toBe(0);
    } finally { vi.useRealTimers(); }
  });

  it("does not restart the shared deadline for the second source and retains its original observations", async () => {
    vi.useFakeTimers(); vi.setSystemTime(0);
    const options = { deadlineAt: 180_000, requestTimeoutMs: 15_000 };
    try {
      const first = await readReportSource(async (from, to) => {
        vi.setSystemTime(Date.now() + 12_000);
        return page(fixture.slice(0, 5000))(from, to);
      }, (row) => String(row.id), REPORT_PAGE_SIZE, 40, 180_000, options);
      expect(first.complete).toBe(true);
      expect(Date.now()).toBe(120_000);
      const second = await readReportSource(async (from, to) => {
        vi.setSystemTime(Date.now() + 5_000);
        return page(fixture)(from, to);
      }, (row) => String(row.id), REPORT_PAGE_SIZE, 40, 180_000, options);
      expect(second).toMatchObject({ complete: false, enumerationComplete: true, pages: 7, verificationPages: 5 });
      expect(second.rows).toHaveLength(6184);
      expect(second.rows.filter((row) => row.status === "failure")).toHaveLength(83);
      expect(second.error).toContain("deadline");
      expect(Date.now()).toBe(180_000);
      const exhausted = vi.fn(page(fixture));
      expect((await readReportSource(exhausted, undefined, REPORT_PAGE_SIZE, 40, 180_000, options)).complete).toBe(false);
      expect(exhausted).not.toHaveBeenCalled();
    } finally { vi.useRealTimers(); }
  });

  it("still aborts a hanging request after 15 seconds and bounds its one retry", async () => {
    vi.useFakeTimers(); vi.setSystemTime(0);
    const signals: AbortSignal[] = [];
    const fetch = vi.fn((_from: number, _to: number, signal: AbortSignal) => {
      signals.push(signal);
      return new Promise<{ data: typeof fixture; count: number; error: null }>(() => {});
    });
    try {
      const pending = readReportSource(fetch, undefined, REPORT_PAGE_SIZE, 40, 180_000,
        { deadlineAt: 180_000, requestTimeoutMs: 15_000 });
      await vi.advanceTimersByTimeAsync(30_000);
      const result = await pending;
      expect(fetch).toHaveBeenCalledTimes(2);
      expect(signals.every((signal) => signal.aborted)).toBe(true);
      expect(result.error).toBe("Source request timed out");
      expect(result.complete).toBe(false);
      expect(vi.getTimerCount()).toBe(0);
    } finally { vi.useRealTimers(); }
  });

  it("clips a request to the shared remaining budget without spending reserved delivery time", async () => {
    vi.useFakeTimers(); vi.setSystemTime(175_000);
    const signals: AbortSignal[] = [];
    const fetch = vi.fn((_from: number, _to: number, signal: AbortSignal) => {
      signals.push(signal);
      return new Promise<{ data: typeof fixture; count: number; error: null }>(() => {});
    });
    try {
      const pending = readReportSource(fetch, undefined, REPORT_PAGE_SIZE, 40, 180_000,
        { deadlineAt: 180_000, requestTimeoutMs: 15_000 });
      await vi.advanceTimersByTimeAsync(5_000);
      const result = await pending;
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(signals[0].aborted).toBe(true);
      expect(result.error).toContain("deadline");
      expect(result.complete).toBe(false);
      expect(Date.now()).toBe(180_000);
      expect(vi.getTimerCount()).toBe(0);
    } finally { vi.useRealTimers(); }
  });

});
