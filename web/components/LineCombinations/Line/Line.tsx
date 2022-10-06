import classNames from "classnames";
import type { Player } from "pages/lines/[abbreviation]";
import React from "react";
import PlayerCard from "../PlayerCard";

import styles from "./Line.module.scss";

type LineProps = {
  className?: string;
  players: Player[];
  columns: 1 | 2 | 3;
};

function Line({ className, players, columns }: LineProps) {
  return (
    <section
      className={classNames(styles.container, className)}
      style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
    >
      {players.map((player) => (
        <div key={player.playerId} className={styles.playerCardWrapper}>
          <PlayerCard {...player} />
        </div>
      ))}
    </section>
  );
}

export default Line;
