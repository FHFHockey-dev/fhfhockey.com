// lib/supabase/GoaliePage/calculateAverages.ts

import { GoalieStat, Averages } from "./types";

export function calculateAverages(goalies: GoalieStat[]): Averages {
  const totals: Averages = {
    gamesPlayed: 0,
    gamesStarted: 0,
    wins: 0,
    losses: 0,
    otLosses: 0,
    saves: 0,
    shotsAgainst: 0,
    goalsAgainst: 0,
    shutouts: 0,
    timeOnIce: 0,
    savePct: 0,
    goalsAgainstAverage: 0,
  };

  goalies.forEach((goalie) => {
    totals.gamesPlayed += goalie.gamesPlayed;
    totals.gamesStarted += goalie.gamesStarted;
    totals.wins += goalie.wins;
    totals.losses += goalie.losses;
    totals.otLosses += goalie.otLosses;
    totals.saves += goalie.saves;
    totals.shotsAgainst += goalie.shotsAgainst;
    totals.goalsAgainst += goalie.goalsAgainst;
    totals.shutouts += goalie.shutouts;
    totals.timeOnIce += goalie.timeOnIce;
    totals.savePct += goalie.savePct;
    totals.goalsAgainstAverage += goalie.goalsAgainstAverage;
  });

  const count = goalies.length;
  const totalMinutesPlayed = totals.timeOnIce / 60;

  return {
    gamesPlayed: count > 0 ? totals.gamesPlayed / count : 0,
    gamesStarted: count > 0 ? totals.gamesStarted / count : 0,
    wins: count > 0 ? totals.wins / count : 0,
    losses: count > 0 ? totals.losses / count : 0,
    otLosses: count > 0 ? totals.otLosses / count : 0,
    saves: count > 0 ? totals.saves / count : 0,
    shotsAgainst: count > 0 ? totals.shotsAgainst / count : 0,
    goalsAgainst: count > 0 ? totals.goalsAgainst / count : 0,
    shutouts: count > 0 ? totals.shutouts / count : 0,
    timeOnIce: count > 0 ? totals.timeOnIce / count : 0,
    savePct: count > 0 ? totals.savePct / count : 0,
    goalsAgainstAverage: count > 0 ? totals.goalsAgainstAverage / count : 0,
  };
}
