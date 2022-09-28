import calcWeekScore from "./calcWeekScore";

// https://nhl-game-grid.netlify.app/game-grid?startDate=2022-05-23&endDate=2022-05-29
// Carolina Hurricanes
it("Carolina Hurricanes week score | startDate=2022-05-23&endDate=2022-05-29", () => {
    const gameScores = [null, 0.53, null, 0.53, null, 0.53, null];
    // no toggle
    expect((calcWeekScore(gameScores, 3, 9, 3))).toBeCloseTo(4.1646428571)
    // turn off Tue
    expect((calcWeekScore(gameScores, 2, 7, 2))).toBeCloseTo(2.7896428571)

    // turn off all days
    expect((calcWeekScore(gameScores, 0, 0, 0))).toBeCloseTo(-100)

})