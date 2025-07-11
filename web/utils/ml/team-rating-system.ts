// utils/ml/team-rating-system.ts
// Comprehensive Team Defensive and Situational Rating System
// Provides opponent strength metrics for xFS neural network

import { createClient } from "@supabase/supabase-js";

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface TeamDefensiveRating {
  team_abbreviation: string;
  season: string;

  // Core Defensive Metrics
  goals_against_per_game: number;
  shots_against_per_game: number;
  save_percentage: number;
  penalty_kill_percentage: number;
  high_danger_save_percentage: number;

  // Composite Ratings (0-1 scale, higher = better defense)
  overall_defensive_rating: number;
  shot_suppression_rating: number;
  goal_prevention_rating: number;
  special_teams_defense_rating: number;

  // Recent Performance (last 10 games)
  recent_defensive_rating: number;
  recent_goals_against_trend: number;
  recent_performance_weight: number;

  // Advanced Metrics
  expected_goals_against_per_60: number;
  corsi_against_per_60: number;
  fenwick_against_per_60: number;

  // Confidence metrics
  games_played: number;
  data_quality_score: number;
}

export interface TeamSituationalRating {
  team_abbreviation: string;
  season: string;

  // Home/Away Performance
  home_defensive_rating: number;
  away_defensive_rating: number;
  home_away_differential: number;

  // Rest Factors
  back_to_back_defensive_rating: number;
  one_day_rest_rating: number;
  two_plus_days_rest_rating: number;
  rest_impact_factor: number;

  // Schedule Strength
  recent_opponent_quality: number;
  strength_of_schedule: number;

  // Goalie Factors
  starting_goalie_save_pct: number;
  backup_goalie_save_pct: number;
  goalie_differential: number;
  expected_starter_probability: number;
}

export interface OpponentStrengthScore {
  opponent_team: string;
  prediction_date: string;

  // Composite Scores (0-1, higher = stronger opponent defense)
  overall_strength_score: number;
  recent_form_score: number;
  situational_strength_score: number;

  // Detailed Breakdown
  goals_against_difficulty: number;
  shot_generation_difficulty: number;
  power_play_opportunity_likelihood: number;

  // Context
  is_home_game: boolean;
  opponent_rest_days: number;
  expected_goalie_quality: number;
  confidence_score: number;
}

export class TeamRatingSystem {
  private teamRatingsCache: Map<string, TeamDefensiveRating> = new Map();
  private cacheExpiry: number = 60 * 60 * 1000; // 1 hour cache
  private lastCacheUpdate: number = 0;

  /**
   * Get comprehensive team defensive rating for a specific team and season
   */
  async getTeamDefensiveRating(
    teamAbbreviation: string,
    season: string = "20242025"
  ): Promise<TeamDefensiveRating | null> {
    const cacheKey = `${teamAbbreviation}_${season}`;

    // Check cache first
    if (
      this.teamRatingsCache.has(cacheKey) &&
      Date.now() - this.lastCacheUpdate < this.cacheExpiry
    ) {
      return this.teamRatingsCache.get(cacheKey)!;
    }

    try {
      // Get team's goalie stats for the season
      const { data: goalieStats, error: goalieError } = await supabase
        .from("wgo_goalie_stats_totals")
        .select("*")
        .eq("current_team_abbreviation", teamAbbreviation)
        .eq("season_id", parseInt(season))
        .order("games_played", { ascending: false });

      if (goalieError) {
        console.error("Error fetching goalie stats:", goalieError);
        return null;
      }

      // Get team's defensive stats by aggregating skater stats
      const { data: skaterStats, error: skaterError } = await supabase
        .from("wgo_skater_stats_totals")
        .select(
          `
          games_played,
          es_goals_against,
          pp_goals_against,
          sh_goals_against,
          sat_against,
          usat_against,
          current_team_abbreviation
        `
        )
        .eq("current_team_abbreviation", teamAbbreviation)
        .eq("season", season);

      if (skaterError) {
        console.error("Error fetching skater stats:", skaterError);
        return null;
      }

      // Get recent games for trend analysis (last 10 games)
      const { data: recentGames, error: recentError } = await supabase
        .from("wgo_goalie_stats")
        .select("*")
        .eq("team_abbreviation", teamAbbreviation)
        .gte("date", this.getDateDaysAgo(20)) // Get last 20 days to ensure 10 games
        .order("date", { ascending: false })
        .limit(10);

      if (recentError) {
        console.error("Error fetching recent games:", recentError);
      }

      // Calculate defensive metrics
      const rating = await this.calculateTeamDefensiveRating(
        teamAbbreviation,
        season,
        goalieStats || [],
        skaterStats || [],
        recentGames || []
      );

      // Cache the result
      this.teamRatingsCache.set(cacheKey, rating);
      this.lastCacheUpdate = Date.now();

      return rating;
    } catch (error) {
      console.error(
        `Error calculating team defensive rating for ${teamAbbreviation}:`,
        error
      );
      return null;
    }
  }

