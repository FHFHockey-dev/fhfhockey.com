// C:\Users\timbr\Desktop\FHFH\fhfhockey.com-3\web\components\LineCombinations\Line\Line.tsx

import React from "react";
import classNames from "classnames";
import type { GoalieStats, SkaterStats } from "pages/lines/[abbreviation]";
import SkaterCard from "../PlayerCard";
import GoalieCard from "../PlayerCard/GoalieCard";

import styles from "./Line.module.scss";

type LineProps = {
  className?: string;
  title?: string;
  columns: 2 | 3;
  children?: React.ReactNode;
} & (
  | {
      type?: "skaters";
      players: SkaterStats[];
    }
  | {
      type: "goalies";
      players: GoalieStats[];
    }
);

function Line({
  className,
  title,
  type = "skaters",
  players,
  columns,
  children,
}: LineProps) {
  return (
    <section className={classNames(styles.container, className)}>
      {title && (
        <div className={styles.title}>
          <h4>{title}</h4>
        </div>
      )}
      <div
        className={classNames(styles.cards, {
          [styles.twoColumn]: columns === 2,
          [styles.threeColumn]: columns === 3,
        })}
      >
        {players
          ? players.map((player) => (
              <div key={player.playerId} className={styles.playerCardWrapper}>
                {type === "skaters" ? (
                  <SkaterCard {...(player as SkaterStats)} />
                ) : (
                  <GoalieCard {...(player as GoalieStats)} />
                )}
              </div>
            ))
          : children}
      </div>
    </section>
  );
}

export default Line;
