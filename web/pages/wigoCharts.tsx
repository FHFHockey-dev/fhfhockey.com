// web/pages/wigoCharts.tsx

import React, { useState } from "react";
import styles from "styles/wigoCharts.module.scss";
import { Player } from "components/WiGO/types";
import NameSearchBar from "../components/WiGO/NameSearchBar";
import Image from "next/image";

const WigoCharts: React.FC = () => {
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [headshotUrl, setHeadshotUrl] = useState<string | null>(null);
  const placeholderImage = "/pictures/player-placeholder.jpg";

  const handlePlayerSelect = (player: Player, headshot: string) => {
    setSelectedPlayer(player);
    setHeadshotUrl(headshot);
  };

  return (
    <div className={styles.chartsContainer}>
      {/* TRENDS CHART */}
      <div className={styles.trendsChartBorder}>
        <div className={styles.trendsChart}>
          <div className={styles.nameSearch}>
            <NameSearchBar onSelect={handlePlayerSelect} />
          </div>
          <div className={styles.notSureYet}> </div>
        </div>
      </div>

      {/* WIGO CHART */}
      <div className={styles.wigoChartBorder}>
        <div className={styles.wigoChart}>
          <div className={styles.nameContainer}>
            {selectedPlayer ? (
              <span>{selectedPlayer.fullName}</span>
            ) : (
              <span>No player selected</span>
            )}
          </div>
          <div className={styles.headshot}>
            {headshotUrl ? (
              <Image
                src={headshotUrl}
                alt={`${selectedPlayer?.fullName} headshot`}
                className={styles.headshotImage}
                layout="fill"
              />
            ) : (
              <Image
                src={placeholderImage}
                alt="No headshot available"
                className={styles.headshotImage}
                layout="fill"
              />
            )}
          </div>
          <div className={styles.pptoiChart}> </div>
          <div className={styles.atoiChart}> </div>
          <div className={styles.doughnut}> </div>
          <div className={styles.percentiles}> </div>
          <div className={styles.countsTable}> </div>
          <div className={styles.ratesTable}> </div>
        </div>
      </div>
    </div>
  );
};

export default WigoCharts;
