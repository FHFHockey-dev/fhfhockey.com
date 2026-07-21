// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-3\web\components\TeamSelect\TeamSelect.tsx

import React, { useRef } from "react";
import Image from "next/legacy/image";
import classNames from "classnames";

import ARROW from "public/pictures/arrow.svg";
import styles from "./TeamSelect.module.scss";
import { getTeamLogo } from "lib/NHL/server";

type TeamSelectProps = {
  className?: string;
  /**
   * An array of team info.
   */
  teams: { abbreviation: string; name: string }[];
  /**
   * Selected team abbreviation.
   */
  team: string;

  onTeamChange: (abbreviation: string) => void;
};

function TeamSelect({
  teams = [],
  team,
  onTeamChange,
  className,
}: TeamSelectProps) {
  const logosRef = useRef<HTMLDivElement>(null);

  const onPreviousClick = () => {
    if (logosRef.current) {
      logosRef.current.scrollBy({ left: -60 * 3 });
    }
  };

  const onNextClick = () => {
    if (logosRef.current) {
      logosRef.current.scrollBy({ left: 60 * 3 });
    }
  };

  return (
    <div
      className={classNames(className, styles.container)}
      role="group"
      aria-label="Team selection"
    >
      <button
        type="button"
        className={styles.button}
        aria-label="Show previous teams"
        title="Show previous teams"
        onClick={onPreviousClick}
      >
        <Image alt="" src={ARROW} width={16} height={16} />
      </button>
      {/* logos */}
      <div
        ref={logosRef}
        className={styles.logos}
        role="group"
        aria-label="Available teams"
      >
        {teams.map(({ abbreviation, name }) => (
          <button
            type="button"
            key={abbreviation}
            title={name}
            aria-label={`Select ${name}`}
            aria-pressed={abbreviation === team}
            className={classNames(styles.logo, {
              [styles.active]: abbreviation === team,
            })}
            onClick={() => onTeamChange(abbreviation)}
          >
            <Image
              alt=""
              src={getTeamLogo(abbreviation)}
              width={60}
              height={40}
              layout="fixed"
              objectFit="contain"
            />
          </button>
        ))}
      </div>
      <button
        type="button"
        className={styles.button}
        aria-label="Show next teams"
        title="Show next teams"
        onClick={onNextClick}
      >
        <Image alt="" src={ARROW} width={16} height={16} />
      </button>
    </div>
  );
}

export default TeamSelect;
