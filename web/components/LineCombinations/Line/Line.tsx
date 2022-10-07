import React from "react";
import classNames from "classnames";
import type { Player } from "pages/lines/[abbreviation]";
import PlayerCard from "../PlayerCard";

import styles from "./Line.module.scss";

type LineProps = {
  className?: string;
  players: Player[];
  columns: 2 | 3;
};

function Line({ className, players, columns }: LineProps) {
  let twoColumnStyle: React.CSSProperties = {};
  if (columns === 2) {
    twoColumnStyle.width = "calc(100% / 3 * 2)";
    twoColumnStyle.marginLeft = "auto";
    twoColumnStyle.marginRight = "auto";
  }
  return (
    <section
      className={classNames(styles.container, className)}
      style={{
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        ...twoColumnStyle,
      }}
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