  /**
   * Calculate comprehensive team defensive rating from raw stats
   */
  private async calculateTeamDefensiveRating(
    teamAbbreviation: string,
    season: string,
    goalieStats: any[],
    skaterStats: any[],
    recentGames: any[]
  ): Promise<TeamDefensiveRating> {
    // Aggregate goalie statistics
    const totalGamesPlayed = goalieStats.reduce(
      (sum, g) => sum + (g.games_played || 0),
      0
    );
    const weightedSavePct = this.calculateWeightedAverage(
      goalieStats,
      "save_pct",
      "games_played"
    );
    const totalGoalsAgainst = goalieStats.reduce(
      (sum, g) => sum + (g.goals_against || 0),
      0
    );
    const totalShotsAgainst = goalieStats.reduce(
      (sum, g) => sum + (g.shots_against || 0),
      0
    );

    // Calculate goals and shots against per game
    const goalsAgainstPerGame =
      totalGamesPlayed > 0 ? totalGoalsAgainst / totalGamesPlayed : 3.0;
    const shotsAgainstPerGame =
      totalGamesPlayed > 0 ? totalShotsAgainst / totalGamesPlayed : 30.0;

    // Calculate penalty kill percentage (approximation from skater stats)
    const totalShGoalsAgainst = skaterStats.reduce(
      (sum, s) => sum + (s.sh_goals_against || 0),
      0
    );
    const totalPpGoalsAgainst = skaterStats.reduce(
      (sum, s) => sum + (s.pp_goals_against || 0),
      0
    );
    const estimatedPenaltyKillPct =
      totalPpGoalsAgainst > 0
        ? Math.max(
            0.5,
            1 -
              totalPpGoalsAgainst / (totalPpGoalsAgainst + totalShGoalsAgainst)
          )
        : 0.8;

    // Calculate recent performance metrics
    const recentMetrics = this.calculateRecentDefensiveMetrics(recentGames);

    // Calculate advanced metrics from available data
    const avgSatAgainst =
      skaterStats.length > 0
        ? skaterStats.reduce((sum, s) => sum + (s.sat_against || 0), 0) /
          skaterStats.length
        : 1200;
    const avgUsatAgainst =
      skaterStats.length > 0
        ? skaterStats.reduce((sum, s) => sum + (s.usat_against || 0), 0) /
          skaterStats.length
        : 800;

    // Calculate composite ratings (0-1 scale, higher = better defense)
    const shotSuppressionRating =
      this.calculateShotSuppressionRating(shotsAgainstPerGame);
    const goalPreventionRating = this.calculateGoalPreventionRating(
      goalsAgainstPerGame,
      weightedSavePct
    );
    const specialTeamsDefenseRating = this.calculateSpecialTeamsRating(
      estimatedPenaltyKillPct
    );

    // Overall defensive rating (weighted combination)
    const overallDefensiveRating =
      shotSuppressionRating * 0.3 +
      goalPreventionRating * 0.4 +
      specialTeamsDefenseRating * 0.2 +
      recentMetrics.recent_defensive_rating * 0.1;

    // Data quality score based on available data
    const dataQualityScore = this.calculateDataQuality(
      goalieStats.length,
      skaterStats.length,
      recentGames.length,
      totalGamesPlayed
    );

    return {
      team_abbreviation: teamAbbreviation,
      season: season,

      // Core Defensive Metrics
      goals_against_per_game: Math.round(goalsAgainstPerGame * 100) / 100,
      shots_against_per_game: Math.round(shotsAgainstPerGame * 100) / 100,
      save_percentage: Math.round(weightedSavePct * 1000) / 1000,
      penalty_kill_percentage:
        Math.round(estimatedPenaltyKillPct * 1000) / 1000,
      high_danger_save_percentage: weightedSavePct * 0.95, // Approximation

      // Composite Ratings
      overall_defensive_rating:
        Math.round(overallDefensiveRating * 1000) / 1000,
      shot_suppression_rating: Math.round(shotSuppressionRating * 1000) / 1000,
      goal_prevention_rating: Math.round(goalPreventionRating * 1000) / 1000,
      special_teams_defense_rating:
        Math.round(specialTeamsDefenseRating * 1000) / 1000,

      // Recent Performance
      recent_defensive_rating:
        Math.round(recentMetrics.recent_defensive_rating * 1000) / 1000,
      recent_goals_against_trend:
        Math.round(recentMetrics.recent_goals_against_trend * 1000) / 1000,
      recent_performance_weight: 0.15, // 15% weight for recent performance

      // Advanced Metrics (approximations from available data)
      expected_goals_against_per_60: goalsAgainstPerGame * 3.0, // Rough conversion
      corsi_against_per_60: (avgSatAgainst / totalGamesPlayed) * 60,
      fenwick_against_per_60: (avgUsatAgainst / totalGamesPlayed) * 60,

      // Confidence metrics
      games_played: totalGamesPlayed,
      data_quality_score: Math.round(dataQualityScore * 1000) / 1000
    };
  }

  /**
   * Calculate recent defensive performance metrics
   */
  private calculateRecentDefensiveMetrics(recentGames: any[]): {
    recent_defensive_rating: number;
    recent_goals_against_trend: number;
  } {
    if (recentGames.length === 0) {
      return {
        recent_defensive_rating: 0.5,
        recent_goals_against_trend: 0
      };
    }

    // Calculate recent goals against per game
    const recentGoalsAgainst = recentGames.map((g) => g.goals_against || 0);
    const avgRecentGoalsAgainst =
      recentGoalsAgainst.reduce((sum, g) => sum + g, 0) /
      recentGoalsAgainst.length;

    // Calculate recent save percentage
    const recentSavePct = recentGames
      .filter((g) => g.save_pct && g.save_pct > 0)
      .map((g) => g.save_pct);
    const avgRecentSavePct =
      recentSavePct.length > 0
        ? recentSavePct.reduce((sum, pct) => sum + pct, 0) /
          recentSavePct.length
        : 0.9;

    // Calculate trend (negative = goals against increasing = worse defense)
    const trend = this.calculateTrendSlope(recentGoalsAgainst) * -1;

    // Recent defensive rating based on goals against and save percentage
    const recentDefensiveRating = this.calculateGoalPreventionRating(
      avgRecentGoalsAgainst,
      avgRecentSavePct
    );

    return {
      recent_defensive_rating: recentDefensiveRating,
      recent_goals_against_trend: trend
    };
  }

  /**
   * Calculate shot suppression rating (0-1, higher = better)
   */
  private calculateShotSuppressionRating(shotsAgainstPerGame: number): number {
    // NHL average is around 30 shots against per game
    // Scale: 25 shots = 1.0 (excellent), 35 shots = 0.0 (poor)
    return Math.max(0, Math.min(1, (35 - shotsAgainstPerGame) / 10));
  }

