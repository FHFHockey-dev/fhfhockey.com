import { useEffect, useState } from "react";
import { differenceInYears } from "date-fns";
import { fetchNHL } from "lib/NHL/NHL_API";

export type Player = {
  /**
   * Player name
   */
  name: string;
  /**
   * The image of the player
   */
  image: string;
  age: number;
  position: string;
  height: string;
  weight: number;
  shoots: string;
  teamName: string;
  /**
   * Team abbreviation
   */
  teamAbbreviation: string;
  /**
   * The url of the team logo
   */
  teamLogo: string;
  [key: string]: string | number;
};
const PROXY_SERVER_URL = process.env.NEXT_PUBLIC_PROXY_SERVER_URL;

const getPlayerImage = (playerId: number) =>
  `${PROXY_SERVER_URL}http://nhl.bamcontent.com/images/headshots/current/168x168/${playerId}.jpg`;

const getTeamLogo = (teamName: string) => `/teamLogos/${teamName}.png`;

export default function usePlayer(playerId: number | undefined) {
  const [player, setPlayer] = useState<Player | null>(null);

  useEffect(() => {
    let mounted = true;
    if (playerId) {
      (async () => {
        try {
          const people = await fetchNHL(`/people/${playerId}`).then(
            ({ people }) => people[0]
          );
          console.log(people);

          const team = people.active
            ? await fetchNHL(`/teams/${people.currentTeam.id}`).then(
                ({ teams }) => {
                  const { abbreviation } = teams[0];
                  return {
                    teamName: people.currentTeam.name,
                    teamAbbreviation: abbreviation,
                    teamLogo: getTeamLogo(people.currentTeam.name),
                  };
                }
              )
            : { teamName: "", teamAbbreviation: "", teamLogo: "" };

          const p: Player = {
            name: people.fullName,
            age: differenceInYears(new Date(), new Date(people.birthDate)),
            position: people.primaryPosition.abbreviation,
            height: people.height,
            weight: people.weight,
            shoots: people.shootsCatches,
            image: getPlayerImage(playerId),
            ...team,
          };

          if (mounted) {
            setPlayer(p);
          }
        } catch (e) {
          console.log(e);

          if (mounted) {
            setPlayer(null);
          }
        }
      })();
    }

    return () => {
      mounted = false;
    };
  }, [playerId]);

  return player;
}
