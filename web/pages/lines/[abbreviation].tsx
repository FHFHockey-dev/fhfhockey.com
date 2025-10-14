// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-3\web\pages\lines\[abbreviation].tsx

import React, { useMemo, useRef } from "react";
import { useRouter } from "next/router";
import { NextSeo } from "next-seo";
import type { GetStaticPaths, GetStaticProps } from "next";
import { toPng } from "html-to-image";

import PageTitle from "components/PageTitle";
import Container from "components/Layout/Container";
import TeamSelect from "components/TeamSelect";
import TimeAgo from "components/TimeAgo";
import Select from "components/Select";
import CategoryTitle from "components/LineCombinations/CategoryTitle";
import Line from "components/LineCombinations/Line";
import { mapTeamAbbreviation } from "lib/NHL/utils/utils";
import PowerPlayCombos from "components/PowerPlayCombos";

import { LineChange } from "components/LineCombinations/PlayerCard/SkaterCard";
import Custom404 from "pages/404";
import TeamColorProvider, { useTeamColor } from "contexts/TeamColorContext";

import styles from "./[abbreviation].module.scss";
import useScreenSize from "hooks/useScreenSize";
import { getTeamLogo, getTeams, getCurrentSeason } from "lib/NHL/server";
import { Team } from "lib/NHL/types";
import { getLineCombinations } from "components/LineCombinations/utilities";

export type PlayerBasic = {
  playerId: number;
  playerName: string;
  position: string;
  sweaterNumber: number;
  lineChange: LineChange;
};

export type SkaterStats = PlayerBasic & {
  Goals: number;
  Assists: number;
  PTS: number;
  PPP: number;
  Shots: number;
  Hits: number;
  Blocks: number;
  PlusMinus: number;
};

export type GoalieStats = PlayerBasic & {
  last10Games: {
    Record: string;
    SV: number;
    SVPercentage: number;
    GAA: number;
  };

  season: {
    Record: string;
    GP: number;
    SVPercentage: number;
    GAA: number;
  };
};

type Props = {
  teamName: string;
  /**
   * An array of team info.
   */
  teams: Team[];

  lineCombinations: {
    game: {
      id: number;
    };
    date: string;
    forwards: {
      line1: SkaterStats[];
      line2: SkaterStats[];
      line3: SkaterStats[];
      line4: SkaterStats[];
    };
    defensemen: {
      line1: SkaterStats[];
      line2: SkaterStats[];
      line3: SkaterStats[];
    };
    goalies: {
      line1: GoalieStats[];
      line2: GoalieStats[];
    };
  };
  lastUpdated: string;
};

export default function TeamLC({
  teamName,
  teams,
  lineCombinations,
  lastUpdated,
}: Props) {
  const router = useRouter();
  const { abbreviation } = router.query;
  const mappedAbbreviation = mapTeamAbbreviation(abbreviation as string); // Map abbreviation
  const teamMeta = useMemo(
    () => teams.find((team) => team.abbreviation === mappedAbbreviation),
    [teams, mappedAbbreviation]
  );
  const teamId = teamMeta?.id ?? 0;

  const onTeamChange = (newAbbreviation: string) => {
    const mappedNewAbbreviation = mapTeamAbbreviation(newAbbreviation);
    router.push(`/lines/${mappedNewAbbreviation}`);
  };

  // download the line combo
  const size = useScreenSize();
  const lineComboRef = useRef<HTMLDivElement>(null);
  const downloadImage = () => {
    if (lineComboRef.current === null) return;
    console.log("downloading...");

    toPng(lineComboRef.current, { backgroundColor: "#202020" })
      .then((dataUrl) => {
        const link = document.createElement("a");
        link.download = `${teamName}-${new Date(
          lastUpdated
        ).toLocaleDateString()}-${size.screen}.png`;
        link.href = dataUrl;
        link.click();
      })
      .catch((err) => {
        console.log(err);
      });
  };

  // NOTE: workaround for weird vercel client side bug
  if (!teams || !lineCombinations) {
    return <Custom404 />;
  }

  return (
    <TeamColorProvider teamName={teamName}>
      <TeamSelect
        className={styles.teamSelect}
        teams={teams}
        team={abbreviation as string}
        onTeamChange={onTeamChange}
      />

      <Container className={styles.container}>
        <NextSeo
          title={`FHFH | ${abbreviation} Line Combinations`}
          description={`${abbreviation} Line Combinations`}
        />
        <div className={styles.top}>
          <PageTitle className={styles.title}>
            NHL LINE <PageTitle.Highlight>COMBINATIONS</PageTitle.Highlight>
          </PageTitle>
          <Select
            className={styles.select}
            option={abbreviation as string}
            options={teams.map((team) => ({
              label: team.abbreviation,
              value: team.abbreviation,
            }))}
            onOptionChange={onTeamChange}
          />
        </div>

        <div ref={lineComboRef}>
          <Header
            sourceUrl={
              `/shiftChart?gameId=${lineCombinations.game.id}` +
              "&linemate-matrix-mode=line-combination#linemate-matrix"
            }
            teamName={teamName}
            teamAbbreviation={mappedAbbreviation}
            lastUpdated={lastUpdated || new Date(2022, 10, 1).toString()}
            onTeamLogoClick={downloadImage}
          />
          <Container className={styles.mainContent}>
            <section className={styles.forwards}>
              <CategoryTitle type="large" className={styles.categoryTitle}>
                FORWARDS
              </CategoryTitle>
              <Line
                className={styles.line}
                title="LINE 1"
                columns={3}
                players={lineCombinations.forwards.line1}
              />
              <Line
                className={styles.line}
                title="LINE 2"
                columns={3}
                players={lineCombinations.forwards.line2}
              />
              <Line
                className={styles.line}
                title="LINE 3"
                columns={3}
                players={lineCombinations.forwards.line3}
              />
              <Line
                className={styles.line}
                title="LINE 4"
                columns={3}
                players={lineCombinations.forwards.line4}
              />
            </section>

            {/* mobile only */}
            <section className={styles.defense}>
              <CategoryTitle type="large">DEFENSE</CategoryTitle>
              <Line
                className={styles.line}
                columns={2}
                players={lineCombinations.defensemen.line1}
              />
              <Line
                className={styles.line}
                columns={2}
                players={lineCombinations.defensemen.line2}
              />
              <Line
                className={styles.line}
                columns={2}
                players={lineCombinations.defensemen.line3}
              />
            </section>

            {/* mobile only */}
            <section className={styles.goalies}>
              <CategoryTitle type="large">GOALIES</CategoryTitle>
              <Line
                className={styles.line}
                columns={2}
                type="goalies"
                players={[
                  ...lineCombinations.goalies.line1,
                  ...lineCombinations.goalies.line2,
                ]}
              />
            </section>

            <section className={styles.defenseAndGoalies}>
              <CategoryTitle type="large" className={styles.categoryTitle}>
                DEFENSE & GOALIES
              </CategoryTitle>
              <Line
                className={styles.line}
                title="1ST PAIR"
                columns={2}
                players={lineCombinations.defensemen.line1}
              />
              <Line
                className={styles.line}
                title="2ND PAIR"
                columns={2}
                players={lineCombinations.defensemen.line2}
              />
              <Line
                className={styles.line}
                title="3RD PAIR"
                columns={2}
                players={lineCombinations.defensemen.line3}
              />

              <Line
                className={styles.line}
                title="GOALIES"
                columns={2}
                type="goalies"
                players={[
                  ...lineCombinations.goalies.line1,
                  ...lineCombinations.goalies.line2,
                ]}
              />
            </section>
          </Container>
          {teamId ? (
            <div className={styles.powerPlay}>
              <PowerPlayCombos
                teamId={teamId}
                gameId={lineCombinations.game.id}
              />
            </div>
          ) : null}
        </div>
      </Container>
    </TeamColorProvider>
  );
}

