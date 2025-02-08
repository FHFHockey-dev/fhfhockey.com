import { expect, test } from "vitest";
import { computePlayerGameScore } from "./game-score";

// https://hockey-graphs.com/2016/07/13/measuring-single-game-productivity-an-introduction-to-game-score/
// Player Game Score = (0.75 * G) + (0.7 * A1) + (0.55 * A2) + (0.075 * SOG) + (0.05 * BLK) + (0.15 * PD) – (0.15 * PT) + (0.01 * FOW) – (0.01 * FOL) + (0.05 * CF) – (0.05 * CA) + (0.15 * GF) – (0.15* GA)

// The stats used are goals, primary assists, secondary assists, shots on goal, blocked shots, penalty differential, faceoffs, 5-on-5 corsi differential, 5-on-5 goal differential.

/**
G = Goals
A1 = primary assist
A2 = secondary assist
SOG = shots
BLK = Blocked shot
PD = penalties drawn
PT = penalties taken
FOW = faceoffs won
FOL = faceoffs lost
CF = Corsi For
CA = corsi against
GF = goals for
GA = goals against
*/

// https://www.espn.com.sg/nhl/boxscore/_/gameId/400815979
// https://www.nhl.com/gamecenter/det-vs-pit/2016/03/26/2015021115/boxscore
/**
     * {
    "playerId": 8473548,
    "sweaterNumber": 81,
    "name": {
        "default": "P. Kessel"
    },
    "position": "R",
    "goals": 1,
    "assists": 4,
    "points": 5,
    "plusMinus": 3,
    "pim": 0,
    "hits": 0,
    "powerPlayGoals": 0,
    "sog": 6,
    "faceoffWinningPctg": 0,
    "toi": "14:10",
    "blockedShots": 0,
    "shifts": 22,
    "giveaways": 3,
    "takeaways": 0
}
     */
test("Phil Kessel 2016-03-26", () => {
  //   const score = computePlayerGameScore({
  //     G: 1,
  //     A1: 4,
  //     SOG: 6,
  //     BLK: 0,
  //     PD: 0,
  //     FOW: 0,
  //   });
  //   expect(7.1).toBe(score);
});
