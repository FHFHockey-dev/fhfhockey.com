import { describe, expect, it } from "vitest";

import { getEspnLeague } from "./client";
import { normalizeEspnLeaguePayload } from "./normalize";

const liveEnabled =
  !process.env.CI &&
  process.env.ESPN_FHL_LIVE_SMOKE === "true" &&
  /^\d+$/.test(process.env.ESPN_FHL_LIVE_LEAGUE_ID ?? "") &&
  /^\d{4}$/.test(process.env.ESPN_FHL_LIVE_SEASON ?? "");

(liveEnabled ? describe : describe.skip)("ESPN FHL public live contract", () => {
  it(
    "validates and normalizes one explicitly configured public hockey league",
    async () => {
      const leagueId = process.env.ESPN_FHL_LIVE_LEAGUE_ID!;
      const season = Number(process.env.ESPN_FHL_LIVE_SEASON!);
      const swid =
        process.env.ESPN_FHL_LIVE_SWID ??
        "{00000000-0000-0000-0000-000000000001}";
      const payload = await getEspnLeague({
        leagueId,
        season,
        credentials: {
          swid,
          espnS2: process.env.ESPN_FHL_LIVE_ESPN_S2 ?? "public-contract-test",
        },
      });
      expect(String(payload.id)).toBe(leagueId);
      expect(Number(payload.seasonId)).toBe(season);

      const normalized = normalizeEspnLeaguePayload({
        leagueId,
        season,
        swid,
        payload,
      });
      expect(normalized.settings.mappingVersion).toBe("espn-fhl-v1");
      expect(normalized.settings.sourceHash).toMatch(/^[a-f0-9]{64}$/);
      expect(normalized.state.sourceHash).toMatch(/^[a-f0-9]{64}$/);
    },
    45_000,
  );
});
