import { describe, expect, it } from "vitest";

import { getFantraxDraftResults, getFantraxLeagueInfo, getFantraxLeagues } from "./client";
import { normalizeFantraxDraftResults } from "./draftResults";
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

(!process.env.CI && process.env.FANTRAX_DRAFT_LIVE_LEAGUE_ID ? describe : describe.skip)(
  "Fantrax numbered draft live smoke",
  () => {
    it("maps a real response without treating future empty slots as skipped picks", async () => {
      const snapshot = normalizeFantraxDraftResults(
        await getFantraxDraftResults(process.env.FANTRAX_DRAFT_LIVE_LEAGUE_ID!),
      );
      expect(snapshot.safeToApply).toBe(true);
      expect(snapshot.slots.length).toBeGreaterThan(0);
      expect(snapshot.slots.length).toBeGreaterThanOrEqual(snapshot.picks.length);
      const lastSelected = snapshot.picks.at(-1)?.pickNumber ?? 0;
      expect(snapshot.slots.some((slot) => slot.playerId === null && slot.pickNumber <= lastSelected)).toBe(false);
    }, 45_000);
  },
);
