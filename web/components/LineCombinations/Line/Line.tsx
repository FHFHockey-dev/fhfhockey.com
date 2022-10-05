import classNames from "classnames";
import React from "react";
import PlayerCard from "../PlayerCard";

import styles from "./Line.module.scss";

type LineProps = {
  className?: string;
};

function Line({ className }: LineProps) {
  return (
    <section className={classNames(styles.container, className)}>
      <div className={styles.playerCardWrapper}>
        <PlayerCard name="Ninno Brind’Amour" jerseyNumber={22} isPromotion />
      </div>
      <div className={styles.playerCardWrapper}>
        <PlayerCard name="Ninno Brind’Amour" jerseyNumber={22} />
      </div>
      <div className={styles.playerCardWrapper}>
        <PlayerCard name="Ninno Brind’Amour" jerseyNumber={22} />
      </div>
    </section>
  );
}

export default Line;
