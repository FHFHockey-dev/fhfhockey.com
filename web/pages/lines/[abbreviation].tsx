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

import styles from "./[abbreviation].module.scss";

type Player = {
  playerId: number;
  playerName: string;
};

type Props = {
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
  }[];
};

export default function TeamLC({ teams, lineCombinations }: Props) {
  const router = useRouter();
  const { abbreviation } = router.query;
  const onTeamChange = (newAbbreviation: string) => {
    router.replace(`/lines/${newAbbreviation}`);
  };

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
          {/* <div style={{ width: 100, background: "red" }}>awdawd</div> */}
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
          teamName={lineCombinations.at(-1)?.team_name || ""}
          lastUpdated={
            lineCombinations.at(-1)?.date || new Date(2022, 10, 1).toString()
          }
        />
        <Container className={styles.mainContent}>
          <section className={styles.forwards}>
            <CategoryTitle type="large">FORWARDS</CategoryTitle>
            <Line className={styles.line} />
            <Line className={styles.line} />
            <Line className={styles.line} />
          </section>

          <section className={styles.defense}>
            <CategoryTitle type="large">DEFENSE</CategoryTitle>
            <Line className={styles.line} />
            <Line className={styles.line} />
            <Line className={styles.line} />
          </section>

          <section className={styles.goalies}>
            <CategoryTitle type="large">GOALIES</CategoryTitle>
            <Line className={styles.line} />
            <Line className={styles.line} />
            <Line className={styles.line} />
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

  const { data: line_combinations, error } = await supabase
    .from("line_combinations")
    .select("date, team_name, team_abbreviation, forwards, defensemen, goalies")
    .eq("team_abbreviation", params?.abbreviation)
    .order("date")
    .limit(2);

  if (error || line_combinations.length === 0) {
    return {
      notFound: true,
    };
  }

  return {
    props: {
      lineCombinations: line_combinations,
      teams,
    },
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
