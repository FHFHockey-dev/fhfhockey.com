import React, { useRef } from "react";
import { useRouter } from "next/router";
import { NextSeo } from "next-seo";
import type { GetStaticPaths, GetStaticProps } from "next";
import { toPng } from "html-to-image";

import supabase from "lib/supabase";
import PageTitle from "components/PageTitle";
import Container from "components/Layout/Container";
import TeamSelect from "components/TeamSelect";
import TimeAgo from "components/TimeAgo";
import Select from "components/Select";
import CategoryTitle from "components/LineCombinations/CategoryTitle";
import Line from "components/LineCombinations/Line";

import getLineChanges from "lib/NHL/getLineChanges";
import { memoizeAsync } from "utils/memoize";
import { LineChange } from "components/LineCombinations/PlayerCard/PlayerCard";
import Custom404 from "pages/404";
import TeamColorProvider, { useTeamColor } from "contexts/TeamColorContext";

import styles from "./[abbreviation].module.scss";
import useScreenSize from "hooks/useScreenSize";
import {
  getCurrentSeason,
  getPlayer,
  getPlayerGameLog,
  getTeamLogo,
  getTeams,
} from "lib/NHL/server";

export type PlayerBasic = {
  playerId: number;
  playerName: string;
};

export type Player = PlayerBasic & {
  Goals: number;
  Assists: number;
  PTS: number;
  PPP: number;
  Shots: number;
  Hits: number;
  Blocks: number;
  PlusMinus: number;
  name: string;
  jerseyNumber: string;
  lineChange: LineChange;
};

type Props = {
  teamName: string;
  /**
   * An array of team info.
   */
  teams: { abbreviation: string; name: string; shortName: string }[];

  lineCombinations: {
    source_url: string;
    date: string;
    team_name: string;
    team_abbreviation: string;
    forwards: {
      line1: Player[];
      line2: Player[];
      line3: Player[];
      line4: Player[];
    };
    defensemen: {
      line1: Player[];
      line2: Player[];
      line3: Player[];
    };
    goalies: {
      line1: Player[];
      line2: Player[];
    };
  };
  source_url: string;
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
  const onTeamChange = (newAbbreviation: string) => {
    router.push(`/lines/${newAbbreviation}`);
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
              label: team.shortName,
              value: team.abbreviation,
            }))}
            onOptionChange={onTeamChange}
          />
        </div>

        <div ref={lineComboRef}>
          <Header
            sourceUrl={lineCombinations.source_url}
            teamName={teamName}
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
                players={[
                  ...lineCombinations.goalies.line1,
                  ...lineCombinations.goalies.line2,
                ]}
              />
            </section>
          </Container>
        </div>
      </Container>
    </TeamColorProvider>
  );
}

export const getStaticProps: GetStaticProps = async ({ params }) => {
  // for Team Select
  const teams = await getTeams();

  teams
    .map((team) => ({
      shortName: team.name,
      name: team.name,
      abbreviation: team.abbreviation,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const { promotions, demotions } = await memoizeAsync<
    ReturnType<typeof getLineChanges>
  >(getLineChanges, 5 * 60)();

  const { data: line_combinations, error } = await supabase
    .from("line_combinations")
    .select(
      "date, team_name, team_abbreviation, forwards, defensemen, goalies, source_url"
    )
    .eq("team_abbreviation", params?.abbreviation)
    .order("date", {
      ascending: false,
    })
    .limit(2);

  if (error || line_combinations.length !== 2) {
    return {
      props: {
        teams: [],
      },
      notFound: true,
    };
  }

  // get current season id
  const seasonId = (await getCurrentSeason()).seasonId;

  // populate each player object with last 10 GP stats
  const [current, _] = line_combinations as Props["lineCombinations"][];

  const lastUpdated = current.date;

  const getLineChange = (playerId: number): LineChange => {
    if (promotions.some((p) => p.playerId === playerId)) return "promotion";
    if (demotions.some((p) => p.playerId === playerId)) return "demotion";
    return "static";
  };

  const populateStat = async (type: "forwards" | "defensemen" | "goalies") => {
    for (const [line, players] of Object.entries(current[type])) {
      // @ts-ignore
      current[type][line] = await Promise.all(
        players.map(async ({ playerId, playerName }) => {
          const jerseyNumber = (await getPlayer(playerId))?.sweaterNumber ?? 0;

          const games = (await getPlayerGameLog(playerId, seasonId)).slice(
            0,
            10
          );

          const stats = {
            Goals: 0,
            Assists: 0,
            PTS: 0,
            PPP: 0,
            Shots: 0,
            Hits: 0,
            Blocks: 0,
            PlusMinus: 0,
            name: playerName,
            playerId,
            jerseyNumber,
            lineChange: getLineChange(playerId),
            source_url: current.source_url,
          };
          games.forEach((stat) => {
            stats["Goals"] += stat.goals;
            stats["Assists"] += stat.assists;
            stats["PTS"] += stat.goals + stat.assists;
            stats["PPP"] += stat.powerPlayPoints;
            stats["Shots"] += stat.shots;
            stats["Hits"] += 0;
            stats["Blocks"] += 0;
            stats["PlusMinus"] += stat.plusMinus;
          });
          return stats;
        })
      );
    }
  };

  await Promise.all([
    populateStat("forwards"),
    populateStat("defensemen"),
    populateStat("goalies"),
  ]);

  return {
    props: {
      teamName: current.team_name,
      lastUpdated,
      lineCombinations: current,
      teams,
    },
    revalidate: 60, // In seconds
  };
};

export const getStaticPaths: GetStaticPaths = async () => {
  const teams = (await getTeams()).map((team) => ({
    params: { abbreviation: team.abbreviation },
  }));

  return {
    paths: teams,
    fallback: false,
  };
};

type HeaderProps = {
  teamName: string;
  lastUpdated: string;
  sourceUrl: string;
  onTeamLogoClick: () => void;
};

function Header({
  teamName,
  lastUpdated,
  sourceUrl,
  onTeamLogoClick,
}: HeaderProps) {
  const names = teamName.split(" ");
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
            src={getTeamLogo(teamName)}
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
            src={getTeamLogo(teamName)}
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
