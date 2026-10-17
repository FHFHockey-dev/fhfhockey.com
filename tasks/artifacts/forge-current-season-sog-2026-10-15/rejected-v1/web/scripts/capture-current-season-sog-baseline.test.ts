// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCurrentSeasonSogAssembly } from "./capture-current-season-sog-baseline";

afterEach(() => vi.useRealTimers());
describe("offline current-season SOG assembly entrypoint", () => {
  it("writes one exclusive private synthetic packet, with no transport/database access", () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-15T20:00:00Z"));
    const directory = mkdtempSync(join(tmpdir(), "forge-sog-synthetic-"));
    const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(() => { throw new Error("Network forbidden"); });
    try {
      const history = { id: 2026020001, season: 20262027, gameType: 2, gameDate: "2026-10-08",
        startTimeUTC: "2026-10-08T23:00:00Z", homeTeam: { id: 13 }, awayTeam: { id: 23 }, gameState: "OFF" };
      const capture = (payload: unknown, url: string) => {
        const rawBody = JSON.stringify(payload);
        return { rawBody, url, capturedAt: "2026-10-15T19:00:00Z", bodySha256: createHash("sha256").update(rawBody).digest("hex") };
      };
      const fixture = { schedule: capture({ games: [history, { ...history, id: 2026020112,
        gameDate: "2026-10-15", startTimeUTC: "2026-10-15T23:00:00Z", gameState: "FUT" }] },
      "https://api-web.nhle.com/v1/club-schedule-season/VAN/20262027"), boxscores: [capture({ ...history,
        playerByGameStats: { homeTeam: { forwards: [{ playerId: 1 }], defense: [], goalies: [{ playerId: 2 }] },
          awayTeam: { forwards: [{ playerId: 8478444, toi: "10:00", sog: 3 }], defense: [], goalies: [{ playerId: 3 }] } } },
      "https://api-web.nhle.com/v1/gamecenter/2026020001/boxscore")] };
      const input = join(directory, "synthetic-responses.json"), out = join(directory, "packet.json");
      writeFileSync(input, JSON.stringify(fixture));
      const args = ["--responses", input, "--out", out];
      expect(runCurrentSeasonSogAssembly(args)).toMatchObject({ sourceRequests: 0, databaseWrites: 0,
        localFilesWritten: 1, status: "unreleased_local", publicUsesApproved: false });
      expect(JSON.parse(readFileSync(out, "utf8")).target).toMatchObject({ mean: 3, sampleSize: 1 });
      expect(statSync(out).mode & 0o777).toBe(0o600);
      expect(() => runCurrentSeasonSogAssembly(args)).toThrow();
      expect(() => runCurrentSeasonSogAssembly([...args, "--collect", "true"])).toThrow();
      expect(() => runCurrentSeasonSogAssembly(["--responses", input, "--out", input])).toThrow();
      const link = join(directory, "link.json"); symlinkSync(input, link);
      expect(() => runCurrentSeasonSogAssembly(["--responses", link, "--out", join(directory, "other.json")])).toThrow();
      expect(fetch).not.toHaveBeenCalled();
    } finally { fetch.mockRestore(); rmSync(directory, { recursive: true, force: true }); }
  });
});
