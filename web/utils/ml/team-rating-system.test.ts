// utils/ml/team-rating-system.test.ts
// Unit tests for Team Rating System

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  TeamRatingSystem,
  TeamDefensiveRating,
  OpponentStrengthScore
} from "./team-rating-system";

// Mock Supabase
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(() => ({
                data: [],
                error: null
              }))
            }))
          })),
          order: vi.fn(() => ({
            ascending: vi.fn(() => ({
              data: [],
              error: null
            }))
          })),
          not: vi.fn(() => ({
            data: [],
            error: null
          }))
        })),
        gte: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn(() => ({
              data: [],
              error: null
            }))
          }))
        })),
        lte: vi.fn(() => ({
          order: vi.fn(() => ({
            ascending: vi.fn(() => ({
              limit: vi.fn(() => ({
                data: [],
                error: null
              }))
            }))
          }))
        }))
      }))
    }))
  }))
}));

describe("TeamRatingSystem", () => {
  let teamRatingSystem: TeamRatingSystem;

  beforeEach(() => {
    teamRatingSystem = new TeamRatingSystem();
    teamRatingSystem.clearCache();
  });

  describe("Team Defensive Rating Calculations", () => {
    it("should calculate defensive rating with valid goalie stats", async () => {
      // Mock data setup
      const mockGoalieStats = [
        {
          games_played: 30,
          save_pct: 0.915,
          goals_against: 75,
          shots_against: 900
        },
        {
          games_played: 20,
          save_pct: 0.905,
          goals_against: 55,
          shots_against: 610
        }
      ];

      const mockSkaterStats = [
        {
          games_played: 50,
          sh_goals_against: 15,
          pp_goals_against: 35,
          sat_against: 1200,
          usat_against: 800
        }
      ];

      const mockRecentGames = [
        { goals_against: 2, save_pct: 0.92 },
        { goals_against: 3, save_pct: 0.91 },
        { goals_against: 1, save_pct: 0.95 },
        { goals_against: 4, save_pct: 0.88 },
        { goals_against: 2, save_pct: 0.925 }
      ];

      // Test the private method via accessing the calculation logic
      const rating = await (
        teamRatingSystem as any
      ).calculateTeamDefensiveRating(
        "TOR",
        "20242025",
        mockGoalieStats,
        mockSkaterStats,
        mockRecentGames
      );

      expect(rating).toBeDefined();
      expect(rating.team_abbreviation).toBe("TOR");
      expect(rating.season).toBe("20242025");
      expect(rating.goals_against_per_game).toBeGreaterThan(0);
      expect(rating.shots_against_per_game).toBeGreaterThan(0);
      expect(rating.save_percentage).toBeGreaterThan(0.8);
      expect(rating.save_percentage).toBeLessThan(1.0);
      expect(rating.overall_defensive_rating).toBeGreaterThanOrEqual(0);
      expect(rating.overall_defensive_rating).toBeLessThanOrEqual(1);
      expect(rating.data_quality_score).toBeGreaterThan(0);
    });

    it("should handle empty data gracefully", async () => {
      const rating = await (
        teamRatingSystem as any
      ).calculateTeamDefensiveRating("TOR", "20242025", [], [], []);

      expect(rating).toBeDefined();
      expect(rating.team_abbreviation).toBe("TOR");
      expect(rating.goals_against_per_game).toBe(3.0); // Default value
      expect(rating.shots_against_per_game).toBe(30.0); // Default value
      expect(rating.data_quality_score).toBeLessThan(1.0); // Lower quality with no data
    });

    it("should calculate shot suppression rating correctly", () => {
      // Test shot suppression rating calculation
      const excellentRating = (
        teamRatingSystem as any
      ).calculateShotSuppressionRating(25);
      const averageRating = (
        teamRatingSystem as any
      ).calculateShotSuppressionRating(30);
      const poorRating = (
        teamRatingSystem as any
      ).calculateShotSuppressionRating(35);

      expect(excellentRating).toBe(1.0);
      expect(averageRating).toBe(0.5);
      expect(poorRating).toBe(0.0);
    });

    it("should calculate goal prevention rating correctly", () => {
      // Test goal prevention rating calculation
      const excellentRating = (
        teamRatingSystem as any
      ).calculateGoalPreventionRating(2.5, 0.92);
      const averageRating = (
        teamRatingSystem as any
      ).calculateGoalPreventionRating(3.0, 0.9);
      const poorRating = (
        teamRatingSystem as any
      ).calculateGoalPreventionRating(3.5, 0.88);

      expect(excellentRating).toBe(1.0);
      expect(averageRating).toBeGreaterThan(0.3);
      expect(averageRating).toBeLessThan(0.7);
      expect(poorRating).toBe(0.0);
    });

    it("should calculate special teams rating correctly", () => {
      const excellentPK = (teamRatingSystem as any).calculateSpecialTeamsRating(
        0.85
      );
      const averagePK = (teamRatingSystem as any).calculateSpecialTeamsRating(
        0.8
      );
      const poorPK = (teamRatingSystem as any).calculateSpecialTeamsRating(
        0.75
      );

      expect(excellentPK).toBeCloseTo(1.0, 5); // Use toBeCloseTo for floating point
      expect(averagePK).toBe(0.5);
      expect(poorPK).toBe(0.0);
    });
  });

  describe("Recent Performance Analysis", () => {
    it("should calculate recent defensive metrics correctly", () => {
      const recentGames = [
        { goals_against: 2, save_pct: 0.92 },
        { goals_against: 3, save_pct: 0.91 },
        { goals_against: 1, save_pct: 0.95 },
        { goals_against: 4, save_pct: 0.88 },
        { goals_against: 2, save_pct: 0.925 },
        { goals_against: 3, save_pct: 0.905 }
      ];

      const recentMetrics = (
        teamRatingSystem as any
      ).calculateRecentDefensiveMetrics(recentGames);

      expect(recentMetrics.recent_defensive_rating).toBeGreaterThanOrEqual(0);
      expect(recentMetrics.recent_defensive_rating).toBeLessThanOrEqual(1);
      expect(recentMetrics.recent_goals_against_trend).toBeDefined();
    });

    it("should handle empty recent games", () => {
      const recentMetrics = (
        teamRatingSystem as any
      ).calculateRecentDefensiveMetrics([]);

      expect(recentMetrics.recent_defensive_rating).toBe(0.5);
      expect(recentMetrics.recent_goals_against_trend).toBe(0);
    });
  });

  describe("Trend Calculation", () => {
    it("should calculate positive trend correctly", () => {
      const improvingValues = [4, 3, 2, 1]; // Goals against decreasing (improving)
      const trend = (teamRatingSystem as any).calculateTrendSlope(
        improvingValues
      );

      expect(trend).toBeLessThan(0); // Negative slope = improving defense
    });

    it("should calculate negative trend correctly", () => {
      const worseningValues = [1, 2, 3, 4]; // Goals against increasing (worsening)
      const trend = (teamRatingSystem as any).calculateTrendSlope(
        worseningValues
      );

      expect(trend).toBeGreaterThan(0); // Positive slope = worsening defense
    });

    it("should handle insufficient data", () => {
      const singleValue = [3];
      const trend = (teamRatingSystem as any).calculateTrendSlope(singleValue);

      expect(trend).toBe(0);
    });
  });

  describe("Weighted Average Calculation", () => {
    it("should calculate weighted average correctly", () => {
      const data = [
        { stat: 0.92, weight: 30 },
        { stat: 0.9, weight: 20 },
        { stat: 0.95, weight: 10 }
      ];

      const weightedAvg = (teamRatingSystem as any).calculateWeightedAverage(
        data,
        "stat",
        "weight"
      );

      // Expected: (0.920*30 + 0.900*20 + 0.950*10) / (30+20+10) = 0.92
      expect(weightedAvg).toBeCloseTo(0.92, 2);
    });

    it("should handle zero weights", () => {
      const data = [
        { stat: 0.92, weight: 0 },
        { stat: 0.9, weight: 0 }
      ];

      const weightedAvg = (teamRatingSystem as any).calculateWeightedAverage(
        data,
        "stat",
        "weight"
      );

      expect(weightedAvg).toBe(0);
    });

    it("should handle empty data", () => {
      const weightedAvg = (teamRatingSystem as any).calculateWeightedAverage(
        [],
        "stat",
        "weight"
      );

      expect(weightedAvg).toBe(0);
    });
  });

  describe("Data Quality Assessment", () => {
    it("should calculate high quality score with complete data", () => {
      const score = (teamRatingSystem as any).calculateDataQuality(
        3,
        15,
        8,
        25
      );

      expect(score).toBeGreaterThan(0.8); // Should be high quality
    });

    it("should calculate low quality score with limited data", () => {
      const score = (teamRatingSystem as any).calculateDataQuality(0, 2, 1, 5);

      expect(score).toBeLessThan(0.6); // Should be lower quality
    });

    it("should not exceed maximum quality score", () => {
      const score = (teamRatingSystem as any).calculateDataQuality(
        10,
        30,
        15,
        50
      );

      expect(score).toBeLessThanOrEqual(1.0);
    });
  });

  describe("Opponent Strength Calculation", () => {
    it("should calculate opponent strength score structure", async () => {
      // Mock a team rating
      const mockTeamRating: TeamDefensiveRating = {
        team_abbreviation: "BOS",
        season: "20242025",
        goals_against_per_game: 2.8,
        shots_against_per_game: 28.5,
        save_percentage: 0.915,
        penalty_kill_percentage: 0.82,
        high_danger_save_percentage: 0.87,
        overall_defensive_rating: 0.75,
        shot_suppression_rating: 0.65,
        goal_prevention_rating: 0.8,
        special_teams_defense_rating: 0.7,
        recent_defensive_rating: 0.78,
        recent_goals_against_trend: -0.1,
        recent_performance_weight: 0.15,
        expected_goals_against_per_60: 8.4,
        corsi_against_per_60: 58.2,
        fenwick_against_per_60: 48.1,
        games_played: 35,
        data_quality_score: 0.9
      };

      // Mock the getTeamDefensiveRating method
      vi.spyOn(teamRatingSystem, "getTeamDefensiveRating").mockResolvedValue(
        mockTeamRating
      );

      const opponentStrength = await teamRatingSystem.calculateOpponentStrength(
        "BOS",
        "2025-01-15",
        true
      );

      expect(opponentStrength).toBeDefined();
      expect(opponentStrength!.opponent_team).toBe("BOS");
      expect(opponentStrength!.prediction_date).toBe("2025-01-15");
      expect(opponentStrength!.is_home_game).toBe(true);
      expect(opponentStrength!.overall_strength_score).toBeGreaterThanOrEqual(
        0
      );
      expect(opponentStrength!.overall_strength_score).toBeLessThanOrEqual(1);
      expect(opponentStrength!.goals_against_difficulty).toBeGreaterThanOrEqual(
        0
      );
      expect(
        opponentStrength!.shot_generation_difficulty
      ).toBeGreaterThanOrEqual(0);
      expect(opponentStrength!.confidence_score).toBe(0.9);
    });

    it("should return null for invalid team", async () => {
      vi.spyOn(teamRatingSystem, "getTeamDefensiveRating").mockResolvedValue(
        null
      );

      const opponentStrength = await teamRatingSystem.calculateOpponentStrength(
        "INVALID",
        "2025-01-15"
      );

      expect(opponentStrength).toBeNull();
    });
  });

  describe("Cache Management", () => {
    it("should cache team ratings", async () => {
      const mockRating: TeamDefensiveRating = {
        team_abbreviation: "TOR",
        season: "20242025",
        goals_against_per_game: 3.1,
        shots_against_per_game: 31.2,
        save_percentage: 0.908,
        penalty_kill_percentage: 0.81,
        high_danger_save_percentage: 0.863,
        overall_defensive_rating: 0.68,
        shot_suppression_rating: 0.62,
        goal_prevention_rating: 0.7,
        special_teams_defense_rating: 0.72,
        recent_defensive_rating: 0.65,
        recent_goals_against_trend: 0.05,
        recent_performance_weight: 0.15,
        expected_goals_against_per_60: 9.3,
        corsi_against_per_60: 62.1,
        fenwick_against_per_60: 51.8,
        games_played: 28,
        data_quality_score: 0.85
      };

      // Set up cache manually to test cache functionality
      (teamRatingSystem as any).teamRatingsCache.set(
        "TOR_20242025",
        mockRating
      );
      (teamRatingSystem as any).lastCacheUpdate = Date.now();

      // This should return cached value without database call
      const cachedRating = await teamRatingSystem.getTeamDefensiveRating(
        "TOR",
        "20242025"
      );

      expect(cachedRating).toEqual(mockRating);
    });

    it("should clear cache properly", () => {
      // Add something to cache
      (teamRatingSystem as any).teamRatingsCache.set("test", {});
      (teamRatingSystem as any).lastCacheUpdate = Date.now();

      // Clear cache
      teamRatingSystem.clearCache();

      expect((teamRatingSystem as any).teamRatingsCache.size).toBe(0);
      expect((teamRatingSystem as any).lastCacheUpdate).toBe(0);
    });
  });

  describe("Utility Functions", () => {
    it("should calculate date days ago correctly", () => {
      const daysAgo = 7;
      const expectedDate = new Date();
      expectedDate.setDate(expectedDate.getDate() - daysAgo);
      const expectedDateString = expectedDate.toISOString().split("T")[0];

      const calculatedDate = (teamRatingSystem as any).getDateDaysAgo(daysAgo);

      expect(calculatedDate).toBe(expectedDateString);
    });
  });

  describe("Edge Cases and Error Handling", () => {
    it("should handle missing goalie stats gracefully", async () => {
      const rating = await (
        teamRatingSystem as any
      ).calculateTeamDefensiveRating(
        "TOR",
        "20242025",
        [], // No goalie stats
        [{ games_played: 10, sh_goals_against: 5, pp_goals_against: 10 }],
        []
      );

      expect(rating.save_percentage).toBe(0);
      expect(rating.goals_against_per_game).toBe(3.0); // Default fallback
      expect(rating.data_quality_score).toBeLessThan(0.5);
    });

    it("should handle invalid statistics gracefully", async () => {
      const mockGoalieStats = [
        {
          games_played: null,
          save_pct: null,
          goals_against: undefined,
          shots_against: "invalid"
        }
      ];

      const rating = await (
        teamRatingSystem as any
      ).calculateTeamDefensiveRating(
        "TOR",
        "20242025",
        mockGoalieStats,
        [],
        []
      );

      expect(rating).toBeDefined();
      expect(rating.data_quality_score).toBeLessThan(0.3); // Very low quality
    });
  });
});
