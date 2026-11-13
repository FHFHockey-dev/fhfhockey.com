import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "pages/api/v1/drm";
import { MatrixScopeError } from "lib/drm/readMatrix";
const mocks = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock("lib/supabase/server", () => ({ default: { injected: true } }));
vi.mock("lib/drm/readMatrix", () => ({ MatrixScopeError: class MatrixScopeError extends Error {}, readDeploymentMatrix: mocks.read }));
const scope = { teamId: "22", seasonId: "20262027", startDate: "2026-11-04", endDate: "2026-11-10", seasonType: "regularSeason" };
async function request(query: Record<string, unknown> = scope, method = "GET") {
  const response = { code: 200, body: undefined as unknown, headers: {} as Record<string, string>,
    status(code: number) { this.code = code; return this; },
    json(body: unknown) { this.body = body; return this; },
    setHeader(key: string, value: string) { this.headers[key] = value; }, end() { return this; } };
  await handler({ query, method } as any, response as any); return response;
}
beforeEach(() => { mocks.read.mockReset(); });
describe("qualified DRM API", () => {
  it("passes scalar scope to the reader and returns only its public DTO", async () => {
    mocks.read.mockResolvedValue({ matchedGameIds: [], coverage: { acceptedGames: 0 } });
    const response = await request();
    expect(response.code).toBe(200);
    expect(mocks.read).toHaveBeenCalledWith({ injected: true }, { teamId: 22, seasonId: 20262027,
      startDate: scope.startDate, endDate: scope.endDate, seasonType: "regularSeason", homeOrAway: "", opponentTeamAbbreviation: "" });
    expect(response.headers["Cache-Control"]).toContain("s-maxage=60");
  });
  it("rejects writes and repeated parameters before a database read", async () => {
    expect((await request(scope, "POST")).code).toBe(405);
    expect((await request({ ...scope, teamId: ["22", "10"] })).code).toBe(400);
    expect(mocks.read).not.toHaveBeenCalled();
  });
  it("keeps scope errors useful and private source errors undisclosed", async () => {
    mocks.read.mockRejectedValueOnce(new MatrixScopeError("Invalid selection"));
    const invalid = await request(); expect(invalid.code).toBe(400); expect(invalid.body).toEqual({ error: "Invalid selection" });
    mocks.read.mockRejectedValueOnce(new Error("private raw payload"));
    const failed = await request(); expect(failed.code).toBe(503); expect(JSON.stringify(failed.body)).not.toContain("private");
    expect(failed.headers["Cache-Control"]).toBe("no-store");
  });
});
