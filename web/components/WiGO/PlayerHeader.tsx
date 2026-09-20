import React, { useState } from "react";
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
  const [failedHeadshot, setFailedHeadshot] = useState<string | null>(null);
  const [failedLogo, setFailedLogo] = useState<string | null>(null);
  const displayedHeadshot = headshotUrl && headshotUrl !== failedHeadshot ? headshotUrl : null;
  return (
    <div className={styles.playerHeadshot}>
      <div className={styles.headshotContainer}>
        <div className={styles.teamLogo}>
          {teamAbbreviation && teamAbbreviation !== failedLogo && selectedPlayer ? (
            <Image
              src={`/teamLogos/${teamAbbreviation}.png`}
              alt={`${teamName} logo`}
              onError={() => setFailedLogo(teamAbbreviation)}
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
            src={displayedHeadshot || placeholderImage}
            onError={() => setFailedHeadshot(headshotUrl)}
            alt={
              displayedHeadshot
                ? `${selectedPlayer?.fullName ?? "Player"} headshot`
                : "Placeholder headshot"
            }
            className={styles.headshotImage}
            fill
            sizes="(max-width: 768px) 220px, 320px"
            priority={Boolean(displayedHeadshot)}
          />
        </div>
      </div>
    </div>
  );
};

export default PlayerHeader;
