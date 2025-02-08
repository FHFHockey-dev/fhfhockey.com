type Stats = {
  G: number;
  A1: number;
  A2: number;
  SOG: number;
  BLK: number;
  PD: number;
  PT: number;
  FOW: number;
  FOL: number;
  CF: number;
  CA: number;
  GF: number;
  GA: number;
};

export function computePlayerGameScore({
  G,
  A1,
  A2,
  SOG,
  BLK,
  PD,
  PT,
  FOW,
  FOL,
  CF,
  CA,
  GF,
  GA,
}: Stats): number {
  const score =
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

  return Number.isNaN(score) ? 0 : score;
}
