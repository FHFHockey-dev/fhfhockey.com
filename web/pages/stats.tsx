import React from "react";
import { NextSeo } from "next-seo";

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
      <NextSeo
        title="FHFH | Stat Catalogue"
        description="Five Hole Fantasy Hockey Podcast Stats for all teams in NHL."
      />

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

  // sort the teams in alphabetical order
  teams.sort((a, b) => a.name.localeCompare(b.name));

  return {
    props: {
      teams,
    },
  };
}

export default Stats;