  /**
   * Calculate goal prevention rating (0-1, higher = better)
   */
  private calculateGoalPreventionRating(
    goalsAgainstPerGame: number,
    savePct: number
  ): number {
    // Goals against component (2.5 goals = 1.0, 3.5 goals = 0.0)
    const goalsComponent = Math.max(
      0,
      Math.min(1, (3.5 - goalsAgainstPerGame) / 1.0)
    );

    // Save percentage component (0.92 = 1.0, 0.88 = 0.0)
    const saveComponent = Math.max(0, Math.min(1, (savePct - 0.88) / 0.04));

    return goalsComponent * 0.6 + saveComponent * 0.4;
  }

  /**
   * Calculate special teams defense rating (0-1, higher = better)
   */
  private calculateSpecialTeamsRating(penaltyKillPct: number): number {
    // Scale: 85% PK = 1.0, 75% PK = 0.0
    return Math.max(0, Math.min(1, (penaltyKillPct - 0.75) / 0.1));
  }

  /**
   * Calculate opponent strength score for a specific matchup
   */
  async calculateOpponentStrength(
    opponentTeam: string,
    predictionDate: string,
    isHomeGame: boolean = false,
    season: string = "20242025"
  ): Promise<OpponentStrengthScore | null> {
    try {
      // Get team defensive rating
      const teamRating = await this.getTeamDefensiveRating(
        opponentTeam,
        season
      );
      if (!teamRating) {
        return null;
      }

      // Get situational rating
      const situationalRating = await this.getTeamSituationalRating(
        opponentTeam,
        season
      );

      // Calculate situational adjustments
      const homeAwayAdjustment = situationalRating
        ? isHomeGame
          ? situationalRating.home_defensive_rating
          : situationalRating.away_defensive_rating
        : teamRating.overall_defensive_rating;

      // Calculate recent form weight (last 10 games get 30% weight)
      const recentFormScore =
        teamRating.overall_defensive_rating * 0.7 +
        teamRating.recent_defensive_rating * 0.3;

      // Calculate situational strength (home/away adjustment)
      const situationalStrengthScore = homeAwayAdjustment;

      // Overall strength score (weighted combination)
      const overallStrengthScore =
        teamRating.overall_defensive_rating * 0.4 +
        recentFormScore * 0.4 +
        situationalStrengthScore * 0.2;

      // Specific difficulty metrics for neural network features
      const goalsAgainstDifficulty = 1 - teamRating.goal_prevention_rating; // Invert: higher = harder to score
      const shotGenerationDifficulty = 1 - teamRating.shot_suppression_rating; // Invert: higher = harder to get shots
      const powerPlayOpportunityLikelihood =
        1 - teamRating.special_teams_defense_rating; // More penalties = more PP opportunities

      return {
        opponent_team: opponentTeam,
        prediction_date: predictionDate,

        // Composite Scores
        overall_strength_score: Math.round(overallStrengthScore * 1000) / 1000,
        recent_form_score: Math.round(recentFormScore * 1000) / 1000,
        situational_strength_score:
          Math.round(situationalStrengthScore * 1000) / 1000,

        // Detailed Breakdown
        goals_against_difficulty:
          Math.round(goalsAgainstDifficulty * 1000) / 1000,
        shot_generation_difficulty:
          Math.round(shotGenerationDifficulty * 1000) / 1000,
        power_play_opportunity_likelihood:
          Math.round(powerPlayOpportunityLikelihood * 1000) / 1000,

        // Context
        is_home_game: isHomeGame,
        opponent_rest_days: 1, // Would need schedule data
        expected_goalie_quality: teamRating.save_percentage,
        confidence_score: teamRating.data_quality_score
      };
    } catch (error) {
      console.error(
        `Error calculating opponent strength for ${opponentTeam}:`,
        error
      );
      return null;
    }
  }

  /**
   * Get team situational ratings (enhanced implementation)
   */
  private async getTeamSituationalRating(
    teamAbbreviation: string,
    season: string
  ): Promise<TeamSituationalRating | null> {
    try {
      // Get team's game-by-game data for situational analysis
      const { data: gameData, error } = await supabase
        .from("wgo_skater_stats")
        .select(
          `
          date,
          games_played,
          goals,
          assists,
          shots,
          hits,
          blocked_shots,
          toi_per_game,
          current_team_abbreviation
        `
        )
        .eq("current_team_abbreviation", teamAbbreviation)
        .gte("date", this.getSeasonStartDate(season))
        .lte("date", this.getSeasonEndDate(season))
        .order("date", { ascending: true });

      if (error || !gameData || gameData.length === 0) {
        console.error(
          `Error fetching game data for ${teamAbbreviation}:`,
          error
        );
        return null;
      }

      // Get goalie data for home/away and rest analysis
      const { data: goalieGameData, error: goalieError } = await supabase
        .from("wgo_goalie_stats")
        .select("*")
        .eq("team_abbreviation", teamAbbreviation)
        .gte("date", this.getSeasonStartDate(season))
        .lte("date", this.getSeasonEndDate(season))
        .order("date", { ascending: true });

      if (goalieError) {
        console.error(
          `Error fetching goalie game data for ${teamAbbreviation}:`,
          goalieError
        );
      }

      // Calculate situational ratings
      const situationalRating = await this.calculateSituationalRating(
        teamAbbreviation,
        season,
        gameData,
        goalieGameData || []
      );

      return situationalRating;
    } catch (error) {
      console.error(
        `Error calculating situational rating for ${teamAbbreviation}:`,
        error
      );
      return null;
    }
  }

