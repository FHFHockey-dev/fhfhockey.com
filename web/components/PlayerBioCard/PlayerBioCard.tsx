/* eslint-disable @next/next/no-img-element */
import Image from "next/image";
import { Chart } from "chart.js";
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
  { label: "Position", key: "position" },
  { label: "Height", key: "height" },
  { label: "Weight", key: "weight" },
  { label: "Shoots", key: "shoots" },
];

const PLACEHOLDER: Player = {
  name: "Select a player",
  image: "",
  teamName: "",
  teamAbbreviation: "",
  teamLogo: "",
  weight: 0,
  age: 0,
  height: "0",
  shoots: "0",
  position: "R",
};

function fullscreenHandler() {
  window.Chart = Chart;

  if (!fscreen.fullscreenEnabled) return;

  const dashboard = document.getElementById("dashboard");
  if (!dashboard) return;

  // fullscreenElement is null if not in fullscreen mode,
  if (fscreen.fullscreenElement === null) {
    fscreen.requestFullscreen(dashboard);
    console.log(Chart.instances);

    console.log("Entered fullscreen mode");
  } else {
    fscreen.exitFullscreen();
    console.log("Exited fullscreen mode");
  }
  for (var id in Chart.instances) {
    Chart.instances[id].resize();
  }
}

function PlayerStatsCard({ playerId }: PlayerStatsCardProps) {
  const player = usePlayer(playerId) ?? PLACEHOLDER;
  const { name, image, teamName, teamAbbreviation, teamLogo } = player;

  return (
    <section className={styles.playerCard}>
      <div className={styles.playerImageWrapper} onClick={fullscreenHandler}>
        <img
          style={{ objectFit: "cover" }}
          src={image || "/pictures/player-placeholder.jpg"}
          alt={name}
          width="100%"
          height="100%"
        />
      </div>

      <header className={styles.header}>
        <span>{name}</span>
        <span className={styles.teamAbbreviation}>{teamAbbreviation}</span>
      </header>

      <div className={styles.info}>
        <ul className={styles.stats}>
          {STATS.map(({ label, key }) => (
            <li key={key} className={styles.statsLine}>
              <span className={styles.label}>{label}:</span>
              <span />
              <span className={styles.value}>{player[key]}</span>
            </li>
          ))}
        </ul>
        <div className={styles.teamLogoWrapper}>
          <div className={styles.teamLogo}>
            <Image
              src={teamLogo || "/pictures/circle.png"}
              alt={teamName}
              layout="fill"
              objectFit="contain"
              priority={true}
            />
          </div>
        </div>
      </div>

      <div className={styles.teamName}>
        <span>{teamName}</span>
      </div>
    </section>
  );
}

export default PlayerStatsCard;
