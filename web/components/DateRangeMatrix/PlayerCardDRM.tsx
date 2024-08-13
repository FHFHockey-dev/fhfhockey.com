/////////////////////////////////////////////////////////////////////////////////////////////////////////
// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-3\web\components\DateRangeMatrix\PlayerCardDRM.tsx

import { teamsInfo } from "lib/NHL/teamsInfo";
import React from "react";
import styles from "../../styles/LinePairGrid.module.scss";

type PlayerCardProps = {
  name: string;
  firstName: string;
  lastName: string;
  teamId: number;
};

const getTeamColors = (teamId: number) => {
  const team = Object.values(teamsInfo).find((team) => team.id === teamId);
  if (team) {
    return {
      primary: team.primaryColor,
      secondary: team.secondaryColor,
      jersey: team.jersey,
      accentColor: team.accent,
    };
  }
  return {
    primary: "#000000", // default to black if not found
    secondary: "#FFFFFF", // default to white if not found
    jersey: "#000000", // default to black if not found
    accentColor: "#000000", // default to black if not found
  };
};

const PlayerCard: React.FC<PlayerCardProps> = ({
  name,
  firstName,
  lastName,
  teamId,
}) => {
  const { primary, secondary, jersey, accentColor } = getTeamColors(teamId);

  return (
    <div
      className={styles.playerCard}
      style={{
        backgroundColor: primary,
        borderColor: jersey,
        ["--accent-color" as any]: accentColor,
        ["--secondary-color" as any]: secondary,
        ["--primary-color" as any]: primary,
        ["--jersey-color" as any]: jersey,
      }}
    >
      <span className={styles.firstNamePlayerCard}>{firstName}</span>
      <br />
      <span className={styles.lastNamePlayerCard}>{lastName}</span>
    </div>
  );
};

export default PlayerCard;
