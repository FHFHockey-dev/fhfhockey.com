// useGoals.tsx
// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-1\web\hooks\useGoals.tsx

import { useEffect, useState } from "react";
import { teamsInfo } from "lib/NHL/teamsInfo";
import Fetch from "lib/cors-fetch";
import styles from "/styles/useGoals.module.scss";

export default function useGoals(id: number) {
  const [goals, setGoals] = useState<Goal[]>([]);

  useEffect(() => {
    (async () => {
      if (!id) return;
      const data = await Fetch(
        `https://api-web.nhle.com/v1/gamecenter/${id}/landing`
      ).then((res) => res.json());
      const scoring = data.summary.scoring;
      const homeTeamAbbrev = data.homeTeam.abbrev;
      const awayTeamAbbrev = data.awayTeam.abbrev;

      const result: Goal[] = [];
      scoring.forEach((periodInfo: any) => {
        periodInfo.goals.forEach((goal: any) => {
          result.push({
            period: {
              number: periodInfo.periodDescriptor.number,
              type: periodInfo.periodDescriptor.periodType,
            },
            scoreTeamAbbreviation: goal.teamAbbrev.default,
            homeTeam: {
              score: goal.homeScore,
              abbreviation: homeTeamAbbrev,
            },
            awayTeam: {
              score: goal.awayScore,
              abbreviation: awayTeamAbbrev,
            },
            scorer: {
              id: goal.playerId,
              firstName: goal.firstName.default,
              lastName: goal.lastName.default,
            },
            assists: goal.assists.map((assist: any) => ({
              id: assist.playerId,
              firstName: assist.firstName.default,
              lastName: assist.lastName.default,
            })),
            timeInPeriod: convertTimeToSeconds(goal.timeInPeriod),
          });
        });
      });
      setGoals(result);
    })();
  }, [id]);

  return goals;
}

type Player = {
  id: number;
  firstName: string;
  lastName: string;
};

type Goal = {
  period: {
    number: 1 | 2 | 3 | 4;
    type: "REG" | "OT";
  };
  scoreTeamAbbreviation: string;
  homeTeam: {
    // current score
    score: number;
    abbreviation: string;
  };
  awayTeam: {
    // current score
    score: number;
    abbreviation: string;
  };
  scorer: Player;
  timeInPeriod: number;
  assists: Player[];
};

// todos:
// - Colored with the team colors - done
// - position (leftPercent)
// - hover event
// - click event
// - vertical line
// - style
// - logic for positioning of overtime games: chart stays same width but goes to 4:4:4:1 column width split for P1:P2:P3:OT as it is 20:20:20:5 in minutes
const PERIOD_IN_SECONDS = 20 * 60;
const PERIOD_LENGTH = 0.3;

function brightenColor(hex: string, percent: number): string {
  // Check if hex starts with "#" and remove it for processing
  const normalizedHex = hex.startsWith("#") ? hex.slice(1) : hex;

  // Parse the hex color to get red, green, and blue components.
  const [r, g, b] = normalizedHex.match(/\w\w/g)!.map((x) => parseInt(x, 16));

  // Calculate the adjustment.
  const adjust = (value: number): string =>
    Math.min(255, value + Math.floor(255 * (percent / 100)))
      .toString(16)
      .padStart(2, "0");

  // Adjust and recombine components.
  return `#${adjust(r)}${adjust(g)}${adjust(b)}`;
}

function GoalIndicator({
  scoreTeamAbbreviation,
  period,
  timeInPeriod,
  homeTeam,
  awayTeam,
}: Goal) {
  console.log(period.number * timeInPeriod);
  // 20 minutes per period , each period is 30% of the total length
  // timeInPeriod / 20 minutes * (30% * period.number)

  const leftPercentage = `${
    ((timeInPeriod / PERIOD_IN_SECONDS) * PERIOD_LENGTH +
      PERIOD_LENGTH * (period.number - 1)) *
    100
  }%`;

  const isHomeScoring = scoreTeamAbbreviation === homeTeam.abbreviation;

  const teamColors =
    scoreTeamAbbreviation in teamsInfo
      ? teamsInfo[scoreTeamAbbreviation as keyof typeof teamsInfo]
      : {
          primaryColor: "black", // Fallback color if not found
          secondaryColor: "white", // Fallback color if not found
        };

  const indicatorPositionStyle = {
    left: leftPercentage,
    zIndex: 2, // Ensure it's on top if needed
  };

  const backgroundColor = isHomeScoring
    ? teamColors.primaryColor
    : teamColors.secondaryColor;
  const borderColor = isHomeScoring
    ? teamColors.secondaryColor
    : teamColors.primaryColor;
  const textColor = brightenColor(
    isHomeScoring ? teamColors.secondaryColor : teamColors.primaryColor,
    25
  );

  const teamColorStyle = {
    "--backgroundColor": backgroundColor,
    "--borderColor": borderColor,
    "--textColor": textColor,
  } as React.CSSProperties;

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        ...indicatorPositionStyle,
        transform: "translateY(-100%) translateX(-50%)",
      }}
    >
      {/* Score display */}
      <div className={styles.scoreContainer}>
        <span>
          {homeTeam.abbreviation} {homeTeam.score} - {awayTeam.score}{" "}
          {awayTeam.abbreviation}
        </span>
      </div>

      {/* Goal Indicator with dynamic color and home plate shape */}
      <div
        className={styles.goalIndicator}
        style={teamColorStyle} // Apply dynamic color styles
      >
        {scoreTeamAbbreviation}
      </div>
    </div>
  );
}

const convertTimeToSeconds = (timeString: string) => {
  if (!timeString) {
    return 0;
  }
  const [minutes, seconds] = timeString.split(":").map(Number);
  return minutes * 60 + seconds;
};

export function GoalIndicators({ id }: { id: number }) {
  const goals = useGoals(id);
  return (
    <>
      {goals.map((goal, i) => (
        <GoalIndicator key={i} {...goal} />
      ))}
    </>
  );
}