  /**
   * Calculate comprehensive situational rating from game data
   */
  private async calculateSituationalRating(
    teamAbbreviation: string,
    season: string,
    gameData: any[],
    goalieData: any[]
  ): Promise<TeamSituationalRating> {
    // Analyze home/away performance
    const homeAwayAnalysis = this.analyzeHomeAwayPerformance(
      gameData,
      goalieData
    );

    // Analyze rest day impact
    const restAnalysis = this.analyzeRestDayImpact(goalieData);

    // Analyze schedule strength
    const scheduleAnalysis = await this.analyzeScheduleStrength(
      teamAbbreviation,
      season
    );

    // Analyze goalie usage patterns
    const goalieAnalysis = this.analyzeGoalieUsage(goalieData);

    return {
      team_abbreviation: teamAbbreviation,
      season: season,

      // Home/Away Performance
      home_defensive_rating: homeAwayAnalysis.home_rating,
      away_defensive_rating: homeAwayAnalysis.away_rating,
      home_away_differential: homeAwayAnalysis.differential,

      // Rest Factors
      back_to_back_defensive_rating: restAnalysis.back_to_back_rating,
      one_day_rest_rating: restAnalysis.one_day_rest_rating,
      two_plus_days_rest_rating: restAnalysis.two_plus_rest_rating,
      rest_impact_factor: restAnalysis.impact_factor,

      // Schedule Strength
      recent_opponent_quality: scheduleAnalysis.recent_opponent_quality,
      strength_of_schedule: scheduleAnalysis.strength_of_schedule,

      // Goalie Factors
      starting_goalie_save_pct: goalieAnalysis.starter_save_pct,
      backup_goalie_save_pct: goalieAnalysis.backup_save_pct,
      goalie_differential: goalieAnalysis.differential,
      expected_starter_probability: goalieAnalysis.starter_probability
    };
  }

  /**
   * Analyze home/away performance differences
   */
  private analyzeHomeAwayPerformance(
    gameData: any[],
    goalieData: any[]
  ): {
    home_rating: number;
    away_rating: number;
    differential: number;
  } {
    if (goalieData.length === 0) {
      return {
        home_rating: 0.5,
        away_rating: 0.5,
        differential: 0
      };
    }

    // For now, we'll infer home/away from alternating pattern or use a heuristic
    // In a real implementation, we'd need actual home/away data
    // This is a simplified approximation
    const homeGames = goalieData.filter((_, index) => index % 2 === 0); // Rough approximation
    const awayGames = goalieData.filter((_, index) => index % 2 === 1);

    const homeRating = this.calculateGameSetDefensiveRating(homeGames);
    const awayRating = this.calculateGameSetDefensiveRating(awayGames);

    return {
      home_rating: homeRating,
      away_rating: awayRating,
      differential: homeRating - awayRating
    };
  }

  /**
   * Analyze rest day impact on defensive performance
   */
  private analyzeRestDayImpact(goalieData: any[]): {
    back_to_back_rating: number;
    one_day_rest_rating: number;
    two_plus_rest_rating: number;
    impact_factor: number;
  } {
    if (goalieData.length < 2) {
      return {
        back_to_back_rating: 0.5,
        one_day_rest_rating: 0.5,
        two_plus_rest_rating: 0.5,
        impact_factor: 1.0
      };
    }

    const gamesWithRest = this.calculateRestDaysBetweenGames(goalieData);

    const backToBackGames = gamesWithRest.filter((g) => g.restDays === 0);
    const oneDayRestGames = gamesWithRest.filter((g) => g.restDays === 1);
    const twoPlusRestGames = gamesWithRest.filter((g) => g.restDays >= 2);

    const b2bRating = this.calculateGameSetDefensiveRating(
      backToBackGames.map((g) => g.game)
    );
    const oneDayRating = this.calculateGameSetDefensiveRating(
      oneDayRestGames.map((g) => g.game)
    );
    const twoPlusRating = this.calculateGameSetDefensiveRating(
      twoPlusRestGames.map((g) => g.game)
    );

    // Impact factor: how much rest affects performance (higher = more rest-dependent)
    const baselineRating = (b2bRating + oneDayRating + twoPlusRating) / 3;
    const restVariance = Math.abs(twoPlusRating - b2bRating);
    const impactFactor = Math.min(2.0, 1.0 + restVariance);

    return {
      back_to_back_rating: b2bRating,
      one_day_rest_rating: oneDayRating,
      two_plus_rest_rating: twoPlusRating,
      impact_factor: impactFactor
    };
  }

  /**
   * Calculate rest days between games
   */
  private calculateRestDaysBetweenGames(
    goalieData: any[]
  ): Array<{ game: any; restDays: number }> {
    const result = [];

    for (let i = 1; i < goalieData.length; i++) {
      const currentGame = goalieData[i];
      const previousGame = goalieData[i - 1];

      const currentDate = new Date(currentGame.date);
      const previousDate = new Date(previousGame.date);

      const timeDiff = currentDate.getTime() - previousDate.getTime();
      const daysDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24)) - 1; // Subtract 1 for actual rest days

