import React from "react";
import Head from "next/head";

import { TextBanner } from "../components/Banner/Banner";
import TeamStatCard from "../components/TeamStatCard";
import styles from "../styles/Stats.module.scss";
import { fetchNHL } from "../styles/NHL_API";

type Team = {
  abbreviation: string;
  name: string;
};
type StatsProps = {
  teams: Team[];
};
function Stats({ teams }: StatsProps) {
  return (
    <div>
      <Head>
        <title>FHFH | Stat Catalogue</title>
        <meta
          name="description"
          content="Five Hole Fantasy Hockey Podcast Stats for all teams in NHL."
        />
      </Head>
      <TextBanner text="Stat Catalogue" />

      <section className={styles.cards}>
        {teams.map((team) => (
          <TeamStatCard
            key={team.name}
            name={team.name}
            logo={`/teamCardPics/${team.abbreviation}.jpg`}
          />
        ))}
      </section>
    </div>
  );
}

export async function getStaticProps() {
  const teams = (await fetchNHL("teams").then((res) => res.teams)).map(
    ({ abbreviation, name }: Team) => ({
      abbreviation,
      name,
    })
  ) as Team[];
  return {
    props: {
      teams,
    },
  };
}

export default Stats;
