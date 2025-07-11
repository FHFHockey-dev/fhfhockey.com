// pages/api/v1/ml/team-ratings.ts
// API endpoint for team rating calculations with caching and batch processing

import { NextApiRequest, NextApiResponse } from "next";
import {
  teamRatingSystem,
  TeamDefensiveRating,
  OpponentStrengthScore
} from "../../../../utils/ml/team-rating-system";

interface TeamRatingRequest {
  team?: string;
  teams?: string[];
  season?: string;
  prediction_date?: string;
  is_home_game?: boolean;
  rest_days?: number;
  include_trend_analysis?: boolean;
  include_situational?: boolean;
  cache_duration?: number;
}

interface TeamRatingResponse {
  success: boolean;
  data?: {
    team_ratings?: TeamDefensiveRating[];
    opponent_strengths?: OpponentStrengthScore[];
    metadata: {
      total_teams: number;
      calculation_time_ms: number;
      cache_status: "hit" | "miss" | "partial";
      season: string;
      timestamp: string;
    };
  };
  error?: string;
  validation_errors?: string[];
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<TeamRatingResponse>
) {
  const startTime = Date.now();

  try {
    // Only allow GET requests
    if (req.method !== "GET") {
      return res.status(405).json({
        success: false,
        error: "Method not allowed. Use GET."
      });
    }

    // Parse and validate request parameters
    const {
      team,
      teams,
      season = "20242025",
      prediction_date = new Date().toISOString().split("T")[0],
      is_home_game = false,
      rest_days = 1,
      include_trend_analysis = false,
      include_situational = false,
      cache_duration = 3600 // 1 hour default
    } = req.query as any; // Use any to handle string/boolean conversion

    // Convert string parameters to appropriate types
    const isHomeGame = is_home_game === "true" || is_home_game === true;
    const includeTrendAnalysis =
      include_trend_analysis === "true" || include_trend_analysis === true;
    const includeSituational =
      include_situational === "true" || include_situational === true;
    const restDaysNum = parseInt(rest_days?.toString() || "1");

    // Validate input parameters
    const validationErrors = validateRequest({
      team,
      teams,
      season,
      prediction_date,
      is_home_game: isHomeGame,
      rest_days: restDaysNum,
      include_trend_analysis: includeTrendAnalysis,
      include_situational: includeSituational,
      cache_duration
    });

    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        validation_errors: validationErrors
      });
    }

    // Set cache headers
    res.setHeader(
      "Cache-Control",
      `public, max-age=${cache_duration}, s-maxage=${cache_duration}`
    );
    res.setHeader("X-API-Version", "1.0");
    res.setHeader("X-Calculation-Start", startTime.toString());

    let teamRatings: TeamDefensiveRating[] = [];
    let opponentStrengths: OpponentStrengthScore[] = [];
    let cacheStatus: "hit" | "miss" | "partial" = "miss";

    // Handle different request types
    if (team) {
      // Single team request
      const result = await handleSingleTeamRequest({
        team,
        season,
        prediction_date,
        is_home_game: isHomeGame,
        rest_days: restDaysNum,
        include_trend_analysis: includeTrendAnalysis,
        include_situational: includeSituational
      });

      teamRatings = result.teamRatings;
      opponentStrengths = result.opponentStrengths;
      cacheStatus = result.cacheStatus;
    } else if (teams && Array.isArray(teams)) {
      // Multiple teams request
      const result = await handleMultipleTeamsRequest({
        teams,
        season,
        prediction_date,
        include_trend_analysis: includeTrendAnalysis,
        include_situational: includeSituational
      });

      teamRatings = result.teamRatings;
      opponentStrengths = result.opponentStrengths;
      cacheStatus = result.cacheStatus;
    } else {
      // All teams request (batch processing)
      const result = await handleAllTeamsRequest({
        season,
        include_trend_analysis: includeTrendAnalysis,
        include_situational: includeSituational
      });

      teamRatings = result.teamRatings;
      cacheStatus = result.cacheStatus;
    }

    const calculationTime = Date.now() - startTime;

    // Set additional response headers
    res.setHeader("X-Cache-Status", cacheStatus);
    res.setHeader("X-Calculation-Time", calculationTime.toString());
    res.setHeader("X-Total-Teams", teamRatings.length.toString());

    return res.status(200).json({
      success: true,
      data: {
        team_ratings: teamRatings,
        opponent_strengths:
          opponentStrengths.length > 0 ? opponentStrengths : undefined,
        metadata: {
          total_teams: teamRatings.length,
          calculation_time_ms: calculationTime,
          cache_status: cacheStatus,
          season,
          timestamp: new Date().toISOString()
        }
      }
    });
  } catch (error) {
    const calculationTime = Date.now() - startTime;

    console.error("Team ratings API error:", error);

    // Extract season from query parameters for error response
    const seasonParam = (req.query.season as string) || "20242025";

    res.setHeader("X-Calculation-Time", calculationTime.toString());
    res.setHeader(
      "X-Error-Type",
      error instanceof Error ? error.constructor.name : "Unknown"
    );

    return res.status(500).json({
      success: false,
      error: "Internal server error while calculating team ratings",
      data: {
        team_ratings: [],
        opponent_strengths: [],
        metadata: {
          total_teams: 0,
          calculation_time_ms: calculationTime,
          cache_status: "miss" as const,
          season: seasonParam,
          timestamp: new Date().toISOString()
        }
      }
    });
  }
}