export const getStaticProps: GetStaticProps = async ({ params }) => {
  const abbreviation = params!.abbreviation as string;
  const mappedAbbreviation = mapTeamAbbreviation(abbreviation); // Map abbreviation

  const teams = await getTeams();
  const team = teams.find((team) => team.abbreviation === mappedAbbreviation);

  if (!team) {
    console.warn(`Team not found for abbreviation: ${mappedAbbreviation}`);
    return { notFound: true };
  }

  try {
    const lineCombinations = await getLineCombinations(team.id);
    console.log("INSIDE getStaticProps");

    console.log("Line Combinations:", lineCombinations);
    console.log("Forwards:", lineCombinations.forwards);
    console.log("Defensemen:", lineCombinations.defensemen);
    console.log("Goalies:", lineCombinations.goalies);
    return {
      props: {
        teamName: team.name,
        lastUpdated: lineCombinations.game.startTime,
        lineCombinations,
        teams,
      },
      revalidate: 60, // In seconds
    };
  } catch (error) {
    // If UTA doesn't have enough current-season data yet, try last season with prior team ID
    if (team.abbreviation === "UTA") {
      try {
        const { lastSeasonId } = await getCurrentSeason();
        const utahLastSeasonTeamId = 59;
        const lineCombinations = await getLineCombinations(
          utahLastSeasonTeamId,
          lastSeasonId
        );
        return {
          props: {
            teamName: team.name,
            lastUpdated: lineCombinations.game.startTime,
            lineCombinations,
            teams,
          },
          revalidate: 60,
        };
      } catch (fallbackError) {
        console.error(
          `Failed fallback for UTA (last season/team 59):`,
          fallbackError
        );
      }
    }
    console.error(
      `Failed to get line combinations for team ${mappedAbbreviation}:`,
      error
    );
    return { notFound: true };
  }
};

export const getStaticPaths: GetStaticPaths = async () => {
  const teams = await getTeams();
  const paths = teams.map((team) => ({
    params: { abbreviation: team.abbreviation },
  }));

  return {
    paths,
    fallback: false,
  };
};

type HeaderProps = {
  teamName: string;
  teamAbbreviation: string;
  lastUpdated: string;
  sourceUrl: string;
  onTeamLogoClick: () => void;
};

function Header({
  teamName,
  teamAbbreviation,
  lastUpdated,
  sourceUrl,
  onTeamLogoClick,
}: HeaderProps) {
  const names = teamName.split(" ");
  const abbreviation = teamAbbreviation;
  const color = useTeamColor();

  return (
    <div
      className={styles.header}
      style={{
        backgroundColor: color.primary,
        color: color.secondary,
      }}
    >
      <div className={styles.left}>
        <h2 className={styles.teamName}>
          {names.slice(0, -1).join(" ")}{" "}
          <span className={styles.highlight}>{names.at(-1)}</span>
        </h2>
        <div className={styles.time}>
          <a href={sourceUrl} target="_blank" rel="noreferrer">
            Updated: <TimeAgo date={lastUpdated} />
          </a>
        </div>
      </div>
      <div className={styles.right} onClick={onTeamLogoClick}>
        <div className={styles.large}>
          <img
            alt={teamName}
            src={getTeamLogo(teamAbbreviation)}
            style={{
              width: 120,
              height: 72,
              objectFit: "contain",
            }}
          />
        </div>

        <div className={styles.small}>
          <img
            alt={teamName}
            src={getTeamLogo(teamAbbreviation)}
            style={{
              width: 60,
              height: 35,
              objectFit: "contain",
            }}
          />
        </div>
      </div>
    </div>
  );
}
