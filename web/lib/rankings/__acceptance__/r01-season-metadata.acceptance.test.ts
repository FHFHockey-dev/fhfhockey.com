// R01 regression check: pure functions only, no data access. Open R01
// reproductions live in tasks/artifacts/rankings-acceptance-2026-11-14/offline-correctness/repros/.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { failClosedFetch } from "./fakeSupabase";
import { DEFAULT_RANKINGS_FILTERS } from "../rankingUrlState";

const fetchSpy = vi.fn(failClosedFetch());

beforeEach(() => {
  vi.useFakeTimers({ now: new Date("2026-11-14T12:00:00.000Z"), toFake: ["Date"] });
  vi.stubGlobal("fetch", fetchSpy);
  fetchSpy.mockClear();
});

afterEach(() => {
  expect(fetchSpy).not.toHaveBeenCalled();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("R01 active season and freshness metadata (offline, 89da739cb)", () => {
  it("FIXED-CHECK R01-DEFAULT: the page default no longer hard-codes a season", () => {
    expect(DEFAULT_RANKINGS_FILTERS.season).toBe("");
  });

});