/**
 * Validate request parameters
 */
function validateRequest(params: TeamRatingRequest): string[] {
  const errors: string[] = [];

  // Validate season format
  if (params.season && !/^\d{8}$/.test(params.season)) {
    errors.push("Season must be in format YYYYYYYY (e.g., 20242025)");
  }

  // Validate prediction date format
  if (
    params.prediction_date &&
    !/^\d{4}-\d{2}-\d{2}$/.test(params.prediction_date)
  ) {
    errors.push("Prediction date must be in format YYYY-MM-DD");
  }

  // Validate rest days
  if (params.rest_days !== undefined) {
    const restDays = parseInt(params.rest_days.toString());
    if (isNaN(restDays) || restDays < 0 || restDays > 10) {
      errors.push("Rest days must be a number between 0 and 10");
    }
  }

  // Validate cache duration
  if (params.cache_duration !== undefined) {
    const cacheDuration = parseInt(params.cache_duration.toString());
    if (isNaN(cacheDuration) || cacheDuration < 0 || cacheDuration > 86400) {
      errors.push(
        "Cache duration must be a number between 0 and 86400 seconds"
      );
    }
  }

  // Validate team abbreviations
  if (params.team && !/^[A-Z]{2,3}$/.test(params.team)) {
    errors.push("Team abbreviation must be 2-3 uppercase letters");
  }

  if (params.teams && Array.isArray(params.teams)) {
    params.teams.forEach((team, index) => {
      if (!/^[A-Z]{2,3}$/.test(team)) {
        errors.push(`Team at index ${index} must be 2-3 uppercase letters`);
      }
    });

    if (params.teams.length > 32) {
      errors.push("Maximum 32 teams allowed per request");
    }
  }

  return errors;
}

/**
 * Handle single team request
 */
