import React from "react";
import Link from "next/link";
import PlayerSearchBar from "components/StatsPage/PlayerSearchBar";
import { PlayerInfo } from "./types";
import styles from "./PlayerPageShell.module.scss";

// Shell position codes for the rail colour (R/L are stored without the W).
const POSITION_CODE: Record<string, string> = { R: "RW", L: "LW" };

interface PlayerIdentityBarProps {
  player: PlayerInfo;
  teamLabel?: string | null;
  scopeLabel: string;
}

/** Identity and scope header: who the page is about and what slice is shown. */
export function PlayerIdentityBar({
  player,
  teamLabel,
  scopeLabel
}: PlayerIdentityBarProps) {
  const rawPosition = (player.position || "").toUpperCase();
  const position = POSITION_CODE[rawPosition] ?? rawPosition;
  const birthplace = [player.birthCity, player.birthCountry]
    .filter(Boolean)
    .join(", ");
  const size = [
    player.heightInCentimeters ? `${player.heightInCentimeters} cm` : null,
    player.weightInKilograms ? `${player.weightInKilograms} kg` : null
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <header className={styles.topbar} data-position={position || undefined}>
      {player.image_url ? (
        <img
          className={styles.headshot}
          src={player.image_url}
          alt={player.fullName}
          width={56}
          height={56}
        />
      ) : (
        <span className={styles.headshot} aria-hidden="true" />
      )}
      <div className={styles.identity}>
        <span className={styles.eyebrow}>Player analytics · {scopeLabel}</span>
        <h1 className={styles.name}>{player.fullName}</h1>
        <ul className={styles.meta}>
          <li className={styles.number}>#{player.sweater_number || "-"}</li>
          {position && <li className={styles.positionChip}>{position}</li>}
          {teamLabel && <li>{teamLabel}</li>}
          {birthplace && <li>{birthplace}</li>}
          {size && <li>{size}</li>}
        </ul>
      </div>
      <div className={styles.topbarActions}>
        <Link href="/stats" className={styles.backLink}>
          ← Back to Stats
        </Link>
        <div className={styles.search}>
          <PlayerSearchBar />
        </div>
      </div>
    </header>
  );
}
