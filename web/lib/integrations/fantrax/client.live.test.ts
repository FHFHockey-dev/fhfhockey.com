import { describe, expect, it } from "vitest";

import { getFantraxLeagueInfo, getFantraxLeagues } from "./client";
import {
  normalizeFantraxDiscovery,
  normalizeFantraxLeagueInfo,
} from "./normalize";

const liveEnabled =
  !process.env.CI &&
  process.env.FANTRAX_LIVE_SMOKE === "true" &&
  Boolean(process.env.FANTRAX_LIVE_SECRET_ID);

(liveEnabled ? describe : describe.skip)("Fantrax FXEA live smoke", () => {
  it(
    "discovers NHL leagues and validates one settings response",
    async () => {
      const secretId = process.env.FANTRAX_LIVE_SECRET_ID!;
      const leagues = normalizeFantraxDiscovery(
        await getFantraxLeagues(secretId),
      );
      expect(leagues.length).toBeGreaterThan(0);

      const requestedLeagueId = process.env.FANTRAX_LIVE_LEAGUE_ID;
      const league = requestedLeagueId
        ? leagues.find(
            (candidate) => candidate.externalLeagueKey === requestedLeagueId,
          )
        : leagues[0];
      expect(league).toBeTruthy();

      const settings = normalizeFantraxLeagueInfo({
        externalLeagueKey: league!.externalLeagueKey,
        ownedTeams: league!.ownedTeams,
        payload: await getFantraxLeagueInfo(league!.externalLeagueKey),
      });
      expect(settings.diagnostics.status).not.toBe("unsupported");
      expect(settings.sourceHash).toMatch(/^[a-f0-9]{64}$/);
    },
    45_000,
  );
});
