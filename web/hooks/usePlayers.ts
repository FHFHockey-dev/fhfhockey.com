import { fetchNHL } from "lib/NHL/NHL_API";
import { useEffect, useState } from "react";
import useCurrentSeason from "./useCurrentSeason";

export type Player = {
  person: {
    id: number;
    fullName: string;
    primaryNumber: string;
  };
};

export default function usePlayers() {
  const season = useCurrentSeason();
  const [players, setPlayers] = useState<Player["person"][]>([]);

  useEffect(() => {
    let mounted = true;

    if (season) {
      getAllPlayers(season.seasonId).then((players: any) => {
        if (mounted) {
          setPlayers(players);
        }
      });
    }

    return () => {
      mounted = false;
    };
  }, [season]);

  return players;
}

// https://statsapi.web.nhl.com/api/v1/teams
// ?expand=team.roster Shows roster of active players for the specified team
// ?expand=team.roster&season=20142015 Adding the season identifier shows the roster for that season
// ?teamId=4,5,29 Can string team id together to get multiple teams
// 20202021
export async function getAllPlayers(season: string) {
  // https://statsapi.web.nhl.com/api/v1/teams?expand=team.roster&season=20202021
  const GET_ROSTERS_ROUTE = `/teams?expand=team.roster&season=${season}`;
  const teams: any[] = await fetchNHL(GET_ROSTERS_ROUTE).then(
    (data) => data.teams
  );

  const rosters = teams.map((team) => team.roster.roster);

  // retrieve player ids
  const players = {};

  rosters.flat().forEach((player) => {
    // @ts-ignore
    players[player.person.id] = {
      id: player.person.id,
      fullName: player.person.fullName,
      primaryNumber: player.jerseyNumber,
    };
  });
  return Object.values(players);
}
