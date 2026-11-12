import { describe, expect, it } from "vitest";

import {
  computeDailyPowerRatings,
  type DailyPowerRating,
  type GameLog,
  type TeamGame,
} from "./power-ratings";

const TEAMS = Array.from({ length: 32 }, (_, i) => `T${String(i).padStart(2, "0")}`);

/** Deterministic, distinct per-team, per-game inputs (frozen fixture). */
const gameValues = (teamIndex: number, gameIndex: number): Omit<GameLog, "team_abbreviation" | "date" | "season_id" | "data_mode"> => {
  const t = teamIndex + 1;
  const g = gameIndex + 1;
  const wobble = ((t * 7 + g * 13) % 11) / 10;
  return {
    cf_per_60: 50 + t * 0.4 + wobble,
    ca_per_60: 58 - t * 0.3 + wobble,
    sf_per_60: 26 + t * 0.2 + wobble,
    sa_per_60: 32 - t * 0.15 + wobble,
    gf_per_60: 2.4 + t * 0.03 + wobble / 5,
    ga_per_60: 3.6 - t * 0.02 + wobble / 7,
    xgf_per_60: 2.2 + t * 0.035 + wobble / 6,
    xga_per_60: 3.4 - t * 0.025 + wobble / 8,
    gp: 1,
    toi_seconds: 3600,
    pace_per_60: null,
    hdcf_per_60: 9 + t * 0.1 + wobble,
    hdca_per_60: 13 - t * 0.08 + wobble,
    pdo: 1 + (t - 16) / 400,
    pp_xgf_per_60: 6 + t * 0.05,
    pk_xga_per_60: 7.5 - t * 0.04,
    penalties_drawn_per_60: 3 + t * 0.01,
    penalties_taken_per_60: 3.3 - t * 0.01,
  };
};

const isoDay = (offset: number) => {
  const d = new Date(Date.UTC(2026, 0, 31));
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};

/**
 * Every team has the same 20 frozen games. The slate mask only decides whether a
 * team's latest game falls on the target date (offset 0) or the day before.
 */
const buildTeamGames = (onSlate: (teamIndex: number) => boolean, gamesPerTeam = 20) => {
  const map = new Map<string, TeamGame[]>();
  TEAMS.forEach((team, teamIndex) => {
    const lastOffset = onSlate(teamIndex) ? 0 : -1;
    const games: TeamGame[] = Array.from({ length: gamesPerTeam }, (_, gameIndex) => ({
      ...gameValues(teamIndex, gameIndex),
      team_abbreviation: team,
      date: isoDay(lastOffset - 2 * (gamesPerTeam - 1 - gameIndex)),
      season_id: 20252026,
      data_mode: "all" as const,
      rn_desc: gamesPerTeam - 1 - gameIndex,
      gp_to_date: gameIndex + 1,
    }));
    map.set(team, games.sort((a, b) => b.date.localeCompare(a.date)));
  });
  return map;
};

/** Mimic the daily cron: yesterday's run is carried forward into today's. */
const runCron = (teamGames: Map<string, TeamGame[]>) => {
  let previous = new Map<string, DailyPowerRating>();
  for (const date of [isoDay(-2), isoDay(-1), isoDay(0)]) {
    previous = computeDailyPowerRatings(teamGames, date, previous);
  }
  return previous;
};

describe("computeDailyPowerRatings slate-mask invariance (W1 P0 #12)", () => {
  it("gives all 32 teams the same ratings whichever teams played tonight", () => {
    const evenTonight = runCron(buildTeamGames((i) => i % 2 === 0));
    const fewTonight = runCron(buildTeamGames((i) => i < 4));

    expect(evenTonight.size).toBe(32);
    expect(fewTonight.size).toBe(32);
    for (const team of TEAMS) {
      const a = evenTonight.get(team)!.rating;
      const b = fewTonight.get(team)!.rating;
      expect(a.off_rating).toBeCloseTo(b.off_rating, 9);
      expect(a.def_rating).toBeCloseTo(b.def_rating, 9);
      expect(a.pace_rating).toBeCloseTo(b.pace_rating, 9);
    }
  });

  it("standardises all 32 teams against one baseline: mean 100, sample SD 15", () => {
    const ratings = [...runCron(buildTeamGames((i) => i < 4)).values()].map((r) => r.rating.off_rating);
    const mean = ratings.reduce((s, v) => s + v, 0) / ratings.length;
    const sd = Math.sqrt(ratings.reduce((s, v) => s + (v - mean) ** 2, 0) / (ratings.length - 1));
    expect(mean).toBeCloseTo(100, 9);
    expect(sd).toBeCloseTo(15, 9);
  });
});

describe("computeDailyPowerRatings early-season shrinkage (decision 19)", () => {
  /** Same per-game inputs; only the season's games played differs for team T31. */
  const withGp = (gp: number) => {
    const map = buildTeamGames(() => true);
    map.set(
      "T31",
      map.get("T31")!.map((game) => ({ ...game, gp_to_date: Math.max(1, game.gp_to_date - (20 - gp)) })),
    );
    return computeDailyPowerRatings(map, isoDay(0)).get("T31")!.rating;
  };

  it("pulls a GP-1 team 90% of the way back to 100, while GP 10 is unshrunk", () => {
    const gp10 = withGp(10);
    const gp1 = withGp(1);
    expect(gp10.off_rating).not.toBeCloseTo(100, 3);
    expect(gp1.off_rating - 100).toBeCloseTo(0.1 * (gp10.off_rating - 100), 9);
    expect(gp1.def_rating - 100).toBeCloseTo(0.1 * (gp10.def_rating - 100), 9);
  });

  it("returns 100 when every team is identical (zero variance)", () => {
    const map = new Map(
      [...buildTeamGames(() => true).entries()].map(([team, games]) => [
        team,
        games.map((game) => ({ ...game, ...gameValues(0, 0) })),
      ]),
    );
    for (const { rating } of computeDailyPowerRatings(map, isoDay(0)).values()) {
      expect(rating.off_rating).toBe(100);
      expect(rating.def_rating).toBe(100);
    }
  });
});
