// /Users/tim/Desktop/FHFH/fhfhockey.com/web/components/WiGO/PlayerHeader.tsx

import React from "react";
import Image from "next/legacy/image"; // Using legacy Image as per original
import { Player, TeamColors } from "./types";
import TeamNameSVG from "./TeamNameSVG";
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
    // This div provides the overall background color
    <div className={styles.playerHeadshot}>
      {/* Container for Left/Right visual areas (Logo, Headshot) */}
      {/* This sits below the SVG Text Overlay */}
      <div className={styles.headshotContainer}>
        <div className={styles.leftSide}>
          {/* TeamLogo */}
          <div className={styles.teamLogo}>
            {teamAbbreviation && selectedPlayer ? (
              <Image
                src={`/teamLogos/${teamAbbreviation}.png`}
                alt={`${teamName} logo`}
                layout="intrinsic"
                width={200}
                height={200}
                objectFit="contain"
              />
            ) : (
              selectedPlayer && <p>No Logo</p>
            )}
          </div>
          {/* Headshot */}
          <div className={styles.headshot}>
            {headshotUrl ? (
              <Image
                src={headshotUrl}
                alt={`${selectedPlayer?.fullName ?? "Player"} headshot`}
                className={styles.headshotImage}
                layout="fill"
                objectFit="cover"
                priority
              />
            ) : (
              <Image
                src={placeholderImage}
                alt="Placeholder headshot"
                className={styles.headshotImage}
                layout="fill"
                objectFit="contain"
              />
            )}
          </div>
        </div>
        {/* rightSide might not need specific content now, */}
        {/* but keep for flex structure if desired */}
        <div className={styles.rightSide}>
          {/* Intentionally empty or for other elements */}
        </div>
      </div>

      {teamName && (
        <TeamNameSVG
          teamName={teamName}
          primaryColor={teamColors.primaryColor} // Prop might be irrelevant now
          secondaryColor={teamColors.secondaryColor} // Color for the text itself
        />
      )}
    </div>
  );
};

export default PlayerHeader;
