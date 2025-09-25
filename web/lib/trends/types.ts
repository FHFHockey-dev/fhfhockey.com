// =============================
// /web/lib/trends/types.ts
// =============================

export type StreakType = "hot" | "cold" | "neutral";

export interface PlayerOption {
  id: number;
  name: string;
  position?: string | null;
}

export interface SeasonSummary {
  season: string;
  goals: number | null;
  assists: number | null;
  points: number | null;
  gamesPlayed: number | null;
  pointsPerGame: number | null;
}

export interface GameLogRow {
  date: string;
  totalPoints: number | null;
  goals: number | null;
  totalAssists: number | null;
  shots?: number | null;
  hits?: number | null;
  blocks?: number | null;
  ppPoints?: number | null;
}

export interface ChartPoint {
  date: Date;
  gameIndex: number;
  points: number;
  rollingAverage: number;
  streakType: StreakType;
  streakLength: number;
}

export interface StreakSegment {
  type: Exclude<StreakType, "neutral">;
  startDate: Date;
  endDate: Date;
  startIndex: number;
  endIndex: number;
  length: number;
  intensity: number;
}

export interface TrendDataBundle {
  baseline: number;
  chartPoints: ChartPoint[];
  streaks: StreakSegment[];
}

export interface RollingWindowOption {
  label: string;
  value: number;
}
