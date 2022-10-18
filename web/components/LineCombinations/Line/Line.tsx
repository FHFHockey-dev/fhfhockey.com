import React from "react";
import classNames from "classnames";
import type { Player } from "pages/lines/[abbreviation]";
import PlayerCard from "../PlayerCard";

import styles from "./Line.module.scss";

type LineProps = {
  className?: string;
  title?: string;
  players?: Player[];
  columns: 2 | 3;
  children?: React.ReactNode;
};

function Line({ className, title, players, columns, children }: LineProps) {
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
                <PlayerCard {...player} />
              </div>
            ))
          : children}
      </div>
    </section>
  );
}

export default Line;
