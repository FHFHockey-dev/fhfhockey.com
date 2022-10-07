import React from "react";
import Image from "next/image";
import { useRouter } from "next/router";
import { NextSeo } from "next-seo";
import type { GetStaticPaths, GetStaticProps } from "next";

import supabase from "lib/supabase";
import { fetchNHL } from "lib/NHL/NHL_API";
import PageTitle from "components/PageTitle";
import Container from "components/Layout/Container";
import TeamSelect from "components/TeamSelect";
import TimeAgo from "components/TimeAgo";
import { getTeamLogo } from "hooks/usePlayer";
import Select from "components/Select";
import CategoryTitle from "components/LineCombinations/CategoryTitle";
import Line from "components/LineCombinations/Line";

import getLineChanges from "lib/NHL/getLineChanges";
import { memoizeAsync } from "utils/memoize";
import { LineChange } from "components/LineCombinations/PlayerCard/PlayerCard";
import Custom404 from "pages/404";

import styles from "./[abbreviation].module.scss";

export type Player = {
  playerId: number;
  playerName: string;
} & {
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

  // NOTE: workaround for weird vercel client side bug
  if (!teams || !lineCombinations) {
    return <Custom404 />;
  }

  return (
    <>
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

        <Header
          teamName={teamName}
          lastUpdated={lastUpdated || new Date(2022, 10, 1).toString()}
        />
        <Container className={styles.mainContent}>
          <section className={styles.forwards}>
            <CategoryTitle type="large">FORWARDS</CategoryTitle>
            <Line
              className={styles.line}
              columns={3}
              players={lineCombinations.forwards.line1}
            />
            <Line
              className={styles.line}
              columns={3}
              players={lineCombinations.forwards.line2}
            />
            <Line
              className={styles.line}
              columns={3}
              players={lineCombinations.forwards.line3}
            />
            <Line
              className={styles.line}
              columns={3}
              players={lineCombinations.forwards.line4}
            />
          </section>

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
        </Container>
      </Container>
    </>
  );
}

export const getStaticProps: GetStaticProps = async ({ params }) => {
  // for Team Select
  const teams = ((await fetchNHL("/teams")).teams as any[]).map((team) => ({
    shortName: team.teamName,
    name: team.name,
    abbreviation: team.abbreviation,
  }));

  const { promotions, demotions } = await memoizeAsync<
    ReturnType<typeof getLineChanges>
  >(getLineChanges, 5 * 60)();

  const { data: line_combinations, error } = await supabase
    .from("line_combinations")
    .select("date, team_name, team_abbreviation, forwards, defensemen, goalies")
    .eq("team_abbreviation", params?.abbreviation)
    .order("date")
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
  const seasonId: string = await fetchNHL("/seasons/current").then(
    (data) => data.seasons[0].seasonId
  );

  // populate each player object with last 10 GP stats
  const [_, current] = line_combinations as Props["lineCombinations"][];

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
          const jerseyNumber =
            (await fetchNHL(`/people/${playerId}`).then(
              ({ people }) => people[0].primaryNumber
            )) || 0;

          const games: any[] = await fetchNHL(
            `/people/${playerId}/stats?stats=gameLog&season=${seasonId}`
          ).then((data) => data.stats[0].splits.slice(0, 10));

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
          };
          games.forEach(({ stat }) => {
            stats["Goals"] += stat.goals;
            stats["Assists"] += stat.assists;
            stats["PTS"] += stat.goals + stat.assists;
            stats["PPP"] += stat.powerPlayPoints;
            stats["Shots"] += stat.shots;
            stats["Hits"] += stat.hits;
            stats["Blocks"] += stat.blocked;
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
  const teams = ((await fetchNHL("/teams")).teams as any[]).map((team) => ({
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
};

function Header({ teamName, lastUpdated }: HeaderProps) {
  const names = teamName.split(" ");
  return (
    <div className={styles.header}>
      <div className={styles.left}>
        <h2 className={styles.teamName}>
          {names.slice(0, -1).join(" ")}{" "}
          <span className={styles.highlight}>{names.at(-1)}</span>
        </h2>
        <div className={styles.time}>
          Updated: <TimeAgo date={lastUpdated} />
        </div>
      </div>
      <div className={styles.right}>
        <div className={styles.large}>
          <Image
            alt={teamName}
            src={getTeamLogo(teamName)}
            width={55}
            height={53}
            layout="fixed"
            objectFit="contain"
          />
        </div>

        <div className={styles.small}>
          <Image
            alt={teamName}
            src={getTeamLogo(teamName)}
            width={60}
            height={35}
            layout="fixed"
            objectFit="contain"
          />
        </div>
      </div>
    </div>
  );
}
