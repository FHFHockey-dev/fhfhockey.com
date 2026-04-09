// /Users/tim/Desktop/FHFH/fhfhockey.com/web/components/WiGO/PlayerHeader.tsx

import React from "react";
import Image from "next/image";
import { Player, TeamColors } from "./types";
import styles from "styles/wigoCharts.module.scss";

interface PlayerHeaderProps {
  selectedPlayer: Player | null;
  headshotUrl: string | null;
  teamName: string;
  teamAbbreviation: string | null;
  teamColors: TeamColors;
  placeholderImage: string;
}

const PlayerHeader: React.FC<PlayerHeaderProps> = ({
  selectedPlayer,
  headshotUrl,
  teamName,
  teamAbbreviation,
  teamColors,
  placeholderImage
}) => {
  return (
    <div className={styles.playerHeadshot}>
      <div className={styles.headshotContainer}>
        <div className={styles.teamLogo}>
          {teamAbbreviation && selectedPlayer ? (
            <Image
              src={`/teamLogos/${teamAbbreviation}.png`}
              alt={`${teamName} logo`}
              fill
              sizes="(max-width: 768px) 160px, 220px"
              className={styles.teamLogoImage}
            />
          ) : (
            selectedPlayer && <p>No Logo</p>
          )}
        </div>
        <div className={styles.headshot}>
          <Image
            src={headshotUrl || placeholderImage}
            alt={
              headshotUrl
                ? `${selectedPlayer?.fullName ?? "Player"} headshot`
                : "Placeholder headshot"
            }
            className={styles.headshotImage}
            fill
            sizes="(max-width: 768px) 220px, 320px"
            priority={Boolean(headshotUrl)}
          />
        </div>
      </div>
    </div>
  );
};

export default PlayerHeader;