async function handleSingleTeamRequest(params: {
  team: string;
  season: string;
  prediction_date: string;
  is_home_game: boolean;
  rest_days: number;
  include_trend_analysis: boolean;
  include_situational: boolean;
}): Promise<{
  teamRatings: TeamDefensiveRating[];
  opponentStrengths: OpponentStrengthScore[];
  cacheStatus: "hit" | "miss" | "partial";
}> {
  const {
    team,
    season,
    prediction_date,
    is_home_game,
    rest_days,
    include_trend_analysis,
    include_situational
  } = params;

  // Get team defensive rating
  const teamRating = await teamRatingSystem.getTeamDefensiveRating(
    team,
    season
  );
  if (!teamRating) {
    return {
      teamRatings: [],
      opponentStrengths: [],
      cacheStatus: "miss"
    };
  }

  const teamRatings = [teamRating];
  const opponentStrengths: OpponentStrengthScore[] = [];

  // Calculate opponent strength if requested
  if (include_trend_analysis) {
    const opponentStrength =
      await teamRatingSystem.calculateTrendWeightedOpponentStrength(
        team,
        prediction_date,
        is_home_game,
        rest_days,
        season
      );

    if (opponentStrength) {
      opponentStrengths.push(opponentStrength);
    }
  } else if (include_situational) {
    const opponentStrength =
      await teamRatingSystem.calculateEnhancedOpponentStrength(
        team,
        prediction_date,
        is_home_game,
        rest_days,
        season
      );

    if (opponentStrength) {
      opponentStrengths.push(opponentStrength);
    }
  }

  return {
    teamRatings,
    opponentStrengths,
    cacheStatus: "hit" // Single requests can leverage cache effectively
  };
}

/**
 * Handle multiple teams request
 */
async function handleMultipleTeamsRequest(params: {
  teams: string[];
  season: string;
  prediction_date: string;
  include_trend_analysis: boolean;
  include_situational: boolean;
}): Promise<{
  teamRatings: TeamDefensiveRating[];
  opponentStrengths: OpponentStrengthScore[];
  cacheStatus: "hit" | "miss" | "partial";
}> {
  const {
    teams,
    season,
    prediction_date,
    include_trend_analysis,
    include_situational
  } = params;

  const teamRatings: TeamDefensiveRating[] = [];
  const opponentStrengths: OpponentStrengthScore[] = [];
  let cacheHits = 0;

  // Process teams in parallel batches of 5 to avoid overwhelming the database
  const batchSize = 5;
  for (let i = 0; i < teams.length; i += batchSize) {
    const batch = teams.slice(i, i + batchSize);

    const batchPromises = batch.map(async (team) => {
      try {
        const teamRating = await teamRatingSystem.getTeamDefensiveRating(
          team,
          season
        );
        if (teamRating) {
          teamRatings.push(teamRating);
          cacheHits++;

          // Calculate opponent strength if requested
          if (include_trend_analysis) {
            const opponentStrength =
              await teamRatingSystem.calculateTrendWeightedOpponentStrength(
                team,
                prediction_date,
                false, // Default to away game for batch requests
                1, // Default to 1 day rest
                season
              );

            if (opponentStrength) {
              opponentStrengths.push(opponentStrength);
            }
          } else if (include_situational) {
            const opponentStrength =
              await teamRatingSystem.calculateEnhancedOpponentStrength(
                team,
                prediction_date,
                false,
                1,
                season
              );

            if (opponentStrength) {
              opponentStrengths.push(opponentStrength);
            }
          }
        }
      } catch (error) {
        console.error(`Error processing team ${team}:`, error);
      }
    });

    await Promise.all(batchPromises);

    // Small delay between batches to be kind to the database
    if (i + batchSize < teams.length) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  // Determine cache status
  let cacheStatus: "hit" | "miss" | "partial" = "miss";
  if (cacheHits === teams.length) {
    cacheStatus = "hit";
  } else if (cacheHits > 0) {
    cacheStatus = "partial";
  }

  return {
    teamRatings,
    opponentStrengths,
    cacheStatus
  };
}

/**
 * Handle all teams request (batch processing)
 */
async function handleAllTeamsRequest(params: {
  season: string;
  include_trend_analysis: boolean;
  include_situational: boolean;
}): Promise<{
  teamRatings: TeamDefensiveRating[];
  cacheStatus: "hit" | "miss" | "partial";
}> {
  const { season } = params;

  try {
    // Use the optimized batch processing method
    const teamRatings =
      await teamRatingSystem.getAllTeamDefensiveRatings(season);

    return {
      teamRatings,
      cacheStatus: teamRatings.length > 0 ? "hit" : "miss"
    };
  } catch (error) {
    console.error("Error in batch team ratings processing:", error);
    return {
      teamRatings: [],
      cacheStatus: "miss"
    };
  }
}
