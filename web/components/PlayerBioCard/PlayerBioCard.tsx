/* eslint-disable @next/next/no-img-element */

import usePlayer from "hooks/usePlayer";
import styles from "./PlayerBioCard.module.scss";
import { Player } from "pages/api/v1/player/[id]";

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
  { label: "Height", key: "height" },
  { label: "Weight", key: "weight" },
  // { label: "Shoots", key: "shoots" },
] as const;

const PLACEHOLDER: Player = {
  image: "",
  teamName: "",
  teamAbbreviation: "",
  teamLogo: "",
  weight: 0,
  age: 0,
  height: 0,
  positionCode: "Center",
  id: 0,
  fullName: "",
  firstName: "Timothy",
  lastName: "Branson",
  sweaterNumber: 0,
  teamId: 0,
};

function PlayerStatsCard({
  playerId,
  onPlayerImageClick,
}: PlayerStatsCardProps) {
  let player = usePlayer(playerId);
  if (player === null) {
    player = PLACEHOLDER;
  }
  const {
    fullName,
    firstName,
    lastName,
    image,
    teamName,
    teamAbbreviation,
    positionCode,
    teamLogo,
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
            src={teamLogo || "/pictures/circle.png"}
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

          <div className={styles.position}>{positionCode}</div>
        </div>
      </div>

      <div
        className={styles.playerImageWrapper}
        onClick={() => onPlayerImageClick && onPlayerImageClick(fullName)}
      >
        <img
          style={{ objectFit: "cover" }}
          src={image || "/pictures/player-placeholder.jpg"}
          alt={fullName}
          width="100%"
          height="100%"
        />
      </div>
    </section>
  );
}

export default PlayerStatsCard;
