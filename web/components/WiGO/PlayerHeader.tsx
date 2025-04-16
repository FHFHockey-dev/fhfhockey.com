// /Users/tim/Desktop/FHFH/fhfhockey.com/web/components/WiGO/PlayerHeader.tsx

import React from "react";
import Image from "next/legacy/image";
import { Player, TeamColors } from "./types";
import TeamNameSVG from "./TeamNameSVG"; // Assuming TeamNameSVG is in the same directory
import styles from "styles/wigoCharts.module.scss"; // Use parent's styles for now, or create dedicated ones

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
      {teamName && (
        <TeamNameSVG
          teamName={teamName}
          primaryColor={teamColors.primaryColor}
          secondaryColor={teamColors.secondaryColor}
        />
      )}

      <div className={styles.headshotContainer}>
        <div className={styles.leftSide}>
          <div className={styles.headshot}>
            {headshotUrl ? (
              <Image
                src={headshotUrl}
                alt={`${selectedPlayer?.fullName ?? "Player"} headshot`}
                className={styles.headshotImage}
                layout="fill"
                objectFit="cover"
                priority // Load headshot faster
                style={{ border: `6px solid ${teamColors.primaryColor}` }}
              />
            ) : (
              <Image
                src={placeholderImage}
                alt="Placeholder headshot"
                className={styles.headshotImage}
                layout="fill"
                objectFit="cover"
                style={{
                  border: `6px solid #07aae2`, // Default border if no team color
                  borderRadius: "90px" // Keep rounded placeholder
                }}
              />
            )}
          </div>
        </div>
        <div className={styles.rightSide}>
          <div className={styles.teamLogo}>
            {teamAbbreviation ? (
              <Image
                src={`/teamLogos/${teamAbbreviation}.png`}
                alt={`${teamName} logo`}
                layout="intrinsic"
                width={150}
                height={150}
              />
            ) : (
              // Optionally display something else if no logo/team
              selectedPlayer && (
                <p style={{ color: "#ccc", fontSize: "14px" }}>
                  No team logo found
                </p>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlayerHeader;
