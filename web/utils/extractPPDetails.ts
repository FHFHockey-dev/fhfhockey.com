// C:\Users\timbr\Desktop\FHFH\fhfhockey.com-3\web\utils\extractPPDetails.ts

import { Block } from "./getPowerPlayBlocks";

export type PowerPlay = {
  teamOnPowerPlay: number; // Team ID on power play
  powerPlayDuration: number; // Duration in seconds
  powerPlayGoal: "Y" | "N"; // Yes if ended by a goal, No if ended by duration
  powerPlayPeriod: number; // Period number
  powerPlayStartTime: string; // "MM:SS"
  powerPlayEndTime: string; // "MM:SS"
  situationCode: string; // sit_code from the play
  homeSide: "left" | "right";
  isPPTeamHome: "Y" | "N";
};

/**
 * Computes the play time in seconds since the start of the game.
 * @param play Play object from play-by-play data.
 * @returns Time in seconds.
 */
function computePlayTimeInSeconds(play: any): number {
  return (
    (play.periodDescriptor.number - 1) * 20 * 60 + parseTime(play.timeInPeriod)
  );
}

/**
 * Parses a "MM:SS" time string into total seconds.
 * @param timeString "MM:SS"
 * @returns Total seconds.
 */
function parseTime(timeString: string): number {
  const [minutes, seconds] = timeString.split(":").map(Number);
  return minutes * 60 + seconds;
}

/**
 * Formats seconds into "MM:SS" string.
 * @param seconds Total seconds.
 * @returns "MM:SS"
 */
function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${remainingSeconds
    .toString()
    .padStart(2, "0")}`;
}

/**
 * Extracts detailed power play information from power play blocks.
 * @param blocks Array of power play blocks identified by getPowerPlayBlocks.
 * @param plays Play-by-play data of the game.
 * @param gameData Additional game data for context.
 * @returns Array of detailed power play objects.
 */
export function extractPowerPlayDetails(
  blocks: Block[],
  plays: any[],
  gameData: any
): PowerPlay[] {
  const powerPlays: PowerPlay[] = [];

  blocks.forEach((block) => {
    const { teamId, start, end } = block;

    // Calculate start time in seconds
    const startSeconds =
      (start.period - 1) * 20 * 60 + parseTime(start.timeInPeriod);

    // Extract situationCode and penalty details from plays at the start of the power play
    const startPlay = plays.find(
      (play) =>
        computePlayTimeInSeconds(play) === startSeconds &&
        play.typeDescKey === "penalty"
    );
    const situationCode = startPlay ? startPlay.situationCode : "0000"; // Default or handle accordingly
    const penaltyDurationMinutes = startPlay ? startPlay.details.duration : 0; // Penalty duration in minutes
    const penaltyTypeCode = startPlay
      ? playTypeKeyToCode(startPlay.details.typeCode)
      : ""; // Penalty type code ("MIN", "MAJ", etc.)

    const penaltyDurationSeconds = penaltyDurationMinutes * 60;
    const scheduledEndSeconds = startSeconds + penaltyDurationSeconds;

    let powerPlayEndSeconds = scheduledEndSeconds;
    let powerPlayEndedByGoal = false;

    // Determine homeSide and isPPTeamHome
    const isHomeTeam = gameData.home_team_id === teamId ? "Y" : "N";
    const homeSide = gameData.home_side; // Assumes 'home_side' is provided in gameData

    // Process plays within the power play interval
    const playsInInterval = plays.filter((play) => {
      const playTime = computePlayTimeInSeconds(play);
      return playTime > startSeconds && playTime <= scheduledEndSeconds;
    });

    playsInInterval.sort(
      (a, b) => computePlayTimeInSeconds(a) - computePlayTimeInSeconds(b)
    );

    let goalsScored = 0;

    if (penaltyTypeCode === "MIN") {
      const goalsNeededToEnd =
        penaltyDurationMinutes === 2 ? 1 : penaltyDurationMinutes === 4 ? 2 : 0; // Adjust as per rules

      for (const play of playsInInterval) {
        const playTime = computePlayTimeInSeconds(play);

        if (
          play.typeDescKey === "goal" &&
          play.details.eventOwnerTeamId === teamId
        ) {
          goalsScored++;
          if (goalsScored >= goalsNeededToEnd) {
            // Power play ends with this goal
            powerPlayEndSeconds = playTime;
            powerPlayEndedByGoal = true;
            break;
          }
        }
      }
    } else if (penaltyTypeCode === "MAJ") {
      // For major penalties, power play continues until the scheduled end time
      // Only ends at game-end or period-end
      // No action needed
    } else {
      // Handle other penalty types if needed
    }

    // Calculate duration
    const duration = powerPlayEndSeconds - startSeconds;

    // Compute end period and time
    const powerPlayEndPeriod = Math.floor(powerPlayEndSeconds / (20 * 60)) + 1;
    const powerPlayEndTimeInPeriodSeconds = powerPlayEndSeconds % (20 * 60);
    const powerPlayEndTime = formatTime(powerPlayEndTimeInPeriodSeconds);

    // Create power play object
    const powerPlay: PowerPlay = {
      teamOnPowerPlay: teamId,
      powerPlayDuration: duration,
      powerPlayGoal: powerPlayEndedByGoal ? "Y" : "N",
      powerPlayPeriod: start.period,
      powerPlayStartTime: start.timeInPeriod,
      powerPlayEndTime: powerPlayEndTime,
      situationCode: situationCode,
      homeSide: homeSide,
      isPPTeamHome: isHomeTeam,
    };

    powerPlays.push(powerPlay);

    // Handle power plays that span multiple periods
    if (start.period !== powerPlayEndPeriod) {
      // Split the power play into separate objects per period
      // First period
      const firstPeriodEndSeconds = start.period * 20 * 60;
      const firstPeriodDuration = firstPeriodEndSeconds - startSeconds;

      const firstPeriodPowerPlay: PowerPlay = {
        teamOnPowerPlay: teamId,
        powerPlayDuration: firstPeriodDuration,
        powerPlayGoal: powerPlayEndedByGoal ? "Y" : "N",
        powerPlayPeriod: start.period,
        powerPlayStartTime: start.timeInPeriod,
        powerPlayEndTime: "20:00",
        situationCode: situationCode,
        homeSide: homeSide,
        isPPTeamHome: isHomeTeam,
      };
      powerPlays.push(firstPeriodPowerPlay);

      // Second period
      const remainingDuration = powerPlayEndSeconds - firstPeriodEndSeconds;
      const secondPeriodStartTime = "00:00";

      const secondPeriodPowerPlay: PowerPlay = {
        teamOnPowerPlay: teamId,
        powerPlayDuration: remainingDuration,
        powerPlayGoal: powerPlayEndedByGoal ? "Y" : "N",
        powerPlayPeriod: powerPlayEndPeriod,
        powerPlayStartTime: secondPeriodStartTime,
        powerPlayEndTime: powerPlayEndTime,
        situationCode: situationCode,
        homeSide: homeSide,
        isPPTeamHome: isHomeTeam,
      };
      powerPlays.push(secondPeriodPowerPlay);
    }
  });

  return powerPlays;
}

/**
 * Converts play type key to standardized code.
 * @param typeDescKey The type description key from play data.
 * @returns Standardized play type code ("MIN", "MAJ", etc.).
 */
function playTypeKeyToCode(typeDescKey: string): string {
  switch (typeDescKey) {
    case "minor":
      return "MIN";
    case "major":
      return "MAJ";
    // Add other cases as needed
    default:
      return "";
  }
}
