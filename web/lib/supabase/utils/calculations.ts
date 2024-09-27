// utils/calculations.ts

import { CombinedGameLog } from "./types";

export const calculateGameScore = (game: CombinedGameLog): number => {
  const G = game.goals ?? 0;
  const A1 = game.total_primary_assists ?? 0;
  const A2 = game.total_secondary_assists ?? 0;
  const SOG = game.shots ?? 0;
  const BLK = game.blocked_shots ?? 0;
  const PD = game.penalties_drawn ?? 0;
  const PT = game.penalties ?? 0;
  const FOW = game.total_fow ?? 0;
  const FOL = game.total_fol ?? 0;
  const CF = game.usat_for ?? 0;
  const CA = game.usat_against ?? 0;
  const GF =
    (game.es_goals_for ?? 0) +
    (game.pp_goals_for ?? 0) +
    (game.sh_goals_for ?? 0);
  const GA =
    (game.es_goals_against ?? 0) +
    (game.pp_goals_against ?? 0) +
    (game.sh_goals_against ?? 0);

  const gameScore =
    0.75 * G +
    0.7 * A1 +
    0.55 * A2 +
    0.075 * SOG +
    0.05 * BLK +
    0.15 * PD -
    0.15 * PT +
    0.01 * FOW -
    0.01 * FOL +
    0.05 * CF -
    0.05 * CA +
    0.15 * GF -
    0.15 * GA;

  return gameScore;
};
