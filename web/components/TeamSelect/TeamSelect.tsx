// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-3\web\components\TeamSelect\TeamSelect.tsx

import React, { useRef } from "react";
import Image from "next/image";
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
    <div className={classNames(className, styles.container)}>
      <button
        className={styles.button}
        title="show previous"
        onClick={onPreviousClick}
      >
        <Image alt="go previous" src={ARROW} width={16} height={16} />
      </button>
      {/* logos */}
      <div ref={logosRef} className={styles.logos}>
        {teams.map(({ abbreviation, name }) => (
          <button
            key={abbreviation}
            title={name}
            className={classNames(styles.logo, {
              [styles.active]: abbreviation === team,
            })}
            onClick={() => onTeamChange(abbreviation)}
          >
            <Image
              alt={abbreviation}
              src={getTeamLogo(abbreviation)}
              width={60}
              height={40}
              layout="fixed"
              objectFit="contain"
            />
          </button>
        ))}
      </div>
      <button className={styles.button} title="show next" onClick={onNextClick}>
        <Image alt="go next" src={ARROW} width={16} height={16} />
      </button>
    </div>
  );
}

export default TeamSelect;
