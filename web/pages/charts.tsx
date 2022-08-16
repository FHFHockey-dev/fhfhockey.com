import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { NextSeo } from "next-seo";
import classNames from "classnames";

import PlayerBioCard from "components/PlayerBioCard";
import TimeOnIceChart from "components/TimeOnIceChart";
import PlayerAutocomplete from "components/PlayerAutocomplete";
import SubstainabilityChart from "components/SubstainabilityChart";
import CareerAveragesChart from "components/CareerAveragesChart";
import CategoryCoverageChart from "components/CategoryCoverageChart";

import styles from "styles/Charts.module.scss";

function Charts() {
  const router = useRouter();
  const queryParamPlayerId = router.query.playerId
    ? Number(router.query.playerId)
    : undefined;

  const [playerId, setPlayerId] = useState<number | undefined>();

  useEffect(() => {
    setPlayerId(queryParamPlayerId);
  }, [queryParamPlayerId]);

  return (
    <div>
      <NextSeo
        title="FHFH | Charts"
        description="The underlying stats of a player in NHL."
      />

      <section className={styles.chartsPage}>
        <div className={styles.playerAutocompleteWrapper}>
          <PlayerAutocomplete
            inputClassName={styles.playerAutocomplete}
            listClassName={styles.autocompleteList}
            playerId={playerId}
            onPlayerIdChange={(playerId) => {
              setPlayerId(playerId);
              if (typeof window !== "undefined") {
                window.history.pushState(
                  "",
                  "",
                  `/charts?playerId=${playerId}`
                );
              }
            }}
          />
        </div>

        <div id="dashboard" className={styles.dashboard}>
          <Box className={styles.playerBioCard}>
            <PlayerBioCard playerId={playerId} />
          </Box>
          <Box className={styles.timeOnIce}>
            <TimeOnIceChart playerId={playerId} chartType="TOI" />
          </Box>
          <Box className={styles.coverageChart}>
            <CategoryCoverageChart playerId={playerId} />
          </Box>
          <Box className={styles.ppTimeOnIce}>
            <TimeOnIceChart playerId={playerId} chartType="POWER_PLAY_TOI" />
          </Box>
          <Box className={styles.sustainability}>
            <SubstainabilityChart playerId={playerId} />
          </Box>
          <Box className={styles.careerAverages}>
            <CareerAveragesChart playerId={playerId} />
          </Box>
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
