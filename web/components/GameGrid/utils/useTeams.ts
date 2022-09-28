import { useEffect, useState } from "react";
import { DAYS, TeamRowData } from "../TeamRow";
import { adjustBackToBackGames } from "../utils/calcWinOdds";
import { getAllTeams, getTeams, Team } from "../utils/NHL-API";

export default function useTeams(
  start: string,
  end: string
): [TeamRowData[], number[], boolean] {
  const [loading, setLoading] = useState(false);
  const [teams, setTeams] = useState<TeamRowData[]>([]);
  const [totalGamesPerDay, setTotalGamesPerDay] = useState<number[]>([]);
  const [allTeams, setAllTeams] = useState<Team[]>([]);

  useEffect(() => {
    let ignore = false;

    (async () => {
      const teams = await getAllTeams();
      if (!ignore) {
        setAllTeams(teams);
      }
    })();

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    (async () => {
      const [teams, totalGamesPerDay] = await getTeams(start, end);
      if (!ignore) {
        const paddedTeams = [...teams];
        // add other teams even they are not playing
        allTeams.forEach((team) => {
          const exist =
            teams.findIndex((matchUp) => matchUp.teamName === team.name) !== -1;
          if (!exist) {
            paddedTeams.push({
              teamName: team.name,
              totalGamesPlayed: 0,
              totalOffNights: 0,
              weekScore: -100, // unknown at this stage
            });
          }
        });

        // add off nights to each day for shading light color for padded teams
        const offNights = getOffNights(totalGamesPerDay);
        paddedTeams.forEach((row) => {
          offNights.forEach((day) => {
            // @ts-ignore
            row[day] = { ...row[day], offNight: true };
          });
        });

        // adjust GameScores based on back-to-back plays
        adjustBackToBackGames(paddedTeams);

        setTeams(paddedTeams);
        setTotalGamesPerDay(totalGamesPerDay);
        setLoading(false);
      }
    })();

    return () => {
      ignore = true;
      setLoading(false);
    };
  }, [start, end, allTeams]);

  return [teams, totalGamesPerDay, loading];
}

function getOffNights(totalGamesPerDay: number[]) {
  const days: string[] = [];
  totalGamesPerDay.forEach((numGames, i) => {
    // when a day has <= 8 games, mark that day as off night
    if (numGames <= 8) {
      days.push(DAYS[i]);
    }
  });
  return days;
}
