import React, { useEffect, useRef, useState } from "react";
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
import Image from "next/image";
import { toPng } from "html-to-image";
import Container from "components/Layout/Container";

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
    <Container>
      <NextSeo
        title="FHFH | Charts"
        description="The underlying stats of a player in NHL."
      />

      <ClientOnly>
        {size.screen === BreakPoint.l ? (
          <Large
            playerId={playerId}
            setPlayerId={setPlayerId}
            timeOption={timeOption}
            setTimeOption={setTimeOption}
          />
        ) : (
          <Small
            playerId={playerId}
            setPlayerId={setPlayerId}
            timeOption={timeOption}
            setTimeOption={setTimeOption}
            chartTypeOption={chartTypeOption}
            setChartTypeOption={setChartTypeOption}
          />
        )}
      </ClientOnly>
    </Container>
  );
}

function Small({
  playerId,
  setPlayerId,
  timeOption,
  setTimeOption,
  chartTypeOption,
  setChartTypeOption,
}: any) {
  const ref = useRef<HTMLDivElement>(null);

  const onDownloadClick = (playerName: string) => {
    if (ref.current === null) {
      return;
    }

    toPng(ref.current, {
      cacheBust: true,
      canvasWidth: 500,
      canvasHeight: 844,
    })
      .then((dataUrl) => {
        const link = document.createElement("a");
        link.download = `${playerId}-${playerName}.png`;
        link.href = dataUrl;
        link.click();
      })
      .catch((err) => {
        console.log(err);
      });
  };
  return (
    <section className={styles.small}>
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

      <div ref={ref} id="dashboard" className={styles.dashboard}>
        <div className={styles.bioCard}>
          <PlayerBioCard
            playerId={playerId}
            onPlayerImageClick={onDownloadClick}
          />
        </div>

        <ClientOnly className={styles.controller}>
          <TimeOptions timeOption={timeOption} setTimeOption={setTimeOption} />
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
              chartType={chartTypeOption}
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
          <Blue>Five Hole</Blue> Fantasy Hockey <Blue>•</Blue> FHFHockey.com{" "}
          <Blue>•</Blue> @FHFHockey
        </footer>
      </div>
    </section>
  );
}

function Large({ playerId, setPlayerId, timeOption, setTimeOption }: any) {
  const ref = useRef<HTMLDivElement>(null);

  const onDownloadClick = () => {
    if (ref.current === null) {
      return;
    }

    toPng(ref.current, {
      cacheBust: true,
      canvasWidth: 1440,
      canvasHeight: 1080,
    })
      .then((dataUrl) => {
        const link = document.createElement("a");
        link.download = `${playerId}-player.png`;
        link.href = dataUrl;
        link.click();
      })
      .catch((err) => {
        console.log(err);
      });
  };

  const onShareClick = () => {
    const TWITTER_URL = new URL("https://twitter.com/intent/tweet");
    TWITTER_URL.searchParams.append("url", window.location.toString());
    TWITTER_URL.searchParams.append(
      "text",
      "The underlying stats of the NHL player."
    );

    window.open(TWITTER_URL, "_blank");
  };

  return (
    <section className={styles.large}>
      <h1 className={styles.title}>
        PLAYER <span className={styles.blue}>CARDS</span>
      </h1>
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
      <div className={styles.actions}>
        <IconButton onClick={onDownloadClick}>
          <Image
            src="/pictures/download.svg"
            alt="download"
            width={20}
            height={24}
          />
        </IconButton>
        <IconButton onClick={onShareClick}>
          <Image
            src="/pictures/share.svg"
            alt="download"
            width={26}
            height={20}
          />
        </IconButton>
      </div>

      <div ref={ref} id="dashboard" className={styles.dashboard}>
        <div className={styles.bioCard}>
          <PlayerBioCard playerId={playerId} />
        </div>
        <div className={styles.coverageChart}>
          <CategoryCoverageChart playerId={playerId} timeOption={timeOption} />
        </div>
        <div className={styles.timeOptions}>
          <TimeOptions timeOption={timeOption} setTimeOption={setTimeOption} />
        </div>

        <div className={styles.timeOnIce}>
          <TimeOnIceChart
            playerId={playerId}
            timeOption={timeOption}
            chartType="TOI"
          />
        </div>
        <div className={styles.ppTimeOnIce}>
          <TimeOnIceChart
            playerId={playerId}
            timeOption={timeOption}
            chartType="POWER_PLAY_TOI"
          />
        </div>
        <div className={styles.sustainabilityVScareerAverages}>
          <SustainabilityVSCareerChart
            playerId={playerId}
            timeOption={timeOption}
          />
        </div>
        <div className={styles.footer}>
          <div className={styles.left}>
            <p>
              <Blue>Five Hole</Blue> Fantasy Hockey <Blue>•</Blue> FHFHockey.com{" "}
              <Blue>•</Blue> @FHFHockey
            </p>
          </div>
          <div className={styles.right}>
            <p>
              Fine, fine print, SOURCE, Credit. ETC. Fine, fine print, SOURCE,
              Credit. ETC.{" "}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Blue({ children }: { children: React.ReactNode }) {
  return <span className={styles.blue}>{children}</span>;
}

function IconButton({
  children,
  ...rest
}: React.DetailedHTMLProps<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  HTMLButtonElement
>) {
  return (
    <button className={styles.button} {...rest}>
      {children}
    </button>
  );
}

export default Charts;
