import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { NextSeo } from "next-seo";

import PlayerBioCard from "components/PlayerBioCard";
import TimeOnIceChart from "components/TimeOnIceChart";
import PlayerAutocomplete from "components/PlayerAutocomplete";
import CategoryCoverageChart from "components/CategoryCoverageChart";

import styles from "styles/Charts.module.scss";
import TimeOptions from "components/TimeOptions";
import { TimeOption } from "components/TimeOptions/TimeOptions";
import {
  ChartTypeOption,
  ChartTypeOptions,
} from "components/TimeOnIceChart/TimeOnIceChart";
import useScreenSize, { BreakPoint } from "hooks/useScreenSize";
import ClientOnly from "components/ClientOnly";
import SustainabilityVSCareerChart from "components/SustainabilityVSCareerChart";

function Charts() {
  const router = useRouter();
  const queryParamPlayerId = router.query.playerId
    ? Number(router.query.playerId)
    : undefined;
  const size = useScreenSize();
  const [playerId, setPlayerId] = useState<number | undefined>();
  const [timeOption, setTimeOption] = useState<TimeOption>("L7");
  const [chartTypeOption, setChartTypeOption] =
    useState<ChartTypeOption>("POWER_PLAY_TOI");

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
                  playerId ? `/charts?playerId=${playerId}` : "/charts"
                );
              }
            }}
          />
        </div>

        <div id="dashboard" className={styles.dashboard}>
          <div className={styles.playerBioCard}>
            <PlayerBioCard playerId={playerId} />
          </div>

          <ClientOnly className={styles.controller}>
            <TimeOptions
              timeOption={timeOption}
              setTimeOption={setTimeOption}
            />
            <ChartTypeOptions
              chartTypeOption={chartTypeOption}
              setChartTypeOption={setChartTypeOption}
            />
          </ClientOnly>
          <section className={styles.stats}>
            <div className={styles.timeOnIce}>
              <TimeOnIceChart
                playerId={playerId}
                timeOption={timeOption}
                chartType={
                  size.screen === BreakPoint.l ? "TOI" : chartTypeOption
                }
              />
            </div>
            <div className={styles.ppTimeOnIce}>
              <TimeOnIceChart
                playerId={playerId}
                timeOption={timeOption}
                chartType="POWER_PLAY_TOI"
              />
            </div>
            <div className={styles.coverageChart}>
              <CategoryCoverageChart
                playerId={playerId}
                timeOption={timeOption}
              />
            </div>
            <div className={styles.sustainabilityVScareerAverages}>
              <SustainabilityVSCareerChart
                playerId={playerId}
                timeOption={timeOption}
              />
            </div>
          </section>
          <footer className={styles.footer}>
            <span className={styles.blue}>Five Hole</span> Fantasy Hockey{" "}
            <span className={styles.blue}>•</span> FHFHockey.com{" "}
            <span className={styles.blue}>•</span> @FHFHockey
          </footer>
        </div>
      </section>
    </div>
  );
}

export default Charts;
