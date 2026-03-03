import {
  HORIZON_B2B_PENALTY,
  HORIZON_DECAY_PER_GAME,
  HORIZON_LONG_REST_BOOST,
  HORIZON_ZERO_REST_PENALTY,
  MAX_SUPPORTED_HORIZON_GAMES
} from "../constants/projection-weights";
import { clamp } from "./number-utils";

export function toDayBoundsUtc(dateOnly: string): {
  startTs: string;
  endTs: string;
} {
  return {
    startTs: `${dateOnly}T00:00:00.000Z`,
    endTs: `${dateOnly}T23:59:59.999Z`
  };
}

export function toUtcDateMs(dateOnly: string): number {
  return new Date(`${dateOnly}T00:00:00.000Z`).getTime();
}

export function daysBetweenDates(a: string, b: string): number {
  const aMs = toUtcDateMs(a);
  const bMs = toUtcDateMs(b);
  if (!Number.isFinite(aMs) || !Number.isFinite(bMs)) return 99;
  return Math.round((aMs - bMs) / (24 * 60 * 60 * 1000));
}

export function parseDateOnly(value: string | null | undefined): string | null {
  if (typeof value !== "string" || value.length === 0) return null;
  return value.length >= 10 ? value.slice(0, 10) : null;
}

export function clampHorizonGames(horizonGames: number): number {
  if (!Number.isFinite(horizonGames)) return 1;
  return clamp(Math.floor(horizonGames), 1, MAX_SUPPORTED_HORIZON_GAMES);
}

export function buildSequentialHorizonScalarsFromDates(
  gameDates: string[],
  horizonGames: number
): number[] {
  const horizon = clampHorizonGames(horizonGames);
  const uniqueSortedDates = Array.from(
    new Set(gameDates.filter((d) => typeof d === "string" && d.length >= 10))
  )
    .map((d) => d.slice(0, 10))
    .sort((a, b) => a.localeCompare(b));

  const scalars: number[] = [];
  let previousDate: string | null = null;
  for (let i = 0; i < horizon; i += 1) {
    const date = uniqueSortedDates[i] ?? null;
    const restDays =
      previousDate && date ? Math.max(0, daysBetweenDates(date, previousDate)) : null;
    let scalar = 1 - i * HORIZON_DECAY_PER_GAME;
    if (restDays === 0) scalar -= HORIZON_ZERO_REST_PENALTY;
    if (restDays === 1) scalar -= HORIZON_B2B_PENALTY;
    if (restDays != null && restDays >= 3) scalar += HORIZON_LONG_REST_BOOST;
    scalars.push(clamp(scalar, 0.75, 1.08));
    if (date) previousDate = date;
  }

  return scalars;
}
