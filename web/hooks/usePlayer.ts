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

const getPlayerImage = (playerId: number) =>
  `http://nhl.bamcontent.com/images/headshots/current/168x168/${playerId}.jpg`;

const getTeamLogo = (abbreviation: string) =>
  `/teamCardPics/${abbreviation}.jpg`;

export default function usePlayer(playerId: number): Player {
  return {
    name: "Claude Giroux",
    age: 34,
    position: "RW",
    height: "5'11''",
    weight: 185,
    shoots: "R",
    image: getPlayerImage(playerId),
    teamName: "ana TEAM",
    teamAbbreviation: "OTT",
    teamLogo: getTeamLogo("ANA"),
  };
}
