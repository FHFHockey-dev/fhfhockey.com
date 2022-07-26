/* eslint-disable @next/next/no-img-element */
import Image from "next/image";
import usePlayer from "hooks/usePlayer";
import styles from "./PlayerBioCard.module.scss";

type PlayerStatsCardProps = {
  /**
   * Player Id
   */
  id: number;
};

// The stats to be displayed on the card
const STATS = [
  { label: "Age", key: "age" },
  { label: "Position", key: "position" },
  { label: "Height", key: "height" },
  { label: "Weight", key: "weight" },
  { label: "Shoots", key: "shoots" },
];

function PlayerStatsCard({ id }: PlayerStatsCardProps) {
  const player = usePlayer(id);
  const { name, image, teamName, teamAbbreviation, teamLogo } = player;

  return (
    <section className={styles.playerCard}>
      <div className={styles.playerImageWrapper}>
        <img
          style={{ objectFit: "cover" }}
          src={image}
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
              src={teamLogo}
              alt={teamName}
              width="100%"
              height="100%"
              layout="fill"
              objectFit="cover"
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
