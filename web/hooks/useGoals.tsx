import { useEffect, useState } from "react";
import Fetch from "lib/cors-fetch";

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
// - Colored with the team colors
// - position
// - hover event
// - click event
// - vertical line
// - style
const PERIOD_IN_SECONDS = 20 * 60;
const PERIOD_LENGTH = 0.3;

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
  const left = `${
    ((timeInPeriod / PERIOD_IN_SECONDS) * PERIOD_LENGTH +
      PERIOD_LENGTH * (period.number - 1)) *
    100
  }%`;
  const isHomeScoring = scoreTeamAbbreviation === homeTeam.abbreviation;
  return (
    <div style={{ position: "absolute", left: left, top: 0, zIndex: 2 }}>
      <div
        style={{
          position: "absolute",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          transform: "translateY(-70%) translateX(-50%)",
          width: "max-content",
        }}
      >
        <span style={{ color: "white" }}>
          {isHomeScoring && homeTeam.abbreviation} {homeTeam.score}-
          {awayTeam.score} {awayTeam.abbreviation}
        </span>
        <span
          style={{
            writingMode: "vertical-rl",
            textOrientation: "upright",
            userSelect: "none",
            backgroundColor: "purple",
            border: "2px solid white",
            borderRadius: "8px",
            fontSize: "8px",
          }}
        >
          {scoreTeamAbbreviation}
        </span>
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
  return goals.map((goal, i) => <GoalIndicator key={i} {...goal} />);
}
