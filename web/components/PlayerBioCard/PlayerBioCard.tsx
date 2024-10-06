/* eslint-disable @next/next/no-img-element */

import usePlayer from "hooks/usePlayer";
import styles from "./PlayerBioCard.module.scss";
import type { Player } from "lib/NHL/types";
import { getTeamLogo } from "lib/NHL/server";
import useCurrentSeason from "hooks/useCurrentSeason";

type PlayerStatsCardProps = {
  /**
   * Player Id
   */
  playerId: number | undefined;
  onPlayerImageClick?: (playerName: string) => void;
};

// The stats to be displayed on the card
const STATS = [
  { label: "Age", key: "age" },
  { label: "Height", key: "heightInCentimeters" },
  { label: "Weight", key: "weightInKilograms" },
  // { label: "Shoots", key: "shoots" },
] as const;

const PLACEHOLDER: Player = {
  age: 33,
  teamName: "Five Hole",
  teamAbbreviation: "Five Hole",
  weightInKilograms: 99,
  heightInCentimeters: 186,
  position: "G",
  id: 0,
  fullName: "",
  firstName: "TJ",
  lastName: "Branson",
  birthCity: "PHILLY",
  birthCountry: "USA",
  birthDate: "1990-05-15",
  sweaterNumber: 5,
  teamId: 0,
};

function PlayerStatsCard({
  playerId,
  onPlayerImageClick,
}: PlayerStatsCardProps) {
  const season = useCurrentSeason();
  let player = usePlayer(playerId);
  if (player === null) {
    player = PLACEHOLDER;
  }
  const {
    fullName,
    firstName,
    lastName,
    teamName,
    teamAbbreviation,
    position,
  } = player;

  return (
    <section className={styles.playerCard}>
      <div className={styles.info}>
        <div className={styles.names}>
          <span className={styles.firstName}>{firstName}</span>
          <span className={styles.lastName}>{lastName}</span>
        </div>

        <div className={styles.teamLogo} title={teamName}>
          <img
            alt={teamName}
            src={getTeamLogo(teamAbbreviation)}
            width="100%"
            height="100%"
          />
        </div>

        <ul className={styles.stats}>
          {STATS.map((stat) => (
            <li key={stat.key}>
              <span className={styles.label}>{stat.label}:</span>
              <span className={styles.value}>
                {player === null ? "" : player[stat.key]}
              </span>
            </li>
          ))}
        </ul>

        <div className={styles.teamInfo}>
          <div className={styles.teamAbbreviation}>
            {teamAbbreviation || "FHFH"}
          </div>

          <div className={styles.position}>{position}</div>
        </div>
      </div>

      <div
        className={styles.playerImageWrapper}
        onClick={() => onPlayerImageClick && onPlayerImageClick(fullName)}
      >
        <img
          style={{ objectFit: "cover" }}
          src={
            getPlayerImage(
              playerId!,
              season?.seasonId ?? 0,
              teamAbbreviation
            ) || "/pictures/player-placeholder.jpg"
          }
          alt={fullName}
          width="100%"
          height="100%"
        />
      </div>
    </section>
  );
}

function getPlayerImage(
  playerId: number,
  seasonId: number,
  teamAbbreviation?: string
) {
  if (!teamAbbreviation) return "";
  return `https://assets.nhle.com/mugs/nhl/${seasonId}/${teamAbbreviation}/${playerId}.png`;
}

export default PlayerStatsCard;
