import { addDays } from "date-fns";
import type { PlayerSeries, TimeSeriesPoint } from "./types";

const PLAYER_DIRECTORY: Record<string, { name: string; position: "F" | "D" }> = {
  "8478402": { name: "Connor McDavid", position: "F" },
  "8477934": { name: "Nathan MacKinnon", position: "F" },
  "8479318": { name: "Cale Makar", position: "D" },
};

const DEFAULT_PLAYER = { name: "Skater", position: "F" as const };

const density = Array.from({ length: 60 }, (_, idx) => {
  const x = -1.5 + (3 * idx) / 59;
  const y = Math.exp(-0.5 * Math.pow((x - 0.15) / 0.35, 2));
  return { x, y };
});

export function buildMockPlayerSeries(
  playerId: string,
  season: string
): PlayerSeries {
  const player = PLAYER_DIRECTORY[playerId] ?? DEFAULT_PLAYER;
  const playerNumeric = Number(playerId) || 1;
  const primaryPhase = (playerNumeric % 7) / 7;
  const amplitude = player.position === "D" ? 0.18 : 0.28;
  const baselineMu = player.position === "D" ? 0.08 : 0.18;
  const baselineSigma = player.position === "D" ? 0.16 : 0.21;

  const seasonStart = new Date("2024-10-01T00:00:00Z");
  const span = season === "2023-24" ? 60 : 48;

  const timeSeries: TimeSeriesPoint[] = Array.from({ length: span }, (_, idx) => {
    const date = addDays(seasonStart, idx);
    const primaryWave = Math.sin(idx / 6 + primaryPhase) * amplitude;
    const trend = 0.01 * (idx / 12);
    const secondaryWave = Math.cos(idx / 4 + primaryPhase) * (amplitude * 0.45);
    const combined = primaryWave + secondaryWave + trend;
    const sko = Math.max(-0.95, Math.min(0.95, combined));
    const streak = sko > 0.45 ? "hot" : sko < -0.4 ? "cold" : null;
    const baseComponent = (seed: number, scale = 1) =>
      Math.sin(idx / (5 + seed) + primaryPhase) * (0.6 * scale) + 0.2 * scale;

    return {
      date: date.toISOString(),
      sko,
      streak,
      components: {
        shots_z: baseComponent(1),
        ixg_z: baseComponent(2, 1.1),
        ixg_per_60_z: baseComponent(3, 0.9),
        toi_z: baseComponent(4, 0.7),
        pp_toi_z: baseComponent(5, 0.6),
        oz_fo_pct_z: baseComponent(6, 0.8) - 0.1,
        onice_sh_pct_z: -baseComponent(2, 0.6),
        shooting_pct_z: -baseComponent(3, 0.7),
      },
    };
  });

  return {
    playerId: Number(playerId) || 0,
    playerName: player.name,
    position: player.position,
    season,
    baseline: {
      mu0: baselineMu,
      sigma0: baselineSigma,
      nTrain: 196,
      density,
    },
    timeSeries,
  };
}
