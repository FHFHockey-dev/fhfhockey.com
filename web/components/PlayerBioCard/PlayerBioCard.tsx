/* eslint-disable @next/next/no-img-element */
// @ts-ignore
import fscreen from "fscreen";

import usePlayer, { Player } from "hooks/usePlayer";
import styles from "./PlayerBioCard.module.scss";

type PlayerStatsCardProps = {
  /**
   * Player Id
   */
  playerId: number | undefined;
};

// The stats to be displayed on the card
const STATS = [
  { label: "Age", key: "age" },
  { label: "Height", key: "height" },
  { label: "Weight", key: "weight" },
  { label: "Shoots", key: "shoots" },
];

const PLACEHOLDER: Player = {
  name: "Select Player",
  image: "",
  teamName: "",
  teamAbbreviation: "",
  teamLogo: "",
  weight: 0,
  age: 0,
  height: "0",
  shoots: "0",
  position: "Center",
};

function fullscreenHandler() {
  if (!fscreen.fullscreenEnabled) return;

  const dashboard = document.getElementById("dashboard");
  if (!dashboard) return;

  // fullscreenElement is null if not in fullscreen mode,
  if (fscreen.fullscreenElement === null) {
    fscreen.requestFullscreen(dashboard);
    // console.log("Entered fullscreen mode");
  } else {
    fscreen.exitFullscreen();
    // console.log("Exited fullscreen mode");
  }
}

function PlayerStatsCard({ playerId }: PlayerStatsCardProps) {
  const player = usePlayer(playerId) ?? PLACEHOLDER;
  const { name, image, teamName, teamAbbreviation, position, teamLogo } =
    player;
  const [firstName, lastName] = name.split(" ");

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
              <span className={styles.value}>{player[stat.key]}</span>
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

      <div className={styles.playerImageWrapper} onClick={fullscreenHandler}>
        <img
          style={{ objectFit: "cover" }}
          src={image || "/pictures/player-placeholder.jpg"}
          alt={name}
          width="100%"
          height="100%"
        />
      </div>
    </section>
  );
}

export default PlayerStatsCard;
