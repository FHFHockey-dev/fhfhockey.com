import React, { useId, useState } from "react";
import Link from "next/link";
import { NextSeo } from "next-seo";

import { TextBanner } from "../components/Banner/Banner";
import styles from "styles/Charts.module.scss";
import PlayerStatsCard from "components/PlayerStatsCard";

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

      <TextBanner text="Underlying Stats" />

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
          <PlayerStatsCard id={8475225} />
        </div>
      </section>
    </div>
  );
}

export default Charts;
