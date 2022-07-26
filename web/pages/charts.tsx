import React, { useId, useState } from "react";
import { NextSeo } from "next-seo";
import classNames from "classnames";

import styles from "styles/Charts.module.scss";
import PlayerBioCard from "components/PlayerBioCard";

function Charts() {
  const playerNameId = useId();
  const [playerName, setPlayerName] = useState("");
  const handleSearch: React.FormEventHandler<HTMLFormElement> = (e) => {
    e.preventDefault();
    console.log({ playerName });
  };
  return (
    <div>
      <NextSeo
        title="FHFH | Charts"
        description="The underlying stats of a player in NHL."
      />

      <section className={styles.chartsPage}>
        <form className={styles.searchForm} onSubmit={handleSearch}>
          <label htmlFor={playerNameId} hidden>
            Player Name
          </label>
          <input
            className={styles.playerNameInput}
            id={playerNameId}
            type="text"
            name="Player Name"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
          />

          <button className={styles.searchButton}>SEARCH</button>
        </form>
        <div className={styles.dashboard}>
          <div className={styles.playerBioCard}>
            <PlayerBioCard id={8475225} />
          </div>
          <Box className={styles.timeOnIce}>time On Ice</Box>
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
