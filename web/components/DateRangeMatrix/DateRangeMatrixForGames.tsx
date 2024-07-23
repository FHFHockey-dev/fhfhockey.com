// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-3\web\components\DateRangeMatrix\DateRangeMatrixForGames.tsx

import { useEffect, useState } from "react";
import {
  DateRangeMatrixInternal,
  PlayerData,
  TOIData,
  generateKey,
  getRostersMap,
  processShifts,
  Team,
} from "components/DateRangeMatrix/index";
import groupBy from "utils/groupBy";
import Fetch from "lib/cors-fetch";

type DateRangeMatrixForGamesProps = {
  gameIds: number[];
  teamId: number;
};

export default function DateRangeMatrixForGames({
  gameIds,
  teamId,
}: DateRangeMatrixForGamesProps) {
  const [toi, setToi] = useState<TOIData[]>([]);
  const [roster, setRoster] = useState<PlayerData[]>([]);
  const [team, setTeam] = useState<Team | undefined>();

  useEffect(() => {
    (async () => {
      const data = await getTOIDataForGames(gameIds, teamId);
      setToi(data.toiData);
      setRoster(data.roster);
      setTeam(data.team);
    })();
  }, [gameIds, teamId]);

  return team !== undefined ? (
    <DateRangeMatrixInternal
      teamId={team.id}
      mode="line-combination"
      teamName={team.name}
      toiData={toi}
      roster={roster}
      homeAwayInfo={[]}
      playerTOI={toi.reduce<
        Record<number, { totalTOI: number; gamesPlayed: Set<number> }>
      >((acc, item) => {
        [item.p1.id, item.p2.id].forEach((playerId) => {
          if (!acc[playerId]) {
            acc[playerId] = { totalTOI: 0, gamesPlayed: new Set<number>() };
          }
          acc[playerId].totalTOI += item.toi;
          acc[playerId].gamesPlayed.add(gameIds[0]);
        });
        return acc;
      }, {})}
    />
  ) : null;
}

async function getTOIDataForGames(gameIds: number[], teamId: number) {
  const allTOIData: Record<number, TOIData[]> = {};
  const allRosters: Record<number, PlayerData[]> = {};
  const allTeams: Set<Team> = new Set();
  const allHomeAwayInfo: { gameId: number; homeOrAway: string }[] = [];

  const gameDataPromises = gameIds.map(async (id) => {
    try {
      const [{ data: shiftsData }, { rostersMap, teams }, boxscore] =
        await Promise.all([
          Fetch(
            `https://api.nhle.com/stats/rest/en/shiftcharts?cayenneExp=gameId=${id}`
          ).then((res) => res.json()),
          getRostersMap(id, teamId),
          Fetch(`https://api-web.nhle.com/v1/gamecenter/${id}/boxscore`).then(
            (res) => res.json()
          ),
        ]);

      let rosters = groupBy(
        Object.values(rostersMap),
        (player: PlayerData) => player.teamId
      );
      if (teamId) {
        rosters = { [teamId]: rosters[teamId] };
      }

      const data: Record<number, TOIData[]> = {};
      const pairwiseTOIForTwoTeams = processShifts(shiftsData, rosters);
      const teamIds = teamId
        ? [teamId]
        : Object.keys(pairwiseTOIForTwoTeams).map(Number);

      teamIds.forEach((teamId) => {
        if (data[teamId] === undefined) data[teamId] = [];
        pairwiseTOIForTwoTeams[teamId].forEach((item) => {
          if (!rostersMap[item.p1] || !rostersMap[item.p2]) return;
          data[teamId].push({
            toi: item.toi,
            p1: rostersMap[item.p1],
            p2: rostersMap[item.p2],
          });
        });
      });

      Object.entries(data).forEach(([teamId, toiData]) => {
        if (!allTOIData[Number(teamId)]) {
          allTOIData[Number(teamId)] = [];
        }
        allTOIData[Number(teamId)] = allTOIData[Number(teamId)].concat(toiData);
      });

      Object.entries(rosters).forEach(([teamId, players]) => {
        if (!allRosters[Number(teamId)]) {
          allRosters[Number(teamId)] = [];
        }
        allRosters[Number(teamId)] = players;
      });

      teams.forEach((team) => allTeams.add(team));

      const isHome = boxscore.homeTeam.id === teamId;
      allHomeAwayInfo.push({
        gameId: id,
        homeOrAway: isHome ? "home" : "away",
      });
    } catch (error) {
      console.error("Error fetching TOI data for game ID", id, ":", error);
    }
  });

  await Promise.all(gameDataPromises);

  const avgToi = new Map<string, TOIData>();
  Object.values(allTOIData).forEach((array) => {
    array.forEach((item) => {
      const key = generateKey(item.p1.id, item.p2.id);
      if (!avgToi.has(key)) {
        avgToi.set(key, {
          toi: 0,
          p1: item.p1,
          p2: item.p2,
        });
      }
      avgToi.get(key)!.toi += item.toi;
    });
  });

  avgToi.forEach((item, key) => {
    item.toi /= gameIds.length;
  });

  return {
    toiData: [...avgToi.values()],
    roster: allRosters[teamId] ?? [],
    team: [...allTeams].find((team) => team.id === teamId),
    homeAwayInfo: allHomeAwayInfo,
  };
}
