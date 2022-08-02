import React, { useState } from "react";
import { NextSeo } from "next-seo";
import classNames from "classnames";

import PlayerBioCard from "components/PlayerBioCard";
import TimeOnIceChart from "components/TimeOnIceChart";
import PlayerAutocomplete from "components/PlayerAutocomplete";

import styles from "styles/Charts.module.scss";

function Charts() {
  const [playerId, setPlayerId] = useState<number | undefined>();

  return (
    <div>
      <NextSeo
        title="FHFH | Charts"
        description="The underlying stats of a player in NHL."
      />

      <section className={styles.chartsPage}>
        <div style={{ margin: "0.5rem 0" }}>
          <PlayerAutocomplete
            inputClassName={styles.playerAutocomplete}
            listClassName={styles.autocompleteList}
            onPlayerIdChange={(playerId) => setPlayerId(playerId)}
          />
        </div>

        <div className={styles.dashboard}>
          <div className={styles.playerBioCard}>
            <PlayerBioCard playerId={playerId} />
          </div>
          <Box className={styles.timeOnIce}>
            <TimeOnIceChart playerId={playerId} />
          </Box>
          <Box className={styles.coverageChart}>coverageChart</Box>
          <Box className={styles.weeklyRank}>weekly Rank</Box>
          <Box className={styles.sustainability}>Sustainability</Box>
          <Box className={styles.careerAverages}>Career Averages</Box>
        </div>
      </section>
    </div>
  );
}

type BoxProps = {
  children?: React.ReactNode;
  className?: string;
};
function Box({ children, className }: BoxProps) {
  return <div className={classNames(styles.box, className)}>{children}</div>;
}
export default Charts;
