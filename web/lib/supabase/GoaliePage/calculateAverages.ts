// lib/supabase/GoaliePage/calculateAverages.ts

import { GoalieStat, Averages } from "./types";

type AggregatedGoalieTotals = {
  gamesPlayed: number;
  gamesStarted: number;
  wins: number;
  losses: number;
  otLosses: number;
  saves: number;
  shotsAgainst: number;
  goalsAgainst: number;
  shutouts: number;
  timeOnIceSeconds: number;
};

export function calculateAverages(goalies: GoalieStat[]): Averages {
  if (goalies.length === 0) {
    return {
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
      goalsAgainstAverage: 0
    };
  }

  const totals = goalies.reduce<AggregatedGoalieTotals>(
    (accumulator, goalie) => {
      accumulator.gamesPlayed += goalie.gamesPlayed;
      accumulator.gamesStarted += goalie.gamesStarted;
      accumulator.wins += goalie.wins;
      accumulator.losses += goalie.losses;
      accumulator.otLosses += goalie.otLosses;
      accumulator.saves += goalie.saves;
      accumulator.shotsAgainst += goalie.shotsAgainst;
      accumulator.goalsAgainst += goalie.goalsAgainst;
      accumulator.shutouts += goalie.shutouts;
      accumulator.timeOnIceSeconds += goalie.timeOnIce;
      return accumulator;
    },
    {
      gamesPlayed: 0,
      gamesStarted: 0,
      wins: 0,
      losses: 0,
      otLosses: 0,
      saves: 0,
      shotsAgainst: 0,
      goalsAgainst: 0,
      shutouts: 0,
      timeOnIceSeconds: 0
    }
  );

  const goalieCount = goalies.length;
  const totalMinutesPlayed = totals.timeOnIceSeconds / 60;

  return {
    gamesPlayed: totals.gamesPlayed / goalieCount,
    gamesStarted: totals.gamesStarted / goalieCount,
    wins: totals.wins / goalieCount,
    losses: totals.losses / goalieCount,
    otLosses: totals.otLosses / goalieCount,
    saves: totals.saves / goalieCount,
    shotsAgainst: totals.shotsAgainst / goalieCount,
    goalsAgainst: totals.goalsAgainst / goalieCount,
    shutouts: totals.shutouts / goalieCount,
    timeOnIce: totalMinutesPlayed / goalieCount,
    savePct: totals.shotsAgainst > 0 ? totals.saves / totals.shotsAgainst : 0,
    goalsAgainstAverage:
      totalMinutesPlayed > 0
        ? (totals.goalsAgainst * 60) / totalMinutesPlayed
        : 0
  };
}
