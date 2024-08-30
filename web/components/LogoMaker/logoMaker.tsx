// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-3\web\components\LogoMaker\logoMaker.tsx

import React from "react";
import styles from "./logoMaker.module.scss";
import { teamsInfo } from "lib/NHL/teamsInfo";

type LogoMakerProps = {
  selectedTeam: keyof typeof teamsInfo;
};

const LogoMaker: React.FC<LogoMakerProps> = ({ selectedTeam }) => {
  const team = teamsInfo[selectedTeam];

  return (
    <div className={styles.logoMakerContainer}>
      <div
        className={styles.logoWrapper}
        style={
          {
            "--primary-color": team.primaryColor,
            "--secondary-color": team.secondaryColor,
            "--jersey-color": team.jersey,
            "--alt-color": team.alt,
            "--accent-color": team.accent,
          } as React.CSSProperties
        }
      >
        <div className={styles.outerBorder}>
          <div className={styles.outerCircle}>
            <div className={styles.innerCircle}>
              <img
                src={`/teamLogos/${team.name}.png`}
                alt={`${team.name} logo`}
                className={styles.teamLogo}
              />
            </div>
          </div>
        </div>
        <svg className={styles.curvedTextSvg}>
          <defs>
            <path
              id="curveUpper"
              d="M 150, 150 m -120, 0 a 120,120 0 1,1 240,0 a 120,120 0 1,1 -240,0"
            />
            <path
              id="curveLower"
              d="M 150, 150 m -125, 0 a 125,125 0 1,0 250,0 a 125,125 0 1,0 -250,0"
            />
          </defs>

          {/* Bars at 9 and 3 o'clock positions */}
          <rect
            x="5"
            y="139"
            width="35"
            height="22"
            fill={team.accent}
            className={styles.pokeballBar}
          />
          <rect
            x="260"
            y="140"
            width="35"
            height="21"
            fill={team.alt}
            className={styles.pokeballBar}
          />

          <text className={styles.curvedTextUpper} dominantBaseline="middle">
            <textPath
              href="#curveUpper"
              startOffset="25.5%"
              textAnchor="middle"
            >
              {team.location}
            </textPath>
          </text>
          <text className={styles.curvedTextLower} dominantBaseline="middle">
            <textPath
              href="#curveLower"
              startOffset="25.5%"
              textAnchor="middle"
            >
              {team.shortName}
            </textPath>
          </text>
        </svg>
      </div>
    </div>
  );
};

export default LogoMaker;
