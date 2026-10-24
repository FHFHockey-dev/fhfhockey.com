import { expect, it } from "vitest";
import * as current from "./calculators/skater-adjustments";
import * as released from "./calculators/releaseC.skater-adjustments";
import * as weights from "./constants/projection-weights";
import * as baseline from "./constants/releaseC.projection-weights";
it("keeps Release C assist/goal/shot prior constants", () => {
  expect(weights.SKATER_ASSIST_SHARE_PRIORS).toEqual(baseline.SKATER_ASSIST_SHARE_PRIORS);
  expect(weights.SKATER_GOAL_CONVERSION_PRIORS).toEqual(baseline.SKATER_GOAL_CONVERSION_PRIORS);
  expect(weights.SKATER_SHOT_RATE_PRIORS).toEqual(baseline.SKATER_SHOT_RATE_PRIORS);
});
it("reproduces Release C rest factors across 98 missing/zero/fractional/B2B/rested matchups", () => {
  const values = [null, 0, .5, 1, 2, 3, 6];
  for (const teamRestDays of values) for (const opponentRestDays of values) for (const isHome of [true, false]) {
    const args={teamRestDays,opponentRestDays,isHome};
    expect(current.computeSkaterRestScheduleAdjustments({...args,buckets:"legacy"})).toEqual(released.computeSkaterRestScheduleAdjustments(args));
  }
});
it("keeps actual goal conversion, assist-share and shot-rate helper output under restored priors", () => {
  for (const position of [null,"C","D"]) for (const n of [0,1,10,100]) {
    const args={evGoalsRecent:n,evShotsRecent:n*10,evGoalsAll:n*10,evShotsAll:n*100,evAssistsRecent:n*2,evAssistsAll:n*20,
      ppGoalsRecent:n,ppShotsRecent:n*5,ppGoalsAll:n*5,ppShotsAll:n*30,ppAssistsRecent:n,ppAssistsAll:n*7,
      goalRateMultiplier:1.1,assistRateMultiplier:.9,position};
    expect(current.computeStrengthSplitConversionRates(args)).toEqual(released.computeStrengthSplitConversionRates(args));
    for (const strength of ["es","pp"] as const) {
      const share={goalsAll:n,assistsAll:n*2,ippAllPct:n?60:null,position,strength};
      expect(current.computeSkaterAssistShare(share)).toEqual(released.computeSkaterAssistShare(share));
    }
  }
});
