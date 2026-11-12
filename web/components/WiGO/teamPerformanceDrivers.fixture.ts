// Test fixture for the D4 team-driver tests (model and rendered card).
// D4 fixture: 32 teams whose PP% and PK% move in opposite directions, so every other
// team's PP+PK standing sits near the middle, and T0 is first on PP and mid-pack on PK.
export const thirtyTwoTeamDriverFixture = () => {
  const fiveOnFive = Array.from({ length: 32 }, (_, index) => ({
    team_abbreviation: `T${index}`, date: "2026-03-20", gp: 10,
    xgf: 15 + index, xga: 45 - index, gf: 12 + index,
  }));
  const specialTeams = Array.from({ length: 32 }, (_, index) => ({
    team_id: index + 1, date: "2026-03-21",
    power_play_pct: index === 0 ? 40 : 10 + index * 0.5,
    penalty_kill_pct: index === 0 ? 80 : 95 - index,
  }));
  return { fiveOnFive, specialTeams };
};

// Mid-rank percentile, written out independently of the model.
export const midRankPercentile = (value: number, population: number[]) => {
  let below = 0;
  let equal = 0;
  for (const other of population) {
    if (other < value) below += 1;
    else if (other === value) equal += 1;
  }
  return ((below + equal / 2) / population.length) * 100;
};


/** T0's true special-teams percentile, computed here without the model. */
export const thirtyTwoTeamExpectedSpecialTeamsPercentile = () => {
  const { specialTeams } = thirtyTwoTeamDriverFixture();
  const pp = specialTeams.map((row) => row.power_play_pct);
  const pk = specialTeams.map((row) => row.penalty_kill_pct);
  const standing = specialTeams.map((row) =>
    (midRankPercentile(row.power_play_pct, pp) + midRankPercentile(row.penalty_kill_pct, pk)) / 2);
  return { truePercentile: midRankPercentile(standing[0], standing), meanOfPercentiles: standing[0] };
};