      result.push({
        game: currentGame,
        restDays: Math.max(0, daysDiff)
      });
    }

    return result;
  }

  /**
   * Calculate defensive rating for a set of games
   */
  private calculateGameSetDefensiveRating(games: any[]): number {
    if (games.length === 0) return 0.5;

    const avgGoalsAgainst =
      games.reduce((sum, g) => sum + (g.goals_against || 0), 0) / games.length;
    const avgSavePct =
      games
        .filter((g) => g.save_pct && g.save_pct > 0)
        .reduce((sum, g) => sum + g.save_pct, 0) /
      Math.max(1, games.filter((g) => g.save_pct && g.save_pct > 0).length);

    return this.calculateGoalPreventionRating(
      avgGoalsAgainst,
      avgSavePct || 0.9
    );
  }

  /**
   * Analyze schedule strength (simplified implementation)
   */
  private async analyzeScheduleStrength(
    teamAbbreviation: string,
    season: string
  ): Promise<{
    recent_opponent_quality: number;
    strength_of_schedule: number;
  }> {
    // This would require opponent data analysis
    // For now, returning reasonable defaults
    return {
      recent_opponent_quality: 0.5, // Average opponent quality
      strength_of_schedule: 0.5 // Average schedule strength
    };
  }

  /**
   * Analyze goalie usage patterns and performance
   */
  private analyzeGoalieUsage(goalieData: any[]): {
    starter_save_pct: number;
    backup_save_pct: number;
    differential: number;
    starter_probability: number;
  } {
    if (goalieData.length === 0) {
      return {
        starter_save_pct: 0.91,
        backup_save_pct: 0.89,
        differential: 0.02,
        starter_probability: 0.65
      };
    }

    // Group goalies by games played to identify starter vs backup
    const goalieStats = new Map<
      string,
      { games: number; totalSaves: number; totalShots: number }
    >();

    goalieData.forEach((game) => {
      const goalieName = game.goalie_name || "Unknown";
      if (!goalieStats.has(goalieName)) {
        goalieStats.set(goalieName, { games: 0, totalSaves: 0, totalShots: 0 });
      }

      const stats = goalieStats.get(goalieName)!;
      stats.games += 1;
      stats.totalSaves += game.saves || 0;
      stats.totalShots += game.shots_against || 0;
    });

    // Sort by games played to identify starter (most games) and backup
    const sortedGoalies = Array.from(goalieStats.entries()).sort(
      (a, b) => b[1].games - a[1].games
    );

    let starterSavePct = 0.91;
    let backupSavePct = 0.89;
    let starterProbability = 0.65;

    if (sortedGoalies.length >= 1) {
      const starter = sortedGoalies[0][1];
      starterSavePct =
        starter.totalShots > 0 ? starter.totalSaves / starter.totalShots : 0.91;
      starterProbability = starter.games / goalieData.length;
    }

    if (sortedGoalies.length >= 2) {
      const backup = sortedGoalies[1][1];
      backupSavePct =
        backup.totalShots > 0 ? backup.totalSaves / backup.totalShots : 0.89;
    }

    return {
      starter_save_pct: Math.round(starterSavePct * 1000) / 1000,
      backup_save_pct: Math.round(backupSavePct * 1000) / 1000,
      differential: Math.round((starterSavePct - backupSavePct) * 1000) / 1000,
      starter_probability: Math.round(starterProbability * 1000) / 1000
    };
  }

  /**
   * Get season start date
   */
  private getSeasonStartDate(season: string): string {
    // For 20242025 season, starts October 2024
    const year = parseInt(season.substring(0, 4));
    return `${year}-10-01`;
  }

  /**
   * Get season end date
   */
  private getSeasonEndDate(season: string): string {
    // For 20242025 season, ends April 2025
    const year = parseInt(season.substring(4, 8));
    return `${year}-04-30`;
  }

  /**
   * Calculate travel fatigue factor based on upcoming schedule
   */
  async calculateTravelFatigue(
    teamAbbreviation: string,
    predictionDate: string,
    lookAheadDays: number = 7
  ): Promise<number> {
    // This would require schedule data with locations
    // For now, returning a baseline factor
    return 1.0; // No fatigue adjustment
  }

  /**
   * Get enhanced opponent strength with situational factors
   */
  async calculateEnhancedOpponentStrength(
    opponentTeam: string,
    predictionDate: string,
    isHomeGame: boolean = false,
    restDays: number = 1,
    season: string = "20242025"
  ): Promise<OpponentStrengthScore | null> {
    try {
      // Get base team defensive rating
      const teamRating = await this.getTeamDefensiveRating(
        opponentTeam,
        season
      );
      if (!teamRating) {
        return null;
      }

      // Get situational rating
      const situationalRating = await this.getTeamSituationalRating(
        opponentTeam,
        season
      );

      // Calculate situational adjustments
      let homeAwayAdjustment = teamRating.overall_defensive_rating;
      let restAdjustment = 1.0;

      if (situationalRating) {
        // Home/away adjustment
        homeAwayAdjustment = isHomeGame
          ? situationalRating.away_defensive_rating // Opponent is away when we're home
          : situationalRating.home_defensive_rating; // Opponent is home when we're away

        // Rest day adjustment
        if (restDays === 0) {
          restAdjustment =
            situationalRating.back_to_back_defensive_rating /
            teamRating.overall_defensive_rating;
        } else if (restDays === 1) {
          restAdjustment =
            situationalRating.one_day_rest_rating /
            teamRating.overall_defensive_rating;
        } else if (restDays >= 2) {
          restAdjustment =
            situationalRating.two_plus_days_rest_rating /
            teamRating.overall_defensive_rating;
        }
      }

      // Calculate recent form weight (last 10 games get 30% weight)
      const recentFormScore =
        teamRating.overall_defensive_rating * 0.7 +
        teamRating.recent_defensive_rating * 0.3;

      // Apply situational adjustments
      const situationalStrengthScore = homeAwayAdjustment * restAdjustment;

      // Overall strength score (weighted combination with situational factors)
      const overallStrengthScore =
        teamRating.overall_defensive_rating * 0.3 +
        recentFormScore * 0.3 +
        situationalStrengthScore * 0.4; // Higher weight for situational factors

      // Specific difficulty metrics for neural network features
      const goalsAgainstDifficulty =
        1 - teamRating.goal_prevention_rating * restAdjustment;
      const shotGenerationDifficulty =
        1 - teamRating.shot_suppression_rating * restAdjustment;
      const powerPlayOpportunityLikelihood =
        1 - teamRating.special_teams_defense_rating;

      // Expected goalie quality based on situational factors
      const expectedGoalieQuality = situationalRating
        ? situationalRating.starting_goalie_save_pct *
            situationalRating.expected_starter_probability +
          situationalRating.backup_goalie_save_pct *
            (1 - situationalRating.expected_starter_probability)
        : teamRating.save_percentage;

      return {
        opponent_team: opponentTeam,
        prediction_date: predictionDate,

        // Composite Scores
        overall_strength_score: Math.round(overallStrengthScore * 1000) / 1000,
        recent_form_score: Math.round(recentFormScore * 1000) / 1000,
        situational_strength_score:
          Math.round(situationalStrengthScore * 1000) / 1000,

        // Detailed Breakdown
        goals_against_difficulty:
          Math.round(goalsAgainstDifficulty * 1000) / 1000,
        shot_generation_difficulty:
          Math.round(shotGenerationDifficulty * 1000) / 1000,
        power_play_opportunity_likelihood:
          Math.round(powerPlayOpportunityLikelihood * 1000) / 1000,

        // Context
        is_home_game: isHomeGame,
        opponent_rest_days: restDays,
        expected_goalie_quality:
          Math.round(expectedGoalieQuality * 1000) / 1000,
        confidence_score: teamRating.data_quality_score
      };
    } catch (error) {
      console.error(
        `Error calculating enhanced opponent strength for ${opponentTeam}:`,
        error
      );
      return null;
    }
  }

  /**
   * Calculate weighted average for a specific stat
   */
  private calculateWeightedAverage(
    data: any[],
    statField: string,
    weightField: string
  ): number {
    if (data.length === 0) return 0;

    const totalWeight = data.reduce(
      (sum, item) => sum + (item[weightField] || 0),
      0
    );
    if (totalWeight === 0) return 0;

    const weightedSum = data.reduce(
      (sum, item) => sum + (item[statField] || 0) * (item[weightField] || 0),
      0
    );

    return weightedSum / totalWeight;
  }

  /**
   * Calculate trend slope using linear regression
   */
  private calculateTrendSlope(values: number[]): number {
    if (values.length < 2) return 0;

    const n = values.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const y = values;

    const sumX = x.reduce((sum, val) => sum + val, 0);
    const sumY = y.reduce((sum, val) => sum + val, 0);
    const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
    const sumXX = x.reduce((sum, val) => sum + val * val, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    return isNaN(slope) ? 0 : slope;
  }

  /**
   * Calculate data quality score based on available data
   */
  private calculateDataQuality(
    goalieDataPoints: number,
    skaterDataPoints: number,
    recentGameDataPoints: number,
    totalGames: number
  ): number {
    let score = 0;

    // Base score for having data
    if (goalieDataPoints > 0) score += 0.3;
    if (skaterDataPoints > 0) score += 0.3;
    if (recentGameDataPoints > 0) score += 0.2;

    // Bonus for sufficient games played
    if (totalGames >= 20) score += 0.2;
    else if (totalGames >= 10) score += 0.1;

    return Math.min(1.0, score);
  }

  /**
   * Get date N days ago
   */
  private getDateDaysAgo(days: number): string {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString().split("T")[0];
  }

  /**
   * Clear the cache (useful for testing or when fresh data is needed)
   */
  clearCache(): void {
    this.teamRatingsCache.clear();
    this.lastCacheUpdate = 0;
  }

  /**
   * Calculate advanced opponent strength with trend weighting (Task 1.3)
   * Emphasizes last 10 games with exponential decay weighting
   */
  async calculateTrendWeightedOpponentStrength(
    opponentTeam: string,
    predictionDate: string,
    isHomeGame: boolean = false,
    restDays: number = 1,
    season: string = "20242025"
  ): Promise<OpponentStrengthScore | null> {
    try {
      // Get base team defensive rating
      const teamRating = await this.getTeamDefensiveRating(
        opponentTeam,
        season
      );
      if (!teamRating) {
        return null;
      }

      // Get detailed recent performance with trend weighting
      const trendWeightedMetrics = await this.calculateTrendWeightedMetrics(
        opponentTeam,
        predictionDate,
        season
      );

      // Get situational rating
      const situationalRating = await this.getTeamSituationalRating(
        opponentTeam,
        season
      );

      // Calculate momentum factor (recent trend impact)
      const momentumFactor = this.calculateMomentumFactor(trendWeightedMetrics);

      // Calculate situational adjustments with trend influence
      let homeAwayAdjustment = teamRating.overall_defensive_rating;
      let restAdjustment = 1.0;

      if (situationalRating) {
        // Home/away adjustment with recent performance influence
        const baseHomeAwayRating = isHomeGame
          ? situationalRating.away_defensive_rating
          : situationalRating.home_defensive_rating;

        homeAwayAdjustment =
          baseHomeAwayRating * 0.7 +
          trendWeightedMetrics.weighted_defensive_rating * 0.3;

        // Rest day adjustment with momentum consideration
        let baseRestRating = teamRating.overall_defensive_rating;
        if (restDays === 0) {
          baseRestRating = situationalRating.back_to_back_defensive_rating;
        } else if (restDays === 1) {
          baseRestRating = situationalRating.one_day_rest_rating;
        } else if (restDays >= 2) {
          baseRestRating = situationalRating.two_plus_days_rest_rating;
        }

        restAdjustment =
          (baseRestRating / teamRating.overall_defensive_rating) *
          momentumFactor;
      }

      // Calculate multi-layered form scores
      const recentFormScore = this.calculateLayeredFormScore(
        teamRating,
        trendWeightedMetrics
      );
      const situationalStrengthScore = homeAwayAdjustment * restAdjustment;

      // Advanced overall strength with trend weighting (Task 1.3 requirement)
      const overallStrengthScore =
        teamRating.overall_defensive_rating * 0.2 + // Season baseline: 20%
        recentFormScore.last_5_games * 0.35 + // Last 5 games: 35%
        recentFormScore.last_10_games * 0.25 + // Games 6-10: 25%
        situationalStrengthScore * 0.2; // Situational: 20%

      // Calculate difficulty metrics with trend adjustments
      const trendAdjustedGoalDifficulty =
        1 - teamRating.goal_prevention_rating * momentumFactor;
      const trendAdjustedShotDifficulty =
        1 - teamRating.shot_suppression_rating * momentumFactor;

      // Power play opportunity likelihood with recent penalty trends
      const ppOpportunityBase = 1 - teamRating.special_teams_defense_rating;
      const ppOpportunityAdjusted =
        ppOpportunityBase * trendWeightedMetrics.penalty_trend_factor;

      // Expected goalie quality with recent performance and probable starter
      const expectedGoalieQuality = this.calculateExpectedGoalieQuality(
        situationalRating,
        trendWeightedMetrics,
        teamRating.save_percentage
      );

      // Confidence score based on data recency and quality
      const confidenceScore = this.calculateTrendConfidenceScore(
        teamRating.data_quality_score,
        trendWeightedMetrics.data_recency_score,
        trendWeightedMetrics.games_in_trend_window
      );

      return {
        opponent_team: opponentTeam,
        prediction_date: predictionDate,

        // Composite Scores with trend weighting
        overall_strength_score: Math.round(overallStrengthScore * 1000) / 1000,
        recent_form_score:
          Math.round(recentFormScore.composite_score * 1000) / 1000,
        situational_strength_score:
          Math.round(situationalStrengthScore * 1000) / 1000,

        // Detailed Breakdown with trend adjustments
        goals_against_difficulty:
          Math.round(trendAdjustedGoalDifficulty * 1000) / 1000,
        shot_generation_difficulty:
          Math.round(trendAdjustedShotDifficulty * 1000) / 1000,
        power_play_opportunity_likelihood:
          Math.round(ppOpportunityAdjusted * 1000) / 1000,

        // Context with enhanced analysis
        is_home_game: isHomeGame,
        opponent_rest_days: restDays,
        expected_goalie_quality:
          Math.round(expectedGoalieQuality * 1000) / 1000,
        confidence_score: Math.round(confidenceScore * 1000) / 1000
      };
    } catch (error) {
      console.error(
        `Error calculating trend-weighted opponent strength for ${opponentTeam}:`,
        error
      );
      return null;
    }
  }

  /**
   * Calculate trend-weighted metrics with exponential decay (emphasizes last 10 games)
   */
  private async calculateTrendWeightedMetrics(
    teamAbbreviation: string,
    predictionDate: string,
    season: string
  ): Promise<{
    weighted_defensive_rating: number;
    last_5_trend: number;
    last_10_trend: number;
    penalty_trend_factor: number;
    data_recency_score: number;
    games_in_trend_window: number;
  }> {
    try {
      // Get recent games with extended window for trend analysis
      const { data: recentGames } = await supabase
        .from("wgo_goalie_stats")
        .select("*")
        .eq("team_abbreviation", teamAbbreviation)
        .lte("date", predictionDate)
        .order("date", { ascending: false })
        .limit(15); // Get 15 games for robust trend analysis

      if (!recentGames || recentGames.length === 0) {
        return {
          weighted_defensive_rating: 0.5,
          last_5_trend: 0,
          last_10_trend: 0,
          penalty_trend_factor: 1.0,
          data_recency_score: 0.1,
          games_in_trend_window: 0
        };
      }

      // Calculate exponential decay weights (higher weight for recent games)
      const weights = recentGames.map(
        (_, index) => Math.exp(-index * 0.15) // Decay factor of 0.15
      );
      const totalWeight = weights.reduce((sum, w) => sum + w, 0);
      const normalizedWeights = weights.map((w) => w / totalWeight);

      // Calculate weighted defensive metrics
      const weightedGoalsAgainst = this.calculateWeightedMetric(
        recentGames.map((g) => g.goals_against || 0),
        normalizedWeights
      );
      const weightedSavePct = this.calculateWeightedMetric(
        recentGames.filter((g) => g.save_pct).map((g) => g.save_pct),
        normalizedWeights.slice(0, recentGames.filter((g) => g.save_pct).length)
      );

      // Calculate weighted defensive rating
      const weightedDefensiveRating = this.calculateGoalPreventionRating(
        weightedGoalsAgainst,
        weightedSavePct || 0.9
      );

      // Calculate trend slopes for different windows
      const last5Games = recentGames.slice(0, Math.min(5, recentGames.length));
      const last10Games = recentGames.slice(
        0,
        Math.min(10, recentGames.length)
      );

      const last5Trend =
        this.calculateTrendSlope(last5Games.map((g) => g.goals_against || 0)) *
        -1; // Negative slope = improving defense

      const last10Trend =
        this.calculateTrendSlope(last10Games.map((g) => g.goals_against || 0)) *
        -1;

      // Calculate penalty trend factor (would need penalty data, using approximation)
      const penaltyTrendFactor = this.calculatePenaltyTrendFactor(recentGames);

      // Data recency score based on how recent the games are
      const dataRecencyScore = this.calculateDataRecencyScore(
        recentGames,
        predictionDate
      );

      return {
        weighted_defensive_rating: weightedDefensiveRating,
        last_5_trend: last5Trend,
        last_10_trend: last10Trend,
        penalty_trend_factor: penaltyTrendFactor,
        data_recency_score: dataRecencyScore,
        games_in_trend_window: recentGames.length
      };
    } catch (error) {
      console.error(
        `Error calculating trend-weighted metrics for ${teamAbbreviation}:`,
        error
      );
      return {
        weighted_defensive_rating: 0.5,
        last_5_trend: 0,
        last_10_trend: 0,
        penalty_trend_factor: 1.0,
        data_recency_score: 0.1,
        games_in_trend_window: 0
      };
    }
  }

  /**
   * Calculate weighted metric using exponential decay weights
   */
  private calculateWeightedMetric(values: number[], weights: number[]): number {
    if (values.length === 0 || weights.length === 0) return 0;

    const minLength = Math.min(values.length, weights.length);
    let weightedSum = 0;
    let totalWeight = 0;

    for (let i = 0; i < minLength; i++) {
      weightedSum += values[i] * weights[i];
      totalWeight += weights[i];
    }

    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  /**
   * Calculate momentum factor based on recent trends
   */
  private calculateMomentumFactor(trendMetrics: any): number {
    // Combine short-term and medium-term trends
    const shortTermWeight = 0.7; // Last 5 games
    const mediumTermWeight = 0.3; // Games 6-10

    const compositeTrend =
      trendMetrics.last_5_trend * shortTermWeight +
      trendMetrics.last_10_trend * mediumTermWeight;

    // Convert trend to momentum factor (1.0 = neutral, >1.0 = improving, <1.0 = declining)
    // Trend range: -2 to +2, momentum range: 0.8 to 1.2
    const momentumFactor = 1.0 + compositeTrend * 0.1;
    return Math.max(0.8, Math.min(1.2, momentumFactor));
  }

  /**
   * Calculate layered form scores with different time windows
   */
  private calculateLayeredFormScore(
    teamRating: TeamDefensiveRating,
    trendMetrics: any
  ): {
    last_5_games: number;
    last_10_games: number;
    composite_score: number;
  } {
    // Weight recent performance more heavily
    const last5Score =
      teamRating.recent_defensive_rating * 0.6 +
      trendMetrics.weighted_defensive_rating * 0.4;

    const last10Score =
      teamRating.overall_defensive_rating * 0.4 +
      teamRating.recent_defensive_rating * 0.6;

    const compositeScore = last5Score * 0.6 + last10Score * 0.4;

    return {
      last_5_games: last5Score,
      last_10_games: last10Score,
      composite_score: compositeScore
    };
  }

  /**
   * Calculate penalty trend factor (approximation until penalty data available)
   */
  private calculatePenaltyTrendFactor(recentGames: any[]): number {
    // This would ideally use penalty minutes or power play opportunities data
    // For now, using goals against as a proxy (more goals against might correlate with more penalties)
    if (recentGames.length < 3) return 1.0;

    const recentGoalsAgainst = recentGames
      .slice(0, 5)
      .map((g) => g.goals_against || 0);
    const avgRecentGoalsAgainst =
      recentGoalsAgainst.reduce((sum, g) => sum + g, 0) /
      recentGoalsAgainst.length;

    // Teams allowing more goals might be taking more penalties
    // Scale: 2.5 goals = 0.9 factor, 3.5 goals = 1.1 factor
    return Math.max(
      0.8,
      Math.min(1.2, 0.9 + (avgRecentGoalsAgainst - 2.5) * 0.2)
    );
  }

  /**
   * Calculate data recency score based on how recent the games are
   */
  private calculateDataRecencyScore(
    recentGames: any[],
    predictionDate: string
  ): number {
    if (recentGames.length === 0) return 0.1;

    const predDate = new Date(predictionDate);
    const gameRecencyScores = recentGames.map((game) => {
      const gameDate = new Date(game.date);
      const daysDiff = Math.abs(
        (predDate.getTime() - gameDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Score decreases with age: 1.0 for same day, 0.5 for 10 days old, 0.1 for 30+ days old
      return Math.max(0.1, Math.min(1.0, 1.0 - daysDiff * 0.05));
    });

    // Average recency score weighted by game importance (recent games more important)
    const weights = gameRecencyScores.map((_, index) => Math.exp(-index * 0.1));
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);

    return gameRecencyScores.reduce(
      (sum, score, index) => sum + (score * weights[index]) / totalWeight,
      0
    );
  }

  /**
   * Calculate expected goalie quality with recent performance
   */
  private calculateExpectedGoalieQuality(
    situationalRating: TeamSituationalRating | null,
    trendMetrics: any,
    baselineSavePct: number
  ): number {
    if (!situationalRating) {
      return baselineSavePct;
    }

    // Base expected quality from starter/backup probability
    const baseExpectedQuality =
      situationalRating.starting_goalie_save_pct *
        situationalRating.expected_starter_probability +
      situationalRating.backup_goalie_save_pct *
        (1 - situationalRating.expected_starter_probability);

    // Adjust based on recent trends
    const trendAdjustment = trendMetrics.last_5_trend * 0.01; // Small adjustment based on trend

    return Math.max(
      0.85,
      Math.min(0.98, baseExpectedQuality + trendAdjustment)
    );
  }

  /**
   * Calculate confidence score for trend-weighted analysis
   */
  private calculateTrendConfidenceScore(
    baseDataQuality: number,
    dataRecencyScore: number,
    gamesInWindow: number
  ): number {
    // Base confidence from data quality
    let confidence = baseDataQuality * 0.5;

    // Boost from data recency
    confidence += dataRecencyScore * 0.3;

    // Boost from sufficient games in trend window
    if (gamesInWindow >= 10) confidence += 0.2;
    else if (gamesInWindow >= 5) confidence += 0.1;

    return Math.min(1.0, confidence);
  }

  /**
   * Get all team defensive ratings with batch processing for league-wide analysis
   */
  async getAllTeamDefensiveRatings(
    season: string = "20242025"
  ): Promise<TeamDefensiveRating[]> {
    // Get list of all teams from current season data
    const { data: teams } = await supabase
      .from("wgo_goalie_stats_totals")
      .select("current_team_abbreviation")
      .eq("season_id", parseInt(season))
      .not("current_team_abbreviation", "is", null);

    if (!teams) return [];

    const uniqueTeams = [
      ...new Set(teams.map((t) => t.current_team_abbreviation))
    ];
    const ratings: TeamDefensiveRating[] = [];

    // Calculate ratings for each team with progress tracking
    console.log(
      `Calculating defensive ratings for ${uniqueTeams.length} teams...`
    );

    for (const [index, team] of uniqueTeams.entries()) {
      try {
        const rating = await this.getTeamDefensiveRating(team, season);
        if (rating) {
          ratings.push(rating);
          console.log(
            `✓ ${team}: ${rating.overall_defensive_rating.toFixed(3)} (${index + 1}/${uniqueTeams.length})`
          );
        }
      } catch (error) {
        console.error(`Error calculating rating for ${team}:`, error);
      }
    }

    // Sort by overall defensive rating (best to worst)
    ratings.sort(
      (a, b) => b.overall_defensive_rating - a.overall_defensive_rating
    );

    console.log(`Completed defensive ratings for ${ratings.length} teams`);
    return ratings;
  }
}

// Export singleton instance
export const teamRatingSystem = new TeamRatingSystem();
