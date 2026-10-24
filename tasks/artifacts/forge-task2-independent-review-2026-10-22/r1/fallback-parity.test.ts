import { describe, expect, it } from "vitest";
import { computeSkaterPhysicalEventRates as fixed } from "./lib/projections/calculators/skater-adjustments";
import { computeSkaterPhysicalEventRates as before } from "./lib/projections/calculators/skater-adjustments.pre-r1";
const league = {
  F: { toDate: { hits: 3900, blocks: 2800, toiSeconds: 3600000 }, prior: { hits: 49000, blocks: 21000, toiSeconds: 36000000 } },
  D: { toDate: { hits: 280, blocks: 540, toiSeconds: 360000 }, prior: { hits: 3200, blocks: 4400, toiSeconds: 3600000 } },
};
describe("independent R1 fallback and complete-pair parity", () => {
  it.each([["C", "hits"], ["D", "hits"], ["C", "blocks"], ["D", "blocks"]] as const)("preserves complete pairs and unsplit policy for %s %s", (position, metric) => {
    const args = (events: number | null | undefined, seconds: number | null | undefined, currentSeasonId: number, totals: typeof league | null) => ({
      all: { season: 20262027, strength_state: "all", toi_seconds_total_last5: 6600, toi_seconds_avg_last5: 1320,
        [`${metric}_per_60_last5`]: 0.5,
        [`${metric}_per_60_${metric}_3ya`]: 200, [`${metric}_per_60_toi_seconds_3ya`]: 240000,
        [`${metric}_per_60_${metric}_season`]: events, [`${metric}_per_60_toi_seconds_season`]: seconds } as any,
      position, esPpToiSeconds: 1200, currentSeasonId, league: totals,
    });
    for (const totals of [null, league]) {
      for (const currentSeasonId of [20262027, 20272028]) {
        for (const events of [0, 20, 200, 500]) for (const seconds of [0, 24000, 240000, 480000]) {
          const input = args(events, seconds, currentSeasonId, totals);
          expect(fixed(input)).toEqual(before(input));
        }
      }
      const expected = before(args(null, null, 20262027, totals));
      for (const missing of [null, undefined, NaN, Infinity, -1]) {
        expect(fixed(args(missing, 120000, 20262027, totals))).toEqual(expected);
        expect(fixed(args(40, missing, 20262027, totals))).toEqual(expected);
      }
      expect(fixed(args(null, 120000, 20262027, totals))[`${metric}Per60`]).not.toBe(fixed(args(0, 120000, 20262027, totals))[`${metric}Per60`]);
    }
  });
});
