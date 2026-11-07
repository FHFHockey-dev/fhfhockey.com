import { contentHash } from "./hash.server";
import { CalendarGame, FrozenForecast, FrozenHorizonForecast, HORIZON_EVALUATION_VERSION, HorizonLabel, RollingCase } from "./horizonEvaluation";

/** Entirely synthetic. These values are not NHL observations or fitted baselines. */
export const fixtureTime = (day: number, hour = 12) => new Date(Date.UTC(2026, 0, 1 + day, hour)).toISOString();
export const horizonSource = (at = fixtureTime(0, 0)) => ({ id: "synthetic-source", revision: "fixture-v1", sha256: contentHash("synthetic"),
  source: "synthetic_fixture", use: "approved" as const, observedAt: at, publishedAt: at, firstReceivedAt: at });
export function skaterGame(index: number, appeared = true): CalendarGame {
  return { gameId: 2099020000 + index, teamId: 1, startsAt: fixtureTime(index),
    counts: { G: 0, A: 0, PPP: 0, SOG: appeared ? 2 : 0, HIT: appeared ? 1 : 0, BLK: 0, PIM: 0, PPG: 0, PPA: 0, GP: Number(appeared) } };
}
export function goalieGame(index: number, overrides: Partial<CalendarGame> = {}): CalendarGame {
  return { gameId: 2099020000 + index, teamId: 1, startsAt: fixtureTime(index), sharedShutout: false,
    counts: { SV: 10, SA: 10, GA: 0, W: 1, SO: 1, MIN: 60, GP: 1, GS: 1, RELIEF: 0 }, ...overrides };
}
export function freezeFixture(forecast: FrozenHorizonForecast): FrozenForecast {
  return { forecast: structuredClone(forecast), sha256: contentHash(forecast) };
}
export function horizonFixture(): RollingCase {
  const games = Array.from({ length: 20 }, (_, i) => skaterGame(i + 1));
  const windows = ([1, 10, 20] as const).map(horizon => ({ horizon, originGameIds: games.slice(0, horizon).map(game => game.gameId), endAt: fixtureTime(horizon, 23) }));
  const candidate = freezeFixture({ schemaVersion: HORIZON_EVALUATION_VERSION, evidenceClass: "fixture", playerId: 9900001,
    originTeamId: 1, seasonId: 20252026, kind: "skater", issuedAt: fixtureTime(0, 1), inputCutoffAt: fixtureTime(0, 0), modelAvailableAt: fixtureTime(0, 0),
    versions: { model: "synthetic-all-or-none-v1", feature: "synthetic-v1", calibration: "none", schedule: "synthetic-schedule-v1", categories: "official-counts-v1" },
    sourceManifest: [horizonSource()], trainingWindows: [], windows,
    samples: [{ probability: 0.5, eligibleGameIds: games.map(g => g.gameId), games },
      { probability: 0.5, eligibleGameIds: games.map(g => g.gameId), games: games.map((_, i) => skaterGame(i + 1, false)) }] });
  const labels: HorizonLabel[] = windows.map(window => ({ playerId: candidate.forecast.playerId, horizon: window.horizon, endAt: window.endAt,
    coverageComplete: true, eligibleGameIds: window.originGameIds, coverageAvailableAt: fixtureTime(window.horizon + 1, 4),
    sourceManifest: [horizonSource(fixtureTime(window.horizon + 1, 4))],
    anchors: games.slice(0, window.horizon).map(game => ({ gameId: game.gameId, startsAt: game.startsAt, finalAt: fixtureTime(Number(game.gameId) - 2099020000, 16) })),
    games: games.slice(0, window.horizon).map(game => ({ ...game, finalAt: fixtureTime(game.gameId - 2099020000, 16), availableAt: fixtureTime(game.gameId - 2099020000, 17) })) }));
  // A deliberately simplistic comparator for exercising pairing, not an empirical incumbent.
  const incumbent = structuredClone(candidate.forecast);
  incumbent.versions.model = "synthetic-certain-availability-v1";
  incumbent.samples = [{ ...incumbent.samples[0], probability: 1 }];
  return { candidate, labels, comparators: { synthetic_incumbent: freezeFixture(incumbent) } };
}
